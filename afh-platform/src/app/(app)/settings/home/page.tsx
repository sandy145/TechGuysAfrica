import Link from "next/link";
import { requireHome } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HomeProfileForm } from "@/components/HomeProfileForm";
import { Card, ErrorBanner, NoticeBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireHome();
  const params = await searchParams;

  const home = await prisma.home.findUnique({ where: { id: user.homeId } });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Home profile"
        description="These answers decide which rules the compliance engine holds you to. Keep them current."
        action={
          <Link href="/settings/document-types" className="btn-secondary">
            Document types
          </Link>
        }
      />

      <ErrorBanner message={params.error} />
      {params.saved && (
        <NoticeBanner message="Saved. Your compliance check has been re-run against the new profile." />
      )}

      <Card>
        <HomeProfileForm home={home} submitLabel="Save changes" />
      </Card>

      <Card className="mt-6" title="Account">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Signed in as</dt>
            <dd className="font-medium text-slate-900">{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium text-slate-900">{user.role}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          Citation moderation and the digest runner require the ADMIN role. Promote a user by
          setting <span className="font-mono">role = &quot;ADMIN&quot;</span> on their User row,
          or set <span className="font-mono">AUTO_APPROVE_CITATIONS=true</span> to skip moderation
          entirely on a single-operator install.
        </p>
      </Card>
    </div>
  );
}
