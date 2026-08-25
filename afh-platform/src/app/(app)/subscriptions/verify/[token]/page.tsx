import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

/** Confirmation target for the double opt-in email. */
export default async function VerifySubscriptionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const subscription = await prisma.subscription.findUnique({
    where: { verifyToken: token },
  });

  if (!subscription) {
    redirect("/subscriptions?error=That%20confirmation%20link%20is%20no%20longer%20valid.");
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    // Clear the token so the link can't be replayed.
    data: { verified: true, verifyToken: null },
  });

  redirect("/subscriptions?verified=1");
}
