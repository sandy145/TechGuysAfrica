import Link from "next/link";
import { signOut } from "@/app/actions/auth";

/**
 * One shell for both audiences. The provider side is visually distinguished by
 * a lighter header, because a provider signing in should never be uncertain
 * about whether they are looking at their own portal or the agency's.
 */
export function AppShell({
  nav,
  userName,
  userDetail,
  side,
  children,
}: {
  nav: { href: string; label: string }[];
  userName: string;
  userDetail: string;
  side: "agency" | "provider";
  children: React.ReactNode;
}) {
  const agencyName = process.env.AGENCY_NAME || "Residential Care Services";

  return (
    <div className="min-h-screen">
      <header className={`no-print ${side === "agency" ? "bg-gov-800" : "bg-gov-700"} text-white`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <Link href={side === "agency" ? "/dashboard" : "/portal"} className="font-semibold">
              Evidence Exchange
            </Link>
            <span className="text-xs uppercase tracking-wider text-gov-200">
              {side === "agency" ? agencyName : "Provider portal"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right leading-tight">
              <p className="font-medium">{userName}</p>
              <p className="text-xs text-gov-200">{userDetail}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded border border-white/30 px-2.5 py-1 text-xs hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap px-3 py-2.5 text-sm text-gov-100 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 print-page">{children}</main>
    </div>
  );
}
