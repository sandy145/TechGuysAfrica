import Link from "next/link";
import { notFound } from "next/navigation";
import { AskBox } from "@/components/AskBox";
import { CATEGORIES, SERVICES, getService } from "@/lib/services";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const svc = getService((await params).slug);
  return { title: svc ? `${svc.title} | Ghana.gov Assistant (test build)` : "Not found" };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const svc = getService((await params).slug);
  if (!svc) notFound();
  const cat = CATEGORIES[svc.category];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-sm text-ink-soft">
        <Link href="/services" className="hover:underline">Services</Link> /{" "}
        <Link href={`/services#${svc.category}`} className="hover:underline">{cat.label}</Link>
      </nav>
      <h1 className="mt-2 text-3xl font-bold">{svc.title}</h1>
      <p className="mt-1 text-sm">
        Run by{" "}
        <a href={svc.agencyUrl} target="_blank" rel="noreferrer" className="font-medium text-forest-700 underline">
          {svc.agency} ↗
        </a>
      </p>
      <p className="mt-6 text-lg leading-relaxed">{svc.summary}</p>

      <h2 className="mt-8 text-xl font-semibold">Steps</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6">
        {svc.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>

      {svc.documents?.length ? (
        <>
          <h2 className="mt-8 text-xl font-semibold">What to bring</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            {svc.documents.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </>
      ) : null}

      {svc.notes?.length ? (
        <div className="mt-8 rounded-lg border-l-4 border-flag-gold bg-yellow-50 p-4 text-sm">
          {svc.notes.map((n) => <p key={n}>{n}</p>)}
        </div>
      ) : null}

      <p className="mt-8 text-sm text-ink-soft">
        Fees and requirements change. Confirm on the agency&apos;s official website before you go or pay.
      </p>

      <div className="mt-10 rounded-2xl bg-forest-50 p-5">
        <p className="mb-3 font-semibold">Still have a question?</p>
        <AskBox placeholder={`Ask about ${svc.title.toLowerCase()}…`} />
      </div>
    </div>
  );
}
