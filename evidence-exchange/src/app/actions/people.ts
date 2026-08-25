"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAgency, randomToken } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { appUrl, button, emailLayout, sendMail } from "@/lib/mailer";
import { addDays } from "@/lib/dates";
import type { ActionState } from "./inspections";

const INVITE_DAYS = 21;

/**
 * "I will create an account for you." The inspector does this at the exit
 * conference, and the provider's findings are waiting behind the link.
 */
export async function inviteProviderContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const homeId = String(formData.get("homeId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;

  if (!email || !name) return { error: "Enter the contact's name and email." };

  const home = await prisma.licensedHome.findUnique({ where: { id: homeId } });
  if (!home) return { error: "Home not found." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.providerHomeId && existing.providerHomeId !== homeId) {
    return { error: "That email already belongs to a contact at another home." };
  }

  const token = randomToken(18);
  const expires = addDays(new Date(), INVITE_DAYS);

  const contact = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          providerHomeId: homeId,
          inviteToken: existing.passwordHash ? null : token,
          inviteExpiresAt: existing.passwordHash ? null : expires,
          isActive: true,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name,
          title,
          role: "PROVIDER",
          providerHomeId: homeId,
          invitedById: user.id,
          inviteToken: token,
          inviteExpiresAt: expires,
        },
      });

  if (contact.inviteToken) {
    await sendMail({
      to: email,
      kind: "INVITATION",
      subject: `Set up your ${process.env.AGENCY_NAME || "licensing"} Evidence Exchange account`,
      html: emailLayout(
        "An account has been created for you",
        `<p>${user.name} has created an Evidence Exchange account for <strong>${home.name}</strong> (licence ${home.licenseNumber}).</p>
         <p>This is where you will see the findings from your inspection and upload the records that answer them. Documents you send here are attached to the specific finding they respond to, and you can see when your licensor opens them.</p>
         ${button("Set your password", appUrl(`/invite/${contact.inviteToken}`))}
         <p style="color:#475467;font-size:13px;">This link expires in ${INVITE_DAYS} days.</p>`,
      ),
    });
  }

  await recordAudit({
    actor: user,
    action: "PROVIDER_INVITED",
    entityType: "User",
    entityId: contact.id,
    summary: `${name} invited as a provider contact for ${home.name}.`,
  });

  revalidatePath(`/homes/${homeId}`);
  return {
    ok: contact.inviteToken
      ? `Invitation sent to ${email}.`
      : `${name} already has an active account and now has access to this home.`,
  };
}

export async function createLicensedHome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAgency();
  const licenseNumber = String(formData.get("licenseNumber") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const providerName = String(formData.get("providerName") ?? "").trim();

  if (!licenseNumber || !name || !providerName) {
    return { error: "Licence number, home name, and licensee are all required." };
  }

  const clash = await prisma.licensedHome.findUnique({ where: { licenseNumber } });
  if (clash) return { error: `Licence ${licenseNumber} is already on file.` };

  const agency = await prisma.agency.findFirst();
  if (!agency) return { error: "No agency configured." };

  const home = await prisma.licensedHome.create({
    data: {
      agencyId: agency.id,
      officeId: user.officeId,
      licenseNumber,
      name,
      providerName,
      addressLine1: String(formData.get("addressLine1") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      county: String(formData.get("county") ?? "").trim() || null,
      zip: String(formData.get("zip") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      bedCapacity: Number(formData.get("bedCapacity") ?? 6) || 6,
    },
  });

  revalidatePath("/homes");
  return { ok: `${home.name} added.` };
}
