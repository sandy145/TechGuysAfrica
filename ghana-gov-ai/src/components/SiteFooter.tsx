import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink text-gray-300">
      <div className="flag-stripe h-1" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
        <div>
          <p className="font-semibold text-white">Ghana.gov Assistant</p>
          <p className="mt-2">
            A test build exploring an AI front door to public services. Answers are generated from a curated knowledge
            base and may be incomplete. Always confirm with the responsible agency.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">Explore</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/ask" className="hover:text-white">Ask a question</Link></li>
            <li><Link href="/services" className="hover:text-white">All services</Link></li>
            <li><a href="https://www.ghana.gov.gh" className="hover:text-white">Official portal: ghana.gov.gh</a></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">Emergency</p>
          <p className="mt-2">
            Call <strong className="text-white">112</strong>. Police 191 · Fire 192 · Ambulance 193.
          </p>
          <p className="mt-2">Government staff will never ask for your Mobile Money PIN.</p>
        </div>
      </div>
    </footer>
  );
}
