"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { getPolicy } from "@/lib/queries";
import { evidenceDeadline, pocDeadline, correctionDeadline, sodGate } from "@/lib/workflow";
import { parseDateInput } from "@/lib/dates";
import { appUrl, button, emailLayout, sendMail } from "@/lib/mailer";

export type ActionState = { error?: string; ok?: string; blockers?: string[] } | null;

export async function createInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const homeId = String(formData.get("homeId") ?? "");
  const type = String(formData.get("type") ?? "FULL");
  const surveyNumber = String(formData.get("surveyNumber") ?? "").trim() || null;
  const scopeNote = String(formData.get("scopeNote") ?? "").trim() || null;
  const enteredAt = parseDateInput(formData.get("enteredAt")) ?? new Date();

  if (!homeId) return { error: "Choose the licensed home this inspection covers." };

  if (surveyNumber) {
    const clash = await prisma.inspection.findUnique({ where: { surveyNumber } });
    if (clash) return { error: `Survey number ${surveyNumber} is already in use.` };
  }

  const inspection = await prisma.inspection.create({
    data: {
      homeId,
      type,
      surveyNumber,
      scopeNote,
      enteredAt,
      leadInspectorId: user.id,
      status: "ONSITE",
    },
    include: { home: true },
  });

  await recordAudit({
    actor: user,
    action: "INSPECTION_CREATED",
    entityType: "Inspection",
    entityId: inspection.id,
    inspectionId: inspection.id,
    summary: `${type} inspection opened for ${inspection.home.name}.`,
  });

  redirect(`/inspections/${inspection.id}`);
}

/**
 * Close the exit conference and open the evidence window. Every finding still
 * in draft is shared with the provider at this moment, each one inherits the
 * deadline, and the provider is notified — this is the handoff the product
 * exists to make reliable.
 */
export async function openEvidenceWindow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const exitConferenceAt = parseDateInput(formData.get("exitConferenceAt")) ?? new Date();

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { home: { include: { contacts: true } }, findings: true },
  });
  if (!inspection) return { error: "Inspection not found." };

  const drafts = inspection.findings.filter((f) => f.status === "DRAFT");
  if (drafts.length === 0 && inspection.findings.length === 0) {
    return { error: "Add at least one finding before opening the evidence window." };
  }

  const policy = await getPolicy(user.agencyId);
  const dueAt = evidenceDeadline(exitConferenceAt, policy);

  await prisma.$transaction([
    prisma.inspection.update({
      where: { id: inspectionId },
      data: { status: "EVIDENCE_OPEN", exitConferenceAt, evidenceDueAt: dueAt },
    }),
    prisma.finding.updateMany({
      where: { inspectionId, status: "DRAFT" },
      data: { status: "PENDING_EVIDENCE", sharedAt: new Date(), evidenceDueAt: dueAt },
    }),
  ]);

  await recordAudit({
    actor: user,
    action: "EXIT_CONFERENCE_RECORDED",
    entityType: "Inspection",
    entityId: inspectionId,
    inspectionId,
    summary: `Exit conference recorded; ${drafts.length} finding(s) shared with the provider.`,
    meta: { evidenceDueAt: dueAt.toISOString() },
  });

  for (const contact of inspection.home.contacts) {
    await sendMail({
      to: contact.email,
      kind: "FINDINGS_SHARED",
      subject: `${inspection.home.name}: ${inspection.findings.length} finding(s) need documentation`,
      html: emailLayout(
        "Your inspection findings are ready",
        `<p>${user.name} has finished the inspection at <strong>${inspection.home.name}</strong> and shared the preliminary findings with you.</p>
         <p>Each finding lists exactly what the licensor is asking for. Upload your documents against the finding they answer — not by email — so there is a record of what you sent and when.</p>
         <p><strong>Your documents are due ${dueAt.toLocaleDateString("en-US", { dateStyle: "long" })}.</strong></p>
         ${button("Open your findings", appUrl("/portal"))}`,
      ),
    });
  }

  revalidatePath(`/inspections/${inspectionId}`);
  return { ok: "Evidence window opened and the provider has been notified." };
}

