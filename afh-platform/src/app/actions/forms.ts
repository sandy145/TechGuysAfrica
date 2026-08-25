"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { FormInstance, FormTemplate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomToken, requireHome } from "@/lib/auth";
import { emailLayout, sendMail } from "@/lib/mailer";
import { addDays, parseDateInput } from "@/lib/dates";
import { collectValues, fillTokens, renderBody } from "@/lib/forms/render";
import {
  contextTokens,
  instanceValues,
  templateFields,
  templateSigners,
} from "@/lib/forms/instance";

const SIGNING_LINK_DAYS = 21;

const CONSENT_TEXT =
  "By signing below I confirm that I have read this document and that my electronic signature " +
  "is the legal equivalent of my handwritten signature.";

export async function createFormInstanceAction(formData: FormData): Promise<void> {
  const user = await requireHome();

  const templateId = String(formData.get("templateId") ?? "");
  const template = await prisma.formTemplate.findUnique({ where: { id: templateId } });
  if (!template) redirect("/forms?error=Unknown%20form.");

  const residentId = str(formData.get("residentId"));
  const employeeId = str(formData.get("employeeId"));

  if (template.subjectType === "RESIDENT" && !residentId) {
    redirect(`/forms/${templateId}/new?error=${encodeURIComponent("Choose the resident this form is about.")}`);
  }
  if (template.subjectType === "EMPLOYEE" && !employeeId) {
    redirect(`/forms/${templateId}/new?error=${encodeURIComponent("Choose the employee this form is about.")}`);
  }

  // Never let a form be attached to another home's resident.
  if (residentId) {
    const owned = await prisma.resident.count({ where: { id: residentId, homeId: user.homeId } });
    if (!owned) redirect("/forms?error=Unknown%20resident.");
  }
  if (employeeId) {
    const owned = await prisma.employee.count({ where: { id: employeeId, homeId: user.homeId } });
    if (!owned) redirect("/forms?error=Unknown%20employee.");
  }

  const fields = templateFields(template);
  const values = collectValues(formData, fields);

  const instance = await prisma.formInstance.create({
    data: {
      homeId: user.homeId,
      templateId: template.id,
      residentId: template.subjectType === "RESIDENT" ? residentId : null,
      employeeId: template.subjectType === "EMPLOYEE" ? employeeId : null,
      status: "DRAFT",
      dataJson: JSON.stringify(values),
      effectiveAt: parseDateInput(formData.get("effectiveAt")) ?? new Date(),
      createdById: user.id,
      signatures: {
        create: templateSigners(template).map((signer) => ({
          signerKey: signer.key,
          signerLabel: signer.label,
        })),
      },
    },
  });

  revalidatePath("/forms");
  redirect(`/forms/instances/${instance.id}`);
}

export async function updateFormInstanceAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const id = String(formData.get("id") ?? "");

  const instance = await prisma.formInstance.findFirst({
    where: { id, homeId: user.homeId },
    include: { template: true },
  });
  if (!instance) redirect("/forms?error=Form%20not%20found.");

  if (instance.status === "COMPLETED") {
    redirect(`/forms/instances/${id}?error=${encodeURIComponent("This form is already signed and can't be edited. Void it and start a new one.")}`);
  }

  const values = collectValues(formData, templateFields(instance.template));

  await prisma.formInstance.update({
    where: { id },
    data: {
      dataJson: JSON.stringify(values),
      effectiveAt: parseDateInput(formData.get("effectiveAt")) ?? instance.effectiveAt,
    },
  });

  revalidatePath(`/forms/instances/${id}`);
  redirect(`/forms/instances/${id}?saved=1`);
}

/**
 * Issue a tokenized signing link for a signer who has no platform account —
 * typically a resident's family member or legal representative.
 */
