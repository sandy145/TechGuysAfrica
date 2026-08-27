import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findingInclude, getPolicy } from "@/lib/queries";
import { determinationGate, reviewState, type FindingShape, type SubmissionShape } from "@/lib/workflow";
import {
  addEvidenceSource,
  addNote,
  requestEvidence,
  shareFinding,
  withdrawFinding,
} from "@/app/actions/findings";
import {
  approveDetermination,
  recordDetermination,
  reviewPlanOfCorrection,
  reviewSubmission,
  verifyCorrection,
} from "@/app/actions/determinations";
import { describeDeadline, formatDate, formatDateTime, relativeTime } from "@/lib/dates";
import { formatBytes } from "@/lib/storage";
import {
  CITATION_STATUS_LABELS,
  EVIDENCE_SOURCE_KINDS,
  EVIDENCE_SOURCE_LABELS,
  FINDING_STATUS_LABELS,
  HARM_LABELS,
  OUTCOME_LABELS,
  SCOPE_LABELS,
} from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { DeterminationForm } from "@/components/DeterminationForm";
import { Alert, Badge, Card, CardBody, CardHeader, Detail, Field, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FindingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAgency();

  const finding = await prisma.finding.findUnique({
    where: { id },
    include: {
      ...findingInclude,
      inspection: { include: { home: true, leadInspector: true } },
      createdBy: true,
    },
  });
  if (!finding) notFound();

  const policy = await getPolicy(user.agencyId);
  const shape: FindingShape = {
    id: finding.id,
    tag: finding.tag,
    status: finding.status,
    harm: finding.harm,
    sharedAt: finding.sharedAt,
    evidenceDueAt: finding.evidenceDueAt,
    sources: finding.sources,
    submissions: finding.submissions as unknown as SubmissionShape[],
  };
  const state = reviewState(shape);
  const citationGate = determinationGate({
    finding: shape,
    outcome: "CITATION",
    policy,
    actorRole: user.role,
  });

  const audit = await prisma.auditEvent.findMany({
    where: {
      OR: [
        { entityType: "Finding", entityId: finding.id },
        { entityType: "Submission", entityId: { in: finding.submissions.map((s) => s.id) } },
        {
          entityType: "SubmissionFile",
          entityId: { in: finding.submissions.flatMap((s) => s.files.map((f) => f.id)) },
        },
        ...(finding.determination
          ? [{ entityType: "Determination", entityId: finding.determination.id }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const deadline = describeDeadline(finding.evidenceDueAt);
  const canOverride = user.role !== "INSPECTOR";

  const suggestedRationale = state.hasEvidence
    ? ""
    : finding.evidenceDueAt && new Date(finding.evidenceDueAt) < new Date()
      ? `No documentation was submitted by the deadline of ${formatDate(finding.evidenceDueAt)}. The finding stands on the evidence gathered during the inspection.`
      : "";

  return (
    <>
      <nav className="mb-4 text-sm text-ink-soft">
        <Link href="/inspections" className="hover:underline">
          Inspections
        </Link>
        {" / "}
        <Link href={`/inspections/${finding.inspectionId}`} className="hover:underline">
          {finding.inspection.home.name}
        </Link>
        {" / "}
        <span className="text-ink">{finding.tag}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{finding.tag}</Badge>
            <Badge
              tone={
                finding.status === "EVIDENCE_RECEIVED"
                  ? "urgent"
                  : finding.status === "DETERMINED"
                    ? "ok"
                    : finding.status === "WITHDRAWN"
                      ? "neutral"
                      : "warn"
              }
            >
              {FINDING_STATUS_LABELS[finding.status as keyof typeof FINDING_STATUS_LABELS]}
            </Badge>
            {finding.harm === "IMMEDIATE_JEOPARDY" ? <Badge tone="urgent">Immediate jeopardy</Badge> : null}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{finding.wacCite}</h1>
          <p className="text-sm text-ink-soft">
            {finding.inspection.home.name} · licence {finding.inspection.home.licenseNumber} · survey{" "}
            {finding.inspection.surveyNumber ?? "—"}
          </p>
        </div>
      </div>

      {state.unreviewedSubmissions > 0 ? (
        <div className="mb-6">
          <Alert tone="warn" title="The provider has sent documentation you have not reviewed">
            {state.unreviewedSubmissions} submission
            {state.unreviewedSubmissions === 1 ? "" : "s"}
            {state.unopenedFiles > 0
              ? `, including ${state.unopenedFiles} file${state.unopenedFiles === 1 ? "" : "s"} never opened`
              : ""}
            . This finding cannot be cited until you have opened and reviewed everything below.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="The finding" subtitle={`Drafted by ${finding.createdBy?.name ?? "—"}`} />
            <CardBody>
              <dl>
                <Detail label="What the rule requires">{finding.requirementText}</Detail>
                <Detail label="What was found">{finding.practiceText}</Detail>
                <div className="grid grid-cols-2 gap-4">
                  <Detail label="Scope">{SCOPE_LABELS[finding.scope]}</Detail>
                  <Detail label="Harm">{HARM_LABELS[finding.harm]}</Detail>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Evidence sources"
              subtitle={`Independent sources supporting this finding. The standard is ${policy.minEvidenceSources}.`}
              action={
                <Badge tone={finding.sources.length >= policy.minEvidenceSources ? "ok" : "warn"}>
                  {finding.sources.length} of {policy.minEvidenceSources}
                </Badge>
              }
            />
            <CardBody className="p-0">
              {finding.sources.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">No sources recorded yet.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {finding.sources.map((s) => (
                    <li key={s.id} className="px-5 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gov-700">
                        {EVIDENCE_SOURCE_LABELS[s.kind]}
                      </p>
                      <p className="text-sm text-ink">{s.detail}</p>
                      {s.gatheredAt ? (
                        <p className="text-xs text-ink-soft">Gathered {formatDate(s.gatheredAt)}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <ActionForm action={addEvidenceSource} submitLabel="Add source" size="sm" variant="secondary" resetOnSuccess>
                  <input type="hidden" name="findingId" value={finding.id} />
                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <Field label="Kind">
                      <select className={inputClass} name="kind" defaultValue="RECORD_REVIEW">
                        {EVIDENCE_SOURCE_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {EVIDENCE_SOURCE_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Detail">
                      <input className={inputClass} name="detail" placeholder="Whose record, which observation, which interview" />
                    </Field>
                  </div>
                </ActionForm>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="What the provider was asked for"
              subtitle="Each request is on the record with its own deadline."
            />
            <CardBody className="p-0">
              {finding.evidenceRequests.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Nothing requested yet.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {finding.evidenceRequests.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div>
                        <p className="text-sm text-ink">{r.prompt}</p>
                        <p className="text-xs text-ink-soft">
                          Requested {formatDate(r.createdAt)}
                          {r.dueAt ? ` · due ${formatDate(r.dueAt)}` : ""}
                        </p>
                      </div>
                      <Badge tone={r.status === "ANSWERED" ? "ok" : "warn"}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <ActionForm action={requestEvidence} submitLabel="Request document" size="sm" variant="secondary" resetOnSuccess>
                  <input type="hidden" name="findingId" value={finding.id} />
                  <Field label="What do you need?" hint="Be specific — this is what the provider sees.">
                    <textarea className={inputClass} name="prompt" rows={2} />
                  </Field>
                </ActionForm>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Provider submissions"
              subtitle={`${state.submissionCount} submission(s), ${state.fileCount} file(s).`}
            />
            <CardBody className="p-0">
              {finding.submissions.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">
                  Nothing submitted yet.
                  {finding.evidenceDueAt ? ` Deadline ${formatDate(finding.evidenceDueAt)} — ${deadline.label}.` : ""}
                </p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {finding.submissions.map((submission) => (
                    <li
                      key={submission.id}
                      className={`px-5 py-4 ${submission.reviewedAt ? "" : "bg-amber-50/60"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          {submission.submittedBy?.name ?? "Provider"} ·{" "}
                          <span className="font-normal text-ink-soft">
                            {formatDateTime(submission.submittedAt)} ({relativeTime(submission.submittedAt)})
                          </span>
                        </p>
                        <div className="flex gap-2">
                          {submission.isLate ? <Badge tone="warn">Late</Badge> : null}
                          {submission.reviewedAt ? (
                            <Badge tone="ok">
                              Reviewed by {submission.reviewedBy?.name ?? "—"} {formatDate(submission.reviewedAt)}
                            </Badge>
                          ) : (
                            <Badge tone="urgent">Not reviewed</Badge>
                          )}
                        </div>
                      </div>

                      {submission.note ? (
                        <p className="mt-2 whitespace-pre-line rounded border border-slate-200 bg-white px-3 py-2 text-sm text-ink">
                          {submission.note}
                        </p>
                      ) : null}

                      {submission.files.length > 0 ? (
                        <ul className="mt-3 space-y-1.5">
                          {submission.files.map((file) => (
                            <li key={file.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <a
                                href={`/api/files/${file.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-gov-700 underline hover:text-gov-900"
                              >
                                {file.fileName}
                              </a>
                              <span className="text-xs text-ink-soft">{formatBytes(file.sizeBytes)}</span>
                              {file.firstOpenedAt ? (
                                <Badge tone="ok">Opened {formatDate(file.firstOpenedAt)}</Badge>
                              ) : (
                                <Badge tone="urgent">Never opened</Badge>
                              )}
                              <span className="text-[11px] text-ink-faint">sha256 {file.sha256.slice(0, 12)}…</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {submission.reviewedAt ? (
                        submission.reviewNote ? (
                          <p className="mt-2 text-xs text-ink-soft">Review note: {submission.reviewNote}</p>
                        ) : null
                      ) : (
                        <div className="mt-3 rounded border border-amber-200 bg-white px-3 py-3">
                          <ActionForm action={reviewSubmission} submitLabel="Mark reviewed" size="sm">
                            <input type="hidden" name="submissionId" value={submission.id} />
                            <Field
                              label="Review note"
                              hint="Optional. What this document does or does not establish."
                            >
                              <input className={inputClass} name="reviewNote" />
                            </Field>
                          </ActionForm>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Discussion" subtitle="Shared notes are visible to the provider; internal notes are not." />
            <CardBody className="p-0">
              {finding.notes.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">No notes.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {finding.notes.map((note) => (
                    <li key={note.id} className="px-5 py-3">
                      <p className="flex items-center gap-2 text-xs text-ink-soft">
                        <span className="font-medium text-ink">{note.author?.name ?? "—"}</span>
                        {formatDateTime(note.createdAt)}
                        {note.visibility === "INTERNAL" ? <Badge tone="neutral">Internal</Badge> : null}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <ActionForm action={addNote} submitLabel="Add note" size="sm" variant="secondary" resetOnSuccess>
                  <input type="hidden" name="findingId" value={finding.id} />
                  <Field label="Note">
                    <textarea className={inputClass} name="body" rows={2} />
                  </Field>
                  <Field label="Visibility">
                    <select className={inputClass} name="visibility" defaultValue="SHARED">
                      <option value="SHARED">Shared with the provider</option>
                      <option value="INTERNAL">Internal only</option>
                    </select>
                  </Field>
                </ActionForm>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Evidence window" />
            <CardBody>
              <dl>
                <Detail label="Shared with provider">
                  {finding.sharedAt ? formatDateTime(finding.sharedAt) : "Not yet shared"}
                </Detail>
                <Detail label="Deadline">
                  {finding.evidenceDueAt ? (
                    <>
                      {formatDate(finding.evidenceDueAt)}
                      <span
                        className={`ml-2 text-xs ${
                          deadline.tone === "late" ? "text-red-700" : "text-ink-soft"
                        }`}
                      >
                        {deadline.label}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </Detail>
              </dl>
              {finding.status === "DRAFT" ? (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <ActionForm action={shareFinding} submitLabel="Share with provider" size="sm">
                    <input type="hidden" name="findingId" value={finding.id} />
                    <p className="text-xs text-ink-soft">
                      Sharing lets the provider see this finding and respond to it.
                    </p>
                  </ActionForm>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card className={finding.determination ? "" : "ring-1 ring-gov-200"}>
            <CardHeader
              title="Determination"
              subtitle={finding.determination ? undefined : "Citation, consultation, or no deficiency."}
            />
            <CardBody>
              {finding.determination ? (
                <>
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
                  <p className="mt-3 whitespace-pre-line text-sm text-ink">{finding.determination.rationale}</p>
                  <dl className="mt-3 border-t border-slate-200 pt-2">
                    <Detail label="Decided by">
                      {finding.determination.decidedBy?.name ?? "—"} ·{" "}
                      {formatDateTime(finding.determination.decidedAt)}
                    </Detail>
                    <Detail label="Evidence considered">
                      {JSON.parse(finding.determination.evidenceConsideredJson).length} submission(s), frozen
                      at decision time
                    </Detail>
                    {finding.determination.noProviderResponse ? (
                      <Detail label="Provider response">None received before the deadline</Detail>
                    ) : null}
                    {finding.determination.overrideReason ? (
                      <Detail label="Supervisor override">{finding.determination.overrideReason}</Detail>
                    ) : null}
                    {finding.determination.approvedAt ? (
                      <Detail label="Approved by">
                        {finding.determination.approvedBy?.name} · {formatDate(finding.determination.approvedAt)}
                      </Detail>
                    ) : null}
                  </dl>

                  {finding.harm === "IMMEDIATE_JEOPARDY" &&
                  finding.determination.outcome === "CITATION" &&
                  !finding.determination.approvedAt ? (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      {user.role === "INSPECTOR" ? (
                        <Alert tone="warn">Awaiting supervisor approval before the statement can be issued.</Alert>
                      ) : (
                        <ActionForm action={approveDetermination} submitLabel="Approve" size="sm">
                          <input type="hidden" name="determinationId" value={finding.determination.id} />
                        </ActionForm>
                      )}
                    </div>
                  ) : null}
                </>
              ) : finding.status === "WITHDRAWN" ? (
                <p className="text-sm text-ink-soft">This finding was withdrawn.</p>
              ) : (
                <DeterminationForm
                  action={recordDetermination}
                  findingId={finding.id}
                  citationBlockers={citationGate.blockers}
                  overridable={citationGate.overridable}
                  notices={citationGate.notices}
                  canOverride={canOverride}
                  suggestedRationale={suggestedRationale}
                />
              )}
            </CardBody>
          </Card>

          {finding.citation ? (
            <Card>
              <CardHeader
                title="Citation"
                subtitle={CITATION_STATUS_LABELS[finding.citation.status]}
              />
              <CardBody>
                <dl>
                  <Detail label="Plan of correction due">{formatDate(finding.citation.pocDueAt)}</Detail>
                  <Detail label="Correction due">{formatDate(finding.citation.correctionDueAt)}</Detail>
                </dl>

                {finding.citation.plansOfCorrection.map((poc) => (
                  <div key={poc.id} className="mt-3 rounded border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-ink-soft">
                        Submitted {formatDate(poc.submittedAt)} {poc.isLate ? "(late)" : ""}
                      </p>
                      <Badge tone={poc.status === "ACCEPTED" ? "ok" : poc.status === "REJECTED" ? "danger" : "warn"}>
                        {poc.status}
                      </Badge>
                    </div>
                    <dl className="mt-2">
                      <Detail label="How corrected">{poc.howCorrected}</Detail>
                      <Detail label="Preventing recurrence">{poc.systemicMeasures}</Detail>
                      <Detail label="Responsible">{poc.responsiblePerson}</Detail>
                      <Detail label="Completion">{formatDate(poc.completionDate)}</Detail>
                    </dl>
                    {poc.status === "SUBMITTED" ? (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <ActionForm action={reviewPlanOfCorrection} submitLabel="Record review" size="sm">
                          <input type="hidden" name="pocId" value={poc.id} />
                          <Field label="Decision">
                            <select className={inputClass} name="decision" defaultValue="ACCEPTED">
                              <option value="ACCEPTED">Accept</option>
                              <option value="REJECTED">Reject</option>
                            </select>
                          </Field>
                          <Field label="Note" hint="Required when rejecting.">
                            <textarea className={inputClass} name="reviewNote" rows={2} />
                          </Field>
                        </ActionForm>
                      </div>
                    ) : null}
                  </div>
                ))}

                {finding.citation.status === "POC_ACCEPTED" ? (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <ActionForm action={verifyCorrection} submitLabel="Verify correction" size="sm">
                      <input type="hidden" name="citationId" value={finding.citation.id} />
                      <Field label="How was it verified?" hint="Revisit, document review, or photograph.">
                        <textarea className={inputClass} name="verifiedNote" rows={2} />
                      </Field>
                    </ActionForm>
                  </div>
                ) : null}

                {finding.citation.verifiedNote ? (
                  <p className="mt-3 text-sm text-ink">
                    <span className="font-medium">Verified:</span> {finding.citation.verifiedNote}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {finding.status !== "DETERMINED" && finding.status !== "WITHDRAWN" ? (
            <Card>
              <CardHeader title="Withdraw this finding" />
              <CardBody>
                <ActionForm action={withdrawFinding} submitLabel="Withdraw" variant="secondary" size="sm">
                  <input type="hidden" name="findingId" value={finding.id} />
                  <Field label="Reason" hint="Shared with the provider.">
                    <input className={inputClass} name="reason" />
                  </Field>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Activity" subtitle="Append-only." />
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
