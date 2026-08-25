"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  homePathFor,
  verifyPassword,
} from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export type FormState = { error?: string; ok?: string } | null;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await prisma.user.findUnique({ where: { email } });
  // One message for every failure mode, so the form cannot be used to discover
  // which addresses have accounts.
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return { error: "That email and password combination was not recognised." };
  }

  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  redirect(homePathFor(user.role));
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * Activate an invited account. This is the step the inspector describes at the
 * exit conference: "I have created an account for you — set a password and
 * your findings are there."
 */
export async function activateInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 10) return { error: "Choose a password of at least 10 characters." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    include: { providerHome: true },
  });
  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    return { error: "This invitation link is no longer valid. Ask your licensor to send a new one." };
  }

  const activated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      inviteToken: null,
      inviteExpiresAt: null,
      isActive: true,
      lastLoginAt: new Date(),
    },
  });

  await recordAudit({
    actor: {
      id: activated.id,
      email: activated.email,
      name: activated.name,
      role: "PROVIDER",
      title: activated.title,
      agencyId: null,
      officeId: null,
      providerHomeId: activated.providerHomeId,
      providerHomeName: user.providerHome?.name ?? null,
      licenseNumber: user.providerHome?.licenseNumber ?? null,
    },
    action: "PROVIDER_ACTIVATED",
    entityType: "User",
    entityId: activated.id,
    summary: `${activated.name} activated their provider account.`,
  });

  await createSession(activated.id);
  redirect(homePathFor(activated.role));
}
