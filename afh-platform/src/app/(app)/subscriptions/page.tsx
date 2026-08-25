import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  previewDigestAction,
  subscribeAction,
  unsubscribeAction,
} from "@/app/actions/subscriptions";
import { formatDate } from "@/lib/dates";
import {
  parseJsonArray,
  SUBSCRIPTION_FREQUENCIES,
  SUBSCRIPTION_TOPICS,
  SUBSCRIPTION_TOPIC_LABELS,
  type SubscriptionTopic,
} from "@/lib/constants";
import { Badge, Card, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const FREQUENCY_LABELS: Record<string, string> = {
  IMMEDIATE: "As things happen (at most daily)",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    subscribed?: string;
    unsubscribed?: string;
    verified?: string;
    token?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  // Signed-in users manage their own; a token from an email footer lets an
  // anonymous subscriber manage theirs without an account.
  const mine = user
    ? await prisma.subscription.findMany({
        where: { OR: [{ email: user.email }, ...(user.homeId ? [{ homeId: user.homeId }] : [])] },
        include: { home: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : params.token
      ? await prisma.subscription.findMany({
          where: { unsubscribeToken: params.token },
          include: { home: { select: { name: true } } },
        })
      : [];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Newsletter and alerts"
        description="Get told what changed and what it means for your home — not just that something changed."
      />

      <ErrorBanner message={params.error} />
      {params.subscribed === "active" && (
        <NoticeBanner message="Subscribed. Your first digest goes out on the next run." />
      )}
      {params.subscribed === "pending" && (
        <NoticeBanner
          tone="amber"
          message="Almost there — a confirmation email has been queued. No mail transport is configured in this build, so open the Outbox to find the confirmation link."
        />
      )}
      {params.verified && <NoticeBanner message="Subscription confirmed." />}
      {params.unsubscribed && <NoticeBanner message="Unsubscribed." />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Subscribe" description="Pick what you want to hear about.">
          <form action={subscribeAction} className="space-y-5">
            <div>
              <label className="label" htmlFor="email">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={user?.email ?? ""}
                className="input"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="label">Send me</legend>
              {SUBSCRIPTION_TOPICS.map((topic) => {
                const personalised = topic === "EXPIRY_DIGEST" || topic === "COMPLIANCE_GAPS";
                return (
                  <label
                    key={topic}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="topics"
                      value={topic}
                      defaultChecked={topic === "WAC_UPDATES" || topic === "CITATIONS"}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      <span className="block text-slate-800">
                        {SUBSCRIPTION_TOPIC_LABELS[topic]}
                      </span>
                      {personalised && (
                        <span className="block text-xs text-slate-500">
                          Needs your home linked below.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div>
              <label className="label" htmlFor="frequency">
                How often
              </label>
              <select id="frequency" name="frequency" defaultValue="WEEKLY" className="input">
                {SUBSCRIPTION_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>

            {user?.homeId ? (
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  name="linkHome"
                  defaultChecked
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  <span className="block font-medium text-slate-800">
                    Check every update against my home
                  </span>
                  <span className="block text-xs text-slate-500">
                    This is what turns the digest from news into a to-do list.
                  </span>
                </span>
              </label>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <Link href="/register" className="font-medium text-brand-700 underline">
                  Create an account
                </Link>{" "}
                to get updates checked against your own records instead of the general feed.
              </p>
            )}

            <button type="submit" className="btn-primary">
              Subscribe
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Your subscriptions">
            {mine.length === 0 ? (
              <p className="text-sm text-slate-500">
                {user
                  ? "You have no subscriptions yet."
                  : "Sign in, or open the manage link from a digest email, to see your subscriptions."}
              </p>
            ) : (
              <ul className="space-y-4">
                {mine.map((subscription) => {
                  const topics = parseJsonArray<SubscriptionTopic>(subscription.topicsJson);
                  return (
                    <li key={subscription.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {subscription.email}
                        </span>
                        {subscription.verified ? (
                          <Badge tone="emerald">Active</Badge>
                        ) : (
                          <Badge tone="amber">Unconfirmed</Badge>
                        )}
                        {subscription.home && (
                          <Badge tone="brand">Linked to {subscription.home.name}</Badge>
                        )}
                      </div>

                      <ul className="mt-1.5 space-y-0.5">
                        {topics.map((topic) => (
                          <li key={topic} className="text-xs text-slate-600">
                            · {SUBSCRIPTION_TOPIC_LABELS[topic] ?? topic}
                          </li>
                        ))}
                      </ul>

                      <p className="mt-1.5 text-xs text-slate-500">
                        {FREQUENCY_LABELS[subscription.frequency] ?? subscription.frequency} · last
                        sent {formatDate(subscription.lastSentAt)}
                      </p>

                      <div className="mt-2 flex gap-2">
                        {user && (
                          <form action={previewDigestAction}>
                            <input type="hidden" name="id" value={subscription.id} />
                            <button type="submit" className="btn-secondary btn-sm">
                              Generate a digest now
                            </button>
                          </form>
                        )}
                        <form action={unsubscribeAction}>
                          <input
                            type="hidden"
                            name="token"
                            value={subscription.unsubscribeToken}
                          />
                          <button type="submit" className="btn-danger btn-sm">
                            Unsubscribe
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="What a digest looks like">
            <p className="text-sm text-slate-600">
              Rather than &ldquo;WAC 388-76-10355 was amended&rdquo;, you get:
            </p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">
                Negotiated care plan review interval shortened
              </p>
              <p className="mt-1 text-xs text-slate-500">Effective in 60 days · WAC 388-76-10355</p>
              <p className="mt-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                2 gaps at your home
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>· Negotiated care plan — Ana R. — Missing</li>
                <li>· Negotiated care plan — David P. — Completed late</li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Digests are queued to the{" "}
              <Link href="/admin/outbox" className="font-medium text-brand-700 underline">
                outbox
              </Link>{" "}
              in this build — no mail is actually delivered until a transport is configured.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
