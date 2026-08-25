import "server-only";
import { prisma } from "./db";
import { emailLayout, sendMail } from "./mailer";
import { evaluateHome, STATUS_LABELS, type Finding } from "./compliance/engine";
import { formatDate } from "./dates";
import { parseJsonArray, type SubscriptionTopic } from "./constants";

/**
 * Digest generation.
 *
 * The point of difference here is that a rule change is not reported as news.
 * For a subscriber with a home attached, every affected rule is evaluated
 * against that home's actual records, so the email says "you are missing X for
 * two residents" rather than "a rule changed, good luck".
 */

export type DigestSection = { heading: string; html: string };

export type DigestResult = {
  subject: string;
  html: string;
  text: string;
  /** False when nothing was worth sending. */
  hasContent: boolean;
};

export async function buildDigest(subscriptionId: string): Promise<DigestResult | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { home: true },
  });
  if (!subscription) return null;

  const topics = parseJsonArray<SubscriptionTopic>(subscription.topicsJson);
  const since = subscription.lastSentAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const sections: DigestSection[] = [];
  const textParts: string[] = [];

  if (topics.includes("WAC_UPDATES")) {
    const section = await ruleUpdateSection(since, subscription.homeId);
    if (section) {
      sections.push(section);
      textParts.push(section.heading);
    }
  }

  if (topics.includes("CITATIONS")) {
    const section = await citationSection(since);
    if (section) {
      sections.push(section);
      textParts.push(section.heading);
    }
  }

  if (subscription.homeId && (topics.includes("EXPIRY_DIGEST") || topics.includes("COMPLIANCE_GAPS"))) {
    const report = await evaluateHome(subscription.homeId);

    if (topics.includes("COMPLIANCE_GAPS") && report.failing.length > 0) {
      sections.push({
        heading: `${report.failing.length} open compliance gap${report.failing.length === 1 ? "" : "s"}`,
        html: findingListHtml(report.failing.slice(0, 15)),
      });
      textParts.push("Open compliance gaps");
    }

    if (topics.includes("EXPIRY_DIGEST") && report.atRisk.length > 0) {
      sections.push({
        heading: `${report.atRisk.length} record${report.atRisk.length === 1 ? "" : "s"} expiring soon`,
        html: findingListHtml(report.atRisk.slice(0, 15)),
      });
      textParts.push("Records expiring soon");
    }
  }

  if (sections.length === 0) {
    return {
      subject: "AFH Compliance — nothing to report",
      html: emailLayout(
        "Nothing needs your attention",
        `<p style="margin:0;">No rule changes, no new citations on the board, and nothing expiring at ${
          subscription.home?.name ?? "your home"
        }. We'll be in touch when that changes.</p>`,
      ),
      text: "Nothing needs your attention this period.",
      hasContent: false,
    };
  }

  const body = sections
    .map(
      (section) =>
        `<h2 style="margin:24px 0 8px;font-size:15px;font-weight:700;color:#12181f;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">${escape(
          section.heading,
        )}</h2>${section.html}`,
    )
    .join("");

  const base = process.env.APP_URL || "http://localhost:3000";
  const footer = `<a href="${base}/subscriptions?token=${subscription.unsubscribeToken}" style="color:#6b7a80;">Manage or cancel this subscription</a>`;

  return {
    subject: `AFH Compliance — ${sections[0].heading}`,
    html: emailLayout(
      subscription.home?.name
        ? `Compliance digest for ${subscription.home.name}`
        : "Your compliance digest",
      body,
      footer,
    ),
    text: textParts.join("\n"),
    hasContent: true,
  };
}

