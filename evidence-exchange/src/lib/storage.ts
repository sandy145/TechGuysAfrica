import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";

// Evidence storage. Everything written here is resident PHI plus
// pre-decisional survey material, so keys are opaque, reads are checked, and
// every file is digested on the way in.
//
// Two drivers, chosen by STORAGE_DRIVER:
//
//   "filesystem" (default) — local disk under STORAGE_DIR. What a self-hosted
//     deployment should use, pointed at a mounted volume.
//   "database" — bytes in a FileBlob row. For serverless hosts with no durable
//     filesystem, which is what the hosted pilot runs on.
//
// A third driver for S3 or the state's own object store means adding one
// branch to each of the three functions below and nothing else.

const DRIVER = process.env.STORAGE_DRIVER === "database" ? "database" : "filesystem";

const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

// Serverless request bodies are capped well below what a scanned document can
// reach, so the limit is configurable rather than assumed.
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024);

/** What a provider realistically sends: scans, phone photos, office files. */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822", // forwarded email, which is how evidence arrives today
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/webp": ".webp",
  "image/tiff": ".tif",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
  "message/rfc822": ".eml",
};

export class StorageError extends Error {}

/** Storage keys for database-held blobs are prefixed so reads self-route. */
const DB_PREFIX = "db:";

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type StoredFile = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

/**
 * Persist an uploaded file and return its metadata. Storage keys are random and
 * never derived from user input, so a crafted filename cannot escape the root
 * or collide with another inspection's evidence. The sha256 is what lets a
 * provider later prove the agency holds the same bytes they sent.
 */
export async function saveUpload(inspectionId: string, file: File): Promise<StoredFile> {
  if (file.size === 0) throw new StorageError(`"${file.name}" is empty.`);
  if (file.size > MAX_BYTES) {
    throw new StorageError(
      `"${file.name}" is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_BYTES)}.`,
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new StorageError(
      `"${file.name}" is a ${mimeType} file, which is not an accepted evidence format. Send a PDF, photo, or office document.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  const common = {
    fileName: safeDisplayName(file.name),
    mimeType,
    sizeBytes: bytes.length,
    sha256,
  };

  if (DRIVER === "database") {
    const blob = await prisma.fileBlob.create({
      data: { data: bytes, mimeType, sizeBytes: bytes.length },
    });
    return { ...common, storageKey: `${DB_PREFIX}${blob.id}` };
  }

  const dir = path.join(ROOT, sanitizeSegment(inspectionId));
  await fs.mkdir(dir, { recursive: true });

  const name = `${crypto.randomBytes(16).toString("hex")}${EXTENSION_BY_MIME[mimeType] ?? ""}`;
  const storageKey = path.posix.join(sanitizeSegment(inspectionId), name);
  await fs.writeFile(path.join(ROOT, storageKey), bytes);

  return { ...common, storageKey };
}

export async function readFile(storageKey: string): Promise<Buffer> {
  // Keys carry their own driver, so a store swapped mid-life still serves the
  // files written before the change.
  if (storageKey.startsWith(DB_PREFIX)) {
    const blob = await prisma.fileBlob.findUnique({
      where: { id: storageKey.slice(DB_PREFIX.length) },
    });
    if (!blob) throw new StorageError("Stored file not found.");
    return Buffer.from(blob.data);
  }

  const full = path.resolve(ROOT, storageKey);
  if (!full.startsWith(ROOT + path.sep)) throw new StorageError("Invalid storage key.");
  return fs.readFile(full);
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (storageKey.startsWith(DB_PREFIX)) {
    await prisma.fileBlob.deleteMany({ where: { id: storageKey.slice(DB_PREFIX.length) } });
    return;
  }

  const full = path.resolve(ROOT, storageKey);
  if (!full.startsWith(ROOT + path.sep)) throw new StorageError("Invalid storage key.");
  await fs.rm(full, { force: true });
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Keep the provider's filename for display, minus anything path-shaped. */
function safeDisplayName(name: string): string {
  return path.basename(name).slice(0, 180) || "upload";
}
