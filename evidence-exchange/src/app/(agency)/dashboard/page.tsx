import Link from "next/link";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  awaitingDetermination,
  expiredWithoutResponse,
  inspectionsForUser,
  rollupFindings,
  unreviewedEvidence,
} from "@/lib/queries";
import { describeDeadline, formatDate, relativeTime } from "@/lib/dates";
import { INSPECTION_STATUS_LABELS, INSPECTION_TYPE_LABELS } from "@/lib/constants";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAgency();
  const mine = user.role === "INSPECTOR" ? { inspectorId: user.id } : {};

  const [unreviewed, expired, ready, inspections, openWindows] = await Promise.all([
    unreviewedEvidence(mine),
    expiredWithoutResponse(mine),
    awaitingDetermination(mine),
    inspectionsForUser(user.id, user.role),
    prisma.inspection.count({
      where: {
        status: "EVIDENCE_OPEN",
        ...(user.role === "INSPECTOR" ? { leadInspectorId: user.id } : {}),
      },
    }),
  ]);

  const unopenedFiles = unreviewed.reduce((n, row) => n + row.state.unopenedFiles, 0);
  const active = inspections.filter((i) => i.status !== "CLOSED");

  return (
    <>
      <PageHeader
        eyebrow={user.role === "INSPECTOR" ? "My caseload" : "Field office"}
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Everything a provider has sent since the exit conference, in one place, with the clock showing."
        actions={<LinkButton href="/inspections/new" variant="primary">New inspection</LinkButton>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Evidence to review"
          value={unreviewed.length}
          tone={unreviewed.length > 0 ? "urgent" : "neutral"}
          href="/review"
          note={unreviewed.length > 0 ? "Findings you cannot cite until you look" : "Nothing waiting"}
        />
        <Stat
          label="Files never opened"
          value={unopenedFiles}
          tone={unopenedFiles > 0 ? "warn" : "neutral"}
          href="/review"
        />
        <Stat label="Ready to determine" value={ready.length} href="/review" note="Reviewed, awaiting a decision" />
        <Stat
          label="No response, window closed"
          value={expired.length}
          tone={expired.length > 0 ? "warn" : "neutral"}
          note="Eligible to finalise"
        />
        <Stat label="Evidence windows open" value={openWindows} href="/inspections" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Provider evidence waiting on you"
              subtitle="Oldest first. A citation cannot be recorded on any of these until the submission is opened and reviewed."
              action={<LinkButton href="/review" size="sm">Open review queue</LinkButton>}
            />
            <CardBody className="p-0">
              {unreviewed.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState title="Nothing unreviewed">
                    Every document a provider has sent has been opened and reviewed.
                  </EmptyState>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {unreviewed.slice(0, 6).map(({ finding, state, oldestUnreviewed }) => (
                    <li key={finding.id}>
                      <Link
                        href={`/findings/${finding.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium text-ink">
                            <Badge tone="info">{finding.tag}</Badge>
                            {finding.inspection.home.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-ink-soft">
                            {finding.wacCite} · {finding.practiceText}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge tone="urgent">
                            {state.unreviewedSubmissions} unreviewed
                          </Badge>
                          {state.unopenedFiles > 0 ? (
                            <Badge tone="warn">{state.unopenedFiles} file(s) never opened</Badge>
                          ) : null}
                          <span className="text-ink-soft">{relativeTime(oldestUnreviewed)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Active inspections"
              subtitle="Where each survey sits in the cycle."
            />
            <CardBody className="p-0">
              {active.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState title="No active inspections" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th className="px-5 py-2 font-medium">Home</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Findings</th>
                      <th className="px-5 py-2 font-medium">Evidence due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {active.map((inspection) => {
                      const roll = rollupFindings(inspection.findings);
                      const deadline = describeDeadline(inspection.evidenceDueAt);
                      return (
                        <tr key={inspection.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <Link href={`/inspections/${inspection.id}`} className="font-medium text-gov-700 hover:underline">
                              {inspection.home.name}
                            </Link>
                            <p className="text-xs text-ink-soft">{inspection.home.licenseNumber}</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-ink-soft">
                            {INSPECTION_TYPE_LABELS[inspection.type as keyof typeof INSPECTION_TYPE_LABELS]}
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={inspection.status === "EVIDENCE_OPEN" ? "info" : "neutral"}>
                              {INSPECTION_STATUS_LABELS[inspection.status as keyof typeof INSPECTION_STATUS_LABELS]}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-ink-soft">
                            {roll.determined}/{roll.total} determined
                            {roll.unreviewedSubmissions > 0 ? (
                              <span className="ml-2 font-medium text-red-700">
                                {roll.unreviewedSubmissions} unreviewed
                              </span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3 text-xs">
                            {inspection.evidenceDueAt ? (
                              <>
                                <span className="block">{formatDate(inspection.evidenceDueAt)}</span>
                                <span
                                  className={
                                    deadline.tone === "late"
                                      ? "text-red-700"
                                      : deadline.tone === "soon" || deadline.tone === "due"
                                        ? "text-amber-700"
                                        : "text-ink-soft"
                                  }
                                >
                                  {deadline.label}
                                </span>
                              </>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Window closed, nothing received"
              subtitle="The provider's deadline passed with no submission."
            />
            <CardBody className="p-0">
              {expired.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Nothing here.</p>
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

          <Card>
            <CardHeader title="Reviewed — decision needed" />
            <CardBody className="p-0">
              {ready.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Nothing here.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {ready.map((f) => (
                    <li key={f.id}>
                      <Link href={`/findings/${f.id}`} className="block px-5 py-3 hover:bg-slate-50">
                        <p className="text-sm font-medium text-ink">
                          {f.tag} · {f.inspection.home.name}
                        </p>
                        <p className="text-xs text-ink-soft">{f.wacCite}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
