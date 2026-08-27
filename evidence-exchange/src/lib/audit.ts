import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";
import type { AuditAction } from "./constants";
import type { SessionUser } from "./auth";

/**
 * The audit log is append-only and is written on the same path as the change
 * it describes. A licensing decision that ends up in informal dispute
 * resolution or an administrative hearing is only defensible if there is an
 * intact record of who saw what, and when — including the negative case, where
 * the log shows a document sat unopened.
 */

export async function recordAudit(input: {
  actor: SessionUser | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  inspectionId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  } catch {
    // Called outside a request (seeding, scripts) — the log entry is still valid.
  }

  await prisma.auditEvent.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorRole: input.actor?.role ?? null,
      actorName: input.actor?.name ?? "System",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      inspectionId: input.inspectionId ?? null,
      summary: input.summary,
      metaJson: JSON.stringify(input.meta ?? {}),
      ip,
    },
  });
}
