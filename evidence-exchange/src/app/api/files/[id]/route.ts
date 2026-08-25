import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAgencyRole } from "@/lib/constants";
import { readFile } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";

/**
 * Serve an evidence file — and record that it was opened.
 *
 * This route is the sensor the determination gate reads. Until an agency user
 * retrieves the bytes, `firstOpenedAt` stays null and the finding cannot be
 * cited. That is deliberate: the failure this system exists to prevent is a
 * document that was sent, was never looked at, and was cited around.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const file = await prisma.submissionFile.findUnique({
    where: { id },
    include: {
      submission: { include: { finding: { include: { inspection: true } } } },
    },
  });
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const inspection = file.submission.finding.inspection;
  const isAgency = isAgencyRole(user.role);
  const ownsIt = user.providerHomeId && user.providerHomeId === inspection.homeId;
  if (!isAgency && !ownsIt) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let bytes: Buffer | null = null;
  try {
    bytes = await readFile(file.storageKey);
  } catch {
    bytes = null; // seeded demo metadata, or a file lost from storage
  }

  // Only an agency user opening it counts as review; a provider re-reading
  // their own upload must never satisfy the gate.
  if (isAgency) {
    await prisma.submissionFile.update({
      where: { id },
      data: {
        openCount: { increment: 1 },
        ...(file.firstOpenedAt ? {} : { firstOpenedAt: new Date(), firstOpenedById: user.id }),
      },
    });
    if (!file.firstOpenedAt) {
      await recordAudit({
        actor: user,
        action: "FILE_OPENED",
        entityType: "SubmissionFile",
        entityId: id,
        inspectionId: inspection.id,
        summary: `${user.name} opened "${file.fileName}" on ${file.submission.finding.tag}.`,
        meta: { sha256: file.sha256, placeholder: bytes === null },
      });
    }
  }

  if (!bytes) {
    // Seed rows carry metadata but no bytes. Say so plainly rather than
    // serving a broken download.
    return new NextResponse(
      `"${file.fileName}" is demonstration metadata from the seed data — no file content was stored.\n\n` +
        `Digest on record: ${file.sha256}\n` +
        `Upload a real document through the provider portal to see the full path end to end.`,
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": file.mimeType,
      "content-disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
      "content-length": String(bytes.length),
      "cache-control": "private, no-store",
    },
  });
}
