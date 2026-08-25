import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — Evidence Exchange" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-gov-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gov-200">
            {process.env.AGENCY_NAME || "Residential Care Services"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Evidence Exchange</h1>
          <p className="mt-2 text-sm text-gov-100">
            Inspection findings, provider documentation, and determinations in one record.
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-lg">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-gov-200">
          <Link href="/" className="underline hover:text-white">
            About this system
          </Link>
        </p>
      </div>
    </main>
  );
}
