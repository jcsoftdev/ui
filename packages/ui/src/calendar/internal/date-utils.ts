/** Calendar-date helpers. Dates are "YYYY-MM-DD" strings handled in UTC so they never shift by time zone. */

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  return formatDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount)),
  );
}

/** First day of the week containing `value`; `weekStartsOn` is 0 (Sunday) to 6 (Saturday). */
export function startOfWeek(value: string, weekStartsOn: WeekStart = 1): string {
  const offset = (parseDate(value).getUTCDay() - weekStartsOn + 7) % 7;
  return addDays(value, -offset);
}

/** Full weeks (7 columns) covering the month that contains `value`. */
export function monthGrid(value: string, weekStartsOn: WeekStart = 1): string[] {
  const target = parseDate(value);
  const month = target.getUTCMonth();
  const first = formatDate(new Date(Date.UTC(target.getUTCFullYear(), month, 1)));
  const last = formatDate(new Date(Date.UTC(target.getUTCFullYear(), month + 1, 0)));
  const start = startOfWeek(first, weekStartsOn);
  const end = addDays(startOfWeek(last, weekStartsOn), 6);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function format(
  value: string,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(parseDate(value));
}

/** Localized short weekday name, e.g. "Mon". */
export function formatWeekday(value: string, locale?: string): string {
  return format(value, locale, { weekday: "short" });
}

/** Localized short weekday followed by the day number, e.g. "Mon 12". */
export function formatWeekdayAndDay(value: string, locale?: string): string {
  return `${formatWeekday(value, locale)} ${parseDate(value).getUTCDate()}`;
}

/** Localized short month name, e.g. "Jan". */
export function formatMonthShort(value: string, locale?: string): string {
  return format(value, locale, { month: "short" });
}

/** Localized hour label for an hour of the day (0-23). */
export function formatHour(hour: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, hour)));
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written "YYYY-MM-DD" (rejects "2026-02-30"). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Builds "YYYY-MM-DD" from numeric parts; no time zone is involved. */
export function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Same day of the month `amount` months away, or the last day when the month is shorter. */
export function addMonths(value: string, amount: number): string {
  const date = parseDate(value);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return toIsoDate(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    Math.min(date.getUTCDate(), last),
  );
}

/** The viewer's calendar date today, read from local fields (never from the UTC date). */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** `value` pulled inside `[min, max]`. ISO dates compare correctly as strings. */
export function clampDate(value: string, min?: string, max?: string): string {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

/** Regions whose calendars conventionally start the week on Sunday. */
const SUNDAY_REGIONS = new Set([
  "US",
  "CA",
  "MX",
  "BR",
  "JP",
  "KR",
  "IL",
  "IN",
  "PH",
  "TW",
  "HK",
  "ZA",
  "CO",
  "VE",
  "SA",
]);

/**
 * First day of the week for a BCP 47 locale: Sunday (0) where that is the convention of the
 * region (en-US, es-MX, pt-BR, ...), Monday (1) everywhere else, including es-PE and en-GB.
 */
export function weekStartFor(locale: string): WeekStart {
  const region = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(locale)?.[1]?.toUpperCase();
  if (region) return SUNDAY_REGIONS.has(region) ? 0 : 1;
  return locale.toLowerCase().startsWith("en") || locale.toLowerCase().startsWith("ja") ? 0 : 1;
}

/** "September 2026" with only the first letter capitalised ("Setiembre de 2026"). */
export function formatMonthTitle(value: string, locale?: string): string {
  const raw = format(value, locale, { month: "long", year: "numeric" });
  return raw.charAt(0).toLocaleUpperCase(locale) + raw.slice(1);
}

/** Full date for a screen reader, e.g. "Monday, September 7, 2026". */
export function formatFullDate(value: string, locale?: string): string {
  return format(value, locale, { dateStyle: "full" });
}

/** Weekday names in column order starting at `weekStartsOn`. */
export function weekdayNames(
  locale: string | undefined,
  weekStartsOn: WeekStart,
): { narrow: string; long: string }[] {
  // 2024-01-07 was a Sunday.
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays("2024-01-07", weekStartsOn + index);
    return {
      narrow: format(day, locale, { weekday: "narrow" }),
      long: format(day, locale, { weekday: "long" }),
    };
  });
}

/** Six full weeks of "YYYY-MM-DD" covering the month of `value`, so the grid keeps its height. */
export function monthWeeks(value: string, weekStartsOn: WeekStart): string[][] {
  const date = parseDate(value);
  let cursor = startOfWeek(
    formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))),
    weekStartsOn,
  );
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 7 }, () => {
      const day = cursor;
      cursor = addDays(cursor, 1);
      return day;
    }),
  );
}
