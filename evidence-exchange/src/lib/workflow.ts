/**
 * Workflow rules.
 *
 * This file is the reason the product exists. Everything else — accounts,
 * uploads, printing — is plumbing that could be bought. What cannot be bought
 * is a guarantee that a citation is never recorded against evidence nobody
 * opened, and that is enforced here, in one place, on the server, on the same
 * path as the write.
 *
 * The functions are pure and take plain shapes rather than Prisma models, so
 * the gates can be reasoned about (and tested) without a database.
 */

import { addBusinessDays } from "./dates";

// --- shapes -----------------------------------------------------------------

export type SubmissionShape = {
  id: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  isLate: boolean;
  files: { id: string; fileName: string; firstOpenedAt: Date | null }[];
};

export type FindingShape = {
  id: string;
  tag: string;
  status: string;
  harm: string;
  sharedAt: Date | null;
  evidenceDueAt: Date | null;
  sources: { id: string }[];
  submissions: SubmissionShape[];
};

export type AgencyPolicy = {
  evidenceWindowDays: number;
  pocDueDays: number;
  idrRequestDays: number;
  correctionDays: number;
  minEvidenceSources: number;
};

export const DEFAULT_POLICY: AgencyPolicy = {
  evidenceWindowDays: 10,
  pocDueDays: 10,
  idrRequestDays: 10,
  correctionDays: 45,
  minEvidenceSources: 2,
};

// --- evidence review state --------------------------------------------------

export type ReviewState = {
  submissionCount: number;
  fileCount: number;
  /** Submissions the agency has not marked reviewed. */
  unreviewedSubmissions: number;
  /** Files whose bytes were never retrieved by an agency user. */
  unopenedFiles: number;
  lastSubmittedAt: Date | null;
  hasEvidence: boolean;
  fullyReviewed: boolean;
};

export function reviewState(finding: Pick<FindingShape, "submissions">): ReviewState {
  const subs = finding.submissions;
  const files = subs.flatMap((s) => s.files);
  const unreviewed = subs.filter((s) => !s.reviewedAt).length;
  const unopened = files.filter((f) => !f.firstOpenedAt).length;
  const last = subs.reduce<Date | null>(
    (acc, s) => (!acc || s.submittedAt > acc ? s.submittedAt : acc),
    null,
  );
  return {
    submissionCount: subs.length,
    fileCount: files.length,
    unreviewedSubmissions: unreviewed,
    unopenedFiles: unopened,
    lastSubmittedAt: last,
    hasEvidence: subs.length > 0,
    fullyReviewed: subs.length > 0 && unreviewed === 0 && unopened === 0,
  };
}

// --- the determination gate -------------------------------------------------

export type Gate = {
  /** Hard stops. A determination cannot be written while any of these stand. */
  blockers: string[];
  /**
   * Soft stops. A supervisor may proceed past these by recording a written
   * reason, which is stored on the determination and shown on the printed
   * statement of deficiencies.
   */
  overridable: string[];
  /** Context the decision-maker should see but that blocks nothing. */
  notices: string[];
};

export function determinationGate(input: {
  finding: FindingShape;
  outcome: string;
  policy: AgencyPolicy;
  actorRole: string;
  now?: Date;
}): Gate {
  const { finding, outcome, policy, actorRole } = input;
  const now = input.now ?? new Date();
  const review = reviewState(finding);

  const blockers: string[] = [];
  const overridable: string[] = [];
  const notices: string[] = [];

  if (finding.status === "DETERMINED") {
    blockers.push("This finding already has a determination. Amend it instead of recording a second one.");
  }
  if (finding.status === "WITHDRAWN") {
    blockers.push("This finding was withdrawn.");
  }

  // A provider cannot answer a finding they were never shown. Recording a
  // consultation or a citation on an unshared finding is the paper version of
  // deciding before asking.
  if (!finding.sharedAt && outcome !== "NO_DEFICIENCY") {
    blockers.push(
      "This finding has not been shared with the provider yet, so they have had no opportunity to respond.",
    );
  }

  // The rule this whole system was built for.
  if (outcome === "CITATION" && review.unreviewedSubmissions > 0) {
    blockers.push(
      `${review.unreviewedSubmissions} provider submission${
        review.unreviewedSubmissions === 1 ? " has" : "s have"
      } not been reviewed. Open and review everything the provider sent before citing.`,
    );
  }
  if (outcome === "CITATION" && review.unopenedFiles > 0) {
    blockers.push(
      `${review.unopenedFiles} uploaded file${
        review.unopenedFiles === 1 ? " has" : "s have"
      } never been opened. A citation cannot be recorded against documents nobody looked at.`,
    );
  }

  // Citing before the provider's window closes, when they have sent nothing
  // yet, is deciding on an incomplete record. Immediate jeopardy is the
  // exception: resident safety does not wait on a document deadline.
  const due = finding.evidenceDueAt;
  const windowOpen = Boolean(due && new Date(due) > now);
  if (outcome === "CITATION" && windowOpen && !review.hasEvidence) {
    if (finding.harm === "IMMEDIATE_JEOPARDY") {
      notices.push(
        "Immediate jeopardy: citing before the provider's evidence window closes is permitted, and the window stays open for the plan of correction.",
      );
    } else {
      blockers.push(
        "The provider's evidence window is still open and nothing has been submitted. Wait for the deadline, or shorten it with a recorded reason.",
      );
    }
  }

  // The two-source standard. Overridable rather than absolute, because a
  // supervisor sometimes has a documented reason — but never silently.
  if (outcome === "CITATION" && finding.sources.length < policy.minEvidenceSources) {
    overridable.push(
      `This finding cites ${finding.sources.length} evidence source${
        finding.sources.length === 1 ? "" : "s"
      }; the standard is ${policy.minEvidenceSources} independent sources for a failed provider practice.`,
    );
  }

  if (overridable.length > 0 && actorRole === "INSPECTOR") {
    blockers.push(
      "A supervisor has to record the override for the items listed below before this determination can be saved.",
    );
  }

  // Facts worth surfacing at the moment of decision.
  if (outcome === "CITATION" && !review.hasEvidence && !windowOpen) {
    notices.push(
      "No evidence was submitted before the deadline. That fact is recorded on the determination.",
    );
  }
  const lateSubs = finding.submissions.filter((s) => s.isLate).length;
  if (lateSubs > 0) {
    notices.push(
      `${lateSubs} submission${lateSubs === 1 ? " arrived" : "s arrived"} after the deadline. Late evidence is kept and shown, not discarded.`,
    );
  }
  if (outcome !== "CITATION" && review.unreviewedSubmissions > 0) {
    notices.push(
      "There is unreviewed provider evidence on this finding. Review it so the record shows what the decision rested on.",
    );
  }
  if (finding.harm === "IMMEDIATE_JEOPARDY" && outcome === "CITATION") {
    notices.push("An immediate jeopardy citation requires a supervisor's approval before the statement of deficiencies is issued.");
  }

  return { blockers, overridable, notices };
}

