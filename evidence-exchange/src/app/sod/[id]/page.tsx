import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isAgencyRole, HARM_LABELS, OUTCOME_LABELS, SCOPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/**
 * The statement of deficiencies, plus something a statement of deficiencies has
 * never carried: the evidence index.
 *
 * Every document the provider submitted is listed with its digest, the moment
 * it arrived, and the moment the agency first opened it. If a decision is
 * challenged, the packet answers "what did you look at?" on its face instead
 * of requiring someone to reconstruct an inbox.
 */
export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      home: true,
      leadInspector: true,
      findings: {
        include: {
          sources: true,
          determination: { include: { decidedBy: true, approvedBy: true } },
          citation: { include: { plansOfCorrection: { orderBy: { submittedAt: "desc" } } } },
          submissions: {
            include: { files: true, submittedBy: true, reviewedBy: true },
            orderBy: { submittedAt: "asc" },
          },
        },
        orderBy: { tag: "asc" },
      },
    },
  });
  if (!inspection) notFound();

  if (!isAgencyRole(user.role) && user.providerHomeId !== inspection.homeId) redirect("/portal");
  if (!inspection.sodIssuedAt && !isAgencyRole(user.role)) redirect("/portal");

  const audit = await prisma.auditEvent.findMany({
    where: { inspectionId: id },
    orderBy: { createdAt: "asc" },
  });

  const cited = inspection.findings.filter((f) => f.determination?.outcome === "CITATION");
  const consultations = inspection.findings.filter((f) => f.determination?.outcome === "CONSULTATION");
  const resolved = inspection.findings.filter((f) => f.determination?.outcome === "NO_DEFICIENCY");
  const withdrawn = inspection.findings.filter((f) => f.status === "WITHDRAWN");
  const agencyName = process.env.AGENCY_NAME || "Residential Care Services";
  const parent = process.env.AGENCY_PARENT || "";

  return (
    <main className="mx-auto max-w-4xl bg-white px-6 py-10 print-page">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={isAgencyRole(user.role) ? `/inspections/${id}` : "/portal"} className="text-sm text-gov-700 hover:underline">
          ← Back
        </Link>
        <PrintButton />
      </div>

      <header className="border-b-2 border-ink pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
          {parent ? `${parent} · ` : ""}
          {agencyName}
        </p>
        <h1 className="mt-1 text-2xl font-bold">Statement of Deficiencies</h1>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p>
            <span className="text-ink-soft">Home:</span> <strong>{inspection.home.name}</strong>
          </p>
          <p>
            <span className="text-ink-soft">Licence:</span> {inspection.home.licenseNumber}
          </p>
          <p>
            <span className="text-ink-soft">Licensee:</span> {inspection.home.providerName}
          </p>
          <p>
            <span className="text-ink-soft">Survey number:</span> {inspection.surveyNumber ?? "—"}
          </p>
          <p>
            <span className="text-ink-soft">Address:</span> {inspection.home.addressLine1}, {inspection.home.city}{" "}
            {inspection.home.zip}
          </p>
          <p>
            <span className="text-ink-soft">Licensor:</span> {inspection.leadInspector?.name ?? "—"}
          </p>
          <p>
            <span className="text-ink-soft">Inspection dates:</span> {formatDate(inspection.enteredAt)} –{" "}
            {formatDate(inspection.exitConferenceAt)}
          </p>
          <p>
            <span className="text-ink-soft">Issued:</span>{" "}
            {inspection.sodIssuedAt ? formatDate(inspection.sodIssuedAt) : "DRAFT — not issued"}
          </p>
        </div>
      </header>

      {inspection.summary ? (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide">Summary</h2>
          <p className="mt-1 whitespace-pre-line text-sm">{inspection.summary}</p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide">Citations ({cited.length})</h2>
        {cited.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">No citations were issued.</p>
        ) : (
          <div className="mt-2 space-y-6">
            {cited.map((f) => (
              <article key={f.id} className="break-inside-avoid border border-ink/20 p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-bold">
                    {f.tag} — {f.wacCite}
                  </h3>
                  <span className="text-xs text-ink-soft">
                    {SCOPE_LABELS[f.scope]} · {HARM_LABELS[f.harm]}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Requirement: </span>
                  {f.requirementText}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Failed provider practice: </span>
                  {f.practiceText}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Evidence: </span>
                  {f.sources.map((s) => s.detail).join(" ")}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Determination: </span>
                  {f.determination?.rationale}
                </p>
                {f.determination?.overrideReason ? (
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">Supervisory override: </span>
                    {f.determination.overrideReason}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-ink-soft">
                  Decided by {f.determination?.decidedBy?.name} on {formatDate(f.determination?.decidedAt)}
                  {f.determination?.approvedBy
                    ? ` · approved by ${f.determination.approvedBy.name} on ${formatDate(f.determination.approvedAt)}`
                    : ""}
                  {f.citation?.pocDueAt ? ` · plan of correction due ${formatDate(f.citation.pocDueAt)}` : ""}
                  {f.citation?.correctionDueAt
                    ? ` · correction due ${formatDate(f.citation.correctionDueAt)}`
                    : ""}
                </p>

                {f.citation?.plansOfCorrection[0] ? (
                  <div className="mt-3 border-t border-ink/20 pt-3 text-sm">
                    <p className="font-semibold">Plan of correction</p>
                    <p className="mt-1">
                      <span className="text-ink-soft">How corrected: </span>
                      {f.citation.plansOfCorrection[0].howCorrected}
                    </p>
                    <p>
                      <span className="text-ink-soft">Preventing recurrence: </span>
                      {f.citation.plansOfCorrection[0].systemicMeasures}
                    </p>
                    <p>
                      <span className="text-ink-soft">Responsible: </span>
                      {f.citation.plansOfCorrection[0].responsiblePerson} ·{" "}
                      {formatDate(f.citation.plansOfCorrection[0].completionDate)} ·{" "}
                      {f.citation.plansOfCorrection[0].status}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 border-t border-ink/20 pt-3">
                    <p className="text-xs font-semibold uppercase text-ink-soft">Plan of correction</p>
                    <div className="mt-1 h-20 border border-dashed border-ink/30" />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {consultations.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Consultations — technical assistance, not cited ({consultations.length})
          </h2>
          <div className="mt-2 space-y-3">
            {consultations.map((f) => (
              <article key={f.id} className="break-inside-avoid border-l-4 border-amber-400 pl-3">
                <h3 className="text-sm font-semibold">
                  {f.tag} — {f.wacCite}
                </h3>
                <p className="text-sm">{f.practiceText}</p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">Resolution: </span>
                  {f.determination?.rationale}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {resolved.length > 0 || withdrawn.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Findings resolved by documentation ({resolved.length + withdrawn.length})
          </h2>
          <p className="text-xs text-ink-soft">
            Raised at the exit conference and closed without a citation once the provider&apos;s records were
            reviewed.
          </p>
          <div className="mt-2 space-y-3">
            {[...resolved, ...withdrawn].map((f) => (
              <article key={f.id} className="break-inside-avoid border-l-4 border-emerald-400 pl-3">
                <h3 className="text-sm font-semibold">
                  {f.tag} — {f.wacCite}
                </h3>
                <p className="text-sm">{f.practiceText}</p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">
                    {f.determination ? OUTCOME_LABELS[f.determination.outcome as keyof typeof OUTCOME_LABELS] : "Withdrawn"}:{" "}
                  </span>
                  {f.determination?.rationale ?? "Withdrawn before determination."}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 break-before-page">
        <h2 className="text-sm font-bold uppercase tracking-wide">Evidence index</h2>
        <p className="text-xs text-ink-soft">
          Everything the provider submitted, when it arrived, and when the agency first opened it.
        </p>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-ink/30 text-left">
              <th className="py-1 pr-2 font-semibold">Finding</th>
              <th className="py-1 pr-2 font-semibold">Document</th>
              <th className="py-1 pr-2 font-semibold">Submitted</th>
              <th className="py-1 pr-2 font-semibold">First opened</th>
              <th className="py-1 pr-2 font-semibold">Reviewed</th>
              <th className="py-1 font-semibold">Digest</th>
            </tr>
          </thead>
          <tbody>
            {inspection.findings.flatMap((f) =>
              f.submissions.flatMap((s) =>
                (s.files.length > 0
                  ? s.files
                  : [{ id: s.id, fileName: "(note only, no attachment)", firstOpenedAt: null, sha256: "" }]
                ).map((file) => (
                  <tr key={`${s.id}-${file.id}`} className="border-b border-ink/10">
                    <td className="py-1 pr-2">{f.tag}</td>
                    <td className="py-1 pr-2">{file.fileName}</td>
                    <td className="py-1 pr-2">
                      {formatDateTime(s.submittedAt)}
                      {s.isLate ? " (late)" : ""}
                    </td>
                    <td className="py-1 pr-2">
                      {file.firstOpenedAt ? formatDateTime(file.firstOpenedAt) : "—"}
                    </td>
                    <td className="py-1 pr-2">
                      {s.reviewedAt ? `${formatDate(s.reviewedAt)} · ${s.reviewedBy?.name ?? ""}` : "—"}
                    </td>
                    <td className="py-1 font-mono text-[10px]">{file.sha256 ? `${file.sha256.slice(0, 16)}…` : "—"}</td>
                  </tr>
                )),
              ),
            )}
            {inspection.findings.every((f) => f.submissions.length === 0) ? (
              <tr>
                <td colSpan={6} className="py-2 text-ink-soft">
                  No documentation was submitted during the evidence window.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide">Record of activity</h2>
        <table className="mt-2 w-full border-collapse text-xs">
          <tbody>
            {audit.map((e) => (
              <tr key={e.id} className="border-b border-ink/10">
                <td className="w-44 py-1 pr-2 align-top text-ink-soft">{formatDateTime(e.createdAt)}</td>
                <td className="w-40 py-1 pr-2 align-top">{e.actorName}</td>
                <td className="py-1">{e.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-10 border-t border-ink/30 pt-4 text-xs text-ink-soft">
        <p>
          Generated by Evidence Exchange on {formatDateTime(new Date())}. The evidence index and record of
          activity are produced from the system&apos;s append-only log.
        </p>
      </footer>
    </main>
  );
}
