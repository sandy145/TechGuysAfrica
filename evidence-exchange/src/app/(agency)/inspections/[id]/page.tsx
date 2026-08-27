import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPolicy, rollupFindings } from "@/lib/queries";
import { reviewState, sodGate, type SubmissionShape } from "@/lib/workflow";
import { createFinding } from "@/app/actions/findings";
import {
  closeInspection,
  extendEvidenceWindow,
  issueStatement,
  openEvidenceWindow,
} from "@/app/actions/inspections";
import { decideIdr } from "@/app/actions/determinations";
import { describeDeadline, formatDate, formatDateTime, toDateInput } from "@/lib/dates";
import {
  FINDING_STATUS_LABELS,
  HARM_LABELS,
  IDR_STATUS_LABELS,
  IDR_TYPE_LABELS,
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  OUTCOME_LABELS,
} from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { FindingComposer } from "@/components/FindingComposer";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Detail,
  EmptyState,
  Field,
  inputClass,
  LinkButton,
  PageHeader,
  Stat,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAgency();

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      home: { include: { contacts: true } },
      leadInspector: true,
      findings: {
        include: { submissions: { include: { files: true } }, determination: true, sources: true },
        orderBy: { tag: "asc" },
      },
      idrRequests: { include: { requestedBy: true }, orderBy: { requestedAt: "desc" } },
    },
  });
  if (!inspection) notFound();

  const policy = await getPolicy(user.agencyId);
  const roll = rollupFindings(inspection.findings);
  const gate = sodGate(inspection.findings);
  const deadline = describeDeadline(inspection.evidenceDueAt);

  const audit = await prisma.auditEvent.findMany({
    where: { inspectionId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const canOpenWindow = inspection.status === "PLANNED" || inspection.status === "ONSITE";
  const windowOpen = inspection.status === "EVIDENCE_OPEN" || inspection.status === "IN_REVIEW";

  return (
    <>
      <PageHeader
        eyebrow={`${INSPECTION_TYPE_LABELS[inspection.type as keyof typeof INSPECTION_TYPE_LABELS]} · survey ${
          inspection.surveyNumber ?? "—"
        }`}
        title={inspection.home.name}
        description={`Licence ${inspection.home.licenseNumber} · ${inspection.home.addressLine1 ?? ""} ${
          inspection.home.city ?? ""
        } · licensee ${inspection.home.providerName} · lead ${inspection.leadInspector?.name ?? "—"}`}
        actions={
          <>
            <LinkButton href={`/homes/${inspection.homeId}`}>Home record</LinkButton>
            {inspection.sodIssuedAt ? (
              <LinkButton href={`/sod/${inspection.id}`} variant="primary">
                Statement of deficiencies
              </LinkButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Status" value={
          <span className="text-base">
            {INSPECTION_STATUS_LABELS[inspection.status as keyof typeof INSPECTION_STATUS_LABELS]}
          </span>
        } />
        <Stat label="Findings" value={roll.total} note={`${roll.determined} determined`} />
        <Stat label="Cited" value={roll.cited} tone={roll.cited > 0 ? "warn" : "neutral"} />
        <Stat
          label="Unreviewed evidence"
          value={roll.unreviewedSubmissions}
          tone={roll.unreviewedSubmissions > 0 ? "urgent" : "neutral"}
        />
        <Stat
          label="Evidence due"
          value={<span className="text-base">{formatDate(inspection.evidenceDueAt)}</span>}
          note={deadline.label}
          tone={deadline.tone === "late" ? "warn" : "neutral"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Findings" subtitle="Every finding gets exactly one determination." />
            <CardBody className="p-0">
              {inspection.findings.length === 0 ? (
                <div className="px-5 py-6">
                  <EmptyState title="No findings yet">Draft the first one below.</EmptyState>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {inspection.findings.map((finding) => {
                    const st = reviewState({
                      submissions: finding.submissions as unknown as SubmissionShape[],
                    });
                    return (
                      <li key={finding.id}>
                        <Link href={`/findings/${finding.id}`} className="block px-5 py-4 hover:bg-slate-50">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                                <Badge tone="info">{finding.tag}</Badge>
                                {finding.wacCite}
                                {finding.harm === "IMMEDIATE_JEOPARDY" ? (
                                  <Badge tone="urgent">Immediate jeopardy</Badge>
                                ) : null}
                              </p>
                              <p className="mt-1 max-w-2xl text-sm text-ink-soft">{finding.practiceText}</p>
                              <p className="mt-1 text-xs text-ink-faint">
                                {finding.sources.length}/{policy.minEvidenceSources} evidence sources ·{" "}
                                {HARM_LABELS[finding.harm]}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
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
                                <Badge tone={finding.status === "EVIDENCE_RECEIVED" ? "urgent" : "warn"}>
                                  {FINDING_STATUS_LABELS[finding.status as keyof typeof FINDING_STATUS_LABELS]}
                                </Badge>
                              )}
                              {st.unreviewedSubmissions > 0 ? (
                                <span className="text-xs font-semibold text-red-700">
                                  {st.unreviewedSubmissions} unreviewed
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {inspection.status !== "CLOSED" ? (
            <Card>
              <CardHeader
                title="Draft a finding"
                subtitle={
                  windowOpen
                    ? "The evidence window is open, so a new finding is shared with the provider immediately and inherits the deadline."
                    : "Findings stay private until the exit conference is recorded."
                }
              />
              <CardBody>
                <FindingComposer action={createFinding} inspectionId={inspection.id} />
              </CardBody>
            </Card>
          ) : null}

          {inspection.idrRequests.length > 0 ? (
            <Card>
              <CardHeader title="Informal dispute resolution" />
              <CardBody className="p-0">
                <ul className="divide-y divide-slate-200">
                  {inspection.idrRequests.map((idr) => (
                    <li key={idr.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          {IDR_TYPE_LABELS[idr.type]} · {JSON.parse(idr.findingIdsJson).length} item(s)
                        </p>
                        <div className="flex gap-2">
                          {idr.isLate ? <Badge tone="warn">Late request</Badge> : null}
                          <Badge tone="info">{IDR_STATUS_LABELS[idr.status]}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        {idr.requestedBy?.name} · {formatDate(idr.requestedAt)}
                        {idr.scheduledAt ? ` · scheduled ${formatDate(idr.scheduledAt)}` : ""}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm text-ink">{idr.statement}</p>
                      {idr.outcomeNote ? (
                        <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-medium">{idr.outcome}:</span> {idr.outcomeNote}
                        </p>
                      ) : user.role !== "INSPECTOR" ? (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <ActionForm action={decideIdr} submitLabel="Update" size="sm" variant="secondary">
                            <input type="hidden" name="idrId" value={idr.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Status">
                                <select className={inputClass} name="status" defaultValue={idr.status}>
                                  {Object.entries(IDR_STATUS_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Outcome">
                                <select className={inputClass} name="outcome" defaultValue="">
                                  <option value="">—</option>
                                  <option value="UPHELD">Citation upheld</option>
                                  <option value="MODIFIED">Citation modified</option>
                                  <option value="DELETED">Citation deleted</option>
                                  <option value="SPLIT">Partially upheld</option>
                                </select>
                              </Field>
                            </div>
                            <Field label="Reasoning">
                              <textarea className={inputClass} name="outcomeNote" rows={2} />
                            </Field>
                          </ActionForm>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {canOpenWindow ? (
            <Card className="ring-1 ring-gov-200">
              <CardHeader
                title="Record the exit conference"
                subtitle={`Shares every draft finding with the provider and starts the ${policy.evidenceWindowDays}-working-day clock.`}
              />
              <CardBody>
                <ActionForm action={openEvidenceWindow} submitLabel="Open the evidence window">
                  <input type="hidden" name="inspectionId" value={inspection.id} />
                  <Field label="Exit conference date">
                    <input
                      className={inputClass}
                      type="date"
                      name="exitConferenceAt"
                      defaultValue={toDateInput(new Date())}
                    />
                  </Field>
                  {inspection.home.contacts.length === 0 ? (
                    <Alert tone="warn" title="No provider contact yet">
                      Invite a contact from the{" "}
                      <Link href={`/homes/${inspection.homeId}`} className="underline">
                        home record
                      </Link>{" "}
                      first, or the notification has nowhere to go.
                    </Alert>
                  ) : null}
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {windowOpen ? (
            <Card>
              <CardHeader title="Evidence window" subtitle={deadline.label} />
              <CardBody>
                <dl>
                  <Detail label="Exit conference">{formatDate(inspection.exitConferenceAt)}</Detail>
                  <Detail label="Documents due">{formatDate(inspection.evidenceDueAt)}</Detail>
                  {inspection.evidenceExtendedReason ? (
                    <Detail label="Extended because">{inspection.evidenceExtendedReason}</Detail>
                  ) : null}
                </dl>
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <ActionForm action={extendEvidenceWindow} submitLabel="Change deadline" size="sm" variant="secondary">
                    <input type="hidden" name="inspectionId" value={inspection.id} />
                    <Field label="New deadline">
                      <input
                        className={inputClass}
                        type="date"
                        name="evidenceDueAt"
                        defaultValue={toDateInput(inspection.evidenceDueAt)}
                      />
                    </Field>
                    <Field label="Reason" hint="Recorded and shown to the provider.">
                      <input className={inputClass} name="reason" />
                    </Field>
                  </ActionForm>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {!inspection.sodIssuedAt && inspection.findings.length > 0 ? (
            <Card>
              <CardHeader title="Issue the statement of deficiencies" />
              <CardBody>
                {gate.blockers.length > 0 ? (
                  <Alert tone="warn" title="Not ready yet">
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {gate.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </Alert>
                ) : (
                  <ActionForm action={issueStatement} submitLabel="Issue statement">
                    <input type="hidden" name="inspectionId" value={inspection.id} />
                    <Field label="Summary" hint="Printed at the head of the statement.">
                      <textarea className={inputClass} name="summary" rows={3} />
                    </Field>
                    {gate.notices.map((n) => (
                      <p key={n} className="text-xs text-ink-soft">
                        {n}
                      </p>
                    ))}
                  </ActionForm>
                )}
              </CardBody>
            </Card>
          ) : null}

          {inspection.sodIssuedAt ? (
            <Card>
              <CardHeader title="Statement issued" />
              <CardBody>
                <dl>
                  <Detail label="Issued">{formatDateTime(inspection.sodIssuedAt)}</Detail>
                  <Detail label="Provider acknowledged">
                    {inspection.sodAcknowledgedAt ? (
                      formatDateTime(inspection.sodAcknowledgedAt)
                    ) : (
                      <span className="text-amber-700">Not yet — correction and dispute clocks not started</span>
                    )}
                  </Detail>
                </dl>
                {inspection.status !== "CLOSED" ? (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <ActionForm action={closeInspection} submitLabel="Close inspection" size="sm" variant="secondary">
                      <input type="hidden" name="inspectionId" value={inspection.id} />
                    </ActionForm>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Provider contacts" />
            <CardBody className="p-0">
              <ul className="divide-y divide-slate-200">
                {inspection.home.contacts.map((c) => (
                  <li key={c.id} className="px-5 py-2.5">
                    <p className="text-sm font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-soft">{c.email}</p>
                    <p className="text-xs text-ink-faint">
                      {c.passwordHash ? `Last signed in ${formatDate(c.lastLoginAt)}` : "Invitation not yet accepted"}
                    </p>
                  </li>
                ))}
                {inspection.home.contacts.length === 0 ? (
                  <li className="px-5 py-3 text-sm text-ink-soft">None yet.</li>
                ) : null}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <CardBody className="p-0">
              <ul className="divide-y divide-slate-200">
                {audit.map((event) => (
                  <li key={event.id} className="px-5 py-2.5">
                    <p className="text-sm text-ink">{event.summary}</p>
                    <p className="text-xs text-ink-soft">
                      {event.actorName} · {formatDateTime(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
