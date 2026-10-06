import Link from "next/link";
import { CATEGORIES, SERVICES, type Category } from "@/lib/services";

export const metadata = { title: "Services | Ghana.gov Assistant (test build)" };

export default function ServicesPage() {
  const categories = Object.entries(CATEGORIES) as [Category, (typeof CATEGORIES)[Category]][];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">All services</h1>
      <p className="mt-2 text-ink-soft">
        Can&apos;t find it? <Link href="/ask" className="text-forest-700 underline">Ask the assistant</Link>.
      </p>
      <div className="mt-8 space-y-10">
        {categories.map(([key, c]) => {
          const items = SERVICES.filter((s) => s.category === key);
          if (!items.length) return null;
          return (
            <section key={key} id={key} className="scroll-mt-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <span aria-hidden="true">{c.icon}</span> {c.label}
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {items.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/services/${s.slug}`} className="block rounded-lg border border-gray-200 p-4 hover:border-forest-700">
                      <span className="font-medium">{s.title}</span>
                      <span className="block text-sm text-ink-soft">{s.agency}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
