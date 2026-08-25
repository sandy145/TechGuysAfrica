import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Local-filesystem evidence storage. Everything written here is resident PHI
// plus pre-decisional survey material, so keys are opaque, reads are
// path-checked against the root, and every file is digested on the way in.
// Swapping in S3/GCS means reimplementing the four functions below.

const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

const MAX_BYTES = 25 * 1024 * 1024;

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
 * Persist an uploaded file under `inspectionId/` and return its metadata.
 * The key is random and never derived from user input, so a crafted filename
 * cannot escape the root or collide with another inspection's evidence. The
 * sha256 is what lets a provider later prove the agency holds the same bytes
 * they sent.
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

  const dir = path.join(ROOT, sanitizeSegment(inspectionId));
  await fs.mkdir(dir, { recursive: true });

  const name = `${crypto.randomBytes(16).toString("hex")}${EXTENSION_BY_MIME[mimeType] ?? ""}`;
  const storageKey = path.posix.join(sanitizeSegment(inspectionId), name);
  await fs.writeFile(path.join(ROOT, storageKey), bytes);

  return {
    storageKey,
    fileName: safeDisplayName(file.name),
    mimeType,
    sizeBytes: bytes.length,
    sha256,
  };
}

export async function readFile(storageKey: string): Promise<Buffer> {
  const full = path.resolve(ROOT, storageKey);
  if (!full.startsWith(ROOT + path.sep)) throw new StorageError("Invalid storage key.");
  return fs.readFile(full);
}

export async function deleteFile(storageKey: string): Promise<void> {
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
