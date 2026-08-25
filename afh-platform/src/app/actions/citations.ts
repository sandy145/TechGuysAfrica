"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHome, requireUser } from "@/lib/auth";
import { authorHash, bedSizeBucket, scrubIdentifiers, voterHash } from "@/lib/anon";
import {
  CITATION_SEVERITIES,
  oneOf,
  SURVEY_TYPES,
  WA_COUNTIES,
  type CitationSeverity,
  type SurveyType,
} from "@/lib/constants";
import { recentQuarters } from "@/lib/dates";

/**
 * Single-operator installs can skip the moderation queue, but the default is to
 * hold posts for review: a narrative that identifies its author is the main way
 * this board could hurt the people it is meant to help.
 */
const AUTO_APPROVE = process.env.AUTO_APPROVE_CITATIONS === "true";

/** Rough throttle so one home can't flood the board. */
const MAX_POSTS_PER_DAY = 5;

export async function createCitationAction(formData: FormData): Promise<void> {
  const user = await requireHome();

  const summaryRaw = String(formData.get("summary") ?? "").trim();
  if (summaryRaw.length < 15) {
    redirect(`/citations/new?error=${encodeURIComponent("Give a one-line summary of at least 15 characters.")}`);
  }

  const hash = authorHash(user.homeId);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.citation.count({
    where: { authorHash: hash, createdAt: { gte: since } },
  });
  if (recent >= MAX_POSTS_PER_DAY) {
    redirect(`/citations/new?error=${encodeURIComponent("You've posted the daily maximum. Try again tomorrow.")}`);
  }

  const home = await prisma.home.findUnique({ where: { id: user.homeId } });

  // Scrub every free-text field before it is stored, not just before display.
  const summary = scrubIdentifiers(summaryRaw);
  const narrative = scrubIdentifiers(String(formData.get("narrative") ?? "").trim());
  const corrective = scrubIdentifiers(String(formData.get("correctiveAction") ?? "").trim());
  const removed = [...summary.removed, ...narrative.removed, ...corrective.removed];

  const wacCite = normaliseCite(String(formData.get("wacCite") ?? ""));
  const regulation = wacCite
    ? await prisma.regulation.findUnique({ where: { cite: wacCite } })
    : null;

  const quarters = recentQuarters(16);
  const citedQuarter = quarters.includes(String(formData.get("citedQuarter")))
    ? String(formData.get("citedQuarter"))
    : null;

  const countyInput = String(formData.get("county") ?? "");
  const county = (WA_COUNTIES as readonly string[]).includes(countyInput)
    ? countyInput
    : null;

  const fineRaw = Number(formData.get("fineAmount"));
  const fineAmount = Number.isFinite(fineRaw) && fineRaw > 0 ? Math.round(fineRaw) : null;

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  // linkHome is opt-in: it is the only thing that ties a post to a home row, and
  // it exists solely so the author can run the rule against themselves later.
  const linkHome = formData.get("linkHome") != null;

  const citation = await prisma.citation.create({
    data: {
      homeId: linkHome ? user.homeId : null,
      authorHash: hash,
      county,
      bedSizeBucket: home ? bedSizeBucket(home.bedCapacity) : null,
      surveyType: oneOf(SURVEY_TYPES, formData.get("surveyType"), "FULL_INSPECTION" as SurveyType),
      citedQuarter,
      regulationId: regulation?.id ?? null,
      wacCite: regulation?.cite ?? wacCite,
      severity: oneOf(
        CITATION_SEVERITIES,
        formData.get("severity"),
        "NO_HARM" as CitationSeverity,
      ),
      summary: summary.text,
      narrative: narrative.text || null,
      correctiveAction: corrective.text || null,
      fineAmount,
      tagsJson: JSON.stringify(tags),
      status: AUTO_APPROVE ? "APPROVED" : "PENDING",
    },
  });

  revalidatePath("/citations");

  const params = new URLSearchParams({ posted: "1" });
  if (removed.length > 0) params.set("redacted", String(removed.length));
  redirect(`/citations/${citation.id}?${params.toString()}`);
}

export async function voteCitationAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const citationId = String(formData.get("citationId") ?? "");

  const citation = await prisma.citation.findFirst({
    where: { id: citationId, status: "APPROVED" },
    select: { id: true },
  });
  if (!citation) redirect("/citations");

  const hash = voterHash(user.homeId);

  // The unique index on (citationId, voterHash) is what actually enforces one
  // vote per home; this just turns a duplicate into a no-op instead of a 500.
  const existing = await prisma.citationVote.findUnique({
    where: { citationId_voterHash: { citationId, voterHash: hash } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.citationVote.delete({ where: { id: existing.id } }),
      prisma.citation.update({
        where: { id: citationId },
        data: { helpfulCount: { decrement: 1 } },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.citationVote.create({ data: { citationId, voterHash: hash } }),
      prisma.citation.update({
        where: { id: citationId },
        data: { helpfulCount: { increment: 1 } },
      }),
    ]);
  }

  revalidatePath("/citations");
  revalidatePath(`/citations/${citationId}`);
}

export async function moderateCitationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/citations?error=Moderation%20is%20restricted%20to%20platform%20administrators.");
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["APPROVED", "REJECTED"].includes(decision)) {
    redirect("/admin/moderation?error=Unknown%20decision.");
  }

  await prisma.citation.update({
    where: { id },
    data: {
      status: decision,
      moderationNote: String(formData.get("moderationNote") ?? "").trim() || null,
    },
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/citations");
  redirect("/admin/moderation?moderated=1");
}

/** Authors can withdraw their own post; the hash is how we know it is theirs. */
export async function withdrawCitationAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const id = String(formData.get("id") ?? "");

  const citation = await prisma.citation.findFirst({
    where: { id, authorHash: authorHash(user.homeId) },
    select: { id: true },
  });
  if (!citation) redirect("/citations?error=That%20post%20isn%27t%20yours.");

  await prisma.citation.delete({ where: { id } });

  revalidatePath("/citations");
  redirect("/citations?withdrawn=1");
}

/** Accept "388-76-10129", "WAC 388-76-10129", or "wac388-76-10129". */
function normaliseCite(input: string): string | null {
  const match = input.trim().match(/(\d{3})-(\d{2,3})-(\d{3,6})/);
  if (!match) return null;
  return `WAC ${match[1]}-${match[2]}-${match[3]}`;
}
