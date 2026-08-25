/**
 * Bulk-load a verified WAC catalog, replacing the unverified seed entries.
 *
 *   npm run wac:import -- ./wac-388-76.json
 *
 * Expected shape — a JSON array of:
 *
 *   {
 *     "cite": "WAC 388-76-10355",        // required; "388-76-10355" also accepted
 *     "title": "Negotiated care plan",   // required, the official section heading
 *     "subchapter": "Negotiated care plan",
 *     "summary": "…",
 *     "url": "https://app.leg.wa.gov/wac/default.aspx?cite=388-76-10355",
 *     "effectiveAt": "2024-07-01"
 *   }
 *
 * Everything imported is marked verified, which removes the "unverified" badge
 * from the UI — so only import a file you have actually checked against the
 * official text published by the Washington State Legislature.
 */

import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ImportRow = {
  cite?: string;
  title?: string;
  subchapter?: string;
  summary?: string;
  url?: string;
  effectiveAt?: string;
};

function normaliseCite(input: string): string | null {
  const match = input.trim().match(/(\d{3})-(\d{2,3})-(\d{3,6})/);
  return match ? `WAC ${match[1]}-${match[2]}-${match[3]}` : null;
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npm run wac:import -- <path-to-json>");
    process.exit(1);
  }

  const raw = await readFile(path, "utf8");
  const rows: unknown = JSON.parse(raw);

  if (!Array.isArray(rows)) {
    console.error("Expected the file to contain a JSON array.");
    process.exit(1);
  }

  let imported = 0;
  const skipped: string[] = [];

  for (const entry of rows as ImportRow[]) {
    const cite = entry.cite ? normaliseCite(entry.cite) : null;
    const title = entry.title?.trim();

    if (!cite || !title) {
      skipped.push(JSON.stringify(entry).slice(0, 80));
      continue;
    }

    const effectiveAt = entry.effectiveAt ? new Date(entry.effectiveAt) : null;

    const data = {
      title,
      subchapter: entry.subchapter?.trim() || null,
      summary: entry.summary?.trim() || null,
      url:
        entry.url?.trim() ||
        `https://app.leg.wa.gov/wac/default.aspx?cite=${cite.replace(/^WAC\s+/, "")}`,
      effectiveAt: effectiveAt && !Number.isNaN(effectiveAt.getTime()) ? effectiveAt : null,
      verified: true,
      isActive: true,
    };

    await prisma.regulation.upsert({
      where: { cite },
      create: { cite, ...data },
      update: data,
    });
    imported++;
  }

  console.log(`Imported ${imported} regulation${imported === 1 ? "" : "s"} as verified.`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} row(s) missing a cite or title:`);
    for (const row of skipped.slice(0, 10)) console.log(`  ${row}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
