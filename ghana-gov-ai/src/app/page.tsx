import Link from "next/link";
import { AskBox } from "@/components/AskBox";
import { SUGGESTIONS } from "@/lib/suggestions";
import { Star } from "@/components/Star";
import { CATEGORIES, MINISTRIES, SERVICES, type Category } from "@/lib/services";

const POPULAR = ["ghana-card", "passport", "drivers-licence", "register-business", "nhis", "birth-registration"];

export default function Home() {
  const categories = Object.entries(CATEGORIES) as [Category, (typeof CATEGORIES)[Category]][];
  return (
    <>
      <section className="relative overflow-hidden bg-forest-800 text-white">
        <Star className="pointer-events-none absolute -right-16 -top-10 h-80 w-80 text-black/20" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-flag-gold">Government of Ghana services</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">How can we help you today?</h1>
          <p className="mx-auto mt-4 max-w-xl text-forest-100">
            One place to ask about any public service. No account, no forms. Plain answers with links to the agency
            responsible.
          </p>
          <div className="mt-8">
            <AskBox />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <Link
                key={s}
                href={`/ask?q=${encodeURIComponent(s)}`}
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Popular services</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR.map((slug) => SERVICES.find((s) => s.slug === slug)!).map((s) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              className="group rounded-xl border border-gray-200 p-5 transition hover:border-forest-700 hover:shadow-md"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-forest-700">{s.agency}</p>
              <p className="mt-1 font-semibold group-hover:underline">{s.title}</p>
              <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{s.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold">Browse by topic</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(([key, c]) => (
              <Link
                key={key}
                href={`/services#${key}`}
                className="flex items-start gap-3 rounded-xl bg-white p-4 ring-1 ring-gray-200 hover:ring-forest-700"
              >
                <span className="text-2xl" aria-hidden="true">{c.icon}</span>
                <span>
                  <span className="block font-semibold">{c.label}</span>
                  <span className="block text-sm text-ink-soft">{c.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3">
        {[
          ["Ask in your language", "English, Twi, Ga, Ewe, Dagbani, Hausa or French. The assistant answers in the language you write in."],
          ["Answers you can check", "Every answer cites the agency page it is based on, so you can confirm before you travel or pay."],
          ["Private by design", "No sign-in. The assistant never asks for your Ghana Card PIN, passport number or Mobile Money PIN."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border-t-4 border-flag-gold bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="font-semibold">{title}</p>
            <p className="mt-2 text-sm text-ink-soft">{body}</p>
          </div>
        ))}
      </section>

      <section id="ministries" className="mx-auto max-w-6xl px-4 pb-4">
        <h2 className="text-2xl font-bold">Ministries</h2>
        <p className="mt-1 text-sm text-ink-soft">Sample list for the test build.</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MINISTRIES.map((m) => (
            <li key={m} className="rounded-lg border border-gray-200 px-4 py-3 text-sm">{m}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
