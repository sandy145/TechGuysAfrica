import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { moderateCitationAction } from "@/app/actions/citations";
import { formatDate } from "@/lib/dates";
import {
  CITATION_SEVERITY_LABELS,
  SURVEY_TYPE_LABELS,
  type CitationSeverity,
  type SurveyType,
} from "@/lib/constants";
import { Badge, Card, EmptyState, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; moderated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  if (user.role !== "ADMIN") {
    return (
      <>
        <PageHeader title="Moderation" />
        <Card>
          <EmptyState
            title="Administrators only"
            description="Citation moderation is restricted to platform administrators. Set a user's role to ADMIN in the database to grant access, or set AUTO_APPROVE_CITATIONS=true for a single-operator install."
            action={
              <Link href="/citations" className="btn-secondary btn-sm">
                Back to the board
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const [pending, recent] = await Promise.all([
    prisma.citation.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { regulation: { select: { cite: true, title: true } } },
    }),
    prisma.citation.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, summary: true, status: true, updatedAt: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Citation moderation"
        description="Check each post for anything that would identify the home that wrote it, then publish or decline."
      />

      <ErrorBanner message={params.error} />
      {params.moderated && <NoticeBanner message="Decision recorded." />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`${pending.length} awaiting review`}>
            {pending.length === 0 ? (
              <EmptyState title="Queue is empty" description="Nothing is waiting for review." />
            ) : (
              <ul className="space-y-6">
                {pending.map((citation) => (
                  <li key={citation.id} className="border-b border-slate-200 pb-6 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="amber">
                        {CITATION_SEVERITY_LABELS[citation.severity as CitationSeverity]}
                      </Badge>
                      {citation.wacCite && (
                        <span className="font-mono text-xs font-semibold text-brand-700">
                          {citation.wacCite}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {citation.county ? `${citation.county} County` : "county withheld"} ·{" "}
                        {SURVEY_TYPE_LABELS[citation.surveyType as SurveyType]} · submitted{" "}
                        {formatDate(citation.createdAt)}
                      </span>
                    </div>

                    <p className="mt-2 font-medium text-slate-900">{citation.summary}</p>
                    {citation.narrative && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">
                        {citation.narrative}
                      </p>
                    )}
                    {citation.correctiveAction && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                        <span className="font-medium">Correction: </span>
                        {citation.correctiveAction}
                      </p>
                    )}

                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <form
                        action={moderateCitationAction}
                        className="contents"
                        id={`approve-${citation.id}`}
                      >
                        <input type="hidden" name="id" value={citation.id} />
                        <input
                          name="moderationNote"
                          placeholder="Note (shown to the author if declined)"
                          className="input"
                        />
                        <button
                          type="submit"
                          name="decision"
                          value="APPROVED"
                          className="btn-primary btn-sm"
                        >
                          Publish
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="REJECTED"
                          className="btn-danger btn-sm"
                        >
                          Decline
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card title="Recent decisions">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((citation) => (
                  <li key={citation.id} className="text-sm">
                    <Link
                      href={`/citations/${citation.id}`}
                      className="line-clamp-2 text-slate-800 hover:text-brand-700"
                    >
                      {citation.summary}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={citation.status === "APPROVED" ? "emerald" : "red"}>
                        {citation.status === "APPROVED" ? "Published" : "Declined"}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {formatDate(citation.updatedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
