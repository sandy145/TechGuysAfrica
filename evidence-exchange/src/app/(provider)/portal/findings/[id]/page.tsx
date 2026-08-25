import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { providerNote, submitEvidence } from "@/app/actions/provider";
import { describeDeadline, formatDate, formatDateTime } from "@/lib/dates";
import { formatBytes } from "@/lib/storage";
import { HARM_LABELS, OUTCOME_LABELS } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { EvidenceUploadForm } from "@/components/EvidenceUploadForm";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Detail,
  Field,
  inputClass,
  PageHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProviderFindingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireProvider();

  const finding = await prisma.finding.findUnique({
    where: { id },
    include: {
      inspection: { include: { leadInspector: true } },
      evidenceRequests: { orderBy: { createdAt: "asc" } },
      submissions: {
        include: { files: true, submittedBy: true },
        orderBy: { submittedAt: "desc" },
      },
      notes: {
        where: { visibility: "SHARED" },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
      determination: { include: { decidedBy: true } },
    },
  });

  if (!finding || finding.inspection.homeId !== user.providerHomeId || !finding.sharedAt) notFound();

  const due = finding.evidenceDueAt ?? finding.inspection.evidenceDueAt;
  const deadline = describeDeadline(due);
  const isLate = Boolean(due && new Date() > due);
  const openRequests = finding.evidenceRequests.filter((r) => r.status === "OPEN");
  const closed = finding.status === "DETERMINED" || finding.status === "WITHDRAWN";

  return (
    <>
      <nav className="mb-4 text-sm text-ink-soft">
        <Link href="/portal" className="hover:underline">
          My findings
        </Link>
        {" / "}
        <span className="text-ink">{finding.tag}</span>
      </nav>

      <PageHeader
        eyebrow={`Finding ${finding.tag}`}
        title={finding.wacCite}
        description={`Raised by ${finding.inspection.leadInspector?.name ?? "your licensor"} at the exit conference on ${formatDate(finding.inspection.exitConferenceAt)}.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="What was found" />
            <CardBody>
              <dl>
                <Detail label="What the rule requires">{finding.requirementText}</Detail>
                <Detail label="What the licensor recorded">{finding.practiceText}</Detail>
                <Detail label="Severity">{HARM_LABELS[finding.harm]}</Detail>
              </dl>
            </CardBody>
          </Card>

          {openRequests.length > 0 ? (
            <Card className="ring-1 ring-amber-200">
              <CardHeader title="What your licensor has asked for" />
              <CardBody>
                <ul className="list-disc space-y-2 pl-5 text-sm text-ink">
                  {openRequests.map((r) => (
                    <li key={r.id}>
                      {r.prompt}
                      {r.dueAt ? (
                        <span className="ml-1 text-xs text-ink-soft">(by {formatDate(r.dueAt)})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {!closed ? (
            <Card>
              <CardHeader
                title="Send your documentation"
                subtitle={due ? `Due ${formatDate(due)} — ${deadline.label}` : undefined}
              />
              <CardBody>
                <EvidenceUploadForm
                  action={submitEvidence}
                  findingId={finding.id}
                  requests={finding.evidenceRequests
                    .filter((r) => r.status === "OPEN")
                    .map((r) => ({ id: r.id, prompt: r.prompt }))}
                  isLate={isLate}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="What you have sent"
              subtitle="With the exact time it arrived and whether your licensor has opened it."
            />
            <CardBody className="p-0">
              {finding.submissions.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Nothing sent yet.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {finding.submissions.map((s) => (
                    <li key={s.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-ink-soft">
                          Sent {formatDateTime(s.submittedAt)} by {s.submittedBy?.name ?? "you"}
                        </p>
                        <div className="flex gap-2">
                          {s.isLate ? <Badge tone="warn">Late</Badge> : null}
                          {s.reviewedAt ? (
                            <Badge tone="ok">Reviewed {formatDate(s.reviewedAt)}</Badge>
                          ) : (
                            <Badge tone="info">Delivered — awaiting review</Badge>
                          )}
                        </div>
                      </div>
                      {s.note ? <p className="mt-2 text-sm text-ink">{s.note}</p> : null}
                      <ul className="mt-2 space-y-1">
                        {s.files.map((f) => (
                          <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <a
                              href={`/api/files/${f.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gov-700 underline"
                            >
                              {f.fileName}
                            </a>
                            <span className="text-xs text-ink-soft">{formatBytes(f.sizeBytes)}</span>
                            {f.firstOpenedAt ? (
                              <Badge tone="ok">Opened {formatDateTime(f.firstOpenedAt)}</Badge>
                            ) : (
                              <Badge tone="neutral">Not opened yet</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Messages" subtitle="Visible to you and to your licensor." />
            <CardBody className="p-0">
              {finding.notes.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">No messages.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {finding.notes.map((note) => (
                    <li key={note.id} className="px-5 py-3">
                      <p className="text-xs text-ink-soft">
                        <span className="font-medium text-ink">{note.author?.name ?? "—"}</span> ·{" "}
                        {formatDateTime(note.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <ActionForm action={providerNote} submitLabel="Send message" size="sm" variant="secondary" resetOnSuccess>
                  <input type="hidden" name="findingId" value={finding.id} />
                  <Field label="Message">
                    <textarea className={inputClass} name="body" rows={2} />
                  </Field>
                </ActionForm>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Where this stands" />
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
                  <p className="mt-3 whitespace-pre-line text-sm text-ink">
                    {finding.determination.rationale}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    Decided by {finding.determination.decidedBy?.name} on{" "}
                    {formatDate(finding.determination.decidedAt)}
                  </p>
                  {finding.determination.outcome === "CITATION" ? (
                    <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
                      <p>
                        If you believe this is wrong,{" "}
                        <Link href="/portal/idr" className="text-gov-700 underline">
                          request informal dispute resolution
                        </Link>
                        .
                      </p>
                    </div>
                  ) : null}
                </>
              ) : finding.submissions.length > 0 ? (
                <Alert tone="info" title="Your documents are in the queue">
                  Your licensor has to open and review everything you sent before this finding can be cited.
                </Alert>
              ) : (
                <Alert tone="warn" title="Nothing sent yet">
                  {due
                    ? `Send your documentation by ${formatDate(due)} — ${deadline.label}.`
                    : "Send your documentation when you have it."}
                </Alert>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
