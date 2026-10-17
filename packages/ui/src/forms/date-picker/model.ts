import { isIsoDate, toIsoDate } from "../../calendar/internal/date-utils.js";

/** Typed-date and date-time rules for `DatePicker` / `DateTimePicker`. Strings in, strings out: no `Date` in local time. */

export type DatePart = "day" | "month" | "year";

export interface DateFormat {
  order: DatePart[];
  separator: string;
}

const FALLBACK: DateFormat = { order: ["day", "month", "year"], separator: "/" };

/** Field order and separator a locale writes numeric dates with: es-PE "dd/mm/yyyy", en-US "mm/dd/yyyy", sv-SE "yyyy-mm-dd". */
export function dateFormatFor(locale: string): DateFormat {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).formatToParts(new Date(Date.UTC(2006, 10, 22)));
    const order = parts
      .map((part) => part.type)
      .filter((type): type is DatePart => type === "day" || type === "month" || type === "year");
    const separator = parts.find((part) => part.type === "literal")?.value.trim();
    if (order.length !== 3) return FALLBACK;
    return { order, separator: separator || "/" };
  } catch {
    return FALLBACK;
  }
}

const SEGMENT: Record<DatePart, number> = { day: 2, month: 2, year: 4 };

/** "2026-09-07" as the locale writes it, or "" for anything that is not an ISO date. */
export function formatDisplay(iso: string, format: DateFormat): string {
  if (!isIsoDate(iso)) return "";
  const value: Record<DatePart, string> = {
    year: iso.slice(0, 4),
    month: iso.slice(5, 7),
    day: iso.slice(8, 10),
  };
  return format.order.map((part) => value[part]).join(format.separator);
}

/** Keeps digits and inserts the separator once a segment is full and more digits follow. */
export function maskDisplay(raw: string, format: DateFormat): string {
  let rest = raw.replace(/\D/g, "").slice(0, 8);
  const segments: string[] = [];
  for (const part of format.order) {
    if (!rest) break;
    segments.push(rest.slice(0, SEGMENT[part]));
    rest = rest.slice(SEGMENT[part]);
  }
  return segments.join(format.separator);
}

/** Typed text to "YYYY-MM-DD"; null while it is incomplete or not a real date. */
export function parseDisplay(text: string, format: DateFormat): string | null {
  const pieces = text.trim().split(format.separator);
  if (pieces.length !== 3) return null;
  const value: Partial<Record<DatePart, string>> = {};
  for (const [index, part] of format.order.entries()) {
    const piece = pieces[index] ?? "";
    const valid = part === "year" ? /^\d{4}$/.test(piece) : /^\d{1,2}$/.test(piece);
    if (!valid) return null;
    value[part] = piece;
  }
  const iso = toIsoDate(Number(value.year), Number(value.month), Number(value.day));
  return isIsoDate(iso) ? iso : null;
}

/** "dd/mm/aaaa" built from the locale's order and the localized segment words. */
export function displayPlaceholder(
  format: DateFormat,
  words: { day: string; month: string; year: string },
): string {
  return format.order.map((part) => words[part]).join(format.separator);
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/**
 * Splits "YYYY-MM-DDTHH:mm". The value is a wall-clock time with no zone: anything carrying a
 * "Z", an offset or seconds is rejected instead of being silently reinterpreted.
 */
export function splitDateTime(value: string): { date: string; time: string } | null {
  const match = DATE_TIME.exec(value);
  if (!match) return null;
  const [, date = "", time = ""] = match;
  return isIsoDate(date) && isValidTime(time) ? { date, time } : null;
}

export function joinDateTime(parts: { date: string; time: string }): string {
  return parts.date && parts.time ? `${parts.date}T${parts.time}` : "";
}

/** `min`/`max` may be a date ("2026-09-07", whole day) or a date-time. Lexicographic compare is chronological. */
export function dateTimeInRange(value: string, min?: string, max?: string): boolean {
  if (min && value < (min.length === 10 ? `${min}T00:00` : min)) return false;
  if (max && value > (max.length === 10 ? `${max}T23:59` : max)) return false;
  return true;
}