async function ruleUpdateSection(
  since: Date,
  homeId: string | null,
): Promise<DigestSection | null> {
  const updates = await prisma.regulatoryUpdate.findMany({
    where: { publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    include: { regulation: true },
    take: 10,
  });
  if (updates.length === 0) return null;

  const blocks: string[] = [];

  for (const update of updates) {
    const codes = parseJsonArray<string>(update.ruleCheckCodesJson);

    // This is the part that makes the digest worth reading: check the change
    // against the subscriber's own records instead of just announcing it.
    let impact = "";
    if (homeId && codes.length > 0) {
      const report = await evaluateHome(homeId, codes);
      if (report.totals.total === 0) {
        impact = pill("#f1f5f9", "#475569", "Doesn't apply to your home");
      } else if (report.totals.failing > 0) {
        impact =
          pill(
            "#fee2e2",
            "#991b1b",
            `${report.totals.failing} gap${report.totals.failing === 1 ? "" : "s"} at your home`,
          ) + findingListHtml(report.failing.slice(0, 5));
      } else if (report.totals.atRisk > 0) {
        impact =
          pill(
            "#fef3c7",
            "#92400e",
            `${report.totals.atRisk} item${report.totals.atRisk === 1 ? "" : "s"} expiring`,
          ) + findingListHtml(report.atRisk.slice(0, 5));
      } else {
        impact = pill("#dcfce7", "#166534", "You already comply");
      }
    } else if (codes.length === 0) {
      impact = pill("#f1f5f9", "#475569", "No automatic check — review by hand");
    }

    blocks.push(
      `<div style="margin:0 0 18px;">
         <div style="font-weight:600;color:#12181f;">${escape(update.title)}</div>
         <div style="font-size:12px;color:#6b7a80;margin:2px 0 6px;">
           ${escape(formatDate(update.publishedAt))}${
             update.regulation ? ` · ${escape(update.regulation.cite)}` : ""
           }${update.effectiveAt ? ` · effective ${escape(formatDate(update.effectiveAt))}` : ""}
         </div>
         <div style="font-size:14px;color:#334155;">${escape(update.summary)}</div>
         <div style="margin-top:8px;">${impact}</div>
       </div>`,
    );
  }

  return {
    heading: `${updates.length} rule update${updates.length === 1 ? "" : "s"}`,
    html: blocks.join(""),
  };
}

async function citationSection(since: Date): Promise<DigestSection | null> {
  const citations = await prisma.citation.findMany({
    where: { status: "APPROVED", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      summary: true,
      wacCite: true,
      county: true,
      severity: true,
      createdAt: true,
    },
  });
  if (citations.length === 0) return null;

  const base = process.env.APP_URL || "http://localhost:3000";
  const items = citations
    .map(
      (c) =>
        `<li style="margin-bottom:10px;">
           <a href="${base}/citations/${c.id}" style="color:#1f6459;font-weight:600;text-decoration:none;">${escape(c.summary)}</a>
           <div style="font-size:12px;color:#6b7a80;">${
             c.wacCite ? escape(c.wacCite) + " · " : ""
           }${c.county ? escape(c.county) + " County · " : ""}${escape(formatDate(c.createdAt))}</div>
         </li>`,
    )
    .join("");

  return {
    heading: `${citations.length} new citation${citations.length === 1 ? "" : "s"} on the board`,
    html: `<ul style="margin:0;padding-left:18px;">${items}</ul>`,
  };
}

function findingListHtml(findings: Finding[]): string {
  const items = findings
    .map(
      (f) =>
        `<li style="margin-bottom:6px;">
           <strong style="color:#12181f;">${escape(f.title)}</strong>
           ${f.subjectType !== "HOME" ? ` — ${escape(f.subjectName ?? "")}` : ""}
           <div style="font-size:12px;color:#6b7a80;">${escape(STATUS_LABELS[f.status])} · ${escape(f.detail)}</div>
         </li>`,
    )
    .join("");
  return `<ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:#334155;">${items}</ul>`;
}

function pill(background: string, color: string, label: string): string {
  return `<span style="display:inline-block;background:${background};color:${color};padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;">${escape(
    label,
  )}</span>`;
}

function escape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build and queue digests for every verified subscription due to receive one.
 * Wire this to a cron job, or run it from the admin page.
 */
export async function sendDueDigests(options: { force?: boolean } = {}): Promise<{
  considered: number;
  sent: number;
  skipped: number;
}> {
  const subscriptions = await prisma.subscription.findMany({
    where: { verified: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const subscription of subscriptions) {
    if (!options.force && !isDue(subscription.frequency, subscription.lastSentAt)) {
      skipped++;
      continue;
    }

    const digest = await buildDigest(subscription.id);
    if (!digest || !digest.hasContent) {
      skipped++;
      continue;
    }

    await sendMail({
      to: subscription.email,
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
      kind: "DIGEST",
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { lastSentAt: new Date() },
    });
    sent++;
  }

  return { considered: subscriptions.length, sent, skipped };
}

function isDue(frequency: string, lastSentAt: Date | null): boolean {
  if (!lastSentAt) return true;
  const elapsedDays = (Date.now() - lastSentAt.getTime()) / (24 * 60 * 60 * 1000);
  if (frequency === "IMMEDIATE") return elapsedDays >= 1;
  if (frequency === "MONTHLY") return elapsedDays >= 30;
  return elapsedDays >= 7;
}
