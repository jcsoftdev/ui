/**
 * Calendar windows over a sorted series of dates: the range selector of the
 * stock chart ("1S", "1M", ..., "Todo") resolves to inclusive index windows.
 */

import { calendarFor } from "../internal/chart-calendar.ts";

export type TimeRangeUnit = "day" | "week" | "month" | "year" | "all";

export interface TimeRangePreset {
  id: string;
  /** Button text, e.g. "1M". */
  label: string;
  /** Accessible name, e.g. "Último mes". */
  description?: string;
  unit: TimeRangeUnit;
  /** How many units back from the last date (ignored for "all"). */
  count?: number;
}

/**
 * `date` moved back by `count` units, in local calendar time or in `timeZone`
 * (months clamp to the last day).
 */
export function shiftDate(
  date: Date,
  unit: Exclude<TimeRangeUnit, "all">,
  count: number,
  timeZone?: string,
): Date {
  const cal = calendarFor(timeZone);
  const next = cal.wall(+date);
  if (unit === "day") cal.setDate(next, cal.date(next) - count);
  else if (unit === "week") cal.setDate(next, cal.date(next) - count * 7);
  else {
    const months = unit === "year" ? count * 12 : count;
    const day = cal.date(next);
    cal.setDate(next, 1);
    cal.setMonth(next, cal.month(next) - months);
    const end = new Date(+next);
    cal.setMonth(end, cal.month(end) + 1);
    cal.setDate(end, 0);
    cal.setDate(next, Math.min(day, cal.date(end)));
  }
  return new Date(cal.instant(next));
}

/**
 * Inclusive index window `[from, last]` for a preset over ascending `dates`:
 * the first date on or after the last date minus the preset. Always spans at
 * least two points when the data has them.
 */
export function rangeWindow(
  dates: ReadonlyArray<Date | number>,
  preset: Pick<TimeRangePreset, "unit" | "count">,
  timeZone?: string,
): [number, number] {
  const last = dates.length - 1;
  if (last <= 0) return [0, Math.max(0, last)];
  if (preset.unit === "all") return [0, last];
  const cutoff = +shiftDate(
    new Date(dates[last] as Date | number),
    preset.unit,
    preset.count ?? 1,
    timeZone,
  );
  let from = last;
  while (from > 0 && +(dates[from - 1] as Date | number) >= cutoff) from -= 1;
  return [Math.min(from, last - 1), last];
}
