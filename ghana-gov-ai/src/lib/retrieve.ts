import { SERVICES, type Service } from "./services";

// Lightweight keyword retrieval over the knowledge base. Good enough for a
// test build with a few dozen entries; swap for embeddings once the corpus is
// the full catalogue of agency pages.

const STOPWORDS = new Set(
  "a an and are as at be can do does for from get go how i in is it me my of on or the to what when where which who why will with you your need want".split(" "),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9*#' ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

function score(service: Service, query: string, queryTokens: string[]): number {
  const q = query.toLowerCase();
  let s = 0;
  for (const kw of service.keywords) {
    if (q.includes(kw)) s += kw.includes(" ") ? 6 : 4;
  }
  const title = tokens(service.title);
  const body = tokens(`${service.summary} ${service.agency} ${service.steps.join(" ")}`);
  for (const t of queryTokens) {
    if (title.includes(t)) s += 2;
    if (body.includes(t)) s += 1;
  }
  return s;
}

export function retrieve(query: string, limit = 4): Service[] {
  const queryTokens = tokens(query);
  const ranked = SERVICES.map((svc) => ({ svc, s: score(svc, query, queryTokens) }))
    .filter((r) => r.s >= 3)
    .sort((a, b) => b.s - a.s);
  // Drop weak matches that only share a generic word ("renew", "register") with the top hit.
  const floor = ranked.length ? ranked[0].s / 2 : 0;
  return ranked
    .filter((r) => r.s >= floor)
    .slice(0, limit)
    .map((r) => r.svc);
}

export function renderSource(svc: Service, n: number): string {
  const lines = [
    `[${n}] ${svc.title}`,
    `Agency: ${svc.agency} (${svc.agencyUrl})`,
    `Summary: ${svc.summary}`,
    `Steps:\n${svc.steps.map((st, i) => `  ${i + 1}. ${st}`).join("\n")}`,
  ];
  if (svc.documents?.length) lines.push(`Documents:\n${svc.documents.map((d) => `  - ${d}`).join("\n")}`);
  if (svc.notes?.length) lines.push(`Notes:\n${svc.notes.map((d) => `  - ${d}`).join("\n")}`);
  return lines.join("\n");
}
