import Link from "next/link";
import { requireAgency } from "@/lib/auth";
import { awaitingDetermination, expiredWithoutResponse, unreviewedEvidence } from "@/lib/queries";
import { formatDate, formatDateTime, relativeTime } from "@/lib/dates";
import { formatBytes } from "@/lib/storage";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * The queue. Everything a provider has sent that nobody has looked at, oldest
 * first, with the files one click away — so "I never saw it" stops being
 * something that can happen quietly.
 */
export default async function ReviewPage() {
  const user = await requireAgency();
  const mine = user.role === "INSPECTOR" ? { inspectorId: user.id } : {};

  const [unreviewed, ready, expired] = await Promise.all([
    unreviewedEvidence(mine),
    awaitingDetermination(mine),
    expiredWithoutResponse(mine),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Evidence review"
        title="What the providers have sent"
        description={
          user.role === "INSPECTOR"
            ? "Your caseload. Oldest submission first."
            : "Every open submission in the office, oldest first."
        }
      />

      <Card>
        <CardHeader
          title="Unreviewed submissions"
          subtitle="A citation is blocked on each of these until the documents are opened and reviewed."
          action={<Badge tone={unreviewed.length ? "urgent" : "ok"}>{unreviewed.length} waiting</Badge>}
        />
        <CardBody className="p-0">
          {unreviewed.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState title="Nothing unreviewed">
                Every document sent by a provider has been opened.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {unreviewed.map(({ finding, state, oldestUnreviewed }) => (
                <li key={finding.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        <Badge tone="info">{finding.tag}</Badge>
                        <Link href={`/findings/${finding.id}`} className="text-gov-700 hover:underline">
                          {finding.inspection.home.name}
                        </Link>
                        <span className="text-ink-soft">{finding.wacCite}</span>
                      </p>
                      <p className="mt-1 max-w-3xl text-sm text-ink-soft">{finding.practiceText}</p>
                    </div>
                    <div className="text-right text-xs">
                      <Badge tone="urgent">{state.unreviewedSubmissions} unreviewed</Badge>
                      <p className="mt-1 text-ink-soft">waiting {relativeTime(oldestUnreviewed)}</p>
                      <p className="text-ink-soft">
                        licensor: {finding.inspection.leadInspector?.name ?? "—"}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {finding.submissions
                      .filter((s) => !s.reviewedAt)
                      .map((s) => (
                        <li key={s.id} className="rounded border border-amber-200 bg-amber-50/60 px-3 py-2">
                          <p className="text-xs text-ink-soft">
                            {s.submittedBy?.name ?? "Provider"} · {formatDateTime(s.submittedAt)}
                            {s.isLate ? " · late" : ""}
                          </p>
                          {s.note ? <p className="mt-1 text-sm text-ink">{s.note}</p> : null}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {s.files.map((f) => (
                              <a
                                key={f.id}
                                href={`/api/files/${f.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-gov-700 underline hover:text-gov-900"
                              >
                                {f.fileName}{" "}
                                <span className="text-xs text-ink-soft">({formatBytes(f.sizeBytes)})</span>
                                {f.firstOpenedAt ? null : (
                                  <span className="ml-1 text-xs font-semibold text-red-700">· never opened</span>
                                )}
                              </a>
                            ))}
                          </div>
                        </li>
                      ))}
                  </ul>

                  <div className="mt-3">
                    <LinkButton href={`/findings/${finding.id}`} size="sm">
                      Open finding
                    </LinkButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Reviewed — awaiting a determination" />
          <CardBody className="p-0">
            {ready.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">Nothing waiting.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {ready.map((f) => (
                  <li key={f.id}>
                    <Link href={`/findings/${f.id}`} className="block px-5 py-3 hover:bg-slate-50">
                      <p className="text-sm font-medium text-ink">
                        {f.tag} · {f.inspection.home.name}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {f.wacCite} · {f.submissions.length} submission(s) reviewed
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Deadline passed, nothing received"
            subtitle="These can be finalised on the inspection record alone — the absence of a response is recorded on the determination."
          />
          <CardBody className="p-0">
            {expired.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">Nothing waiting.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {expired.map((f) => (
                  <li key={f.id}>
                    <Link href={`/findings/${f.id}`} className="block px-5 py-3 hover:bg-slate-50">
                      <p className="text-sm font-medium text-ink">
                        {f.tag} · {f.inspection.home.name}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {f.wacCite} · due {formatDate(f.evidenceDueAt)}
                      </p>
                    </Link>
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
