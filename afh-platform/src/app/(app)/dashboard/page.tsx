import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateHome } from "@/lib/compliance/engine";
import { parseJsonArray } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { FindingsList } from "@/components/FindingsList";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireHome();

  const [report, home, recentUpdates, pendingSignatures] = await Promise.all([
    evaluateHome(user.homeId),
    prisma.home.findUnique({ where: { id: user.homeId } }),
    prisma.regulatoryUpdate.findMany({
      orderBy: { publishedAt: "desc" },
      take: 4,
      include: { regulation: true },
    }),
    prisma.formInstance.count({
      where: { homeId: user.homeId, status: "AWAITING_SIGNATURES" },
    }),
  ]);

  const scoreTone =
    report.score >= 95 ? "emerald" : report.score >= 80 ? "amber" : "red";

  // Which of the recent rule changes actually leave this home exposed.
  const updateImpacts = await Promise.all(
    recentUpdates.map(async (update) => {
      const codes = parseJsonArray<string>(update.ruleCheckCodesJson);
      if (codes.length === 0) return { update, failing: 0, checked: 0 };
      const scoped = await evaluateHome(user.homeId, codes);
      return {
        update,
        failing: scoped.totals.failing,
        checked: scoped.totals.total,
      };
    }),
  );

  return (
    <>
      <PageHeader
        title={home?.name ?? "Dashboard"}
        description={
          <>
            Inspection readiness as of {formatDate(report.generatedAt)}.{" "}
            {report.notApplicableCount > 0 && (
              <span className="text-slate-500">
                {report.notApplicableCount} rule
                {report.notApplicableCount === 1 ? "" : "s"} skipped as not applicable to your
                profile.
              </span>
            )}
          </>
        }
        action={
          <>
            <Link href="/binder" className="btn-secondary">
              Print inspection binder
            </Link>
            <Link href="/documents?upload=1" className="btn-primary">
              Upload a document
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Readiness"
          value={`${report.score}%`}
          hint={`${report.totals.passing} of ${report.totals.total} checks in place`}
          tone={scoreTone}
        />
        <Stat
          label="Would be cited today"
          value={report.totals.failing}
          hint={
            report.bySeverity.CRITICAL > 0
              ? `${report.bySeverity.CRITICAL} critical`
              : "Missing, expired, or late"
          }
          tone={report.totals.failing > 0 ? "red" : "emerald"}
        />
        <Stat
          label="Expiring soon"
          value={report.totals.atRisk}
          hint="Still valid, but not for long"
          tone={report.totals.atRisk > 0 ? "amber" : "emerald"}
        />
        <Stat
          label="Awaiting signature"
          value={pendingSignatures}
          hint="Forms sent but not signed"
          tone={pendingSignatures > 0 ? "amber" : "emerald"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="What a licensor would write up today"
            description={
              report.failing.length === 0
                ? "Nothing outstanding."
                : `${report.failing.length} finding${report.failing.length === 1 ? "" : "s"}, worst first.`
            }
          >
            {report.failing.length === 0 ? (
              <EmptyState
                title="No open findings"
                description="Every applicable requirement has a current record on file. Keep an eye on the expiring list so it stays that way."
              />
            ) : (
              <FindingsList findings={report.failing} />
            )}
          </Card>

          <Card
            title="Expiring soon"
            description="Compliant right now. These are the ones that quietly lapse."
          >
            {report.atRisk.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing expiring inside the warning window.</p>
            ) : (
              <FindingsList findings={report.atRisk} />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Rule changes"
            description="Checked against your records"
            action={
              <Link href="/updates" className="btn-secondary btn-sm">
                All updates
              </Link>
            }
          >
            {updateImpacts.length === 0 ? (
              <p className="text-sm text-slate-500">No updates published yet.</p>
            ) : (
              <ul className="space-y-4">
                {updateImpacts.map(({ update, failing, checked }) => (
                  <li key={update.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <Link
                      href={`/updates#${update.id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                    >
                      {update.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(update.publishedAt)}
                      {update.regulation ? ` · ${update.regulation.cite}` : ""}
                    </p>
                    <div className="mt-2">
                      {checked === 0 ? (
                        <Badge>No automatic check</Badge>
                      ) : failing > 0 ? (
                        <Badge tone="red">
                          {failing} gap{failing === 1 ? "" : "s"} at your home
                        </Badge>
                      ) : (
                        <Badge tone="emerald">You already comply</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Quick actions">
            <ul className="space-y-2 text-sm">
              {[
                { href: "/forms", label: "Generate and sign a form" },
                { href: "/residents", label: "Add a resident" },
                { href: "/employees", label: "Add an employee" },
                { href: "/citations", label: "See what others were cited for" },
                { href: "/citations/new", label: "Post a citation anonymously" },
                { href: "/subscriptions", label: "Manage newsletter subscriptions" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className="text-slate-700">{link.label}</span>
                    <span aria-hidden className="text-slate-400">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
