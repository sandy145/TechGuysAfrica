import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

/**
 * Serve an uploaded document. Files live outside the public directory, so this
 * route is the only way to read them and it scopes every lookup to the caller's
 * own home — resident PHI must never be reachable by guessing an id.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.homeId) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, homeId: user.homeId },
  });

  if (!doc?.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(doc.storageKey);
  } catch {
    return NextResponse.json(
      { error: "The stored file is missing from disk." },
      { status: 410 },
    );
  }

  // Quote-escape the filename so a name containing a quote can't break out of
  // the Content-Disposition header.
  const filename = (doc.fileName ?? "document").replace(/["\\]/g, "_");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
