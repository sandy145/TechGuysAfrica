"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireProvider } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { getPolicy } from "@/lib/queries";
import { idrGate } from "@/lib/workflow";
import { saveUpload, StorageError } from "@/lib/storage";
import { parseDateInput } from "@/lib/dates";
import { appUrl, button, emailLayout, sendMail } from "@/lib/mailer";
import type { ActionState } from "./inspections";

/**
 * Upload documentation against a finding.
 *
 * Three things happen that email cannot do: the files are bound to the finding
 * they answer, lateness is computed against the recorded deadline rather than
 * argued about later, and the provider gets a receipt naming every file with
 * its digest.
 */
export async function submitEvidence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireProvider();
  const findingId = String(formData.get("findingId") ?? "");
  const evidenceRequestId = String(formData.get("evidenceRequestId") ?? "") || null;
  const note = String(formData.get("note") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0 && !note) {
    return { error: "Attach at least one document, or write a note explaining your response." };
  }

  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: { inspection: { include: { home: true, leadInspector: true } } },
  });
  if (!finding || finding.inspection.homeId !== user.providerHomeId) {
    return { error: "Finding not found." };
  }
  if (!finding.sharedAt) return { error: "This finding is not open for response." };
  if (finding.status === "WITHDRAWN") return { error: "This finding was withdrawn." };

  const due = finding.evidenceDueAt ?? finding.inspection.evidenceDueAt;
  const isLate = Boolean(due && new Date() > due);

  let stored;
  try {
    stored = await Promise.all(files.map((file) => saveUpload(finding.inspectionId, file)));
  } catch (err) {
    if (err instanceof StorageError) return { error: err.message };
    throw err;
  }

  const submission = await prisma.submission.create({
    data: {
      findingId,
      evidenceRequestId,
      note: note || null,
      submittedById: user.id,
      isLate,
      files: {
        create: stored.map((f) => ({
          fileName: f.fileName,
          storageKey: f.storageKey,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          sha256: f.sha256,
        })),
      },
    },
    include: { files: true },
  });

  // A finding with evidence on it is never silently "pending" again.
  if (finding.status === "PENDING_EVIDENCE") {
    await prisma.finding.update({ where: { id: findingId }, data: { status: "EVIDENCE_RECEIVED" } });
  }
  if (evidenceRequestId) {
    await prisma.evidenceRequest.update({
      where: { id: evidenceRequestId },
      data: { status: "ANSWERED" },
    });
  }

  await recordAudit({
    actor: user,
    action: "SUBMISSION_RECEIVED",
    entityType: "Submission",
    entityId: submission.id,
    inspectionId: finding.inspectionId,
    summary: `${user.name} submitted ${stored.length} file(s) on ${finding.tag}${isLate ? " (after the deadline)" : ""}.`,
    meta: { files: stored.map((f) => ({ name: f.fileName, sha256: f.sha256 })), isLate },
  });

  // Receipt to the provider: the proof they do not get from a sent-items folder.
  await sendMail({
    to: user.email,
    kind: "SUBMISSION_RECEIPT",
    subject: `Receipt: ${stored.length} document(s) received for ${finding.tag}`,
    html: emailLayout(
      "We have your documents",
      `<p>${process.env.AGENCY_NAME || "The agency"} received your submission on finding <strong>${finding.tag}</strong> at ${new Date().toLocaleString("en-US")}${
        isLate ? " — after the deadline, which is recorded with the submission" : ""
      }.</p>
       <ul>${stored.map((f) => `<li>${f.fileName} <span style="color:#475467;font-size:12px">(${f.sha256.slice(0, 16)}…)</span></li>`).join("")}</ul>
       <p>You can see when your licensor opens each file.</p>
       ${button("View the finding", appUrl("/portal"))}`,
    ),
  });

  // And a notification to the licensor, whose queue this now sits at the top of.
  if (finding.inspection.leadInspector?.email) {
    await sendMail({
      to: finding.inspection.leadInspector.email,
      kind: "REMINDER",
      subject: `${finding.inspection.home.name} sent documents on ${finding.tag}`,
      html: emailLayout(
        "New provider evidence",
        `<p>${user.name} submitted ${stored.length} file(s) on finding ${finding.tag}. It is at the top of your review queue.</p>
         ${button("Review it", appUrl(`/findings/${findingId}`))}`,
      ),
    });
  }

  revalidatePath(`/portal/findings/${findingId}`);
  revalidatePath("/portal");
  return {
    ok: `Received — ${stored.length} file(s) logged at ${new Date().toLocaleTimeString("en-US")}.`,
  };
}

