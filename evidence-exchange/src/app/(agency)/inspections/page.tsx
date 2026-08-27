import Link from "next/link";
import { requireAgency } from "@/lib/auth";
import { inspectionsForUser, rollupFindings } from "@/lib/queries";
import { describeDeadline, formatDate } from "@/lib/dates";
import { INSPECTION_STATUS_LABELS, INSPECTION_TYPE_LABELS } from "@/lib/constants";
import { Badge, Card, CardBody, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const user = await requireAgency();
  const inspections = await inspectionsForUser(user.id, user.role);

  return (
    <>
      <PageHeader
        eyebrow="Inspections"
        title={user.role === "INSPECTOR" ? "My inspections" : "Office inspections"}
        actions={<LinkButton href="/inspections/new" variant="primary">New inspection</LinkButton>}
      />

      <Card>
        <CardBody className="p-0">
          {inspections.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState title="No inspections yet">Open one to begin recording findings.</EmptyState>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-5 py-2 font-medium">Home</th>
                  <th className="px-3 py-2 font-medium">Survey</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Findings</th>
                  <th className="px-3 py-2 font-medium">Cited</th>
                  <th className="px-5 py-2 font-medium">Evidence due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inspections.map((inspection) => {
                  const roll = rollupFindings(inspection.findings);
                  const deadline = describeDeadline(inspection.evidenceDueAt);
                  return (
                    <tr key={inspection.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/inspections/${inspection.id}`}
                          className="font-medium text-gov-700 hover:underline"
                        >
                          {inspection.home.name}
                        </Link>
                        <p className="text-xs text-ink-soft">
                          {inspection.home.city}, {inspection.home.county} County
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-soft">{inspection.surveyNumber ?? "—"}</td>
                      <td className="px-3 py-3 text-xs text-ink-soft">
                        {INSPECTION_TYPE_LABELS[inspection.type as keyof typeof INSPECTION_TYPE_LABELS]}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={inspection.status === "CLOSED" ? "neutral" : "info"}>
                          {INSPECTION_STATUS_LABELS[inspection.status as keyof typeof INSPECTION_STATUS_LABELS]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {roll.determined}/{roll.total}
                        {roll.unreviewedSubmissions > 0 ? (
                          <span className="ml-2 font-semibold text-red-700">
                            {roll.unreviewedSubmissions} unreviewed
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs">{roll.cited}</td>
                      <td className="px-5 py-3 text-xs">
                        {inspection.evidenceDueAt ? (
                          <>
                            {formatDate(inspection.evidenceDueAt)}
                            <span
                              className={`block ${
                                deadline.tone === "late" ? "text-red-700" : "text-ink-soft"
                              }`}
                            >
                              {deadline.label}
                            </span>
                          </>
                        ) : (
                          "—"
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
    </>
  );
}
