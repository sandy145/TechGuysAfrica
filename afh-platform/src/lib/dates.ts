/** Date helpers shared by the vault, the rules engine, and the digests. */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole days from `from` until `to`. Negative when `to` is in the past. */
export function daysUntil(to: Date, from: Date = new Date()): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
  );
}

export function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  const targetMonth = copy.getMonth() + months;
  copy.setMonth(targetMonth);
  // Clamp e.g. Jan 31 + 1 month to Feb 28/29 rather than rolling into March.
  if (copy.getMonth() !== ((targetMonth % 12) + 12) % 12) copy.setDate(0);
  return copy;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** For <input type="date"> values. */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${m}-${day}`;
}

/** Parse a form value into a Date, treating blanks as null. */
export function parseDateInput(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "2026-Q1" for the quarter containing `d`. */
export function toQuarter(d: Date): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

/** Recent quarters, newest first — used for the citation date selector. */
export function recentQuarters(count = 12, from: Date = new Date()): string[] {
  const out: string[] = [];
  const cursor = new Date(from);
  for (let i = 0; i < count; i++) {
    out.push(toQuarter(cursor));
    cursor.setMonth(cursor.getMonth() - 3);
  }
  return out;
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}
