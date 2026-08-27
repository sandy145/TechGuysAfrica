import Link from "next/link";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "The licensor finishes the inspection",
    body: "At the exit conference the preliminary findings are already written up — each one with its citation, what was observed, and the evidence sources behind it.",
  },
  {
    title: "The provider gets an account, not an email thread",
    body: "The licensor creates the account on the spot. The provider signs in and sees every finding and exactly what is being asked for, with the working-day deadline counting down.",
  },
  {
    title: "Documents land on the finding they answer",
    body: "Uploads attach to a specific finding, are digested and timestamped, and produce a receipt. The provider can see the moment the agency opens each file.",
  },
  {
    title: "The determination is recorded against the evidence",
    body: "Citation, consultation, or no deficiency — with a rationale, and a frozen snapshot of what the decision-maker had in front of them.",
  },
];

const GUARANTEES = [
  {
    title: "A citation cannot be recorded on unread evidence",
    body: "If a provider submission is unreviewed, or an uploaded file has never been opened, the system refuses to record a citation on that finding and says why.",
  },
  {
    title: "The two-source standard is checked, not assumed",
    body: "A finding cited on fewer independent sources than the programme requires needs a supervisor's written override, which is stored and printed on the statement.",
  },
  {
    title: "Silence is distinguishable from disagreement",
    body: "\"Nothing was submitted before the deadline\" is recorded as a fact on the determination — separate from \"submitted, considered, and cited anyway\".",
  },
  {
    title: "The packet answers the appeal on its face",
    body: "The statement of deficiencies carries an evidence index: every document, when it arrived, when it was first opened, and its digest.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-gov-900 text-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gov-200">
            For state adult family home licensing programmes
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Evidence Exchange</h1>
          <p className="mt-4 max-w-2xl text-lg text-gov-100">
            The window between the exit conference and the statement of deficiencies runs on email. Documents
            arrive as attachments in a thread, and a record that was sent but not seen becomes a citation the
            provider has to appeal. This closes that window.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-md bg-white px-5 py-2.5 font-semibold text-gov-900 hover:bg-gov-50"
            >
              Sign in
            </Link>
            <a
              href="#how"
              className="rounded-md border border-white/40 px-5 py-2.5 font-semibold hover:bg-white/10"
            >
              How it works
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gov-700">The failure it prevents</h2>
        <p className="mt-3 max-w-3xl text-lg text-ink">
          A provider produces a record during the evidence window. It is buried in a long email chain, or
          attached to a message that arrived alongside a dozen others. The licensor does not see it, and the
          finding is cited rather than resolved. The provider notices and says so — and if they had not, the
          citation would have stood on the record of a home that had done nothing wrong.
        </p>
        <p className="mt-3 max-w-3xl text-ink-soft">
          Nobody in that story behaved badly. The tool was an inbox, and an inbox has no idea which message
          answers which finding, no idea what has been read, and no memory of what a decision was based on.
        </p>
      </section>

      <section id="how" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gov-700">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-lg border border-slate-200 bg-white p-5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gov-700 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gov-700">
          What the system guarantees
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="border-l-4 border-gov-600 pl-4">
              <h3 className="font-semibold text-ink">{g.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gov-700">Demonstration accounts</h2>
          <p className="mt-2 text-sm text-ink-soft">
            This build ships with a seeded scenario: a full inspection six days past its exit conference, with
            one finding whose resolving document is sitting unread.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-200">
                {[
                  ["inspector@example.wa.gov", "Licensor — the scenario starts here"],
                  ["supervisor@example.wa.gov", "Field manager — oversight and overrides"],
                  ["adeline@cedargroveafh.example", "Provider — the home under inspection"],
                ].map(([email, role]) => (
                  <tr key={email}>
                    <td className="px-4 py-2 font-mono text-xs">{email}</td>
                    <td className="px-4 py-2 text-ink-soft">{role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Password for every demonstration account: <code className="rounded bg-white px-1">Exchange2026!</code>
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-xs text-ink-soft">
        <p>
          Evidence Exchange is a working prototype built for evaluation by a state licensing programme. Rule
          citations in the seeded catalog are illustrative and must be replaced with an authoritative rule
          table before operational use.
        </p>
      </footer>
    </main>
  );
}
