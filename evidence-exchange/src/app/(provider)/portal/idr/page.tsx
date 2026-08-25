import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPolicy } from "@/lib/queries";
import { idrGate, IDR_PANEL_MAX } from "@/lib/workflow";
import { requestIdr } from "@/app/actions/provider";
import { describeDeadline, formatDate } from "@/lib/dates";
import { IDR_STATUS_LABELS, IDR_TYPE_LABELS } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Requesting informal dispute resolution. Today this is an email to a shared
 * inbox or a fax; here it is a form bound to the citations under dispute, with
 * the deadline computed rather than guessed.
 */
export default async function IdrPage() {
  const user = await requireProvider();
  const policy = await getPolicy();

  const inspections = await prisma.inspection.findMany({
    where: { homeId: user.providerHomeId, sodIssuedAt: { not: null } },
    include: {
      findings: { where: { citation: { isNot: null } }, include: { determination: true } },
      idrRequests: { orderBy: { requestedAt: "desc" } },
    },
    orderBy: { sodIssuedAt: "desc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Dispute"
        title="Informal dispute resolution"
        description={`If you believe a citation is wrong — including because documentation you sent was not taken into account — you can ask for it to be reviewed within ${policy.idrRequestDays} working days of receiving the statement.`}
      />

      {inspections.length === 0 ? (
        <EmptyState title="No issued citations">
          There is nothing to dispute. Citations appear here once a statement of deficiencies is issued.
        </EmptyState>
      ) : null}

      <div className="space-y-6">
        {inspections.map((inspection) => {
          const gate = idrGate({
            type: "TRADITIONAL",
            findingIds: ["placeholder"],
            sodIssuedAt: inspection.sodIssuedAt,
            acknowledgedAt: inspection.sodAcknowledgedAt,
            policy,
          });
          const deadline = describeDeadline(gate.deadline);

          return (
            <Card key={inspection.id}>
              <CardHeader
                title={`Survey ${inspection.surveyNumber ?? "—"}`}
                subtitle={`Statement issued ${formatDate(inspection.sodIssuedAt)}${
                  inspection.sodAcknowledgedAt
                    ? ` · acknowledged ${formatDate(inspection.sodAcknowledgedAt)}`
                    : " · not yet acknowledged"
                }`}
                action={
                  <Badge tone={gate.isLate ? "danger" : "info"}>
                    Request by {formatDate(gate.deadline)} · {deadline.label}
                  </Badge>
                }
              />
              <CardBody>
                {inspection.idrRequests.length > 0 ? (
                  <div className="mb-4 space-y-2">
                    {inspection.idrRequests.map((idr) => (
                      <div key={idr.id} className="rounded border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-ink">{IDR_TYPE_LABELS[idr.type]}</p>
                          <Badge tone="info">{IDR_STATUS_LABELS[idr.status]}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-soft">
                          Requested {formatDate(idr.requestedAt)}
                          {idr.scheduledAt ? ` · scheduled ${formatDate(idr.scheduledAt)}` : ""}
                        </p>
                        <p className="mt-2 text-sm">{idr.statement}</p>
                        {idr.outcomeNote ? (
                          <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-sm">
                            <span className="font-medium">{idr.outcome}:</span> {idr.outcomeNote}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {inspection.findings.length === 0 ? (
                  <p className="text-sm text-ink-soft">No citations were issued for this survey.</p>
                ) : (
                  <>
                    {gate.isLate ? (
                      <div className="mb-3">
                        <Alert tone="warn" title="The request window has closed">
                          You can still submit. The request is recorded as late and forwarded to the agency to
                          decide whether to accept it.
                        </Alert>
                      </div>
                    ) : null}

                    <ActionForm action={requestIdr} submitLabel="Submit request">
                      <input type="hidden" name="inspectionId" value={inspection.id} />

                      <fieldset>
                        <legend className="text-sm font-medium text-ink">
                          Which citations are you disputing?
                        </legend>
                        <div className="mt-2 space-y-2">
                          {inspection.findings.map((f) => (
                            <label key={f.id} className="flex items-start gap-2 text-sm">
                              <input type="checkbox" name="findingIds" value={f.id} className="mt-1" />
                              <span>
                                <span className="font-medium">
                                  {f.tag} — {f.wacCite}
                                </span>
                                <span className="block text-xs text-ink-soft">{f.practiceText}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <Field
                        label="Type of review"
                        hint={`Panel review is limited to ${IDR_PANEL_MAX} disputed items.`}
                      >
                        <select className={inputClass} name="type" defaultValue="TRADITIONAL">
                          <option value="TRADITIONAL">{IDR_TYPE_LABELS.TRADITIONAL}</option>
                          <option value="PANEL">{IDR_TYPE_LABELS.PANEL}</option>
                        </select>
                      </Field>

                      <Field
                        label="Why do you disagree?"
                        hint="Point to the documents in the record. Everything you uploaded during the evidence window is already attached to the finding, with the date it arrived."
                        required
                      >
                        <textarea className={inputClass} name="statement" rows={5} required />
                      </Field>

                      <p className="text-xs text-ink-soft">
                        Need to look at what you sent first?{" "}
                        <Link href={`/sod/${inspection.id}`} className="text-gov-700 underline">
                          Open the statement and evidence index
                        </Link>
                        .
                      </p>
                    </ActionForm>
                  </>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
