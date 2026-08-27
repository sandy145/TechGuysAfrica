/**
 * Date and deadline math.
 *
 * Licensing deadlines are almost always stated in *working days* ("submit a
 * plan of correction within ten working days"), and a portal that quietly
 * counts calendar days will tell a provider their evidence is late when it is
 * not. So business-day arithmetic — weekends plus observed state holidays —
 * lives here and is the only way deadlines are computed anywhere in the app.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Whole days from `from` until `to`. Negative when `to` is in the past. */
export function daysUntil(to: Date, from: Date = new Date()): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

// --- holidays ---------------------------------------------------------------

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

/**
 * A fixed-date holiday falling on a weekend is observed on the adjacent
 * weekday, which is what actually moves a deadline.
 */
function observed(d: Date): Date {
  if (d.getDay() === 0) return addDays(d, 1);
  if (d.getDay() === 6) return addDays(d, -1);
  return d;
}

function key(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const holidayCache = new Map<number, Set<string>>();

/**
 * Legal holidays for the year. This is the Washington State list (RCW 1.16.050),
 * which matches the federal list plus the day after Thanksgiving. A deployment
 * in another state overrides this function and nothing else.
 */
export function stateHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // 4th Thursday, November
  const dates = [
    observed(new Date(year, 0, 1)), // New Year's Day
    nthWeekdayOfMonth(year, 0, 1, 3), // Martin Luther King Jr. Day
    nthWeekdayOfMonth(year, 1, 1, 3), // Presidents' Day
    lastWeekdayOfMonth(year, 4, 1), // Memorial Day
    observed(new Date(year, 5, 19)), // Juneteenth
    observed(new Date(year, 6, 4)), // Independence Day
    nthWeekdayOfMonth(year, 8, 1, 1), // Labor Day
    observed(new Date(year, 10, 11)), // Veterans Day
    thanksgiving,
    addDays(thanksgiving, 1), // Native American Heritage Day
    observed(new Date(year, 11, 25)), // Christmas Day
  ];

  const set = new Set(dates.map(key));
  holidayCache.set(year, set);
  return set;
}

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  return !stateHolidays(d.getFullYear()).has(key(d));
}

/**
 * The deadline `count` working days after `from`. The starting day is never
 * counted, matching how "within ten working days after receipt" is read.
 * The result is end-of-day, so a 4:59pm upload on the due date is on time.
 */
export function addBusinessDays(from: Date, count: number): Date {
  const cursor = startOfDay(from);
  let remaining = Math.max(0, count);
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) remaining--;
  }
  return endOfDay(cursor);
}

/** Working days from `from` until `to`. Negative once the deadline has passed. */
export function businessDaysUntil(to: Date, from: Date = new Date()): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (start.getTime() === end.getTime()) return 0;

  const forward = end > start;
  const cursor = new Date(forward ? start : end);
  const stop = forward ? end : start;
  let count = 0;
  while (cursor < stop) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) count++;
  }
  return forward ? count : -count;
}

// --- formatting -------------------------------------------------------------

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

/** "3 working days left" / "2 working days overdue" — the portal countdown. */
export function describeDeadline(
  due: Date | null | undefined,
  now: Date = new Date(),
): { label: string; tone: "ok" | "soon" | "due" | "late" | "none" } {
  if (!due) return { label: "No deadline set", tone: "none" };
  const days = businessDaysUntil(due, now);
  if (new Date(due) < now && days <= 0) {
    const late = Math.abs(days);
    return {
      label: late === 0 ? "Due today — window closing" : `${late} working day${late === 1 ? "" : "s"} overdue`,
      tone: "late",
    };
  }
  if (days === 0) return { label: "Due today", tone: "due" };
  if (days <= 2) return { label: `${days} working day${days === 1 ? "" : "s"} left`, tone: "soon" };
  return { label: `${days} working days left`, tone: "ok" };
}

export function relativeTime(d: Date | null | undefined, now: Date = new Date()): string {
  if (!d) return "—";
  const diff = now.getTime() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(new Date(d));
}
