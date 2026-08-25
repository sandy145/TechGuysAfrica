import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCitationAction } from "@/app/actions/citations";
import { recentQuarters } from "@/lib/dates";
import {
  CITATION_SEVERITIES,
  CITATION_SEVERITY_LABELS,
  SURVEY_TYPES,
  SURVEY_TYPE_LABELS,
  WA_COUNTIES,
} from "@/lib/constants";
import { Card, ErrorBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewCitationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireHome();
  const { error } = await searchParams;

  const [home, regulations] = await Promise.all([
    prisma.home.findUnique({ where: { id: user.homeId } }),
    prisma.regulation.findMany({
      where: { isActive: true },
      orderBy: { cite: "asc" },
      select: { cite: true, title: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Post a citation anonymously"
        description="Sharing what you were cited for is the fastest way for another provider to avoid the same finding. Your identity is not attached to this post."
        action={
          <Link href="/citations" className="btn-secondary">
            Back to board
          </Link>
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-900">
        <p className="font-semibold">Before you post</p>
        <ul className="mt-2 space-y-1">
          <li>
            Your county ({home?.county ?? "not set"}) and size band are published; your name,
            license number, and address are not.
          </li>
          <li>Dates are published as a quarter, never an exact survey date.</li>
          <li>
            Phone numbers, emails, street addresses, and license numbers are stripped from your
            text automatically — you&apos;ll see what was removed.
          </li>
          <li>A moderator reviews the post before it appears on the board.</li>
          <li>
            Nothing here is a legal filing. Do not post anything you would not be comfortable
            seeing published.
          </li>
        </ul>
      </div>

      <Card>
        <form action={createCitationAction} className="space-y-5">
          <div>
            <label className="label" htmlFor="summary">
              One-line summary <span className="text-red-600">*</span>
            </label>
            <input
              id="summary"
              name="summary"
              required
              minLength={15}
              maxLength={200}
              placeholder="Negotiated care plan not updated after a significant change in condition"
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">
              Describe the finding, not your home. This is what other providers scan.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="wacCite">
                WAC cited
              </label>
              <input
                id="wacCite"
                name="wacCite"
                list="wac-cites"
                placeholder="388-76-10355"
                className="input"
              />
              <datalist id="wac-cites">
                {regulations.map((reg) => (
                  <option key={reg.cite} value={reg.cite}>
                    {reg.title}
                  </option>
                ))}
              </datalist>
              <p className="mt-1 text-xs text-slate-500">
                Linking the rule lets other providers check themselves against it.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="severity">
                Severity as scored
              </label>
              <select id="severity" name="severity" defaultValue="NO_HARM" className="input">
                {CITATION_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {CITATION_SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="surveyType">
                Type of visit
              </label>
              <select
                id="surveyType"
                name="surveyType"
                defaultValue="FULL_INSPECTION"
                className="input"
              >
                {SURVEY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SURVEY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="citedQuarter">
                When (quarter)
              </label>
              <select id="citedQuarter" name="citedQuarter" className="input">
                <option value="">Prefer not to say</option>
                {recentQuarters(16).map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="county">
                County
              </label>
              <select
                id="county"
                name="county"
                defaultValue={home?.county ?? ""}
                className="input"
              >
                <option value="">Prefer not to say</option>
                {WA_COUNTIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="fineAmount">
                Fine, if any (USD)
              </label>
              <input id="fineAmount" name="fineAmount" type="number" min={0} className="input" />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="narrative">
              What happened
            </label>
            <textarea
              id="narrative"
              name="narrative"
              rows={5}
              placeholder="What the surveyor looked at, what they found, and how it was written up."
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="correctiveAction">
              What you did to correct it
            </label>
            <textarea
              id="correctiveAction"
              name="correctiveAction"
              rows={4}
              placeholder="The plan of correction you submitted, and whether it was accepted."
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">
              This is the part other providers find most useful.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="tags">
              Tags
            </label>
            <input
              id="tags"
              name="tags"
              placeholder="medications, care plan, staffing"
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">Comma separated, up to six.</p>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              name="linkHome"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              <span className="block font-medium">Keep a private link between this post and my home</span>
              <span className="block text-xs text-slate-500">
                Off by default. Turning it on stores your home id on the post so you can find it
                later. It is never shown to other users, but it does mean the link exists in the
                database. Leave it off for the strongest anonymity.
              </span>
            </span>
          </label>

          <button type="submit" className="btn-primary">
            Submit for review
          </button>
        </form>
      </Card>
    </div>
  );
}
