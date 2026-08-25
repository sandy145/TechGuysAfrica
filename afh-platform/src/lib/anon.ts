import "server-only";
import crypto from "node:crypto";

/**
 * Anonymity for the citation board.
 *
 * A provider posting a citation is admitting a regulatory finding against their
 * own license, so the board is only useful if the link back to them is genuinely
 * severable. The approach:
 *
 *   - The author is recorded as a salted SHA-256 digest, never a foreign key.
 *     It supports rate limiting and "edit my own post", nothing else.
 *   - ANON_SALT lives outside the database. A database leak alone therefore
 *     doesn't deanonymise anyone, and rotating the salt permanently detaches
 *     every existing post from its author.
 *   - Location is stored at county level and dates at quarter level, because a
 *     town plus an exact survey date identifies a home outright.
 *   - Narrative text is scrubbed for the obvious direct identifiers before it
 *     reaches the moderation queue.
 *
 * This is deliberately not a claim of unlinkability against a determined
 * adversary: a sufficiently distinctive narrative always risks identifying its
 * author, which is why posts are moderated before publication.
 */

function salt(): string {
  const value = process.env.ANON_SALT;
  if (!value) {
    throw new Error(
      "ANON_SALT is not set. Copy .env.example to .env before starting.",
    );
  }
  return value;
}

/** One-way author fingerprint. Same input always yields the same digest. */
export function authorHash(homeId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${salt()}:author:${homeId}`)
    .digest("hex");
}

/** Separate namespace so a vote digest can't be compared against an author digest. */
export function voterHash(homeId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${salt()}:voter:${homeId}`)
    .digest("hex");
}

const SCRUB_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // Phone numbers.
  { re: /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g, replacement: "[phone removed]" },
  // Email addresses.
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: "[email removed]" },
  // Street addresses.
  {
    re: /\b\d{1,6}\s+[NSEW]{0,2}\.?\s*[A-Za-z0-9'.\- ]{2,40}\s(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|place|pl|boulevard|blvd|terrace|ter|circle|cir|parkway|pkwy)\b\.?/gi,
    replacement: "[address removed]",
  },
  // WA license numbers as commonly written.
  { re: /\b(?:license|lic\.?|licence)\s*#?\s*\d{4,10}\b/gi, replacement: "[license number removed]" },
  // Long digit runs (SSN, UBI, resident IDs).
  { re: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN removed]" },
  { re: /\b\d{7,}\b/g, replacement: "[number removed]" },
];

export type ScrubResult = { text: string; removed: string[] };

/**
 * Strip direct identifiers from provider-written narrative text. Returns what
 * was removed so the poster can be shown the redactions before publishing —
 * silent edits to someone's own account of an inspection would be worse than
 * no scrubbing at all.
 */
export function scrubIdentifiers(input: string): ScrubResult {
  let text = input;
  const removed: string[] = [];

  for (const { re, replacement } of SCRUB_PATTERNS) {
    text = text.replace(re, (match) => {
      removed.push(match.trim());
      return replacement;
    });
  }

  return { text, removed };
}

/** Bucket a bed capacity into the coarse size band shown on the board. */
export function bedSizeBucket(bedCapacity: number): "1-4" | "5-6" | "7-8" {
  if (bedCapacity <= 4) return "1-4";
  if (bedCapacity <= 6) return "5-6";
  return "7-8";
}
