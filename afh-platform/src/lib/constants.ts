// Allowed values for the String-typed status/category columns. SQLite has no
// enums, so these are the single source of truth for both validation and UI
// labels. Keep the keys in sync with the comments in prisma/schema.prisma.

export const USER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SPECIALTIES = [
  "DEMENTIA",
  "MENTAL_HEALTH",
  "DEVELOPMENTAL_DISABILITIES",
] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  DEMENTIA: "Dementia",
  MENTAL_HEALTH: "Mental health",
  DEVELOPMENTAL_DISABILITIES: "Developmental disabilities",
};

export const EMPLOYEE_ROLES = [
  "PROVIDER",
  "ENTITY_REPRESENTATIVE",
  "RESIDENT_MANAGER",
  "CAREGIVER",
  "SUBSTITUTE",
  "VOLUNTEER",
  "CONTRACTOR",
] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  PROVIDER: "Provider",
  ENTITY_REPRESENTATIVE: "Entity representative",
  RESIDENT_MANAGER: "Resident manager",
  CAREGIVER: "Caregiver",
  SUBSTITUTE: "Substitute caregiver",
  VOLUNTEER: "Volunteer",
  CONTRACTOR: "Contractor",
};

export const DOCUMENT_SCOPES = ["HOME", "RESIDENT", "EMPLOYEE"] as const;
export type DocumentScope = (typeof DOCUMENT_SCOPES)[number];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const FORM_STATUSES = [
  "DRAFT",
  "AWAITING_SIGNATURES",
  "COMPLETED",
  "VOIDED",
] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  DRAFT: "Draft",
  AWAITING_SIGNATURES: "Awaiting signatures",
  COMPLETED: "Completed",
  VOIDED: "Voided",
};

export const CITATION_SEVERITIES = [
  "NO_HARM",
  "POTENTIAL_HARM",
  "ACTUAL_HARM",
  "IMMEDIATE_JEOPARDY",
] as const;
export type CitationSeverity = (typeof CITATION_SEVERITIES)[number];

export const CITATION_SEVERITY_LABELS: Record<CitationSeverity, string> = {
  NO_HARM: "No harm",
  POTENTIAL_HARM: "Potential for harm",
  ACTUAL_HARM: "Actual harm",
  IMMEDIATE_JEOPARDY: "Immediate jeopardy",
};

export const SURVEY_TYPES = [
  "FULL_INSPECTION",
  "COMPLAINT",
  "FOLLOW_UP",
  "CHANGE_OF_OWNERSHIP",
  "OTHER",
] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  FULL_INSPECTION: "Full inspection",
  COMPLAINT: "Complaint investigation",
  FOLLOW_UP: "Follow-up / revisit",
  CHANGE_OF_OWNERSHIP: "Change of ownership",
  OTHER: "Other",
};

export const BED_SIZE_BUCKETS = ["1-4", "5-6", "7-8"] as const;
export type BedSizeBucket = (typeof BED_SIZE_BUCKETS)[number];

export const MODERATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const SUBSCRIPTION_TOPICS = [
  "CITATIONS",
  "WAC_UPDATES",
  "EXPIRY_DIGEST",
  "COMPLIANCE_GAPS",
] as const;
export type SubscriptionTopic = (typeof SUBSCRIPTION_TOPICS)[number];

export const SUBSCRIPTION_TOPIC_LABELS: Record<SubscriptionTopic, string> = {
  CITATIONS: "New citations posted by other homes",
  WAC_UPDATES: "New and amended Washington rules (WAC)",
  EXPIRY_DIGEST: "My documents expiring soon",
  COMPLIANCE_GAPS: "My open compliance gaps",
};

export const SUBSCRIPTION_FREQUENCIES = ["IMMEDIATE", "WEEKLY", "MONTHLY"] as const;
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number];

export const UPDATE_KINDS = [
  "NEW_RULE",
  "AMENDED_RULE",
  "POLICY",
  "GUIDANCE",
  "ENFORCEMENT_TREND",
] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

export const UPDATE_KIND_LABELS: Record<UpdateKind, string> = {
  NEW_RULE: "New rule",
  AMENDED_RULE: "Amended rule",
  POLICY: "Policy change",
  GUIDANCE: "Guidance",
  ENFORCEMENT_TREND: "Enforcement trend",
};

export const CHECK_TYPES = [
  "HOME_DOCUMENT",
  "PER_RESIDENT_DOCUMENT",
  "PER_EMPLOYEE_DOCUMENT",
  "PROFILE_FLAG",
] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

/** Washington counties, used for the coarse location field on citations. */
export const WA_COUNTIES = [
  "Adams", "Asotin", "Benton", "Chelan", "Clallam", "Clark", "Columbia",
  "Cowlitz", "Douglas", "Ferry", "Franklin", "Garfield", "Grant",
  "Grays Harbor", "Island", "Jefferson", "King", "Kitsap", "Kittitas",
  "Klickitat", "Lewis", "Lincoln", "Mason", "Okanogan", "Pacific",
  "Pend Oreille", "Pierce", "San Juan", "Skagit", "Skamania", "Snohomish",
  "Spokane", "Stevens", "Thurston", "Wahkiakum", "Walla Walla", "Whatcom",
  "Whitman", "Yakima",
] as const;

/** Narrow an untrusted string to one of an allowed set, else fall back. */
export function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Parse a JSON text column into an array, tolerating malformed values. */
export function parseJsonArray<T = string>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Parse a JSON text column into an object, tolerating malformed values. */
export function parseJsonObject<T extends object = Record<string, unknown>>(
  raw: string | null | undefined,
): T {
  if (!raw) return {} as T;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch {
    return {} as T;
  }
}
