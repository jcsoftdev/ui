// Time scale: calendar-aligned ticks and date labels, in es-PE and local time by default,
// or any locale and IANA time zone. Kept apart from chart/scale so numeric and band charts
// do not pay for the calendar.
import {
  type Calendar,
  calendarFor,
  type DateLocaleOptions,
  dateFormat,
} from "../internal/chart-calendar.ts";
import type { ContinuousScale } from "./scale.ts";

export type { DateLocaleOptions };

const DAY = 86_400_000;

export type TimeUnit = "day" | "week" | "month" | "year";

export interface TimeTick {
  value: number;
  unit: TimeUnit;
  label: string;
}

interface Interval {
  unit: TimeUnit;
  every: number;
  /** Approximate length, only used to pick the interval. */
  approx: number;
}

const INTERVALS: Interval[] = [
  { unit: "day", every: 1, approx: DAY },
  { unit: "day", every: 2, approx: 2 * DAY },
  { unit: "week", every: 1, approx: 7 * DAY },
  { unit: "week", every: 2, approx: 14 * DAY },
  { unit: "month", every: 1, approx: 30.44 * DAY },
  { unit: "month", every: 3, approx: 91.3 * DAY },
  { unit: "month", every: 6, approx: 182.6 * DAY },
  { unit: "year", every: 1, approx: 365.25 * DAY },
];

/** Short month without the period Intl appends ("oct", not "oct."). Spanish (es-PE) by default. */
export function shortMonth(date: Date, options: DateLocaleOptions = {}): string {
  return dateFormat({ month: "short" }, options).format(date).replace(".", "").toLowerCase();
}

/** Short weekday without the trailing period ("lun"). Spanish (es-PE) by default. */
export function shortWeekday(date: Date, options: DateLocaleOptions = {}): string {
  return dateFormat({ weekday: "short" }, options).format(date).replace(".", "").toLowerCase();
}

/** Day of the month of `date` in the zone of `options`. */
export function dayOfMonth(date: Date, options: DateLocaleOptions = {}): number {
  const cal = calendarFor(options.timeZone);
  return cal.date(cal.wall(+date));
}

/** "lun 6 oct 2026": the full label used by tooltips and the data table. */
export function formatDate(value: Date | number, options: DateLocaleOptions = {}): string {
  const date = new Date(value);
  const cal = calendarFor(options.timeZone);
  const wall = cal.wall(+date);
  return `${shortWeekday(date, options)} ${cal.date(wall)} ${shortMonth(date, options)} ${cal.year(wall)}`;
}

function firstTick(t0: number, interval: Interval, cal: Calendar): Date {
  const d = cal.wall(t0);
  cal.midnight(d);
  if (cal.instant(d) < t0) cal.setDate(d, cal.date(d) + 1);
  if (interval.unit === "week") {
    cal.setDate(d, cal.date(d) + ((8 - cal.day(d)) % 7));
  } else if (interval.unit !== "day") {
    if (cal.date(d) !== 1) {
      cal.setDate(d, 1);
      cal.setMonth(d, cal.month(d) + 1);
    }
    const every = interval.unit === "year" ? 12 : interval.every;
    while (cal.month(d) % every !== 0) cal.setMonth(d, cal.month(d) + 1);
  }
  return d;
}

function advance(d: Date, interval: Interval, cal: Calendar): void {
  if (interval.unit === "day") cal.setDate(d, cal.date(d) + interval.every);
  else if (interval.unit === "week") cal.setDate(d, cal.date(d) + 7 * interval.every);
  else if (interval.unit === "month") cal.setMonth(d, cal.month(d) + interval.every);
  else cal.setYear(d, cal.year(d) + interval.every);
}

function tickLabel(
  wall: Date,
  instant: Date,
  unit: TimeUnit,
  first: boolean,
  spanDays: number,
  cal: Calendar,
  options: DateLocaleOptions,
): string {
  if (unit === "year") return String(cal.year(wall));
  if (unit === "month") {
    return first || cal.month(wall) === 0
      ? `${shortMonth(instant, options)} ${cal.year(wall)}`
      : shortMonth(instant, options);
  }
  if (unit === "day" && spanDays <= 14) {
    return `${shortWeekday(instant, options)} ${cal.date(wall)}`;
  }
  return `${cal.date(wall)} ${shortMonth(instant, options)}`;
}

/**
 * Calendar-aligned ticks (midnight, Mondays, first of the month, January) in the local time
 * zone or `options.timeZone`, labelled in es-PE or `options.locale`. Picks the finest interval
 * that keeps at most `count` ticks.
 */
export function timeTicks(
  start: number,
  end: number,
  count = 6,
  options: DateLocaleOptions = {},
): TimeTick[] {
  const t0 = Math.min(start, end);
  const t1 = Math.max(start, end);
  const span = t1 - t0;
  const limit = Math.max(1, count);
  const interval = INTERVALS.find((candidate) => span / candidate.approx <= limit) ?? {
    unit: "year",
    every: Math.ceil(span / (365.25 * DAY) / limit),
    approx: 0,
  };
  const spanDays = span / DAY;
  const cal = calendarFor(options.timeZone);
  const out: TimeTick[] = [];
  const cursor = firstTick(t0, interval, cal);
  while (cal.instant(cursor) <= t1 && out.length < 500) {
    const value = cal.instant(cursor);
    out.push({
      value,
      unit: interval.unit,
      label: tickLabel(
        cursor,
        new Date(value),
        interval.unit,
        out.length === 0,
        spanDays,
        cal,
        options,
      ),
    });
    advance(cursor, interval, cal);
  }
  return out;
}

export interface TimeScaleOptions extends DateLocaleOptions {
  domain: readonly [Date | number, Date | number];
  range: readonly [number, number];
}

export interface TimeScale extends ContinuousScale {
  timeTicks(count?: number): TimeTick[];
}

export function timeScale({ domain, range, locale, timeZone }: TimeScaleOptions): TimeScale {
  const d0 = +domain[0];
  const d1 = +domain[1] === d0 ? d0 + DAY : +domain[1];
  const [r0, r1] = range;
  const labels = { locale, timeZone };
  return {
    type: "time",
    domain: [d0, d1],
    range,
    map: (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0),
    invert: (pixel) => d0 + ((pixel - r0) / (r1 - r0 || 1)) * (d1 - d0),
    ticks: (count = 6) => timeTicks(d0, d1, count, labels).map((tick) => tick.value),
    timeTicks: (count = 6) => timeTicks(d0, d1, count, labels),
  };
}
