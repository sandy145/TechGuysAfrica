import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { ErrorBanner } from "@/components/ui";

export default async function RegisterPage({
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
          <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            You&apos;ll set up your home&apos;s profile on the next screen.
          </p>

          <div className="mt-5">
            <ErrorBanner message={error} />
          </div>

          <form action={registerAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="name">
                Your name
              </label>
              <input id="name" name="name" required autoComplete="name" className="input" />
            </div>
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
                minLength={10}
                autoComplete="new-password"
                className="input"
              />
              <p className="mt-1 text-xs text-slate-500">At least 10 characters.</p>
            </div>
            <button type="submit" className="btn-primary w-full">
              Create account
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