export function gateAllows(gate: Gate, overrideReason: string | null): boolean {
  if (gate.blockers.length > 0) return false;
  if (gate.overridable.length > 0 && !overrideReason?.trim()) return false;
  return true;
}

/**
 * What the decision-maker actually had in front of them, frozen at decision
 * time. A submission that lands afterwards can never rewrite the basis of a
 * past decision — it shows up as new activity instead.
 */
export function snapshotEvidence(submissions: SubmissionShape[]) {
  return submissions.map((s) => ({
    submissionId: s.id,
    submittedAt: s.submittedAt.toISOString(),
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
    isLate: s.isLate,
    files: s.files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      opened: Boolean(f.firstOpenedAt),
    })),
  }));
}

// --- issuing the statement of deficiencies ----------------------------------

export function sodGate(findings: { status: string; determination: { outcome: string; approvedAt: Date | null } | null; harm: string; tag: string }[]): Gate {
  const blockers: string[] = [];
  const notices: string[] = [];

  const undecided = findings.filter((f) => f.status !== "DETERMINED" && f.status !== "WITHDRAWN");
  if (undecided.length > 0) {
    blockers.push(
      `${undecided.length} finding${undecided.length === 1 ? " is" : "s are"} still open (${undecided
        .map((f) => f.tag)
        .join(", ")}). Every finding needs a determination before the statement of deficiencies is issued.`,
    );
  }

  const unapprovedIj = findings.filter(
    (f) =>
      f.harm === "IMMEDIATE_JEOPARDY" &&
      f.determination?.outcome === "CITATION" &&
      !f.determination.approvedAt,
  );
  if (unapprovedIj.length > 0) {
    blockers.push(
      `Immediate jeopardy citation${unapprovedIj.length === 1 ? "" : "s"} ${unapprovedIj
        .map((f) => f.tag)
        .join(", ")} still need supervisor approval.`,
    );
  }

  const cited = findings.filter((f) => f.determination?.outcome === "CITATION").length;
  if (cited === 0) {
    notices.push(
      "No findings were cited. Issuing closes the inspection with consultations and resolved findings on the record.",
    );
  }

  return { blockers, overridable: [], notices };
}

// --- informal dispute resolution -------------------------------------------

export const IDR_PANEL_MAX = 3;

export function idrGate(input: {
  type: string;
  findingIds: string[];
  sodIssuedAt: Date | null;
  acknowledgedAt: Date | null;
  policy: AgencyPolicy;
  now?: Date;
}): Gate & { deadline: Date | null; isLate: boolean } {
  const now = input.now ?? new Date();
  const blockers: string[] = [];
  const notices: string[] = [];

  const start = input.acknowledgedAt ?? input.sodIssuedAt;
  const deadline = start ? addBusinessDays(start, input.policy.idrRequestDays) : null;
  const isLate = Boolean(deadline && now > deadline);

  if (!input.sodIssuedAt) {
    blockers.push("The statement of deficiencies has not been issued yet.");
  }
  if (input.findingIds.length === 0) {
    blockers.push("Select at least one citation to dispute.");
  }
  if (input.type === "PANEL" && input.findingIds.length > IDR_PANEL_MAX) {
    blockers.push(
      `Panel review is limited to ${IDR_PANEL_MAX} disputed items. Choose a traditional review, or reduce the selection.`,
    );
  }
  if (isLate) {
    // Recorded, not refused: an agency decides what to do with a late request,
    // and a portal that silently swallows one is worse than one that logs it.
    notices.push(
      "This request is past the deadline. It will be recorded as late and forwarded for the agency to decide whether to accept it.",
    );
  }

  return { blockers, overridable: [], notices, deadline, isLate };
}

// --- deadline helpers -------------------------------------------------------

export function evidenceDeadline(exitConferenceAt: Date, policy: AgencyPolicy): Date {
  return addBusinessDays(exitConferenceAt, policy.evidenceWindowDays);
}

export function pocDeadline(sodDate: Date, policy: AgencyPolicy): Date {
  return addBusinessDays(sodDate, policy.pocDueDays);
}

export function correctionDeadline(sodDate: Date, policy: AgencyPolicy): Date {
  const d = new Date(sodDate);
  d.setDate(d.getDate() + policy.correctionDays);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** "F-01", "F-02", ... — stable labels used in conversation and on the SOD. */
export function nextFindingTag(existing: string[]): string {
  const numbers = existing
    .map((t) => Number.parseInt(t.replace(/^F-/, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `F-${String(next).padStart(2, "0")}`;
}
