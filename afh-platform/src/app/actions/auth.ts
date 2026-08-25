"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { oneOf, SPECIALTIES, type Specialty } from "@/lib/constants";
import { parseDateInput } from "@/lib/dates";

// Errors surface as a query string rather than thrown exceptions so the pages
// stay plain server components. redirect() throws internally, so it is always
// called outside try/catch.

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function registerAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !name || !password) fail("/register", "All fields are required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail("/register", "That doesn't look like an email address.");
  }
  if (password.length < 10) {
    fail("/register", "Use a password of at least 10 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) fail("/register", "An account with that email already exists.");

  const user = await prisma.user.create({
    data: { email, name, passwordHash: hashPassword(password), role: "OWNER" },
  });

  await createSession(user.id);
  redirect("/onboarding");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });

  // Same message either way, so the form can't be used to enumerate accounts.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    fail("/login", "Email or password is incorrect.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);

  redirect(user.homeId ? "/dashboard" : "/onboarding");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Creates the home on first run, updates it thereafter. */
export async function saveHomeAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    fail(user.homeId ? "/settings/home" : "/onboarding", "The home needs a name.");
  }

  const bedCapacityRaw = Number(formData.get("bedCapacity"));
  const bedCapacity =
    Number.isFinite(bedCapacityRaw) && bedCapacityRaw > 0
      ? Math.min(Math.round(bedCapacityRaw), 8)
      : 6;

  const specialties = formData
    .getAll("specialties")
    .map((s) => oneOf(SPECIALTIES, String(s), "DEMENTIA" as Specialty))
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const data = {
    name,
    licenseNumber: str(formData.get("licenseNumber")),
    addressLine1: str(formData.get("addressLine1")),
    city: str(formData.get("city")),
    county: str(formData.get("county")),
    zip: str(formData.get("zip")),
    phone: str(formData.get("phone")),
    bedCapacity,
    specialties: JSON.stringify(specialties),
    providerIsResident: formData.get("providerIsResident") != null,
    hasResidentManager: formData.get("hasResidentManager") != null,
    employsStaff: formData.get("employsStaff") != null,
    servesMedicaid: formData.get("servesMedicaid") != null,
    usesNurseDelegation: formData.get("usesNurseDelegation") != null,
    multipleFacilities: formData.get("multipleFacilities") != null,
    licensedAt: parseDateInput(formData.get("licensedAt")),
  };

  if (user.homeId) {
    await prisma.home.update({ where: { id: user.homeId }, data });
    redirect("/settings/home?saved=1");
  }

  const home = await prisma.home.create({ data });
  await prisma.user.update({
    where: { id: user.id },
    data: { homeId: home.id },
  });

  redirect("/dashboard");
}

function str(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}
