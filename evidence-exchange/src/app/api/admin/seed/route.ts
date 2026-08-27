import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { seedDemoData } from "@/lib/seed";

/**
 * Load the demonstration scenario into a hosted database.
 *
 * A pilot host has no shell, so the seed has to be reachable over HTTP. That
 * makes it dangerous, so it is closed by default and narrow when open:
 *
 *   - absent SEED_TOKEN, the route does not exist (404, not 401 — an endpoint
 *     that announces itself is an invitation)
 *   - the token is compared in constant time
 *   - it wipes and rebuilds demonstration data, so it must never be enabled on
 *     a deployment holding real inspections
 *
 * Delete the SEED_TOKEN variable once the pilot data is loaded.
 */
export async function POST(request: Request) {
  const expected = process.env.SEED_TOKEN;
  if (!expected) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const provided = request.headers.get("x-seed-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const counts = await seedDemoData(prisma);
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