export async function providerNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireProvider();
  const findingId = String(formData.get("findingId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };

  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: { inspection: true },
  });
  if (!finding || finding.inspection.homeId !== user.providerHomeId) {
    return { error: "Finding not found." };
  }

  await prisma.findingNote.create({
    data: { findingId, authorId: user.id, visibility: "SHARED", body },
  });
  await recordAudit({
    actor: user,
    action: "NOTE_ADDED",
    entityType: "Finding",
    entityId: findingId,
    inspectionId: finding.inspectionId,
    summary: `Provider note added on ${finding.tag}.`,
  });

  revalidatePath(`/portal/findings/${findingId}`);
  return { ok: "Note added." };
}

/** Acknowledging receipt starts the correction and dispute clocks. */
export async function acknowledgeStatement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireProvider();
  const inspectionId = String(formData.get("inspectionId") ?? "");

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.homeId !== user.providerHomeId) return { error: "Not found." };
  if (!inspection.sodIssuedAt) return { error: "No statement of deficiencies has been issued." };
  if (inspection.sodAcknowledgedAt) return { ok: "Already acknowledged." };

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { sodAcknowledgedAt: new Date() },
  });

  await recordAudit({
    actor: user,
    action: "SOD_ACKNOWLEDGED",
    entityType: "Inspection",
    entityId: inspectionId,
    inspectionId,
    summary: `${user.name} acknowledged receipt of the statement of deficiencies.`,
  });

  revalidatePath("/portal");
  return { ok: "Receipt acknowledged." };
}

export async function submitPlanOfCorrection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireProvider();
  const citationId = String(formData.get("citationId") ?? "");
  const howCorrected = String(formData.get("howCorrected") ?? "").trim();
  const systemicMeasures = String(formData.get("systemicMeasures") ?? "").trim();
  const responsiblePerson = String(formData.get("responsiblePerson") ?? "").trim();
  const completionDate = parseDateInput(formData.get("completionDate"));

  if (!howCorrected || !systemicMeasures || !responsiblePerson || !completionDate) {
    return {
      error:
        "A plan of correction has to answer all four questions: how it was corrected, what keeps it from recurring, who is responsible, and by when.",
    };
  }

  const citation = await prisma.citation.findUnique({
    where: { id: citationId },
    include: { finding: { include: { inspection: true } } },
  });
  if (!citation || citation.finding.inspection.homeId !== user.providerHomeId) {
    return { error: "Citation not found." };
  }

  const isLate = Boolean(citation.pocDueAt && new Date() > citation.pocDueAt);

  await prisma.$transaction([
    prisma.planOfCorrection.create({
      data: {
        citationId,
        howCorrected,
        systemicMeasures,
        responsiblePerson,
        completionDate,
        submittedById: user.id,
        isLate,
      },
    }),
    prisma.citation.update({ where: { id: citationId }, data: { status: "POC_SUBMITTED" } }),
  ]);

  await recordAudit({
    actor: user,
    action: "POC_SUBMITTED",
    entityType: "Citation",
    entityId: citationId,
    inspectionId: citation.finding.inspectionId,
    summary: `Plan of correction submitted for ${citation.finding.tag}${isLate ? " (late)" : ""}.`,
  });

  revalidatePath("/portal");
  return { ok: "Plan of correction submitted." };
}

export async function requestIdr(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireProvider();
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const type = String(formData.get("type") ?? "TRADITIONAL");
  const statement = String(formData.get("statement") ?? "").trim();
  const findingIds = formData.getAll("findingIds").map(String).filter(Boolean);

  if (!statement) return { error: "Explain what you disagree with and why." };

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.homeId !== user.providerHomeId) return { error: "Not found." };

  const policy = await getPolicy();
  const gate = idrGate({
    type,
    findingIds,
    sodIssuedAt: inspection.sodIssuedAt,
    acknowledgedAt: inspection.sodAcknowledgedAt,
    policy,
  });
  if (gate.blockers.length > 0) return { blockers: gate.blockers };

  const request = await prisma.idrRequest.create({
    data: {
      inspectionId,
      type,
      findingIdsJson: JSON.stringify(findingIds),
      statement,
      requestedById: user.id,
      isLate: gate.isLate,
    },
  });

  await recordAudit({
    actor: user,
    action: "IDR_REQUESTED",
    entityType: "IdrRequest",
    entityId: request.id,
    inspectionId,
    summary: `${type} informal dispute resolution requested on ${findingIds.length} citation(s)${
      gate.isLate ? " (after the deadline)" : ""
    }.`,
  });

  revalidatePath("/portal");
  return {
    ok: gate.isLate
      ? "Request recorded as late and forwarded to the agency."
      : "Request submitted.",
  };
}
