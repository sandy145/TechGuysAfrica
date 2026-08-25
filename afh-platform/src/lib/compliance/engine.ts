import "server-only";
import type {
  Document,
  DocumentType,
  Employee,
  Home,
  Regulation,
  Resident,
  RuleCheck,
} from "@prisma/client";
import { prisma } from "../db";
import { addMonths, daysUntil } from "../dates";
import {
  parseJsonArray,
  parseJsonObject,
  SEVERITY_RANK,
  type Severity,
} from "../constants";

/**
 * The compliance engine answers one question: if a licensor walked in today,
 * what would they find missing?
 *
 * Each RuleCheck row is one machine-evaluable requirement traced back to a WAC
 * section. A check first decides whether it *applies* to this home (a dementia
 * specialty rule is irrelevant to a home with no dementia designation), then
 * resolves the documents that would satisfy it, then reports a status. Nothing
 * here writes to the database — callers cache or render as they see fit.
 */

export type FindingStatus =
  | "PASS"
  | "MISSING"
  | "EXPIRED"
  | "EXPIRING"
  | "OVERDUE"
  | "UNDATED";

/** Statuses that a surveyor would write up today. */
export const FAILING_STATUSES: FindingStatus[] = ["MISSING", "EXPIRED", "OVERDUE"];
/** Statuses that are fine today but will not be for long. */
export const AT_RISK_STATUSES: FindingStatus[] = ["EXPIRING", "UNDATED"];

export const STATUS_LABELS: Record<FindingStatus, string> = {
  PASS: "In place",
  MISSING: "Missing",
  EXPIRED: "Expired",
  EXPIRING: "Expiring soon",
  OVERDUE: "Completed late",
  UNDATED: "No date recorded",
};

export type Finding = {
  ruleCheckId: string;
  code: string;
  title: string;
  description: string | null;
  severity: Severity;
  status: FindingStatus;
  detail: string;
  remediation: string | null;

  wacCite: string | null;
  regulationTitle: string | null;
  regulationVerified: boolean;

  subjectType: "HOME" | "RESIDENT" | "EMPLOYEE";
  subjectId: string | null;
  subjectName: string | null;

  documentTypeId: string | null;
  documentTypeName: string | null;
  documentId: string | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
};

export type ComplianceReport = {
  homeId: string;
  generatedAt: Date;
  findings: Finding[];
  failing: Finding[];
  atRisk: Finding[];
  passing: Finding[];
  /** 0–100. At-risk items count half, since they are compliant right now. */
  score: number;
  totals: { total: number; passing: number; atRisk: number; failing: number };
  bySeverity: Record<Severity, number>;
  /** Checks skipped because they do not apply to this home's profile. */
  notApplicableCount: number;
};

// --- applicability predicates ----------------------------------------------

type HomePredicate = {
  specialtiesIncludeAny?: string[];
  bedCapacityMin?: number;
  bedCapacityMax?: number;
  residentCountMin?: number;
  employsStaff?: boolean;
  servesMedicaid?: boolean;
  usesNurseDelegation?: boolean;
  providerIsResident?: boolean;
  hasResidentManager?: boolean;
  multipleFacilities?: boolean;
};

type ResidentPredicate = {
  hasDementiaDiagnosis?: boolean;
  hasMentalHealthDiagnosis?: boolean;
  hasDevelopmentalDisability?: boolean;
  isMedicaid?: boolean;
  selfAdministersMedication?: boolean;
};

type EmployeePredicate = {
  roleIn?: string[];
  roleNotIn?: string[];
  hasDirectResidentContact?: boolean;
};

type CheckParams = {
  /** Document must be dated no later than N days after admission/hire. */
  withinDaysOfAdmission?: number;
  withinDaysOfHire?: number;
  /** PROFILE_FLAG: the Home column to inspect. */
  field?: string;
  /** PROFILE_FLAG: require the column to be truthy/non-empty. */
  mustBePresent?: boolean;
  /** PROFILE_FLAG: require an exact boolean value. */
  equals?: boolean;
  /** Override the document type's own warn window. */
  warnDays?: number;
};

function homeApplies(home: Home, predicate: HomePredicate): boolean {
  const specialties = parseJsonArray<string>(home.specialties);

  if (predicate.specialtiesIncludeAny?.length) {
    if (!predicate.specialtiesIncludeAny.some((s) => specialties.includes(s))) {
      return false;
    }
  }
  if (predicate.bedCapacityMin != null && home.bedCapacity < predicate.bedCapacityMin) {
    return false;
  }
  if (predicate.bedCapacityMax != null && home.bedCapacity > predicate.bedCapacityMax) {
    return false;
  }
  if (
    predicate.residentCountMin != null &&
    home.residentCount < predicate.residentCountMin
  ) {
    return false;
  }

  const flags: Array<keyof HomePredicate & keyof Home> = [
    "employsStaff",
    "servesMedicaid",
    "usesNurseDelegation",
    "providerIsResident",
    "hasResidentManager",
    "multipleFacilities",
  ];
  for (const flag of flags) {
    const want = predicate[flag] as boolean | undefined;
    if (want != null && Boolean(home[flag]) !== want) return false;
  }

  return true;
}