export async function extendEvidenceWindow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const newDue = parseDateInput(formData.get("evidenceDueAt"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!newDue) return { error: "Choose a new deadline." };
  if (!reason) return { error: "Record the reason for the change — it goes on the record." };

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection) return { error: "Inspection not found." };

  newDue.setHours(23, 59, 59, 999);

  await prisma.$transaction([
    prisma.inspection.update({
      where: { id: inspectionId },
      data: { evidenceDueAt: newDue, evidenceExtendedReason: reason },
    }),
    prisma.finding.updateMany({
      where: { inspectionId, status: { in: ["PENDING_EVIDENCE", "EVIDENCE_RECEIVED"] } },
      data: { evidenceDueAt: newDue },
    }),
  ]);

  await recordAudit({
    actor: user,
    action: "EVIDENCE_DEADLINE_EXTENDED",
    entityType: "Inspection",
    entityId: inspectionId,
    inspectionId,
    summary: `Evidence deadline changed to ${newDue.toLocaleDateString("en-US")}: ${reason}`,
  });

  revalidatePath(`/inspections/${inspectionId}`);
  return { ok: "Deadline updated. The provider sees the new date immediately." };
}

/**
 * Issue the statement of deficiencies. Refuses while any finding is
 * undetermined or an immediate jeopardy citation is unapproved.
 */
export async function issueStatement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const summary = String(formData.get("summary") ?? "").trim() || null;

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      home: { include: { contacts: true } },
      findings: { include: { determination: true } },
    },
  });
  if (!inspection) return { error: "Inspection not found." };
  if (inspection.sodIssuedAt) return { error: "This statement of deficiencies has already been issued." };

  const gate = sodGate(inspection.findings);
  if (gate.blockers.length > 0) return { blockers: gate.blockers };

  const policy = await getPolicy(user.agencyId);
  const issuedAt = new Date();
  const cited = inspection.findings.filter((f) => f.determination?.outcome === "CITATION");

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: "SOD_ISSUED", sodIssuedAt: issuedAt, summary },
  });

  await prisma.citation.updateMany({
    where: { findingId: { in: cited.map((f) => f.id) } },
    data: {
      pocDueAt: pocDeadline(issuedAt, policy),
      correctionDueAt: correctionDeadline(issuedAt, policy),
    },
  });

  await recordAudit({
    actor: user,
    action: "SOD_ISSUED",
    entityType: "Inspection",
    entityId: inspectionId,
    inspectionId,
    summary: `Statement of deficiencies issued with ${cited.length} citation(s).`,
  });

  for (const contact of inspection.home.contacts) {
    await sendMail({
      to: contact.email,
      kind: "SOD_ISSUED",
      subject: `${inspection.home.name}: statement of deficiencies issued`,
      html: emailLayout(
        "Your statement of deficiencies is available",
        `<p>The inspection at <strong>${inspection.home.name}</strong> is complete. ${cited.length} finding(s) were cited.</p>
         <p>Sign in to acknowledge receipt, read the determination and rationale on each finding, submit your plan of correction, and — if you disagree — request informal dispute resolution.</p>
         ${button("Open the statement", appUrl("/portal"))}`,
      ),
    });
  }

  revalidatePath(`/inspections/${inspectionId}`);
  return { ok: "Statement of deficiencies issued." };
}

export async function closeInspection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const inspectionId = String(formData.get("inspectionId") ?? "");

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await recordAudit({
    actor: user,
    action: "INSPECTION_STATUS_CHANGED",
    entityType: "Inspection",
    entityId: inspectionId,
    inspectionId,
    summary: "Inspection closed.",
  });
  revalidatePath(`/inspections/${inspectionId}`);
  return { ok: "Inspection closed." };
}
