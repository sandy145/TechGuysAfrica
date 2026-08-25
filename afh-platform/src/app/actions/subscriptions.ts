"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, randomToken, requireUser } from "@/lib/auth";
import { buildDigest, sendDueDigests } from "@/lib/newsletter";
import { emailLayout, sendMail } from "@/lib/mailer";
import {
  oneOf,
  SUBSCRIPTION_FREQUENCIES,
  SUBSCRIPTION_TOPICS,
  type SubscriptionFrequency,
  type SubscriptionTopic,
} from "@/lib/constants";

export async function subscribeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`/subscriptions?error=${encodeURIComponent("Enter a valid email address.")}`);
  }

  const topics = formData
    .getAll("topics")
    .map((t) => String(t))
    .filter((t): t is SubscriptionTopic =>
      (SUBSCRIPTION_TOPICS as readonly string[]).includes(t),
    );

  if (topics.length === 0) {
    redirect(`/subscriptions?error=${encodeURIComponent("Pick at least one thing to hear about.")}`);
  }

  const frequency = oneOf(
    SUBSCRIPTION_FREQUENCIES,
    formData.get("frequency"),
    "WEEKLY" as SubscriptionFrequency,
  );

  // Personalised topics need a home to evaluate against; an anonymous
  // subscriber can still get the general feed.
  const wantsPersonalised = topics.some(
    (t) => t === "EXPIRY_DIGEST" || t === "COMPLIANCE_GAPS",
  );
  const homeId = formData.get("linkHome") != null ? (user?.homeId ?? null) : null;

  if (wantsPersonalised && !homeId) {
    redirect(
      `/subscriptions?error=${encodeURIComponent("Expiry and gap digests need to be linked to your home. Tick the box, or choose only the general topics.")}`,
    );
  }

  const unsubscribeToken = randomToken(24);
  const verifyToken = randomToken(24);

  // A person may hold one general subscription plus one per home they manage.
  const existing = await prisma.subscription.findFirst({ where: { email, homeId } });

  const subscription = existing
    ? await prisma.subscription.update({
        where: { id: existing.id },
        data: { topicsJson: JSON.stringify(topics), frequency },
      })
    : await prisma.subscription.create({
        data: {
          email,
          homeId,
          topicsJson: JSON.stringify(topics),
          frequency,
          unsubscribeToken,
          verifyToken,
          // A signed-in user confirming their own address has already proved it.
          verified: Boolean(user && user.email === email),
        },
      });

  if (!subscription.verified && subscription.verifyToken) {
    const base = process.env.APP_URL || "http://localhost:3000";
    await sendMail({
      to: email,
      kind: "VERIFICATION",
      subject: "Confirm your AFH Compliance subscription",
      html: emailLayout(
        "Confirm your subscription",
        `<p style="margin:0 0 20px;">Click below to start receiving compliance digests.</p>
         <p style="margin:0;"><a href="${base}/subscriptions/verify/${subscription.verifyToken}" style="display:inline-block;background:#1f6459;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Confirm subscription</a></p>`,
      ),
      text: `Confirm your subscription: ${base}/subscriptions/verify/${subscription.verifyToken}`,
    });
  }

  revalidatePath("/subscriptions");
  redirect(
    `/subscriptions?subscribed=${subscription.verified ? "active" : "pending"}&id=${subscription.id}`,
  );
}

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const subscription = await prisma.subscription.findUnique({
    where: { unsubscribeToken: token },
  });

  if (subscription) await prisma.subscription.delete({ where: { id: subscription.id } });

  revalidatePath("/subscriptions");
  redirect("/subscriptions?unsubscribed=1");
}

/** Queue a digest immediately so a provider can see exactly what they'd get. */
export async function previewDigestAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");

  const digest = await buildDigest(id);
  if (!digest) redirect("/subscriptions?error=Subscription%20not%20found.");

  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) redirect("/subscriptions?error=Subscription%20not%20found.");

  await sendMail({
    to: subscription.email,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
    kind: "DIGEST",
  });

  revalidatePath("/admin/outbox");
  redirect("/admin/outbox?generated=1");
}

/** Run the whole mailing. Admin-only; a cron job would call sendDueDigests directly. */
export async function runDigestsAction(): Promise<void> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/admin/outbox?error=Administrators%20only.");
  }

  const result = await sendDueDigests({ force: false });

  revalidatePath("/admin/outbox");
  redirect(`/admin/outbox?ran=1&sent=${result.sent}&skipped=${result.skipped}`);
}