function residentApplies(resident: Resident, predicate: ResidentPredicate): boolean {
  const flags: Array<keyof ResidentPredicate & keyof Resident> = [
    "hasDementiaDiagnosis",
    "hasMentalHealthDiagnosis",
    "hasDevelopmentalDisability",
    "isMedicaid",
    "selfAdministersMedication",
  ];
  for (const flag of flags) {
    const want = predicate[flag];
    if (want != null && Boolean(resident[flag]) !== want) return false;
  }
  return true;
}

function employeeApplies(employee: Employee, predicate: EmployeePredicate): boolean {
  if (predicate.roleIn?.length && !predicate.roleIn.includes(employee.role)) return false;
  if (predicate.roleNotIn?.length && predicate.roleNotIn.includes(employee.role)) {
    return false;
  }
  if (
    predicate.hasDirectResidentContact != null &&
    employee.hasDirectResidentContact !== predicate.hasDirectResidentContact
  ) {
    return false;
  }
  return true;
}

// --- document status resolution ---------------------------------------------

/**
 * Effective expiry for a document: an explicit date wins, otherwise it is
 * derived from the issue date plus the document type's renewal interval.
 */
export function effectiveExpiry(
  doc: Pick<Document, "expiresAt" | "issuedAt">,
  type: Pick<DocumentType, "renewalMonths">,
): Date | null {
  if (doc.expiresAt) return doc.expiresAt;
  if (type.renewalMonths && doc.issuedAt) {
    return addMonths(doc.issuedAt, type.renewalMonths);
  }
  return null;
}

type DocStatus = {
  status: FindingStatus;
  detail: string;
  document: Document | null;
  expiresAt: Date | null;
  daysRemaining: number | null;
};

function resolveDocumentStatus(
  candidates: Document[],
  type: DocumentType,
  params: CheckParams,
  timing?: { anchor: Date | null; withinDays: number | undefined; anchorLabel: string },
): DocStatus {
  if (candidates.length === 0) {
    return {
      status: "MISSING",
      detail: "No document on file.",
      document: null,
      expiresAt: null,
      daysRemaining: null,
    };
  }

  // Prefer whichever copy stays valid longest — a home that re-uploaded a
  // renewed certificate should not be failed for the superseded one.
  const scored = candidates
    .map((doc) => ({ doc, expiry: effectiveExpiry(doc, type) }))
    .sort((a, b) => {
      if (!a.expiry && !b.expiry) {
        return (b.doc.issuedAt?.getTime() ?? 0) - (a.doc.issuedAt?.getTime() ?? 0);
      }
      if (!a.expiry) return -1; // never-expiring copy is the strongest
      if (!b.expiry) return 1;
      return b.expiry.getTime() - a.expiry.getTime();
    });

  const best = scored[0];
  const doc = best.doc;
  const expiresAt = best.expiry;

  // Timing rules ("an initial assessment within 30 days of admission").
  //
  // Two things matter here. The deadline is about the *first* document of its
  // kind, so it is measured against the earliest copy on file, not the newest —
  // otherwise this year's annual review of a five-year resident reads as
  // hundreds of days late. And the check only runs while the deadline is still
  // the live question: once a full review cycle has passed since admission or
  // hire, currency is what matters, and a home that has only backfilled its
  // current paperwork should not be told its records are late.
  if (timing?.withinDays != null && timing.anchor) {
    const cycleDays = (type.renewalMonths ?? 12) * 30;
    const anchorAge = daysUntil(new Date(), timing.anchor);

    if (anchorAge <= cycleDays) {
      const earliest = candidates.reduce((oldest, candidate) => {
        const a = (candidate.issuedAt ?? candidate.createdAt).getTime();
        const b = (oldest.issuedAt ?? oldest.createdAt).getTime();
        return a < b ? candidate : oldest;
      });

      const reference = earliest.issuedAt ?? earliest.createdAt;
      const lateBy = daysUntil(reference, timing.anchor) - timing.withinDays;

      if (lateBy > 0) {
        return {
          status: "OVERDUE",
          detail: `Dated ${lateBy} day${lateBy === 1 ? "" : "s"} past the ${timing.withinDays}-day deadline after ${timing.anchorLabel}.`,
          document: earliest,
          expiresAt,
          daysRemaining: expiresAt ? daysUntil(expiresAt) : null,
        };
      }
    }
  }

  if (!expiresAt) {
    if (type.renewalMonths) {
      return {
        status: "UNDATED",
        detail: `On file, but with no issue date. This type renews every ${type.renewalMonths} months, so expiry can't be tracked.`,
        document: doc,
        expiresAt: null,
        daysRemaining: null,
      };
    }
    return {
      status: "PASS",
      detail: "On file.",
      document: doc,
      expiresAt: null,
      daysRemaining: null,
    };
  }

  const remaining = daysUntil(expiresAt);
  const warnDays = params.warnDays ?? type.warnDays;

  if (remaining < 0) {
    return {
      status: "EXPIRED",
      detail: `Expired ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} ago.`,
      document: doc,
      expiresAt,
      daysRemaining: remaining,
    };
  }
  if (remaining <= warnDays) {
    return {
      status: "EXPIRING",
      detail: `Expires in ${remaining} day${remaining === 1 ? "" : "s"}.`,
      document: doc,
      expiresAt,
      daysRemaining: remaining,
    };
  }
  return {
    status: "PASS",
    detail: `Valid for another ${remaining} days.`,
    document: doc,
    expiresAt,
    daysRemaining: remaining,
  };
}

