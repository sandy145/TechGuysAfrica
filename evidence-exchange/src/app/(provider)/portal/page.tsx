import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { acknowledgeStatement, submitPlanOfCorrection } from "@/app/actions/provider";
import { describeDeadline, formatDate, formatDateTime, toDateInput } from "@/lib/dates";
import {
  CITATION_STATUS_LABELS,
  FINDING_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  OUTCOME_LABELS,
} from "@/lib/constants";
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
  LinkButton,
  PageHeader,
  Stat,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await requireProvider();

  const inspections = await prisma.inspection.findMany({
    where: { homeId: user.providerHomeId, status: { not: "PLANNED" } },
    include: {
      leadInspector: true,
      findings: {
        where: { sharedAt: { not: null } },
        include: {
          evidenceRequests: true,
          submissions: { include: { files: true } },
          determination: true,
          citation: { include: { plansOfCorrection: true } },
        },
        orderBy: { tag: "asc" },
      },
    },
    orderBy: { exitConferenceAt: "desc" },
  });

  const openFindings = inspections.flatMap((i) =>
    i.findings.filter((f) => f.status === "PENDING_EVIDENCE" || f.status === "EVIDENCE_RECEIVED"),
  );
  const awaitingUpload = openFindings.filter((f) => f.submissions.length === 0);
  const citations = inspections.flatMap((i) =>
    i.findings.filter((f) => f.citation).map((f) => ({ finding: f, inspection: i })),
  );
  const pocDue = citations.filter(({ finding }) => finding.citation?.status === "PENDING_POC");
  const nextDeadline = openFindings
    .map((f) => f.evidenceDueAt)
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime())[0];
  const deadline = describeDeadline(nextDeadline ?? null);

  const unacknowledged = inspections.filter((i) => i.sodIssuedAt && !i.sodAcknowledgedAt);

  return (
    <>
      <PageHeader
        eyebrow={user.providerHomeName ?? ""}
        title="Your inspection findings"
        description="Everything your licensor has raised, what they need from you, and what they decided once they read it."
      />

      {unacknowledged.map((inspection) => (
        <div key={inspection.id} className="mb-6">
          <Card className="border-gov-300 ring-1 ring-gov-200">
            <CardHeader
              title="Your statement of deficiencies has been issued"
              subtitle={`Issued ${formatDate(inspection.sodIssuedAt)}. Acknowledging receipt starts the clock for your plan of correction and for disputing a citation.`}
              action={<LinkButton href={`/sod/${inspection.id}`}>Read it</LinkButton>}
            />
            <CardBody>
              <ActionForm action={acknowledgeStatement} submitLabel="Acknowledge receipt">
                <input type="hidden" name="inspectionId" value={inspection.id} />
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Findings open"
          value={openFindings.length}
          tone={openFindings.length > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Still need documents"
          value={awaitingUpload.length}
          tone={awaitingUpload.length > 0 ? "urgent" : "ok"}
        />
        <Stat
          label="Next deadline"
          value={<span className="text-base">{formatDate(nextDeadline ?? null)}</span>}
          note={deadline.label}
          tone={deadline.tone === "late" ? "urgent" : deadline.tone === "soon" ? "warn" : "neutral"}
        />
        <Stat label="Plans of correction due" value={pocDue.length} tone={pocDue.length ? "warn" : "neutral"} />
      </div>

      {openFindings.length > 0 ? (
        <div className="mt-6">
          <Alert tone="info" title="Send documents here, not by email">
            A document uploaded against a finding is attached to that finding in the agency's record. You get a
            receipt, and you can see the moment your licensor opens it.
          </Alert>
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        {inspections.map((inspection) => (
          <Card key={inspection.id}>
            <CardHeader
              title={`${INSPECTION_TYPE_LABELS[inspection.type as keyof typeof INSPECTION_TYPE_LABELS]} · ${formatDate(inspection.exitConferenceAt)}`}
              subtitle={`Licensor ${inspection.leadInspector?.name ?? "—"}${
                inspection.evidenceDueAt ? ` · documents due ${formatDate(inspection.evidenceDueAt)}` : ""
              }`}
              action={
                inspection.sodIssuedAt ? (
                  <LinkButton href={`/sod/${inspection.id}`} size="sm">
                    Statement of deficiencies
                  </LinkButton>
                ) : null
              }
            />
            <CardBody className="p-0">
              {inspection.findings.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState title="No findings shared yet" />
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {inspection.findings.map((finding) => {
                    const openRequests = finding.evidenceRequests.filter((r) => r.status === "OPEN");
                    const files = finding.submissions.flatMap((s) => s.files);
                    const opened = files.filter((f) => f.firstOpenedAt).length;
                    const due = describeDeadline(finding.evidenceDueAt);
                    return (
                      <li key={finding.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                              <Badge tone="info">{finding.tag}</Badge>
                              {finding.wacCite}
                            </p>
                            <p className="mt-1 max-w-2xl text-sm text-ink-soft">{finding.practiceText}</p>
                            {openRequests.length > 0 ? (
                              <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                <span className="font-medium">Asked for: </span>
                                {openRequests.map((r) => r.prompt).join(" ")}
                              </p>
                            ) : null}
                            {finding.submissions.length > 0 ? (
                              <p className="mt-2 text-xs text-ink-soft">
                                You sent {files.length} file(s) ·{" "}
                                {opened === files.length && files.length > 0 ? (
                                  <span className="font-medium text-emerald-700">all opened by your licensor</span>
                                ) : (
                                  <span className="font-medium text-amber-700">
                                    {opened} of {files.length} opened so far
                                  </span>
                                )}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-1 text-right">
                            {finding.determination ? (
                              <Badge
                                tone={
                                  finding.determination.outcome === "CITATION"
                                    ? "danger"
                                    : finding.determination.outcome === "CONSULTATION"
                                      ? "warn"
                                      : "ok"
                                }
                              >
                                {OUTCOME_LABELS[finding.determination.outcome as keyof typeof OUTCOME_LABELS]}
                              </Badge>
                            ) : (
                              <>
                                <Badge tone={finding.submissions.length ? "info" : "warn"}>
                                  {FINDING_STATUS_LABELS[finding.status as keyof typeof FINDING_STATUS_LABELS]}
                                </Badge>
                                <span
                                  className={`text-xs ${
                                    due.tone === "late" ? "text-red-700" : "text-ink-soft"
                                  }`}
                                >
                                  {due.label}
                                </span>
                              </>
                            )}
                            <Link
                              href={`/portal/findings/${finding.id}`}
                              className="text-sm font-medium text-gov-700 hover:underline"
                            >
                              {finding.determination ? "View" : "Send documents"} →
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {citations.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-ink">Citations and plans of correction</h2>
          <div className="space-y-4">
            {citations.map(({ finding, inspection }) => (
              <Card key={finding.id}>
                <CardHeader
                  title={`${finding.tag} — ${finding.wacCite}`}
                  subtitle={CITATION_STATUS_LABELS[finding.citation!.status]}
                  action={
                    <Badge tone={finding.citation!.status === "CORRECTION_VERIFIED" ? "ok" : "warn"}>
                      {finding.citation!.pocDueAt
                        ? `Plan due ${formatDate(finding.citation!.pocDueAt)}`
                        : "Plan due once acknowledged"}
                    </Badge>
                  }
                />
                <CardBody>
                  <p className="text-sm text-ink">{finding.determination?.rationale}</p>

                  {finding.citation!.plansOfCorrection.length > 0 ? (
                    finding.citation!.plansOfCorrection.map((poc) => (
                      <div key={poc.id} className="mt-3 rounded border border-slate-200 p-3 text-sm">
                        <p className="text-xs text-ink-soft">
                          Submitted {formatDateTime(poc.submittedAt)} · {poc.status}
                        </p>
                        <p className="mt-1">{poc.howCorrected}</p>
                        {poc.reviewNote ? (
                          <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs">
                            Agency note: {poc.reviewNote}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : null}

                  {finding.citation!.status === "PENDING_POC" || finding.citation!.status === "POC_REJECTED" ? (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <p className="mb-2 text-sm font-medium text-ink">Submit your plan of correction</p>
                      <ActionForm action={submitPlanOfCorrection} submitLabel="Submit plan">
                        <input type="hidden" name="citationId" value={finding.citation!.id} />
                        <Field label="How was, or will be, each deficiency corrected?" required>
                          <textarea className={inputClass} name="howCorrected" rows={3} required />
                        </Field>
                        <Field label="What keeps it from happening again?" required>
                          <textarea className={inputClass} name="systemicMeasures" rows={3} required />
                        </Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Who is responsible?" required>
                            <input className={inputClass} name="responsiblePerson" required />
                          </Field>
                          <Field label="Completion date" required>
                            <input
                              className={inputClass}
                              type="date"
                              name="completionDate"
                              defaultValue={toDateInput(finding.citation!.correctionDueAt)}
                              required
                            />
                          </Field>
                        </div>
                      </ActionForm>
                    </div>
                  ) : null}

                  {inspection.sodIssuedAt ? (
                    <p className="mt-3 text-xs text-ink-soft">
                      Disagree with this citation?{" "}
                      <Link href="/portal/idr" className="text-gov-700 underline">
                        Request informal dispute resolution
                      </Link>
                      .
                    </p>
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
