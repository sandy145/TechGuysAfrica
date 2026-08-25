import "server-only";
import { prisma } from "./db";
import { DEFAULT_POLICY, reviewState, type AgencyPolicy, type SubmissionShape } from "./workflow";

/** Program deadlines. Falls back to the built-in defaults before setup. */
export async function getPolicy(agencyId?: string | null): Promise<AgencyPolicy> {
  const agency = agencyId
    ? await prisma.agency.findUnique({ where: { id: agencyId } })
    : await prisma.agency.findFirst();
  if (!agency) return DEFAULT_POLICY;
  return {
    evidenceWindowDays: agency.evidenceWindowDays,
    pocDueDays: agency.pocDueDays,
    idrRequestDays: agency.idrRequestDays,
    correctionDays: agency.correctionDays,
    minEvidenceSources: agency.minEvidenceSources,
  };
}

export const findingInclude = {
  sources: true,
  evidenceRequests: { orderBy: { createdAt: "asc" } },
  submissions: {
    include: { files: true, submittedBy: true, reviewedBy: true },
    orderBy: { submittedAt: "asc" },
  },
  determination: { include: { decidedBy: true, approvedBy: true } },
  citation: { include: { plansOfCorrection: { orderBy: { submittedAt: "desc" } } } },
  notes: { include: { author: true }, orderBy: { createdAt: "asc" } },
} as const;

/**
 * Findings carrying provider evidence that no agency user has reviewed, oldest
 * submission first. This query is the product: it is the thing an inbox cannot
 * do, and it is what stops a document from being missed.
 */
export async function unreviewedEvidence(filter: { inspectorId?: string } = {}) {
  const findings = await prisma.finding.findMany({
    where: {
      status: { in: ["PENDING_EVIDENCE", "EVIDENCE_RECEIVED"] },
      submissions: { some: { reviewedAt: null } },
      ...(filter.inspectorId
        ? { inspection: { leadInspectorId: filter.inspectorId } }
        : {}),
    },
    include: {
      inspection: { include: { home: true, leadInspector: true } },
      submissions: { include: { files: true, submittedBy: true } },
      sources: true,
    },
  });

  return findings
    .map((f) => {
      const state = reviewState({ submissions: f.submissions as unknown as SubmissionShape[] });
      const oldestUnreviewed = f.submissions
        .filter((s) => !s.reviewedAt)
        .reduce<Date | null>((acc, s) => (!acc || s.submittedAt < acc ? s.submittedAt : acc), null);
      return { finding: f, state, oldestUnreviewed };
    })
    .sort((a, b) => (a.oldestUnreviewed?.getTime() ?? 0) - (b.oldestUnreviewed?.getTime() ?? 0));
}

/** Open findings whose evidence deadline has passed with nothing submitted. */
export async function expiredWithoutResponse(filter: { inspectorId?: string } = {}) {
  return prisma.finding.findMany({
    where: {
      status: "PENDING_EVIDENCE",
      evidenceDueAt: { lt: new Date() },
      submissions: { none: {} },
      ...(filter.inspectorId ? { inspection: { leadInspectorId: filter.inspectorId } } : {}),
    },
    include: { inspection: { include: { home: true } } },
    orderBy: { evidenceDueAt: "asc" },
  });
}

/** Findings reviewed and ready for a determination. */
export async function awaitingDetermination(filter: { inspectorId?: string } = {}) {
  const findings = await prisma.finding.findMany({
    where: {
      status: { in: ["EVIDENCE_RECEIVED", "PENDING_EVIDENCE"] },
      determination: null,
      ...(filter.inspectorId ? { inspection: { leadInspectorId: filter.inspectorId } } : {}),
    },
    include: {
      inspection: { include: { home: true } },
      submissions: { include: { files: true } },
      sources: true,
    },
  });
  return findings.filter((f) => {
    const state = reviewState({ submissions: f.submissions as unknown as SubmissionShape[] });
    return state.hasEvidence && state.fullyReviewed;
  });
}

export async function inspectionsForUser(userId: string, role: string) {
  return prisma.inspection.findMany({
    where: role === "INSPECTOR" ? { leadInspectorId: userId } : {},
    include: {
      home: true,
      leadInspector: true,
      findings: { include: { submissions: { include: { files: true } }, determination: true } },
    },
    orderBy: [{ status: "asc" }, { exitConferenceAt: "desc" }],
  });
}

export type InspectionRollup = {
  total: number;
  open: number;
  determined: number;
  cited: number;
  unreviewedSubmissions: number;
  unopenedFiles: number;
};

export function rollupFindings(
  findings: {
    status: string;
    determination: { outcome: string } | null;
    submissions: { reviewedAt: Date | null; files: { firstOpenedAt: Date | null }[] }[];
  }[],
): InspectionRollup {
  let unreviewedSubmissions = 0;
  let unopenedFiles = 0;
  for (const f of findings) {
    for (const s of f.submissions) {
      if (!s.reviewedAt) unreviewedSubmissions++;
      for (const file of s.files) if (!file.firstOpenedAt) unopenedFiles++;
    }
  }
  return {
    total: findings.length,
    open: findings.filter((f) => f.status === "PENDING_EVIDENCE" || f.status === "EVIDENCE_RECEIVED")
      .length,
    determined: findings.filter((f) => f.status === "DETERMINED").length,
    cited: findings.filter((f) => f.determination?.outcome === "CITATION").length,
    unreviewedSubmissions,
    unopenedFiles,
  };
}
