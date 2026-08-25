import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import {
  BED_SIZE_BUCKETS,
  CITATION_SEVERITIES,
  CITATION_SEVERITY_LABELS,
  parseJsonArray,
  SURVEY_TYPE_LABELS,
  WA_COUNTIES,
  type CitationSeverity,
  type SurveyType,
} from "@/lib/constants";
import { Badge, Card, EmptyState, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<CitationSeverity, "slate" | "amber" | "red"> = {
  NO_HARM: "slate",
  POTENTIAL_HARM: "amber",
  ACTUAL_HARM: "red",
  IMMEDIATE_JEOPARDY: "red",
};

export default async function CitationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    withdrawn?: string;
    county?: string;
    severity?: string;
    cite?: string;
    beds?: string;
    q?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  const county = (WA_COUNTIES as readonly string[]).includes(params.county ?? "")
    ? params.county
    : undefined;
  const severity = (CITATION_SEVERITIES as readonly string[]).includes(params.severity ?? "")
    ? params.severity
    : undefined;
  const beds = (BED_SIZE_BUCKETS as readonly string[]).includes(params.beds ?? "")
    ? params.beds
    : undefined;

  // Only approved posts are readable, and only non-identifying columns are
  // selected — homeId and authorHash never leave the server.
  const citations = await prisma.citation.findMany({
    where: {
      status: "APPROVED",
      ...(county ? { county } : {}),
      ...(severity ? { severity } : {}),
      ...(beds ? { bedSizeBucket: beds } : {}),
      ...(params.cite ? { wacCite: { contains: params.cite } } : {}),
      ...(params.q
        ? {
            OR: [
              { summary: { contains: params.q } },
              { narrative: { contains: params.q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      county: true,
      bedSizeBucket: true,
      surveyType: true,
      citedQuarter: true,
      wacCite: true,
      severity: true,
      summary: true,
      narrative: true,
      fineAmount: true,
      tagsJson: true,
      helpfulCount: true,
      createdAt: true,
      regulation: { select: { cite: true, title: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 60,
  });

  const [totalApproved, topCites] = await Promise.all([
    prisma.citation.count({ where: { status: "APPROVED" } }),
    prisma.citation.groupBy({
      by: ["wacCite"],
      where: { status: "APPROVED", wacCite: { not: null } },
      _count: { wacCite: true },
      orderBy: { _count: { wacCite: "desc" } },
      take: 8,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Citation board"
        description="Deficiencies other Washington providers have received, posted anonymously. County-level location, quarter-level dates, and direct identifiers stripped before publication."
        action={
          user?.homeId ? (
            <Link href="/citations/new" className="btn-primary">
              Post a citation
            </Link>
          ) : (
            <Link href="/register" className="btn-primary">
              Create an account to post
            </Link>
          )
        }
      />

      <ErrorBanner message={params.error} />
      {params.withdrawn && <NoticeBanner message="Your post has been withdrawn." />}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          <Card
            title={`${citations.length} citation${citations.length === 1 ? "" : "s"}`}
            description={
              totalApproved > citations.length
                ? `Filtered from ${totalApproved} published posts.`
                : "Newest first."
            }
          >
            {citations.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                description="Either no one has posted a citation matching these filters yet, or your filters are too narrow."
                action={
                  <Link href="/citations" className="btn-secondary btn-sm">
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {citations.map((citation) => {
                  const tags = parseJsonArray<string>(citation.tagsJson);
                  return (
                    <li key={citation.id} className="py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={SEVERITY_TONE[citation.severity as CitationSeverity]}>
                          {CITATION_SEVERITY_LABELS[citation.severity as CitationSeverity] ??
                            citation.severity}
                        </Badge>
                        {citation.wacCite && (
                          <span className="font-mono text-xs font-semibold text-brand-700">
                            {citation.wacCite}
                          </span>
                        )}
                        {citation.fineAmount && (
                          <Badge tone="red">
                            ${citation.fineAmount.toLocaleString("en-US")} fine
                          </Badge>
                        )}
                      </div>

                      <Link
                        href={`/citations/${citation.id}`}
                        className="mt-1.5 block font-medium text-slate-900 hover:text-brand-700"
                      >
                        {citation.summary}
                      </Link>

                      {citation.narrative && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {citation.narrative}
                        </p>
                      )}

                      <p className="mt-1.5 text-xs text-slate-500">
                        {citation.county ? `${citation.county} County` : "County withheld"} ·{" "}
                        {citation.bedSizeBucket ? `${citation.bedSizeBucket} beds` : "size withheld"} ·{" "}
                        {SURVEY_TYPE_LABELS[citation.surveyType as SurveyType] ??
                          citation.surveyType}
                        {citation.citedQuarter ? ` · ${citation.citedQuarter}` : ""} · posted{" "}
                        {formatDate(citation.createdAt)}
                        {citation.helpfulCount > 0 && ` · ${citation.helpfulCount} found helpful`}
                      </p>

                      {tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <Badge key={tag} tone="slate">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Filter">
            <form method="get" className="space-y-3">
              <div>
                <label className="label" htmlFor="q">
                  Search
                </label>
                <input id="q" name="q" defaultValue={params.q ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="county">
                  County
                </label>
                <select id="county" name="county" defaultValue={county ?? ""} className="input">
                  <option value="">Anywhere</option>
                  {WA_COUNTIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="severity">
                  Severity
                </label>
                <select id="severity" name="severity" defaultValue={severity ?? ""} className="input">
                  <option value="">Any</option>
                  {CITATION_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {CITATION_SEVERITY_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="beds">
                  Home size
                </label>
                <select id="beds" name="beds" defaultValue={beds ?? ""} className="input">
                  <option value="">Any</option>
                  {BED_SIZE_BUCKETS.map((b) => (
                    <option key={b} value={b}>
                      {b} beds
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="cite">
                  WAC contains
                </label>
                <input
                  id="cite"
                  name="cite"
                  placeholder="388-76-103"
                  defaultValue={params.cite ?? ""}
                  className="input"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary btn-sm flex-1">
                  Apply
                </button>
                <Link href="/citations" className="btn-secondary btn-sm">
                  Reset
                </Link>
              </div>
            </form>
          </Card>

          {topCites.length > 0 && (
            <Card title="Most cited rules" description="Across all published posts.">
              <ul className="space-y-1.5">
                {topCites.map((row) => (
                  <li key={row.wacCite}>
                    <Link
                      href={`/citations?cite=${encodeURIComponent(row.wacCite ?? "")}`}
                      className="flex items-center justify-between text-sm hover:text-brand-700"
                    >
                      <span className="font-mono text-xs text-slate-700">{row.wacCite}</span>
                      <span className="text-xs text-slate-500">{row._count.wacCite}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="How anonymity works">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Posts store a salted one-way digest of your home, never a link back to it.</li>
              <li>The salt lives outside the database, so a database leak alone reveals nothing.</li>
              <li>Location is county-level and dates are quarter-level.</li>
              <li>Phone numbers, emails, addresses, and license numbers are stripped automatically.</li>
              <li>Every post is reviewed before it appears here.</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              A distinctive story can still identify you. Write about the finding, not the
              circumstances.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
