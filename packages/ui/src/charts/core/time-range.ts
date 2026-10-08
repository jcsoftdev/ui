/**
 * Calendar windows over a sorted series of dates: the range selector of the
 * stock chart ("1S", "1M", ..., "Todo") resolves to inclusive index windows.
 */

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

/** `date` moved back by `count` units, in local calendar time (months clamp to the last day). */
export function shiftDate(date: Date, unit: Exclude<TimeRangeUnit, "all">, count: number): Date {
  const next = new Date(date);
  if (unit === "day") next.setDate(next.getDate() - count);
  else if (unit === "week") next.setDate(next.getDate() - count * 7);
  else {
    const months = unit === "year" ? count * 12 : count;
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() - months);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  }
  return next;
}

/**
 * Inclusive index window `[from, last]` for a preset over ascending `dates`:
 * the first date on or after the last date minus the preset. Always spans at
 * least two points when the data has them.
 */
export function rangeWindow(
  dates: ReadonlyArray<Date | number>,
  preset: Pick<TimeRangePreset, "unit" | "count">,
): [number, number] {
  const last = dates.length - 1;
  if (last <= 0) return [0, Math.max(0, last)];
  if (preset.unit === "all") return [0, last];
  const cutoff = +shiftDate(new Date(dates[last] as Date | number), preset.unit, preset.count ?? 1);
  let from = last;
  while (from > 0 && +(dates[from - 1] as Date | number) >= cutoff) from -= 1;
  return [Math.min(from, last - 1), last];
}
