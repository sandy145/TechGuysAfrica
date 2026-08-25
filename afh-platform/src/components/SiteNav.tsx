import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";

const PRIMARY_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/residents", label: "Residents" },
  { href: "/employees", label: "Employees" },
  { href: "/forms", label: "Forms" },
  { href: "/binder", label: "Binder" },
];

const COMMUNITY_LINKS = [
  { href: "/citations", label: "Citations" },
  { href: "/updates", label: "Rule updates" },
  { href: "/regulations", label: "Rule catalog" },
];

export function SiteNav({ user }: { user: SessionUser | null }) {
  const signedIn = Boolean(user?.homeId);

  return (
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <Link href={signedIn ? "/dashboard" : "/"} className="text-base font-bold text-brand-700">
          AFH Compliance
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {signedIn &&
            PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium text-slate-600 hover:text-brand-700"
              >
                {link.label}
              </Link>
            ))}

          <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />

          {COMMUNITY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-slate-600 hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href="/settings/home"
                className="hidden max-w-[16rem] truncate text-slate-500 hover:text-slate-800 sm:block"
                title={user.homeName ?? user.email}
              >
                {user.homeName ?? user.email}
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="btn-secondary btn-sm">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="font-medium text-slate-600 hover:text-slate-900">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
