"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAgency, requireSupervisor } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { getPolicy } from "@/lib/queries";
import {
  determinationGate,
  gateAllows,
  snapshotEvidence,
  type FindingShape,
  type SubmissionShape,
} from "@/lib/workflow";
import { appUrl, button, emailLayout, sendMail } from "@/lib/mailer";
import { OUTCOME_LABELS, type Outcome } from "@/lib/constants";
import type { ActionState } from "./inspections";

/**
 * Mark a provider submission reviewed. Reviewing is a deliberate act with a
 * name and a timestamp on it, because "I read it" is exactly the fact that is
 * unprovable when this happens over email.
 */
export async function reviewSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const submissionId = String(formData.get("submissionId") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { finding: true, files: true },
  });
  if (!submission) return { error: "Submission not found." };

  const unopened = submission.files.filter((f) => !f.firstOpenedAt);
  if (unopened.length > 0) {
    return {
      error: `Open ${unopened.length === 1 ? "the file" : `all ${unopened.length} files`} before marking this reviewed — ${unopened
        .map((f) => f.fileName)
        .join(", ")}.`,
    };
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { reviewedAt: new Date(), reviewedById: user.id, reviewNote },
  });

  await prisma.evidenceRequest.updateMany({
    where: { id: submission.evidenceRequestId ?? "", status: "OPEN" },
    data: { status: "ANSWERED" },
  });

  await recordAudit({
    actor: user,
    action: "SUBMISSION_REVIEWED",
    entityType: "Submission",
    entityId: submissionId,
    inspectionId: submission.finding.inspectionId,
    summary: `Submission on ${submission.finding.tag} reviewed${reviewNote ? `: ${reviewNote.slice(0, 100)}` : "."}`,
  });

  revalidatePath(`/findings/${submission.findingId}`);
  return { ok: "Marked reviewed." };
}

/**
 * Record the determination. The gate runs here, on the server, on the same
 * path as the write — not in the browser, where it could be skipped.
 */
export async function recordDetermination(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const findingId = String(formData.get("findingId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as Outcome;
  const rationale = String(formData.get("rationale") ?? "").trim();
  const overrideReason = String(formData.get("overrideReason") ?? "").trim() || null;

  if (!["NO_DEFICIENCY", "CONSULTATION", "CITATION"].includes(outcome)) {
    return { error: "Choose an outcome." };
  }
  if (rationale.length < 20) {
    return {
      error:
        "Write the rationale. It is what the provider reads, what informal dispute resolution reviews, and what a hearing looks at.",
    };
  }

  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: {
      sources: true,
      submissions: { include: { files: true } },
      inspection: { include: { home: { include: { contacts: true } } } },
    },
  });
  if (!finding) return { error: "Finding not found." };

  const policy = await getPolicy(user.agencyId);
  const shape: FindingShape = {
    id: finding.id,
    tag: finding.tag,
    status: finding.status,
    harm: finding.harm,
    sharedAt: finding.sharedAt,
    evidenceDueAt: finding.evidenceDueAt,
    sources: finding.sources,
    submissions: finding.submissions as unknown as SubmissionShape[],
  };

  const gate = determinationGate({ finding: shape, outcome, policy, actorRole: user.role });
  if (!gateAllows(gate, overrideReason)) {
    return {
      blockers:
        gate.blockers.length > 0
          ? gate.blockers
          : ["Record the supervisor's reason for proceeding past the items above."],
    };
  }

  const noResponse = finding.submissions.length === 0;

  const determination = await prisma.determination.create({
    data: {
      findingId,
      outcome,
      rationale,
      noProviderResponse: noResponse,
      overrideReason: gate.overridable.length > 0 ? overrideReason : null,
      decidedById: user.id,
      evidenceConsideredJson: JSON.stringify(
        snapshotEvidence(finding.submissions as unknown as SubmissionShape[]),
      ),
    },
  });

  await prisma.finding.update({ where: { id: findingId }, data: { status: "DETERMINED" } });

  if (outcome === "CITATION") {
    await prisma.citation.create({ data: { findingId, status: "PENDING_POC" } });
  }

  await recordAudit({
    actor: user,
    action: "DETERMINATION_RECORDED",
    entityType: "Determination",
    entityId: determination.id,
    inspectionId: finding.inspectionId,
    summary: `${finding.tag} determined: ${OUTCOME_LABELS[outcome]}${
      overrideReason ? " (with supervisor override)" : ""
    }.`,
    meta: {
      outcome,
      evidenceSources: finding.sources.length,
      submissionsConsidered: finding.submissions.length,
      noProviderResponse: noResponse,
    },
  });

  // The provider hears the outcome from the system, not from silence followed
  // by a letter.
  for (const contact of finding.inspection.home.contacts) {
    await sendMail({
      to: contact.email,
      kind: "DETERMINATION",
      subject: `${finding.inspection.home.name}: a decision was recorded on ${finding.tag}`,
      html: emailLayout(
        `Finding ${finding.tag}: ${OUTCOME_LABELS[outcome]}`,
        `<p>A determination has been recorded on finding ${finding.tag}. Sign in to read the rationale and see exactly which documents it was based on.</p>
         ${button("Open the finding", appUrl("/portal"))}`,
      ),
    });
  }

  revalidatePath(`/findings/${findingId}`);
  revalidatePath(`/inspections/${finding.inspectionId}`);
  return { ok: `Determination recorded: ${OUTCOME_LABELS[outcome]}.` };
}

