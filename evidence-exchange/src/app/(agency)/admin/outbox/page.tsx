import { requireAgency } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { Alert, Badge, Card, CardBody, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Every notice the system would send. Nothing here carries a case document —
 * notifications are a doorbell, and the record stays behind the sign-in.
 */
export default async function OutboxPage() {
  await requireAgency();
  const messages = await prisma.outboxMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Notification outbox"
        description="What the system has sent, and what it would send once a mail transport is configured."
      />

      <div className="mb-6">
        <Alert tone="info" title="No mail transport is configured in this build">
          Messages are recorded rather than delivered, so nothing is claimed to have been sent that was not.
          Point <code className="rounded bg-white px-1">src/lib/mailer.ts</code> at the agency&apos;s relay to
          deliver for real.
        </Alert>
      </div>

      <Card>
        <CardBody className="p-0">
          <ul className="divide-y divide-slate-200">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{m.subject}</p>
                  <div className="flex gap-2">
                    <Badge tone="neutral">{m.kind}</Badge>
                    <Badge tone={m.status === "SENT" ? "ok" : m.status === "FAILED" ? "danger" : "warn"}>
                      {m.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-ink-soft">
                  To {m.toEmail} · {formatDateTime(m.createdAt)}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gov-700">Show body</summary>
                  <div
                    className="mt-2 overflow-hidden rounded border border-slate-200 bg-slate-50 p-3 text-xs"
                    dangerouslySetInnerHTML={{ __html: m.bodyHtml }}
                  />
                </details>
              </li>
            ))}
            {messages.length === 0 ? (
              <li className="px-5 py-4 text-sm text-ink-soft">Nothing yet.</li>
            ) : null}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}
