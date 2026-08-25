import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

const FEATURES = [
  {
    title: "Every record, one binder",
    body: "Resident files, employee files, and home records in one vault, each tied to the rule that requires it. Expiry dates are tracked for you, so a lapsed TB test or CPR card surfaces weeks before a licensor finds it.",
  },
  {
    title: "Know your gaps before they do",
    body: "The compliance engine reads your home's profile — bed count, specialty designations, Medicaid, nurse delegation — and evaluates only the rules that actually apply to you. Every gap comes with the citation and what to do about it.",
  },
  {
    title: "Forms that generate and sign themselves",
    body: "Fill a form once and it renders as a printable document. Sign on screen, or send a family member a private link to sign from their phone. The signed copy files itself into the resident's record.",
  },
  {
    title: "Learn from other homes, anonymously",
    body: "Providers post the citations they received with identifying details stripped and dates coarsened to the quarter. Browse what is being written up across the state, then check the same rules against your own home in one click.",
  },
  {
    title: "Rule changes that check themselves against you",
    body: "When a WAC changes, the digest doesn't just tell you it changed. It runs the affected checks against your records and tells you whether you are already compliant, and precisely what is missing if not.",
  },
  {
    title: "Walk into inspection prepared",
    body: "One printable binder: the home's records, then a tab per resident and per employee, with a cover sheet showing what is in place and what is outstanding.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.homeId ? "/dashboard" : "/onboarding");

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <span className="text-lg font-bold text-brand-700">AFH Compliance</span>
            <span className="ml-2 hidden text-sm text-slate-500 sm:inline">
              Washington adult family homes
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/citations" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Citation board
            </Link>
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary btn-sm">
              Create account
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Built around chapter 388-76 WAC
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Be ready for the inspection before it is scheduled.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          A single place for a Washington adult family home to keep required documentation,
          generate and sign the forms the state expects, watch what other providers are being
          cited for, and find out the moment a rule change leaves you out of compliance.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="btn-primary">
            Set up my home
          </Link>
          <Link href="/citations" className="btn-secondary">
            Browse the citation board
          </Link>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card p-5">
              <h2 className="text-base font-semibold text-slate-900">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-xl border border-amber-200 bg-amber-50 px-6 py-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">
            Not legal advice
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-900">
            This platform helps you organise records and track requirements. It does not
            interpret the law for you. The rule catalog shipped with this build is a starting
            point and is marked unverified until each citation has been checked against the
            official text published by the Washington State Legislature. Confirm every
            requirement against{" "}
            <span className="font-medium">chapter 388-76 WAC</span> and current DSHS/ALTSA
            guidance before relying on it for a survey.
          </p>
        </div>
      </section>
    </main>
  );
}