/** Second signature on an immediate jeopardy citation. */
export async function approveDetermination(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireSupervisor();
  const determinationId = String(formData.get("determinationId") ?? "");

  const determination = await prisma.determination.findUnique({
    where: { id: determinationId },
    include: { finding: true },
  });
  if (!determination) return { error: "Determination not found." };
  if (determination.decidedById === user.id) {
    return { error: "A determination cannot be approved by the person who made it." };
  }

  await prisma.determination.update({
    where: { id: determinationId },
    data: { approvedById: user.id, approvedAt: new Date() },
  });

  await recordAudit({
    actor: user,
    action: "DETERMINATION_APPROVED",
    entityType: "Determination",
    entityId: determinationId,
    inspectionId: determination.finding.inspectionId,
    summary: `${determination.finding.tag} determination approved.`,
  });

  revalidatePath(`/findings/${determination.findingId}`);
  return { ok: "Approved." };
}

/** Review a provider's plan of correction. */
export async function reviewPlanOfCorrection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const pocId = String(formData.get("pocId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("reviewNote") ?? "").trim();

  if (!["ACCEPTED", "REJECTED"].includes(decision)) return { error: "Choose accept or reject." };
  if (decision === "REJECTED" && !note) {
    return { error: "Say what the plan is missing, so the provider can fix it." };
  }

  const poc = await prisma.planOfCorrection.findUnique({
    where: { id: pocId },
    include: { citation: { include: { finding: true } } },
  });
  if (!poc) return { error: "Plan of correction not found." };

  await prisma.$transaction([
    prisma.planOfCorrection.update({
      where: { id: pocId },
      data: { status: decision, reviewNote: note || null, reviewedAt: new Date(), reviewedById: user.id },
    }),
    prisma.citation.update({
      where: { id: poc.citationId },
      data: { status: decision === "ACCEPTED" ? "POC_ACCEPTED" : "POC_REJECTED" },
    }),
  ]);

  await recordAudit({
    actor: user,
    action: "POC_REVIEWED",
    entityType: "PlanOfCorrection",
    entityId: pocId,
    inspectionId: poc.citation.finding.inspectionId,
    summary: `Plan of correction on ${poc.citation.finding.tag} ${decision.toLowerCase()}.`,
  });

  revalidatePath(`/findings/${poc.citation.findingId}`);
  return { ok: `Plan of correction ${decision.toLowerCase()}.` };
}

export async function verifyCorrection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const citationId = String(formData.get("citationId") ?? "");
  const note = String(formData.get("verifiedNote") ?? "").trim();
  if (!note) return { error: "Record how the correction was verified." };

  const citation = await prisma.citation.update({
    where: { id: citationId },
    data: { status: "CORRECTION_VERIFIED", verifiedAt: new Date(), verifiedNote: note },
    include: { finding: true },
  });

  await recordAudit({
    actor: user,
    action: "CORRECTION_VERIFIED",
    entityType: "Citation",
    entityId: citationId,
    inspectionId: citation.finding.inspectionId,
    summary: `Correction verified on ${citation.finding.tag}: ${note.slice(0, 120)}`,
  });

  revalidatePath(`/findings/${citation.findingId}`);
  return { ok: "Correction verified." };
}

/** Record the outcome of an informal dispute resolution. */
export async function decideIdr(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireSupervisor();
  const idrId = String(formData.get("idrId") ?? "");
  const status = String(formData.get("status") ?? "");
  const outcome = String(formData.get("outcome") ?? "").trim() || null;
  const outcomeNote = String(formData.get("outcomeNote") ?? "").trim() || null;

  const idr = await prisma.idrRequest.findUnique({ where: { id: idrId } });
  if (!idr) return { error: "Request not found." };
  if (status === "DECIDED" && (!outcome || !outcomeNote)) {
    return { error: "Record both the outcome and the reasoning." };
  }

  await prisma.idrRequest.update({
    where: { id: idrId },
    data: {
      status,
      outcome,
      outcomeNote,
      decidedAt: status === "DECIDED" ? new Date() : null,
      scheduledAt:
        status === "SCHEDULED"
          ? new Date(String(formData.get("scheduledAt") ?? "") || Date.now())
          : idr.scheduledAt,
    },
  });

  await recordAudit({
    actor: user,
    action: "IDR_UPDATED",
    entityType: "IdrRequest",
    entityId: idrId,
    inspectionId: idr.inspectionId,
    summary: `Informal dispute resolution ${status.toLowerCase()}${outcome ? ` — ${outcome}` : ""}.`,
  });

  revalidatePath(`/inspections/${idr.inspectionId}`);
  return { ok: "Updated." };
}
