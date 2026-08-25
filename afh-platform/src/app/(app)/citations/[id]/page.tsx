import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorHash } from "@/lib/anon";
import { evaluateHome } from "@/lib/compliance/engine";
import { voteCitationAction, withdrawCitationAction } from "@/app/actions/citations";
import { formatDate } from "@/lib/dates";
import {
  CITATION_SEVERITY_LABELS,
  parseJsonArray,
  SURVEY_TYPE_LABELS,
  type CitationSeverity,
  type SurveyType,
} from "@/lib/constants";
import { FindingsList } from "@/components/FindingsList";
import { Badge, Card, NoticeBanner, PageHeader, WacCite } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CitationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ posted?: string; redacted?: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const query = await searchParams;

  const citation = await prisma.citation.findUnique({
    where: { id },
    include: { regulation: true },
  });
  if (!citation) notFound();

  // The author can see their own post before it clears moderation; everyone
  // else only sees approved posts.
  const isAuthor = Boolean(
    user?.homeId && citation.authorHash === authorHash(user.homeId),
  );
  if (citation.status !== "APPROVED" && !isAuthor) notFound();

  const tags = parseJsonArray<string>(citation.tagsJson);

  // "Would this have been written up at my home?" — run the same rule against
  // the viewer's own records.
  let selfCheck: Awaited<ReturnType<typeof evaluateHome>> | null = null;
  let ruleCodes: string[] = [];

  if (user?.homeId && citation.regulationId) {
    const checks = await prisma.ruleCheck.findMany({
      where: { regulationId: citation.regulationId, isActive: true },
      select: { code: true },
    });
    ruleCodes = checks.map((c) => c.code);
    if (ruleCodes.length > 0) selfCheck = await evaluateHome(user.homeId, ruleCodes);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={citation.summary}
        description={
          <>
            {citation.county ? `${citation.county} County` : "County withheld"} ·{" "}
            {citation.bedSizeBucket ? `${citation.bedSizeBucket} beds` : "size withheld"} ·{" "}
            {SURVEY_TYPE_LABELS[citation.surveyType as SurveyType] ?? citation.surveyType}
            {citation.citedQuarter ? ` · ${citation.citedQuarter}` : ""}
          </>
        }
        action={
          <Link href="/citations" className="btn-secondary">
            Back to board
          </Link>
        }
      />

      {query.posted && (
        <NoticeBanner
          tone="amber"
          message={
            citation.status === "APPROVED"
              ? "Posted to the board. Thank you — this is genuinely useful to other providers."
              : "Submitted. A moderator will review it before it appears on the board. Only you can see it until then."
          }
        />
      )}

      {query.redacted && (
        <NoticeBanner
          tone="amber"
          message={`${query.redacted} identifying detail${query.redacted === "1" ? " was" : "s were"} removed from your text automatically. Read the post below and check it still says what you meant.`}
        />
      )}

      {citation.status === "PENDING" && (
        <NoticeBanner tone="amber" message="Awaiting moderation. Not visible to other providers yet." />
      )}
      {citation.status === "REJECTED" && (
        <NoticeBanner
          tone="amber"
          message={`Not published. ${citation.moderationNote ?? "A moderator declined this post."}`}
        />
      )}

      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                citation.severity === "NO_HARM"
                  ? "slate"
                  : citation.severity === "POTENTIAL_HARM"
                    ? "amber"
                    : "red"
              }
            >
              {CITATION_SEVERITY_LABELS[citation.severity as CitationSeverity] ??
                citation.severity}
            </Badge>
            {citation.fineAmount && (
              <Badge tone="red">${citation.fineAmount.toLocaleString("en-US")} fine</Badge>
            )}
            {tags.map((tag) => (
              <Badge key={tag} tone="slate">
                {tag}
              </Badge>
            ))}
          </div>

          {citation.wacCite && (
            <p className="mt-3">
              <WacCite
                cite={citation.wacCite}
                title={citation.regulation?.title}
                verified={citation.regulation?.verified ?? false}
              />
            </p>
          )}

          {citation.narrative && (
            <>
              <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-slate-500">
                What happened
              </h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {citation.narrative}
              </p>
            </>
          )}

          {citation.correctiveAction && (
            <>
              <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-slate-500">
                How it was corrected
              </h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {citation.correctiveAction}
              </p>
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">
              Posted {formatDate(citation.createdAt)} · {citation.helpfulCount} found this helpful
            </p>
            <div className="flex gap-2">
              {user?.homeId && citation.status === "APPROVED" && (
                <form action={voteCitationAction}>
                  <input type="hidden" name="citationId" value={citation.id} />
                  <button type="submit" className="btn-secondary btn-sm">
                    This was helpful
                  </button>
                </form>
              )}
              {isAuthor && (
                <form action={withdrawCitationAction}>
                  <input type="hidden" name="id" value={citation.id} />
                  <button type="submit" className="btn-danger btn-sm">
                    Withdraw my post
                  </button>
                </form>
              )}
            </div>
          </div>
        </Card>

        <Card
          title="Would this be a finding at your home?"
          description="The same rule, run against your own records right now."
        >
          {!user?.homeId ? (
            <p className="text-sm text-slate-600">
              <Link href="/register" className="font-medium text-brand-700 hover:underline">
                Create an account
              </Link>{" "}
              and set up your home to check this rule against your own documentation.
            </p>
          ) : !citation.regulationId ? (
            <p className="text-sm text-slate-600">
              This post isn&apos;t linked to a rule in the catalog, so there is nothing to check
              automatically. Read the narrative and compare it against your own practice.
            </p>
          ) : ruleCodes.length === 0 ? (
            <p className="text-sm text-slate-600">
              {citation.wacCite} is in the catalog, but no automatic check has been written for it
              yet. Add one under{" "}
              <Link href="/regulations" className="font-medium text-brand-700 hover:underline">
                the rule catalog
              </Link>
              , or review this requirement by hand.
            </p>
          ) : selfCheck && selfCheck.totals.failing === 0 && selfCheck.totals.atRisk === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-900">
                You look covered on this one.
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                All {selfCheck.totals.total} check
                {selfCheck.totals.total === 1 ? "" : "s"} tied to {citation.wacCite} pass against
                your current records.
              </p>
            </div>
          ) : selfCheck ? (
            <>
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-900">
                  You have {selfCheck.totals.failing} gap
                  {selfCheck.totals.failing === 1 ? "" : "s"} against this rule
                  {selfCheck.totals.atRisk > 0 &&
                    `, plus ${selfCheck.totals.atRisk} expiring soon`}
                  .
                </p>
                <p className="mt-1 text-sm text-red-800">
                  This is what another home was cited for. Close these before your next survey.
                </p>
              </div>
              <FindingsList
                findings={[...selfCheck.failing, ...selfCheck.atRisk]}
              />
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
