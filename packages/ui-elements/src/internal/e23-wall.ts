import { calendarFor } from "@jcsoftdev/ui-core/chart/calendar";

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Milliseconds the wall clock of `tz` (the local zone when omitted) is ahead of UTC at `time`. */
function wallOffset(time: number, tz?: string): number {
  if (!tz) return -new Date(time).getTimezoneOffset() * 60_000;
  return calendarFor(tz).wall(time).getTime() - time;
}

/** Hours and minutes on the wall clock of `tz` (the local zone when omitted). */
export function wallClock(time: number, tz?: string): { hours: number; minutes: number } {
  const t = (((time + wallOffset(time, tz)) % DAY) + DAY) % DAY;
  return { hours: Math.floor(t / HOUR), minutes: Math.floor((t % HOUR) / 60_000) };
}

/** True when `time` is midnight on the wall clock of `tz`. */
export const isMidnight = (time: number, tz?: string): boolean => {
  const { hours, minutes } = wallClock(time, tz);
  return hours === 0 && minutes === 0;
};

/**
 * A date from a `Date`, a timestamp or text. A date-only text (`2026-10-05`) is midnight of that
 * day in `tz` (local time by default), not UTC midnight; other text goes through `Date.parse`.
 */
export function toWallDate(value: Date | number | string, tz?: string): Date {
  if (typeof value !== "string") return value instanceof Date ? value : new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return new Date(value);
  const [year = 0, month = 1, date = 1] = match.slice(1).map(Number);
  if (!tz) return new Date(year, month - 1, date);
  return new Date(calendarFor(tz).instant(new Date(Date.UTC(year, month - 1, date))));
}
