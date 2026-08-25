import { redirect } from "next/navigation";
import { HomeProfileForm } from "@/components/HomeProfileForm";
import { requireUser } from "@/lib/auth";
import { ErrorBanner } from "@/components/ui";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  if (user.homeId) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Step 1 of 1</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Tell us about your home
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        The compliance engine only checks the rules that apply to you, so these answers decide
        what you&apos;ll be held to. You can change any of them later under Settings.
      </p>

      <div className="mt-8 card px-6 py-6">
        <ErrorBanner message={error} />
        <HomeProfileForm home={null} submitLabel="Create my home" />
      </div>
    </main>
  );
}
