import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import type { UserRole } from "./constants";

// Sessions are HMAC-signed cookies rather than a library, to keep the
// dependency surface (and the native-build surface) at zero. Passwords use
// scrypt from node:crypto for the same reason.

const COOKIE_NAME = "afh_session";
const SESSION_DAYS = 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set. Copy .env.example to .env before starting.",
    );
  }
  return value;
}

// --- password hashing -------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- generic signed tokens (sessions and remote-signing links) --------------

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Sign an arbitrary JSON payload with an expiry. */
export function signToken(data: Record<string, unknown>, ttlMs: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...data, exp: Date.now() + ttlMs }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify and decode a token produced by signToken. Null when invalid/expired. */
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
  const token = signToken({ userId }, SESSION_DAYS * 24 * 60 * 60 * 1000);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
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
  homeId: string | null;
  homeName: string | null;
};

/** The signed-in user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken<{ userId: string }>(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { home: { select: { name: true } } },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    homeId: user.homeId,
    homeName: user.home?.name ?? null,
  };
}

/** Require a signed-in user; redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a signed-in user who has finished home setup. Every tenant-scoped
 * page uses this, so `homeId` is a non-null string downstream.
 */
export async function requireHome(): Promise<SessionUser & { homeId: string }> {
  const user = await requireUser();
  if (!user.homeId) redirect("/onboarding");
  return user as SessionUser & { homeId: string };
}