export async function requestSignatureAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const signatureId = String(formData.get("signatureId") ?? "");
  const email = String(formData.get("signerEmail") ?? "").trim();
  const name = String(formData.get("signerName") ?? "").trim();

  const signature = await prisma.signature.findFirst({
    where: { id: signatureId, formInstance: { homeId: user.homeId } },
    include: { formInstance: { include: { template: true, resident: true } } },
  });
  if (!signature) redirect("/forms?error=Signature%20request%20not%20found.");

  const instanceId = signature.formInstanceId;

  if (signature.formInstance.status === "VOIDED") {
    redirect(`/forms/instances/${instanceId}?error=${encodeURIComponent("This form is voided. Start a new one before requesting signatures.")}`);
  }
  if (signature.signedAt) {
    redirect(`/forms/instances/${instanceId}?error=${encodeURIComponent(`${signature.signerLabel} has already signed.`)}`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`/forms/instances/${instanceId}?error=${encodeURIComponent("Enter a valid email address for the signer.")}`);
  }

  const token = randomToken(32);
  await prisma.signature.update({
    where: { id: signatureId },
    data: {
      signerEmail: email,
      signerName: name || null,
      accessToken: token,
      tokenExpiresAt: addDays(new Date(), SIGNING_LINK_DAYS),
    },
  });

  // Only a draft moves to "awaiting signatures". A form whose required signers
  // are already in stays COMPLETED — collecting an optional extra signature
  // afterwards must not un-finalise a document that has been filed.
  if (signature.formInstance.status === "DRAFT") {
    await prisma.formInstance.update({
      where: { id: instanceId },
      data: { status: "AWAITING_SIGNATURES" },
    });
  }

  const base = process.env.APP_URL || "http://localhost:3000";
  const link = `${base}/sign/${token}`;
  const home = await prisma.home.findUnique({ where: { id: user.homeId } });

  await sendMail({
    to: email,
    kind: "SIGNATURE_REQUEST",
    subject: `Signature requested: ${signature.formInstance.template.title}`,
    html: emailLayout(
      `${home?.name ?? "Your adult family home"} needs your signature`,
      `<p style="margin:0 0 16px;">${escapeHtml(name || "Hello")},</p>
       <p style="margin:0 0 16px;">You have been asked to sign <strong>${escapeHtml(signature.formInstance.template.title)}</strong>${
         signature.formInstance.resident
           ? ` for ${escapeHtml(`${signature.formInstance.resident.firstName} ${signature.formInstance.resident.lastName}`)}`
           : ""
       }.</p>
       <p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;background:#1f6459;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Read and sign the document</a></p>
       <p style="margin:0;font-size:13px;color:#6b7a80;">This link is private to you and expires in ${SIGNING_LINK_DAYS} days.</p>`,
      "You received this because an adult family home requested your signature on a care document.",
    ),
    text: `Please sign "${signature.formInstance.template.title}": ${link}`,
  });

  revalidatePath(`/forms/instances/${instanceId}`);
  redirect(`/forms/instances/${instanceId}?requested=${encodeURIComponent(signatureId)}`);
}

/** Sign as a logged-in member of the home. */
export async function signInternalAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const signatureId = String(formData.get("signatureId") ?? "");

  const signature = await prisma.signature.findFirst({
    where: { id: signatureId, formInstance: { homeId: user.homeId } },
  });
  if (!signature) redirect("/forms?error=Signature%20not%20found.");

  await applySignature(signatureId, {
    typedName: String(formData.get("typedName") ?? "").trim() || user.name,
    imageData: String(formData.get("imageData") ?? ""),
  });

  revalidatePath(`/forms/instances/${signature.formInstanceId}`);
  redirect(`/forms/instances/${signature.formInstanceId}?signed=1`);
}

/** Sign through a tokenized link, with no account. */
export async function signRemoteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");

  const signature = await prisma.signature.findUnique({ where: { accessToken: token } });
  if (
    !signature ||
    signature.signedAt ||
    (signature.tokenExpiresAt && signature.tokenExpiresAt < new Date())
  ) {
    redirect(`/sign/${token}?error=${encodeURIComponent("This signing link is no longer valid.")}`);
  }

  const typedName = String(formData.get("typedName") ?? "").trim();
  if (!typedName) {
    redirect(`/sign/${token}?error=${encodeURIComponent("Type your full name to sign.")}`);
  }

  await applySignature(signature.id, {
    typedName,
    imageData: String(formData.get("imageData") ?? ""),
  });

  redirect(`/sign/${token}?done=1`);
}

