import "server-only";
import { prisma } from "./db";

/**
 * Outbound mail.
 *
 * No SMTP transport is configured in this build, and rather than pretend a
 * message was delivered, every send is written to the OutboxMessage table and
 * left QUEUED. The admin Outbox page renders exactly what would have gone out.
 *
 * To actually deliver, implement `transport` below against a provider SDK and
 * set the status to SENT/FAILED from its response — no caller changes needed.
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  kind?: "DIGEST" | "SIGNATURE_REQUEST" | "VERIFICATION" | "OTHER";
};

type Transport = (message: MailMessage) => Promise<void>;

const transport: Transport | null = null;

export async function sendMail(message: MailMessage): Promise<{ delivered: boolean }> {
  const record = await prisma.outboxMessage.create({
    data: {
      toEmail: message.to,
      subject: message.subject,
      bodyHtml: message.html,
      bodyText: message.text ?? null,
      kind: message.kind ?? "OTHER",
      status: "QUEUED",
    },
  });

  if (!transport) return { delivered: false };

  try {
    await (transport as Transport)(message);
    await prisma.outboxMessage.update({
      where: { id: record.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { delivered: true };
  } catch (err) {
    await prisma.outboxMessage.update({
      where: { id: record.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
    });
    return { delivered: false };
  }
}

/** Shared shell so every generated email looks like one product. */
export function emailLayout(title: string, bodyHtml: string, footer?: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#12181f;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe4e2;border-radius:12px;overflow:hidden;">
    <div style="background:#1f6459;padding:18px 24px;">
      <div style="color:#ffffff;font-size:16px;font-weight:700;">AFH Compliance</div>
      <div style="color:#a8d3ca;font-size:12px;">Washington adult family home readiness</div>
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${escape(title)}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#f8fafa;border-top:1px solid #e6eeec;font-size:12px;color:#6b7a80;">
      ${footer ?? "You are receiving this because you subscribed to AFH Compliance updates."}
    </div>
  </div>
</body></html>`;
}

function escape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
