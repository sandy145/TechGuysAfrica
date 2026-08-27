import "server-only";
import { prisma } from "./db";

/**
 * Outbound mail.
 *
 * No SMTP transport is configured in this build. Rather than pretend a message
 * was delivered, every send is written to the OutboxMessage table and left
 * QUEUED; the admin Outbox page renders exactly what would have gone out. To
 * deliver for real, implement `transport` against the state's mail relay and
 * set SENT/FAILED from its response — no caller changes needed.
 *
 * Note what these messages deliberately do NOT contain: findings, evidence, or
 * attachments. Email is a doorbell here, not a filing cabinet. That is the
 * whole point of the product.
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  kind?:
    | "INVITATION"
    | "FINDINGS_SHARED"
    | "REMINDER"
    | "SUBMISSION_RECEIPT"
    | "DETERMINATION"
    | "SOD_ISSUED"
    | "OTHER";
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

export function appUrl(pathname = "/"): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${pathname}`;
}

export function agencyName(): string {
  return process.env.AGENCY_NAME || "Residential Care Services";
}

/** Shared shell so every generated notice looks like one system of record. */
export function emailLayout(title: string, bodyHtml: string, footer?: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#eef2f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#101828;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d8e1f1;border-radius:10px;overflow:hidden;">
    <div style="background:#233d68;color:#ffffff;padding:16px 24px;font-size:14px;letter-spacing:.04em;text-transform:uppercase;">
      ${escapeHtml(agencyName())} &middot; Evidence Exchange
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#f7f9fc;border-top:1px solid #e4eaf4;font-size:12px;color:#475467;">
      ${footer ?? "This notice contains no case documents. Sign in to the Evidence Exchange to view findings and upload records."}
    </div>
  </div>
</body></html>`;
}

export function button(label: string, href: string): string {
  return `<p style="margin:20px 0;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#233d68;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;">${escapeHtml(label)}</a>
  </p>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
