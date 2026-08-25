"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHome } from "@/lib/auth";
import { addMonths, parseDateInput } from "@/lib/dates";
import { deleteFile, saveUpload, StorageError } from "@/lib/storage";

function str(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

function backTo(formData: FormData, fallback = "/documents"): string {
  const raw = formData.get("returnTo");
  // Only same-origin relative paths, so a crafted form can't turn an upload
  // into an open redirect.
  if (typeof raw === "string" && /^\/[A-Za-z0-9/_\-?=&.%]*$/.test(raw)) return raw;
  return fallback;
}

export async function uploadDocumentAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const returnTo = backTo(formData);

  const documentTypeId = String(formData.get("documentTypeId") ?? "");
  const documentType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
  });
  if (!documentType) {
    redirect(`${returnTo}?error=${encodeURIComponent("Pick a document type.")}`);
  }

  const residentId = str(formData.get("residentId"));
  const employeeId = str(formData.get("employeeId"));

  // Confirm the subject belongs to this home before attaching anything to it.
  if (residentId) {
    const owned = await prisma.resident.count({
      where: { id: residentId, homeId: user.homeId },
    });
    if (!owned) redirect(`${returnTo}?error=${encodeURIComponent("Unknown resident.")}`);
  }
  if (employeeId) {
    const owned = await prisma.employee.count({
      where: { id: employeeId, homeId: user.homeId },
    });
    if (!owned) redirect(`${returnTo}?error=${encodeURIComponent("Unknown employee.")}`);
  }

  if (documentType.scope === "RESIDENT" && !residentId) {
    redirect(`${returnTo}?error=${encodeURIComponent(`${documentType.name} has to be filed under a resident.`)}`);
  }
  if (documentType.scope === "EMPLOYEE" && !employeeId) {
    redirect(`${returnTo}?error=${encodeURIComponent(`${documentType.name} has to be filed under an employee.`)}`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${returnTo}?error=${encodeURIComponent("Choose a file to upload.")}`);
  }

  const stored = await saveUpload(user.homeId, file).catch((err: unknown) => {
    // StorageError carries a message written for the provider; anything else is
    // a real fault and gets a generic one.
    const message =
      err instanceof StorageError ? err.message : "That file could not be saved.";
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`);
  });

  const issuedAt = parseDateInput(formData.get("issuedAt"));
  let expiresAt = parseDateInput(formData.get("expiresAt"));

  // Most providers know the issue date and not the renewal interval, so derive
  // the expiry when the type defines one and no explicit date was given.
  if (!expiresAt && issuedAt && documentType.renewalMonths) {
    expiresAt = addMonths(issuedAt, documentType.renewalMonths);
  }

  await prisma.document.create({
    data: {
      homeId: user.homeId,
      documentTypeId: documentType.id,
      residentId: documentType.scope === "RESIDENT" ? residentId : null,
      employeeId: documentType.scope === "EMPLOYEE" ? employeeId : null,
      title: str(formData.get("title")) ?? documentType.name,
      fileName: file.name,
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      issuedAt,
      expiresAt,
      notes: str(formData.get("notes")),
      uploadedById: user.id,
    },
  });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  revalidatePath("/binder");
  redirect(`${returnTo}?uploaded=1`);
}

export async function updateDocumentDatesAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const returnTo = backTo(formData);
  const id = String(formData.get("id") ?? "");

  const doc = await prisma.document.findFirst({
    where: { id, homeId: user.homeId },
    include: { documentType: true },
  });
  if (!doc) redirect(`${returnTo}?error=${encodeURIComponent("Document not found.")}`);

  const issuedAt = parseDateInput(formData.get("issuedAt"));
  let expiresAt = parseDateInput(formData.get("expiresAt"));
  if (!expiresAt && issuedAt && doc.documentType.renewalMonths) {
    expiresAt = addMonths(issuedAt, doc.documentType.renewalMonths);
  }

  await prisma.document.update({
    where: { id },
    data: { issuedAt, expiresAt, notes: str(formData.get("notes")) },
  });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?saved=1`);
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const returnTo = backTo(formData);
  const id = String(formData.get("id") ?? "");

  const doc = await prisma.document.findFirst({ where: { id, homeId: user.homeId } });
  if (doc) {
    await prisma.document.delete({ where: { id } });
    // Remove the bytes only after the row is gone, so a failed delete never
    // leaves a record pointing at a file that no longer exists.
    if (doc.storageKey) await deleteFile(doc.storageKey);
  }

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  revalidatePath("/binder");
  redirect(`${returnTo}?deleted=1`);
}

/** Providers can extend the catalog with document types the state asks them for. */
export async function createDocumentTypeAction(formData: FormData): Promise<void> {
  await requireHome();
  const returnTo = backTo(formData, "/settings/document-types");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`${returnTo}?error=${encodeURIComponent("Give the document type a name.")}`);

  const scope = String(formData.get("scope") ?? "HOME");
  const renewalRaw = Number(formData.get("renewalMonths"));
  const renewalMonths =
    Number.isFinite(renewalRaw) && renewalRaw > 0 ? Math.round(renewalRaw) : null;

  const code = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now().toString(36)}`;

  await prisma.documentType.create({
    data: {
      code,
      name,
      description: str(formData.get("description")),
      scope: ["HOME", "RESIDENT", "EMPLOYEE"].includes(scope) ? scope : "HOME",
      category: str(formData.get("category")) ?? "Custom",
      wacCite: str(formData.get("wacCite")),
      renewalMonths,
      isSystem: false,
    },
  });

  revalidatePath("/settings/document-types");
  revalidatePath("/documents");
  redirect(`${returnTo}?saved=1`);
}
