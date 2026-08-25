import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  effectiveExpiry,
  evaluateHome,
  groupBySubject,
  STATUS_LABELS,
} from "@/lib/compliance/engine";
import { formatDate, formatDateLong } from "@/lib/dates";
import { parseJsonArray, SPECIALTY_LABELS, type Specialty } from "@/lib/constants";
import { PrintTrigger } from "@/components/PrintTrigger";
import { StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * The binder is the artefact a provider actually hands to a licensor: a cover
 * sheet stating what is on file and what is not, then a tab per resident and
 * per employee. It is built for paper — screen styling is secondary.
 */
export default async function BinderPage() {
  const user = await requireHome();

  const [home, report, documents, residents, employees] = await Promise.all([
    prisma.home.findUnique({ where: { id: user.homeId } }),
    evaluateHome(user.homeId),
    prisma.document.findMany({
      where: { homeId: user.homeId },
      include: { documentType: true },
      orderBy: [{ documentType: { category: "asc" } }, { createdAt: "desc" } ],
    }),
    prisma.resident.findMany({
      where: { homeId: user.homeId, dischargedAt: null },
      orderBy: [{ lastName: "asc" }],
    }),
    prisma.employee.findMany({
      where: { homeId: user.homeId, terminatedAt: null },
      orderBy: [{ lastName: "asc" }],
    }),
  ]);

  const specialties = parseJsonArray<Specialty>(home?.specialties);
  const groups = groupBySubject(report.findings);

  const homeDocs = documents.filter((d) => !d.residentId && !d.employeeId);
  const docsFor = (key: "residentId" | "employeeId", id: string) =>
    documents.filter((d) => d[key] === id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inspection binder</h1>
          <p className="mt-1 text-sm text-slate-600">
            Print this, or save it as a PDF, and keep a copy at the front of your physical
            binder. It reflects your records as of right now.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="btn-secondary">
            Back to dashboard
          </Link>
          <PrintTrigger label="Print binder" />
        </div>
      </div>

      {/* Cover sheet */}
      <section className="card avoid-break mb-6 px-8 py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
          Adult family home · documentation summary
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">{home?.name}</h2>

        <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <Field label="License number" value={home?.licenseNumber ?? "—"} />
          <Field label="Licensed since" value={formatDate(home?.licensedAt)} />
          <Field label="Bed capacity" value={String(home?.bedCapacity ?? "—")} />
          <Field
            label="Address"
            value={
              [home?.addressLine1, home?.city, home?.zip].filter(Boolean).join(", ") || "—"
            }
          />
          <Field label="County" value={home?.county ?? "—"} />
          <Field label="Phone" value={home?.phone ?? "—"} />
          <Field
            label="Specialties"
            value={
              specialties.length
                ? specialties.map((s) => SPECIALTY_LABELS[s]).join(", ")
                : "None"
            }
          />
          <Field label="Current residents" value={String(residents.length)} />
          <Field label="Current staff" value={String(employees.length)} />
        </dl>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-200 pt-5">
          <Summary label="Requirements met" value={report.totals.passing} tone="text-emerald-700" />
          <Summary label="Expiring soon" value={report.totals.atRisk} tone="text-amber-700" />
          <Summary label="Outstanding" value={report.totals.failing} tone="text-red-700" />
        </div>

        <p className="mt-5 text-xs text-slate-500">
          Generated {formatDateLong(report.generatedAt)}. Covers {report.totals.total} applicable
          checks; {report.notApplicableCount} were skipped as inapplicable to this home&apos;s
          profile. This summary reflects what has been recorded in the platform and is not a
          determination of compliance.
        </p>
      </section>

      {/* Outstanding items — first thing a provider needs to see. */}
      {report.failing.length > 0 && (
        <section className="card avoid-break mb-6 px-8 py-6">
          <h2 className="text-lg font-bold text-slate-900">Outstanding before inspection</h2>
          <ul className="mt-3 space-y-2">
            {report.failing.map((f) => (
              <li key={`${f.ruleCheckId}:${f.subjectId ?? "home"}`} className="avoid-break text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={f.status} label={STATUS_LABELS[f.status]} />
                  <span className="font-medium text-slate-900">{f.title}</span>
                  {f.subjectType !== "HOME" && (
                    <span className="text-slate-600">— {f.subjectName}</span>
                  )}
                </div>
                {f.remediation && (
                  <p className="ml-1 mt-0.5 text-xs text-slate-600">{f.remediation}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tab 1: the home itself */}
      <BinderTab
        heading="Tab 1 · Home records"
        findings={groups.find((g) => g.subjectType === "HOME")?.findings ?? []}
        documents={homeDocs}
      />

      {residents.map((resident, index) => (
        <BinderTab
          key={resident.id}
          heading={`Tab ${index + 2} · Resident — ${resident.firstName} ${resident.lastName}`}
          subheading={`Admitted ${formatDate(resident.admittedAt)}`}
          findings={
            groups.find((g) => g.subjectType === "RESIDENT" && g.subjectName === `${resident.firstName} ${resident.lastName}`)
              ?.findings ?? []
          }
          documents={docsFor("residentId", resident.id)}
          pageBreak
        />
      ))}

      {employees.map((employee, index) => (
        <BinderTab
          key={employee.id}
          heading={`Tab ${residents.length + index + 2} · Employee — ${employee.firstName} ${employee.lastName}`}
          subheading={`Hired ${formatDate(employee.hiredAt)}`}
          findings={
            groups.find((g) => g.subjectType === "EMPLOYEE" && g.subjectName === `${employee.firstName} ${employee.lastName}`)
              ?.findings ?? []
          }
          documents={docsFor("employeeId", employee.id)}
          pageBreak
        />
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={`text-3xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

type BinderDoc = {
  id: string;
  title: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  documentType: { name: string; renewalMonths: number | null };
};

function BinderTab({
  heading,
  subheading,
  findings,
  documents,
  pageBreak = false,
}: {
  heading: string;
  subheading?: string;
  findings: Array<{
    ruleCheckId: string;
    subjectId: string | null;
    title: string;
    status: keyof typeof STATUS_LABELS;
    detail: string;
    wacCite: string | null;
  }>;
  documents: BinderDoc[];
  pageBreak?: boolean;
}) {
  return (
    <section className={`card mb-6 px-8 py-6 ${pageBreak ? "page-break" : ""}`}>
      <h2 className="text-lg font-bold text-slate-900">{heading}</h2>
      {subheading && <p className="text-sm text-slate-500">{subheading}</p>}

      <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
        Requirement checklist
      </h3>
      {findings.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No applicable checks.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {findings.map((f) => (
            <li
              key={`${f.ruleCheckId}:${f.subjectId ?? "home"}`}
              className="avoid-break flex items-start gap-2 text-sm"
            >
              <StatusPill status={f.status} label={STATUS_LABELS[f.status]} />
              <span className="flex-1">
                <span className="text-slate-900">{f.title}</span>
                {f.wacCite && <span className="ml-1.5 text-xs text-slate-500">{f.wacCite}</span>}
                <span className="block text-xs text-slate-500">{f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">
        Documents in this tab
      </h3>
      {documents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nothing filed.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5 font-semibold">Document</th>
              <th className="py-1.5 font-semibold">Issued</th>
              <th className="py-1.5 font-semibold">Expires</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const expiry = effectiveExpiry(doc, doc.documentType);
              return (
                <tr key={doc.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="text-slate-900">{doc.title}</span>
                    <span className="block text-xs text-slate-500">{doc.documentType.name}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-600">{formatDate(doc.issuedAt)}</td>
                  <td className="py-1.5 text-slate-600">{formatDate(expiry)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
