"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { nextFindingTag } from "@/lib/workflow";
import { parseDateInput } from "@/lib/dates";
import { appUrl, button, emailLayout, sendMail } from "@/lib/mailer";
import type { ActionState } from "./inspections";

export async function createFinding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const wacCite = String(formData.get("wacCite") ?? "").trim();
  const requirementText = String(formData.get("requirementText") ?? "").trim();
  const practiceText = String(formData.get("practiceText") ?? "").trim();
  const scope = String(formData.get("scope") ?? "ISOLATED");
  const harm = String(formData.get("harm") ?? "POTENTIAL_HARM");
  const prompt = String(formData.get("prompt") ?? "").trim();

  if (!wacCite) return { error: "Enter the citation this finding is written under." };
  if (!requirementText) return { error: "State what the rule requires." };
  if (!practiceText) return { error: "Describe the practice that fell short." };

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { findings: { select: { tag: true } } },
  });
  if (!inspection) return { error: "Inspection not found." };

  const finding = await prisma.finding.create({
    data: {
      inspectionId,
      tag: nextFindingTag(inspection.findings.map((f) => f.tag)),
      wacCite,
      requirementText,
      practiceText,
      scope,
      harm,
      createdById: user.id,
      evidenceDueAt: inspection.evidenceDueAt,
      // A finding added after the window is already open is shared straight
      // away — holding it back would quietly shorten the provider's clock.
      status: inspection.status === "EVIDENCE_OPEN" ? "PENDING_EVIDENCE" : "DRAFT",
      sharedAt: inspection.status === "EVIDENCE_OPEN" ? new Date() : null,
    },
  });

  if (prompt) {
    await prisma.evidenceRequest.create({
      data: {
        findingId: finding.id,
        prompt,
        dueAt: inspection.evidenceDueAt,
        requestedById: user.id,
      },
    });
  }

  await recordAudit({
    actor: user,
    action: "FINDING_CREATED",
    entityType: "Finding",
    entityId: finding.id,
    inspectionId,
    summary: `${finding.tag} drafted under ${wacCite}.`,
  });

  revalidatePath(`/inspections/${inspectionId}`);
  return { ok: `${finding.tag} added.` };
}

export async function addEvidenceSource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const findingId = String(formData.get("findingId") ?? "");
  const kind = String(formData.get("kind") ?? "OBSERVATION");
  const detail = String(formData.get("detail") ?? "").trim();
  const gatheredAt = parseDateInput(formData.get("gatheredAt"));

  if (!detail) return { error: "Describe the source — what was observed, who was interviewed, which record." };

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding) return { error: "Finding not found." };

  await prisma.evidenceSource.create({ data: { findingId, kind, detail, gatheredAt } });
  await recordAudit({
    actor: user,
    action: "EVIDENCE_SOURCE_ADDED",
    entityType: "Finding",
    entityId: findingId,
    inspectionId: finding.inspectionId,
    summary: `${kind} source added to ${finding.tag}.`,
  });

  revalidatePath(`/findings/${findingId}`);
  return { ok: "Source recorded." };
}

/** Ask the provider for something specific, with the ask on the record. */
export async function requestEvidence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const findingId = String(formData.get("findingId") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return { error: "Say what you need the provider to send." };

  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: { inspection: { include: { home: { include: { contacts: true } } } } },
  });
  if (!finding) return { error: "Finding not found." };

  await prisma.evidenceRequest.create({
    data: {
      findingId,
      prompt,
      dueAt: finding.evidenceDueAt ?? finding.inspection.evidenceDueAt,
      requestedById: user.id,
    },
  });

  await recordAudit({
    actor: user,
    action: "EVIDENCE_REQUEST_CREATED",
    entityType: "Finding",
    entityId: findingId,
    inspectionId: finding.inspectionId,
    summary: `Evidence requested on ${finding.tag}: ${prompt.slice(0, 120)}`,
  });

  if (finding.sharedAt) {
    for (const contact of finding.inspection.home.contacts) {
      await sendMail({
        to: contact.email,
        kind: "REMINDER",
        subject: `${finding.inspection.home.name}: a document was requested on ${finding.tag}`,
        html: emailLayout(
          "A new document request",
          `<p>${user.name} has asked for something on finding ${finding.tag}. Sign in to read the request and upload your response.</p>
           ${button("Open the finding", appUrl("/portal"))}`,
        ),
      });
    }
  }

  revalidatePath(`/findings/${findingId}`);
  return { ok: "Request sent." };
}

/** Share a single draft finding without waiting for the exit conference step. */
export async function shareFinding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const findingId = String(formData.get("findingId") ?? "");

  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: { inspection: true },
  });
  if (!finding) return { error: "Finding not found." };
  if (finding.status !== "DRAFT") return { error: "This finding has already been shared." };

  await prisma.finding.update({
    where: { id: findingId },
    data: {
      status: "PENDING_EVIDENCE",
      sharedAt: new Date(),
      evidenceDueAt: finding.evidenceDueAt ?? finding.inspection.evidenceDueAt,
    },
  });

  await recordAudit({
    actor: user,
    action: "FINDING_SHARED",
    entityType: "Finding",
    entityId: findingId,
    inspectionId: finding.inspectionId,
    summary: `${finding.tag} shared with the provider.`,
  });

  revalidatePath(`/findings/${findingId}`);
  return { ok: "Shared with the provider." };
}

export async function withdrawFinding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const findingId = String(formData.get("findingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Record why the finding is being withdrawn." };

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding) return { error: "Finding not found." };
  if (finding.status === "DETERMINED") {
    return { error: "This finding has a determination. Withdrawing it now would rewrite a decision already given to the provider." };
  }

  await prisma.$transaction([
    prisma.finding.update({ where: { id: findingId }, data: { status: "WITHDRAWN" } }),
    prisma.findingNote.create({
      data: { findingId, authorId: user.id, visibility: "SHARED", body: `Withdrawn: ${reason}` },
    }),
  ]);

  await recordAudit({
    actor: user,
    action: "FINDING_WITHDRAWN",
    entityType: "Finding",
    entityId: findingId,
    inspectionId: finding.inspectionId,
    summary: `${finding.tag} withdrawn: ${reason}`,
  });

  revalidatePath(`/findings/${findingId}`);
  return { ok: "Finding withdrawn." };
}

export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const findingId = String(formData.get("findingId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const visibility = String(formData.get("visibility") ?? "SHARED");
  if (!body) return { error: "Write something first." };

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding) return { error: "Finding not found." };

  await prisma.findingNote.create({ data: { findingId, authorId: user.id, body, visibility } });
  await recordAudit({
    actor: user,
    action: "NOTE_ADDED",
    entityType: "Finding",
    entityId: findingId,
    inspectionId: finding.inspectionId,
    summary: `${visibility === "INTERNAL" ? "Internal note" : "Note to provider"} added on ${finding.tag}.`,
  });

  revalidatePath(`/findings/${findingId}`);
  return { ok: "Note added." };
}
