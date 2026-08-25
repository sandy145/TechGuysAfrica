import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RegulationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cite?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  const regulations = await prisma.regulation.findMany({
    where: {
      ...(params.cite ? { cite: { contains: params.cite } } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q } },
              { summary: { contains: params.q } },
              { cite: { contains: params.q } },
            ],
          }
        : {}),
    },
    include: {
      ruleChecks: { where: { isActive: true }, select: { id: true, title: true, severity: true } },
      _count: { select: { citations: { where: { status: "APPROVED" } } } },
    },
    orderBy: { cite: "asc" },
  });

  const unverified = regulations.filter((r) => !r.verified).length;

  const bySubchapter = new Map<string, typeof regulations>();
  for (const regulation of regulations) {
    const key = regulation.subchapter ?? "Other";
    const list = bySubchapter.get(key);
    if (list) list.push(regulation);
    else bySubchapter.set(key, [regulation]);
  }

  return (
    <>
      <PageHeader
        title="Rule catalog"
        description="The Washington rules this platform tracks, and the automatic checks wired to each one."
      />

      {unverified > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">
            {unverified} of {regulations.length} entries are unverified
          </p>
          <p className="mt-1">
            They were seeded as a working starting point from the published structure of chapter
            388-76 WAC, but their titles and text have not been checked against the official
            source. Treat them as a scaffold: confirm each one at{" "}
            <span className="font-mono text-xs">app.leg.wa.gov/wac/default.aspx?cite=388-76</span>{" "}
            and mark it verified. Run{" "}
            <span className="font-mono text-xs">npm run wac:import -- path/to/wac.json</span> to
            load a verified catalog in bulk.
          </p>
        </div>
      )}

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search titles, summaries, or citations"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
          {(params.q || params.cite) && (
            <Link href="/regulations" className="btn-secondary">
              Clear
            </Link>
          )}
        </form>
      </Card>

      {regulations.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing in the catalog"
            description="Run `npm run db:seed` to load the starter catalog."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {[...bySubchapter.entries()].map(([subchapter, group]) => (
            <Card key={subchapter} title={subchapter} description={`${group.length} sections`}>
              <ul className="divide-y divide-slate-100">
                {group.map((regulation) => (
                  <li key={regulation.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-brand-700">
                        {regulation.cite}
                      </span>
                      {!regulation.verified && <Badge tone="amber">unverified</Badge>}
                      {regulation._count.citations > 0 && (
                        <Link href={`/citations?cite=${encodeURIComponent(regulation.cite)}`}>
                          <Badge tone="red">
                            {regulation._count.citations} citation
                            {regulation._count.citations === 1 ? "" : "s"} posted
                          </Badge>
                        </Link>
                      )}
                    </div>

                    <p className="mt-0.5 text-sm font-medium text-slate-900">{regulation.title}</p>
                    {regulation.summary && (
                      <p className="mt-1 text-sm text-slate-600">{regulation.summary}</p>
                    )}

                    {regulation.ruleChecks.length > 0 ? (
                      <ul className="mt-2 space-y-0.5">
                        {regulation.ruleChecks.map((check) => (
                          <li key={check.id} className="text-xs text-slate-500">
                            · Checked automatically: {check.title}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">
                        No automatic check wired to this section yet.
                      </p>
                    )}

                    {regulation.url && (
                      <a
                        href={regulation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-block text-xs font-medium text-brand-700 underline"
                      >
                        Official text
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {user?.homeId && (
        <p className="mt-6 text-sm text-slate-500">
          Want to know where you stand against all of this?{" "}
          <Link href="/dashboard" className="font-medium text-brand-700 hover:underline">
            Open your dashboard
          </Link>
          .
        </p>
      )}
    </>
  );
}
