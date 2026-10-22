import { isIsoDate, parseDate, todayIso } from "../../calendar/internal/date-utils.js";

export type DueState = "overdue" | "soon" | "ok";

const NAIVE = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

/**
 * The calendar day ("YYYY-MM-DD") a due value falls on. A date or a naive date-time
 * ("2026-03-04T17:00") already names its day and is read as written, so it never shifts with the
 * viewer's zone. An instant with `Z` or an offset names a moment, so it lands on the viewer's
 * local day. Anything else is `null`.
 */
export function dueCalendarDate(value: string): string | null {
  const naive = NAIVE.exec(value);
  if (naive) {
    const day = naive[1] as string;
    return isIsoDate(day) ? day : null;
  }
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : todayIso(instant);
  }
  return null;
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS);
}

export interface DueStatus {
  state: DueState;
  /** Days until the due day; negative once overdue, 0 on the day itself. */
  days: number;
}

/**
 * `overdue` once the due day is before `today`, `soon` from today through `soonDays` days ahead,
 * `ok` beyond. `today` is a calendar day (default: the viewer's today). `null` for an unreadable value.
 */
export function dueStatus(
  value: string,
  {
    today = todayIso(),
    soonDays = 3,
  }: { today?: string | undefined; soonDays?: number | undefined } = {},
): DueStatus | null {
  const day = dueCalendarDate(value);
  const reference = dueCalendarDate(today);
  if (!day || !reference) return null;
  const days = daysBetween(reference, day);
  const state: DueState = days < 0 ? "overdue" : days <= soonDays ? "soon" : "ok";
  return { state, days };
}

/** "Mar 4" (with the year when it is not the reference year), formatted in UTC so the day never shifts. */
export function formatDueDay(day: string, reference: string, locale?: string): string {
  const sameYear = day.slice(0, 4) === reference.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(parseDate(day));
}
