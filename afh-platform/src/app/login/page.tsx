import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { ErrorBanner } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.homeId ? "/dashboard" : "/onboarding");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-brand-700">
          AFH Compliance
        </Link>

        <div className="card px-6 py-7">
          <h1 className="text-xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Access your home&apos;s records and compliance status.
          </p>

          <div className="mt-5">
            <ErrorBanner message={error} />
          </div>

          <form action={loginAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Sign in
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            No account yet?{" "}
            <Link href="/register" className="font-medium text-brand-700 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
