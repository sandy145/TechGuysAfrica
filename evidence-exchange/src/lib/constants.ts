// Every status/category column in schema.prisma is a String, because SQLite has
// no enums. These are the allowed values plus their display labels, and they
// are the single place to change when a program's vocabulary differs.

export const USER_ROLES = ["AGENCY_ADMIN", "SUPERVISOR", "INSPECTOR", "PROVIDER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  AGENCY_ADMIN: "Agency administrator",
  SUPERVISOR: "Field supervisor",
  INSPECTOR: "Licensor / inspector",
  PROVIDER: "Provider contact",
};

/** Agency-side roles see the licensing workspace; PROVIDER sees the portal. */
export function isAgencyRole(role: string): boolean {
  return role === "AGENCY_ADMIN" || role === "SUPERVISOR" || role === "INSPECTOR";
}

export const INSPECTION_TYPES = [
  "FULL",
  "INITIAL",
  "COMPLAINT",
  "FOLLOW_UP",
  "CHANGE_OF_OWNERSHIP",
  "MONITORING",
] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  FULL: "Full inspection",
  INITIAL: "Initial licensing inspection",
  COMPLAINT: "Complaint investigation",
  FOLLOW_UP: "Follow-up visit",
  CHANGE_OF_OWNERSHIP: "Change of ownership",
  MONITORING: "Monitoring visit",
};

export const INSPECTION_STATUSES = [
  "PLANNED",
  "ONSITE",
  "EVIDENCE_OPEN",
  "IN_REVIEW",
  "SOD_ISSUED",
  "POC_REVIEW",
  "CLOSED",
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  PLANNED: "Planned",
  ONSITE: "Onsite",
  EVIDENCE_OPEN: "Evidence window open",
  IN_REVIEW: "Agency review",
  SOD_ISSUED: "Statement of deficiencies issued",
  POC_REVIEW: "Plan of correction review",
  CLOSED: "Closed",
};

export const FINDING_STATUSES = [
  "DRAFT",
  "PENDING_EVIDENCE",
  "EVIDENCE_RECEIVED",
  "DETERMINED",
  "WITHDRAWN",
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  DRAFT: "Draft",
  PENDING_EVIDENCE: "Awaiting provider evidence",
  EVIDENCE_RECEIVED: "Evidence received — needs review",
  DETERMINED: "Determined",
  WITHDRAWN: "Withdrawn",
};

export const SCOPES = ["ISOLATED", "PATTERN", "WIDESPREAD"] as const;
export const SCOPE_LABELS: Record<string, string> = {
  ISOLATED: "Isolated",
  PATTERN: "Pattern",
  WIDESPREAD: "Widespread",
};

export const HARM_LEVELS = [
  "NO_HARM",
  "POTENTIAL_HARM",
  "ACTUAL_HARM",
  "IMMEDIATE_JEOPARDY",
] as const;
export const HARM_LABELS: Record<string, string> = {
  NO_HARM: "No harm",
  POTENTIAL_HARM: "Potential for harm",
  ACTUAL_HARM: "Actual harm",
  IMMEDIATE_JEOPARDY: "Immediate jeopardy",
};

export const EVIDENCE_SOURCE_KINDS = [
  "OBSERVATION",
  "INTERVIEW",
  "RECORD_REVIEW",
  "PHOTO",
  "DOCUMENT",
  "OTHER",
] as const;
export const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  OBSERVATION: "Observation",
  INTERVIEW: "Interview",
  RECORD_REVIEW: "Record review",
  PHOTO: "Photograph",
  DOCUMENT: "Document",
  OTHER: "Other",
};

export const OUTCOMES = ["NO_DEFICIENCY", "CONSULTATION", "CITATION"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  NO_DEFICIENCY: "No deficiency",
  CONSULTATION: "Consultation / technical assistance",
  CITATION: "Citation",
};

export const OUTCOME_DESCRIPTIONS: Record<Outcome, string> = {
  NO_DEFICIENCY:
    "The evidence shows the requirement was met. Nothing appears on the statement of deficiencies.",
  CONSULTATION:
    "A shortfall was identified but is being addressed through technical assistance rather than a citation.",
  CITATION:
    "A failed provider practice is cited. A plan of correction is required and appeal rights attach.",
};

export const CITATION_STATUSES = [
  "PENDING_POC",
  "POC_SUBMITTED",
  "POC_ACCEPTED",
  "POC_REJECTED",
  "CORRECTION_VERIFIED",
  "UNCORRECTED",
] as const;
export const CITATION_STATUS_LABELS: Record<string, string> = {
  PENDING_POC: "Plan of correction due",
  POC_SUBMITTED: "Plan of correction submitted",
  POC_ACCEPTED: "Plan of correction accepted",
  POC_REJECTED: "Plan of correction rejected",
  CORRECTION_VERIFIED: "Correction verified",
  UNCORRECTED: "Uncorrected",
};

export const IDR_TYPES = ["TRADITIONAL", "PANEL"] as const;
export const IDR_TYPE_LABELS: Record<string, string> = {
  TRADITIONAL: "Traditional (one-to-one review)",
  PANEL: "Panel review",
};
/** Panel review is commonly limited to a small number of disputed items. */
export const IDR_PANEL_MAX_ITEMS = 3;

export const IDR_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  HELD: "Held",
  DECIDED: "Decided",
  WITHDRAWN: "Withdrawn",
};

export const IDR_OUTCOME_LABELS: Record<string, string> = {
  UPHELD: "Citation upheld",
  MODIFIED: "Citation modified",
  DELETED: "Citation deleted",
  SPLIT: "Partially upheld",
};

/** Audit verbs. Kept as a closed list so the activity feed can label them. */
export const AUDIT_ACTIONS = {
  INSPECTION_CREATED: "Inspection created",
  INSPECTION_STATUS_CHANGED: "Inspection status changed",
  EXIT_CONFERENCE_RECORDED: "Exit conference recorded",
  EVIDENCE_WINDOW_OPENED: "Evidence window opened",
  EVIDENCE_DEADLINE_EXTENDED: "Evidence deadline extended",
  FINDING_CREATED: "Finding drafted",
  FINDING_UPDATED: "Finding updated",
  FINDING_SHARED: "Finding shared with provider",
  FINDING_WITHDRAWN: "Finding withdrawn",
  EVIDENCE_SOURCE_ADDED: "Evidence source added",
  EVIDENCE_REQUEST_CREATED: "Evidence request issued",
  SUBMISSION_RECEIVED: "Provider submission received",
  SUBMISSION_REVIEWED: "Submission marked reviewed",
  FILE_OPENED: "Evidence file opened",
  NOTE_ADDED: "Note added",
  DETERMINATION_RECORDED: "Determination recorded",
  DETERMINATION_APPROVED: "Determination approved",
  SOD_ISSUED: "Statement of deficiencies issued",
  SOD_ACKNOWLEDGED: "Statement of deficiencies acknowledged by provider",
  POC_SUBMITTED: "Plan of correction submitted",
  POC_REVIEWED: "Plan of correction reviewed",
  CORRECTION_VERIFIED: "Correction verified",
  IDR_REQUESTED: "Informal dispute resolution requested",
  IDR_UPDATED: "Informal dispute resolution updated",
  PROVIDER_INVITED: "Provider contact invited",
  PROVIDER_ACTIVATED: "Provider account activated",
  USER_SIGNED_IN: "Signed in",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
