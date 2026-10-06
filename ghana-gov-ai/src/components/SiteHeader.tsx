import Link from "next/link";
import { Star } from "./Star";

export function SiteHeader() {
  return (
    <header>
      <div className="bg-ink px-4 py-1.5 text-center text-xs text-white">
        <strong className="text-flag-gold">Test prototype.</strong> Not an official Government of Ghana website. Do not
        enter personal information.
      </div>
      <div className="flag-stripe h-1" />
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-forest-700 text-flag-gold">
              <Star className="h-5 w-5 text-black" />
            </span>
            <span className="leading-tight">
              Ghana.gov <span className="font-normal text-ink-soft">Assistant</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-4">
            <Link href="/services" className="rounded px-2 py-1 hover:bg-gray-100">
              Services
            </Link>
            <Link href="/#ministries" className="hidden rounded px-2 py-1 hover:bg-gray-100 sm:inline">
              Government
            </Link>
            <Link href="/ask" className="rounded-full bg-forest-700 px-4 py-1.5 font-medium text-white hover:bg-forest-800">
              Ask
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