/**
 * Record one signature, then complete the form if every required signer is in.
 * Completing snapshots the rendered body and files a Document, so later edits
 * to the template can never rewrite what someone actually signed.
 */
async function applySignature(
  signatureId: string,
  input: { typedName: string; imageData: string },
): Promise<void> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");

  await prisma.signature.update({
    where: { id: signatureId },
    data: {
      typedName: input.typedName,
      signerName: input.typedName,
      // Only accept an inline PNG data URL; anything else is dropped rather
      // than stored and later rendered into an <img>.
      imageData: /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.imageData)
        ? input.imageData
        : null,
      signedAt: new Date(),
      ipAddress: forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip"),
      userAgent: headerList.get("user-agent"),
      consentText: CONSENT_TEXT,
      // Burn the link so a forwarded email can't be reused.
      accessToken: null,
    },
  });

  const signature = await prisma.signature.findUnique({
    where: { id: signatureId },
    select: { formInstanceId: true },
  });
  if (!signature) return;

  await maybeComplete(signature.formInstanceId);
}

async function maybeComplete(instanceId: string): Promise<void> {
  const instance = await prisma.formInstance.findUnique({
    where: { id: instanceId },
    include: { template: true, signatures: true },
  });
  if (!instance || instance.status === "COMPLETED" || instance.status === "VOIDED") return;

  const signers = templateSigners(instance.template);
  const required = signers.filter((s) => s.required !== false).map((s) => s.key);
  const signedKeys = new Set(
    instance.signatures.filter((s) => s.signedAt).map((s) => s.signerKey),
  );

  if (!required.every((key) => signedKeys.has(key))) {
    await prisma.formInstance.update({
      where: { id: instanceId },
      data: { status: "AWAITING_SIGNATURES" },
    });
    return;
  }

  const rendered = renderBody(
    fillTokens(
      instance.template.bodyTemplate,
      instanceValues(instance),
      templateFields(instance.template),
      await contextTokens(instance),
    ),
  );

  await prisma.formInstance.update({
    where: { id: instanceId },
    data: { status: "COMPLETED", completedAt: new Date(), renderedBody: rendered },
  });

  await fileCompletedForm(instanceId);
}

/** File the completed form into the vault so it counts toward compliance. */
async function fileCompletedForm(instanceId: string): Promise<void> {
  const instance = await prisma.formInstance.findUnique({
    where: { id: instanceId },
    include: { template: true, document: true },
  });
  if (!instance || instance.document) return;

  const code = instance.template.documentTypeCode;
  if (!code) return;

  const documentType = await prisma.documentType.findUnique({ where: { code } });
  if (!documentType) return;

  await prisma.document.create({
    data: {
      homeId: instance.homeId,
      documentTypeId: documentType.id,
      residentId: documentType.scope === "RESIDENT" ? instance.residentId : null,
      employeeId: documentType.scope === "EMPLOYEE" ? instance.employeeId : null,
      title: instance.template.title,
      issuedAt: instance.effectiveAt ?? instance.completedAt ?? new Date(),
      notes: "Generated and signed in the platform.",
      formInstanceId: instance.id,
    },
  });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  revalidatePath("/binder");
}

export async function voidFormInstanceAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const id = String(formData.get("id") ?? "");

  const instance = await prisma.formInstance.findFirst({
    where: { id, homeId: user.homeId },
  });
  if (!instance) redirect("/forms?error=Form%20not%20found.");

  await prisma.formInstance.update({
    where: { id },
    data: { status: "VOIDED" },
  });
  // Invalidate any outstanding signing links on a voided form.
  await prisma.signature.updateMany({
    where: { formInstanceId: id, signedAt: null },
    data: { accessToken: null, tokenExpiresAt: null },
  });

  revalidatePath("/forms");
  redirect(`/forms/instances/${id}?voided=1`);
}

function str(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
