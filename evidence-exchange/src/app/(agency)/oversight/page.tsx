import Link from "next/link";
import { requireSupervisor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unreviewedEvidence } from "@/lib/queries";
import { businessDaysUntil, formatDate, relativeTime } from "@/lib/dates";
import { OUTCOME_LABELS } from "@/lib/constants";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * The view a programme manager needs and does not have today: whether evidence
 * is being read before decisions are made, how long providers wait, and
 * whether two licensors treat the same shortfall the same way.
 */
export default async function OversightPage() {
  await requireSupervisor();

  const [unreviewed, determinations, pendingApproval, latePocs, idrs, inspectors] = await Promise.all([
    unreviewedEvidence(),
    prisma.determination.findMany({
      include: { decidedBy: true, finding: { include: { inspection: { include: { home: true } } } } },
      orderBy: { decidedAt: "desc" },
    }),
    prisma.determination.findMany({
      where: { outcome: "CITATION", approvedAt: null, finding: { harm: "IMMEDIATE_JEOPARDY" } },
      include: { finding: { include: { inspection: { include: { home: true } } } }, decidedBy: true },
    }),
    prisma.citation.findMany({
      where: { status: "PENDING_POC", pocDueAt: { lt: new Date() } },
      include: { finding: { include: { inspection: { include: { home: true } } } } },
    }),
    prisma.idrRequest.findMany({
      where: { status: { in: ["REQUESTED", "SCHEDULED"] } },
      include: { inspection: { include: { home: true } }, requestedBy: true },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.user.findMany({ where: { role: "INSPECTOR" } }),
  ]);

  // Determinations recorded with an override, and determinations recorded
  // where evidence existed — the two numbers that say whether the guardrails
  // are working or being walked around.
  const withOverride = determinations.filter((d) => d.overrideReason);
  const citedWithNoResponse = determinations.filter(
    (d) => d.outcome === "CITATION" && d.noProviderResponse,
  );

  const byInspector = inspectors.map((inspector) => {
    const theirs = determinations.filter((d) => d.decidedById === inspector.id);
    const count = (outcome: string) => theirs.filter((d) => d.outcome === outcome).length;
    return {
      inspector,
      total: theirs.length,
      citation: count("CITATION"),
      consultation: count("CONSULTATION"),
      noDeficiency: count("NO_DEFICIENCY"),
      overrides: theirs.filter((d) => d.overrideReason).length,
    };
  });

  const oldestWait = unreviewed[0]?.oldestUnreviewed ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Oversight"
        title="Programme integrity"
        description="Whether evidence is being read before decisions are made, and whether the same shortfall gets the same answer across the office."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Unreviewed submissions"
          value={unreviewed.length}
          tone={unreviewed.length > 0 ? "urgent" : "ok"}
          href="/review"
          note={oldestWait ? `oldest ${relativeTime(oldestWait)}` : "queue clear"}
        />
        <Stat
          label="Determinations with override"
          value={withOverride.length}
          tone={withOverride.length > 0 ? "warn" : "neutral"}
          note="Recorded below the evidence standard"
        />
        <Stat
          label="Cited with no provider response"
          value={citedWithNoResponse.length}
          note="Window closed with nothing submitted"
        />
        <Stat
          label="Immediate jeopardy awaiting approval"
          value={pendingApproval.length}
          tone={pendingApproval.length > 0 ? "urgent" : "neutral"}
        />
      </div>

      {unreviewed.length > 0 ? (
        <div className="mt-6">
          <Alert tone="warn" title="Evidence is waiting in the office">
            {unreviewed.length} finding{unreviewed.length === 1 ? " has" : "s have"} provider documentation
            that nobody has opened. None of them can be cited until someone does — but a provider is waiting
            on each one.
          </Alert>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Determination mix by licensor"
            subtitle="Wide variation is not proof of anything, but it is the question worth asking."
          />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-5 py-2 font-medium">Licensor</th>
                  <th className="px-3 py-2 font-medium">Decisions</th>
                  <th className="px-3 py-2 font-medium">Cited</th>
                  <th className="px-3 py-2 font-medium">Consultation</th>
                  <th className="px-3 py-2 font-medium">No deficiency</th>
                  <th className="px-5 py-2 font-medium">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {byInspector.map((row) => (
                  <tr key={row.inspector.id}>
                    <td className="px-5 py-3 font-medium text-ink">{row.inspector.name}</td>
                    <td className="px-3 py-3 tabular-nums">{row.total}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.citation}
                      {row.total > 0 ? (
                        <span className="ml-1 text-xs text-ink-soft">
                          ({Math.round((row.citation / row.total) * 100)}%)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{row.consultation}</td>
                    <td className="px-3 py-3 tabular-nums">{row.noDeficiency}</td>
                    <td className="px-5 py-3 tabular-nums">
                      {row.overrides > 0 ? <Badge tone="warn">{row.overrides}</Badge> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Overrides on the record" subtitle="Every determination recorded below the evidence standard." />
          <CardBody className="p-0">
            {withOverride.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">None.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {withOverride.map((d) => (
                  <li key={d.id} className="px-5 py-3">
                    <Link href={`/findings/${d.findingId}`} className="text-sm font-medium text-gov-700 hover:underline">
                      {d.finding.tag} · {d.finding.inspection.home.name}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {OUTCOME_LABELS[d.outcome as keyof typeof OUTCOME_LABELS]} by {d.decidedBy?.name} ·{" "}
                      {formatDate(d.decidedAt)}
                    </p>
                    <p className="mt-1 text-sm text-ink">{d.overrideReason}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plans of correction overdue" />
          <CardBody className="p-0">
            {latePocs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">None overdue.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {latePocs.map((c) => (
                  <li key={c.id} className="px-5 py-3">
                    <Link href={`/findings/${c.findingId}`} className="text-sm font-medium text-gov-700 hover:underline">
                      {c.finding.tag} · {c.finding.inspection.home.name}
                    </Link>
                    <p className="text-xs text-red-700">
                      Due {formatDate(c.pocDueAt)} · {Math.abs(businessDaysUntil(c.pocDueAt!))} working days
                      overdue
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Disputes in flight" />
          <CardBody className="p-0">
            {idrs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">None open.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {idrs.map((idr) => (
                  <li key={idr.id} className="px-5 py-3">
                    <Link
                      href={`/inspections/${idr.inspectionId}`}
                      className="text-sm font-medium text-gov-700 hover:underline"
                    >
                      {idr.inspection.home.name}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {idr.type} · requested {formatDate(idr.requestedAt)} by {idr.requestedBy?.name}
                      {idr.isLate ? " · late" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
