import { prisma } from "@/lib/db";
import { Alert } from "@/components/ui";
import { ActivateForm } from "./ActivateForm";

export const metadata = { title: "Activate your account — Evidence Exchange" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    include: { providerHome: { select: { name: true, licenseNumber: true } }, invitedBy: true },
  });

  const valid = user && user.inviteExpiresAt && user.inviteExpiresAt > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gov-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gov-200">
            {process.env.AGENCY_NAME || "Residential Care Services"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Evidence Exchange</h1>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-lg">
          {!valid ? (
            <Alert tone="danger" title="This invitation is no longer valid">
              Ask your licensor to send a new invitation.
            </Alert>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-ink">Set your password</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {user!.invitedBy?.name ? `${user!.invitedBy.name} created` : "An account was created"} an
                account for <strong>{user!.name}</strong> at {user!.providerHome?.name} (licence{" "}
                {user!.providerHome?.licenseNumber}). Choose a password to activate it.
              </p>
              <div className="mt-5">
                <ActivateForm token={token} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
