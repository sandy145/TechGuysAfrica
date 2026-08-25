import { SiteNav } from "@/components/SiteNav";
import { getCurrentUser } from "@/lib/auth";

/**
 * Shared chrome. Auth is enforced per page rather than here, because the
 * citation board and rule catalog are readable without an account — a provider
 * deciding whether to sign up should be able to see what is on the board.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteNav user={user} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
