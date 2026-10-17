import { isIsoDate, parseDate } from "../../calendar/internal/date-utils.js";

export interface FeedTimeOptions {
  locale?: string | undefined;
  /** IANA zone used to show an instant (default: the viewer's). Calendar dates never use a zone. */
  timeZone?: string | undefined;
  /** Show "5 minutes ago" for instants within a week of `now` instead of the absolute time. */
  relative?: boolean | undefined;
  /** Reference instant for `relative` (default: the current time). */
  now?: Date | string | number | undefined;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a calendar date ("YYYY-MM-DD") rather than an instant. */
export function isCalendarDate(value: string): boolean {
  return DATE_ONLY.test(value) && isIsoDate(value);
}

/** The value for a `<time datetime>` attribute: strings pass through, dates become ISO instants. */
export function toDateTimeAttribute(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

/**
 * Display text for a feed timestamp. A calendar date ("2026-03-04") is formatted in UTC so it
 * never shifts a day; an instant is shown as date and time in `timeZone`; with `relative`, an
 * instant within a week of `now` reads "5 minutes ago". Invalid input comes back unchanged.
 */
export function formatFeedTime(value: string | Date, options: FeedTimeOptions = {}): string {
  const { locale, timeZone, relative = false, now } = options;
  if (typeof value === "string" && isCalendarDate(value)) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
      parseDate(value),
    );
  }
  const instant = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(instant.getTime())) return String(value);
  if (relative) {
    const reference = now === undefined ? new Date() : new Date(now);
    const seconds = Math.round((instant.getTime() - reference.getTime()) / 1000);
    const abs = Math.abs(seconds);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (abs < 60) return rtf.format(seconds === 0 ? 0 : Math.sign(seconds) * abs, "second");
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
    if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), "day");
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(instant);
}
