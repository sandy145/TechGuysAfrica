import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateHome } from "@/lib/compliance/engine";
import { formatDate } from "@/lib/dates";
import {
  parseJsonArray,
  UPDATE_KIND_LABELS,
  type Severity,
  type UpdateKind,
} from "@/lib/constants";
import { FindingsList } from "@/components/FindingsList";
import { Badge, Card, EmptyState, PageHeader, SeverityBadge, WacCite } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  const user = await getCurrentUser();

  const updates = await prisma.regulatoryUpdate.findMany({
    orderBy: { publishedAt: "desc" },
    include: { regulation: true },
    take: 40,
  });

  // Evaluate each update against the viewer's own records.
  const withImpact = await Promise.all(
    updates.map(async (update) => {
      const codes = parseJsonArray<string>(update.ruleCheckCodesJson);
      if (!user?.homeId || codes.length === 0) {
        return { update, report: null, codes };
      }
      return { update, report: await evaluateHome(user.homeId, codes), codes };
    }),
  );

  return (
    <>
      <PageHeader
        title="Rule updates"
        description="New and amended Washington rules, policy changes, and enforcement trends — each one checked against your own records rather than just announced."
        action={
          <Link href="/subscriptions" className="btn-primary">
            Subscribe to the digest
          </Link>
        }
      />

      {!user?.homeId && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-900">
          <Link href="/register" className="font-semibold underline">
            Create an account
          </Link>{" "}
          to see whether each change leaves your home out of compliance.
        </div>
      )}

      {updates.length === 0 ? (
        <Card>
          <EmptyState
            title="No updates published"
            description="Run `npm run db:seed` to load the sample update feed, or add entries to the RegulatoryUpdate table as the state publishes changes."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {withImpact.map(({ update, report, codes }) => (
            <Card key={update.id}>
              <div id={update.id} className="scroll-mt-20">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">
                    {UPDATE_KIND_LABELS[update.kind as UpdateKind] ?? update.kind}
                  </Badge>
                  <SeverityBadge severity={update.severity as Severity} />
                  <span className="text-xs text-slate-500">
                    Published {formatDate(update.publishedAt)}
                    {update.effectiveAt && ` · effective ${formatDate(update.effectiveAt)}`}
                  </span>
                </div>

                <h2 className="mt-2 text-lg font-semibold text-slate-900">{update.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{update.summary}</p>

                {update.body && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {update.body}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {update.regulation && (
                    <WacCite
                      cite={update.regulation.cite}
                      title={update.regulation.title}
                      verified={update.regulation.verified}
                    />
                  )}
                  {update.source && (
                    <span className="text-xs text-slate-500">Source: {update.source}</span>
                  )}
                  {update.url && (
                    <a
                      href={update.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-700 underline"
                    >
                      Read the official text
                    </a>
                  )}
                </div>

                {/* Personalised impact */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {!user?.homeId ? (
                    <p className="text-sm text-slate-500">
                      Sign in to check this against your records.
                    </p>
                  ) : codes.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No automatic check is wired to this update — review it by hand.
                    </p>
                  ) : !report || report.totals.total === 0 ? (
                    <Badge>Doesn&apos;t apply to your home&apos;s profile</Badge>
                  ) : report.totals.failing === 0 && report.totals.atRisk === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
                      <span className="font-semibold">You already comply.</span> All{" "}
                      {report.totals.total} related check
                      {report.totals.total === 1 ? "" : "s"} pass.
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
                        <span className="font-semibold">
                          {report.totals.failing} gap
                          {report.totals.failing === 1 ? "" : "s"} at your home
                        </span>
                        {report.totals.atRisk > 0 &&
                          `, plus ${report.totals.atRisk} expiring soon`}
                        . Here is exactly what to fix.
                      </div>
                      <FindingsList findings={[...report.failing, ...report.atRisk]} />
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
