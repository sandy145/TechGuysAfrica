import Link from "next/link";
import { STATUS_LABELS, type Finding } from "@/lib/compliance/engine";
import { formatDate } from "@/lib/dates";
import { SeverityBadge, StatusPill, WacCite } from "./ui";

/** Where to go to actually fix a finding. */
function resolveHref(finding: Finding): string {
  if (finding.subjectType === "RESIDENT" && finding.subjectId) {
    return `/residents/${finding.subjectId}`;
  }
  if (finding.subjectType === "EMPLOYEE" && finding.subjectId) {
    return `/employees/${finding.subjectId}`;
  }
  if (finding.documentTypeId) return `/documents?type=${finding.documentTypeId}`;
  return "/settings/home";
}

export function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="avoid-break flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={finding.status} label={STATUS_LABELS[finding.status]} />
          <span className="text-sm font-semibold text-slate-900">{finding.title}</span>
          <SeverityBadge severity={finding.severity} />
        </div>

        <p className="mt-1 text-sm text-slate-600">
          {finding.subjectType !== "HOME" && (
            <span className="font-medium text-slate-800">{finding.subjectName} — </span>
          )}
          {finding.detail}
        </p>

        {finding.remediation && finding.status !== "PASS" && (
          <p className="mt-1 text-sm text-brand-800">
            <span className="font-medium">To fix: </span>
            {finding.remediation}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <WacCite
            cite={finding.wacCite}
            title={finding.regulationTitle}
            verified={finding.regulationVerified}
          />
          {finding.expiresAt && (
            <span className="text-xs text-slate-500">
              Expires {formatDate(finding.expiresAt)}
            </span>
          )}
        </div>
      </div>

      {finding.status !== "PASS" && (
        <Link href={resolveHref(finding)} className="no-print btn-secondary btn-sm shrink-0">
          Resolve
        </Link>
      )}
    </li>
  );
}

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="py-2 text-sm text-slate-500">Nothing here.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {findings.map((finding) => (
        <FindingRow key={`${finding.ruleCheckId}:${finding.subjectId ?? "home"}`} finding={finding} />
      ))}
    </ul>
  );
}