// --- evaluation -------------------------------------------------------------

type LoadedCheck = RuleCheck & {
  documentType: DocumentType | null;
  regulation: Regulation | null;
};

function baseFinding(check: LoadedCheck): Omit<
  Finding,
  "status" | "detail" | "subjectType" | "subjectId" | "subjectName" | "documentId" | "expiresAt" | "daysRemaining"
> {
  return {
    ruleCheckId: check.id,
    code: check.code,
    title: check.title,
    description: check.description,
    severity: (check.severity as Severity) ?? "MEDIUM",
    remediation: check.remediation,
    wacCite: check.regulation?.cite ?? null,
    regulationTitle: check.regulation?.title ?? null,
    regulationVerified: check.regulation?.verified ?? false,
    documentTypeId: check.documentTypeId,
    documentTypeName: check.documentType?.name ?? null,
  };
}

/**
 * Evaluate every active rule check against a home.
 *
 * @param ruleCodes restrict to specific RuleCheck codes — used by the digest to
 *                  answer "does this new WAC affect me?" without a full run.
 */
export async function evaluateHome(
  homeId: string,
  ruleCodes?: string[],
): Promise<ComplianceReport> {
  const [home, residents, employees, documents, checks] = await Promise.all([
    prisma.home.findUnique({ where: { id: homeId } }),
    prisma.resident.findMany({
      where: { homeId, dischargedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.employee.findMany({
      where: { homeId, terminatedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.document.findMany({ where: { homeId } }),
    prisma.ruleCheck.findMany({
      where: {
        isActive: true,
        ...(ruleCodes?.length ? { code: { in: ruleCodes } } : {}),
      },
      include: { documentType: true, regulation: true },
    }),
  ]);

  if (!home) throw new Error(`Home ${homeId} not found`);

  // Index documents once; a home with 8 residents and 30 rules would otherwise
  // rescan the full document list a few hundred times.
  const homeDocs = new Map<string, Document[]>();
  const residentDocs = new Map<string, Document[]>();
  const employeeDocs = new Map<string, Document[]>();

  for (const doc of documents) {
    if (doc.residentId) {
      push(residentDocs, `${doc.residentId}:${doc.documentTypeId}`, doc);
    } else if (doc.employeeId) {
      push(employeeDocs, `${doc.employeeId}:${doc.documentTypeId}`, doc);
    } else {
      push(homeDocs, doc.documentTypeId, doc);
    }
  }

  const findings: Finding[] = [];
  let notApplicableCount = 0;

  for (const check of checks) {
    const appliesWhen = parseJsonObject<HomePredicate>(check.appliesWhenJson);
    if (!homeApplies(home, appliesWhen)) {
      notApplicableCount++;
      continue;
    }

    const params = parseJsonObject<CheckParams>(check.paramsJson);
    const base = baseFinding(check);

    switch (check.checkType) {
      case "PROFILE_FLAG": {
        const field = params.field as keyof Home | undefined;
        const value = field ? home[field] : undefined;
        let ok: boolean;
        if (params.mustBePresent) {
          ok = value != null && String(value).trim() !== "";
        } else if (params.equals != null) {
          ok = Boolean(value) === params.equals;
        } else {
          ok = Boolean(value);
        }
        findings.push({
          ...base,
          status: ok ? "PASS" : "MISSING",
          detail: ok ? "Recorded on the home profile." : "Not recorded on the home profile.",
          subjectType: "HOME",
          subjectId: null,
          subjectName: home.name,
          documentId: null,
          expiresAt: null,
          daysRemaining: null,
        });
        break;
      }

      case "HOME_DOCUMENT": {
        if (!check.documentType) break;
        const result = resolveDocumentStatus(
          homeDocs.get(check.documentType.id) ?? [],
          check.documentType,
          params,
        );
        findings.push({
          ...base,
          status: result.status,
          detail: result.detail,
          subjectType: "HOME",
          subjectId: null,
          subjectName: home.name,
          documentId: result.document?.id ?? null,
          expiresAt: result.expiresAt,
          daysRemaining: result.daysRemaining,
        });
        break;
      }

      case "PER_RESIDENT_DOCUMENT": {
        if (!check.documentType) break;
        const subjectWhen = parseJsonObject<ResidentPredicate>(check.subjectWhenJson);
        for (const resident of residents) {
          if (!residentApplies(resident, subjectWhen)) continue;
          const result = resolveDocumentStatus(
            residentDocs.get(`${resident.id}:${check.documentType.id}`) ?? [],
            check.documentType,
            params,
            {
              anchor: resident.admittedAt,
              withinDays: params.withinDaysOfAdmission,
              anchorLabel: "admission",
            },
          );
          findings.push({
            ...base,
            status: result.status,
            detail: result.detail,
            subjectType: "RESIDENT",
            subjectId: resident.id,
            subjectName: `${resident.firstName} ${resident.lastName}`,
            documentId: result.document?.id ?? null,
            expiresAt: result.expiresAt,
            daysRemaining: result.daysRemaining,
          });
        }
        break;
      }

      case "PER_EMPLOYEE_DOCUMENT": {
        if (!check.documentType) break;
        const subjectWhen = parseJsonObject<EmployeePredicate>(check.subjectWhenJson);
        for (const employee of employees) {
          if (!employeeApplies(employee, subjectWhen)) continue;
          const result = resolveDocumentStatus(
            employeeDocs.get(`${employee.id}:${check.documentType.id}`) ?? [],
            check.documentType,
            params,
            {
              anchor: employee.hiredAt,
              withinDays: params.withinDaysOfHire,
              anchorLabel: "hire",
            },
          );
          findings.push({
            ...base,
            status: result.status,
            detail: result.detail,
            subjectType: "EMPLOYEE",
            subjectId: employee.id,
            subjectName: `${employee.firstName} ${employee.lastName}`,
            documentId: result.document?.id ?? null,
            expiresAt: result.expiresAt,
            daysRemaining: result.daysRemaining,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  findings.sort(compareFindings);

  const failing = findings.filter((f) => FAILING_STATUSES.includes(f.status));
  const atRisk = findings.filter((f) => AT_RISK_STATUSES.includes(f.status));
  const passing = findings.filter((f) => f.status === "PASS");

  const bySeverity: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of failing) bySeverity[f.severity]++;

  const total = findings.length;
  const score =
    total === 0 ? 100 : Math.round((100 * (passing.length + atRisk.length * 0.5)) / total);

  return {
    homeId,
    generatedAt: new Date(),
    findings,
    failing,
    atRisk,
    passing,
    score,
    totals: { total, passing: passing.length, atRisk: atRisk.length, failing: failing.length },
    bySeverity,
    notApplicableCount,
  };
}

const STATUS_ORDER: Record<FindingStatus, number> = {
  EXPIRED: 0,
  MISSING: 1,
  OVERDUE: 2,
  EXPIRING: 3,
  UNDATED: 4,
  PASS: 5,
};

/** Worst and most urgent first, so the dashboard's top row is the real work. */
export function compareFindings(a: Finding, b: Finding): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;

  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;

  if (a.daysRemaining != null && b.daysRemaining != null) {
    const byDays = a.daysRemaining - b.daysRemaining;
    if (byDays !== 0) return byDays;
  }
  return a.title.localeCompare(b.title);
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

/** Group findings for the binder and dashboard views. */
export function groupBySubject(findings: Finding[]): Array<{
  key: string;
  subjectType: Finding["subjectType"];
  subjectName: string;
  findings: Finding[];
}> {
  const groups = new Map<string, { subjectType: Finding["subjectType"]; subjectName: string; findings: Finding[] }>();
  for (const f of findings) {
    const key = `${f.subjectType}:${f.subjectId ?? "home"}`;
    const existing = groups.get(key);
    if (existing) existing.findings.push(f);
    else {
      groups.set(key, {
        subjectType: f.subjectType,
        subjectName: f.subjectName ?? "The home",
        findings: [f],
      });
    }
  }
  const order: Record<Finding["subjectType"], number> = { HOME: 0, RESIDENT: 1, EMPLOYEE: 2 };
  return [...groups.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort(
      (a, b) =>
        order[a.subjectType] - order[b.subjectType] ||
        a.subjectName.localeCompare(b.subjectName),
    );
}
