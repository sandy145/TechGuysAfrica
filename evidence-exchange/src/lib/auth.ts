import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { isAgencyRole, type UserRole } from "./constants";

// Sessions are HMAC-signed cookies rather than a library, and passwords use
// scrypt from node:crypto, to keep the dependency and native-build surface at
// zero. A production deployment behind a state SSO would replace
// getCurrentUser() and leave every call site untouched.

const COOKIE_NAME = "ee_session";
const SESSION_HOURS = 12; // shorter than a consumer app: this is case material

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set. Copy .env.example to .env before starting.");
  }
  return value;
}

// --- password hashing -------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- signed tokens ----------------------------------------------------------

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signToken(data: Record<string, unknown>, ttlMs: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs })).toString(
    "base64url",
  );
  return `${body}.${sign(body)}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// --- session lifecycle ------------------------------------------------------

export async function createSession(userId: string): Promise<void> {
  const token = signToken({ userId }, SESSION_HOURS * 60 * 60 * 1000);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string | null;
  agencyId: string | null;
  officeId: string | null;
  providerHomeId: string | null;
  providerHomeName: string | null;
  licenseNumber: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken<{ userId: string }>(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { providerHome: { select: { name: true, licenseNumber: true } } },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    title: user.title,
    agencyId: user.agencyId,
    officeId: user.officeId,
    providerHomeId: user.providerHomeId,
    providerHomeName: user.providerHome?.name ?? null,
    licenseNumber: user.providerHome?.licenseNumber ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Agency staff only. Provider sessions are bounced to their own portal. */
export async function requireAgency(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAgencyRole(user.role)) redirect("/portal");
  return user;
}

/** A supervisor or agency administrator — the approval and oversight views. */
export async function requireSupervisor(): Promise<SessionUser> {
  const user = await requireAgency();
  if (user.role === "INSPECTOR") redirect("/dashboard");
  return user;
}

/**
 * A provider contact with a home. `providerHomeId` is non-null downstream, and
 * every provider-side query filters on it — it is the tenancy boundary.
 */
export async function requireProvider(): Promise<SessionUser & { providerHomeId: string }> {
  const user = await requireUser();
  if (user.role !== "PROVIDER" || !user.providerHomeId) redirect("/dashboard");
  return user as SessionUser & { providerHomeId: string };
}

/** Where a session lands after sign-in. */
export function homePathFor(role: string): string {
  return isAgencyRole(role) ? "/dashboard" : "/portal";
}
