import type { ContinuousScale } from "./linear.js";

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

const LOCALE = "es-PE";
const monthFormat = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });

/** Short Spanish month without the period Intl appends ("oct", not "oct."). */
export function shortMonth(date: Date): string {
  return monthFormat.format(date).replace(".", "").toLowerCase();
}

/** Short Spanish weekday without the trailing period ("lun"). */
export function shortWeekday(date: Date): string {
  return weekdayFormat.format(date).replace(".", "").toLowerCase();
}

/** "lun 6 oct 2026": the full label used by tooltips and the data table. */
export function formatDate(value: Date | number): string {
  const date = new Date(value);
  return `${shortWeekday(date)} ${date.getDate()} ${shortMonth(date)} ${date.getFullYear()}`;
}

function firstTick(t0: number, interval: Interval): Date {
  const d = new Date(t0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < t0) d.setDate(d.getDate() + 1);
  if (interval.unit === "week") {
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  } else if (interval.unit !== "day") {
    if (d.getDate() !== 1) {
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
    }
    const every = interval.unit === "year" ? 12 : interval.every;
    while (d.getMonth() % every !== 0) d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function advance(d: Date, interval: Interval): void {
  if (interval.unit === "day") d.setDate(d.getDate() + interval.every);
  else if (interval.unit === "week") d.setDate(d.getDate() + 7 * interval.every);
  else if (interval.unit === "month") d.setMonth(d.getMonth() + interval.every);
  else d.setFullYear(d.getFullYear() + interval.every);
}

function tickLabel(date: Date, unit: TimeUnit, first: boolean, spanDays: number): string {
  if (unit === "year") return String(date.getFullYear());
  if (unit === "month") {
    return first || date.getMonth() === 0
      ? `${shortMonth(date)} ${date.getFullYear()}`
      : shortMonth(date);
  }
  if (unit === "day" && spanDays <= 14) return `${shortWeekday(date)} ${date.getDate()}`;
  return `${date.getDate()} ${shortMonth(date)}`;
}

/**
 * Calendar-aligned ticks (local midnight, Mondays, first of the month, January)
 * with es-PE labels. Picks the finest interval that keeps at most `count` ticks.
 */
export function timeTicks(start: number, end: number, count = 6): TimeTick[] {
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
  const out: TimeTick[] = [];
  const cursor = firstTick(t0, interval);
  while (cursor.getTime() <= t1 && out.length < 500) {
    out.push({
      value: cursor.getTime(),
      unit: interval.unit,
      label: tickLabel(cursor, interval.unit, out.length === 0, spanDays),
    });
    advance(cursor, interval);
  }
  return out;
}

export interface TimeScaleOptions {
  domain: readonly [Date | number, Date | number];
  range: readonly [number, number];
}

export interface TimeScale extends ContinuousScale {
  timeTicks(count?: number): TimeTick[];
}

export function timeScale({ domain, range }: TimeScaleOptions): TimeScale {
  const d0 = +domain[0];
  const d1 = +domain[1] === d0 ? d0 + DAY : +domain[1];
  const [r0, r1] = range;
  return {
    type: "time",
    domain: [d0, d1],
    range,
    map: (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0),
    invert: (pixel) => d0 + ((pixel - r0) / (r1 - r0 || 1)) * (d1 - d0),
    ticks: (count = 6) => timeTicks(d0, d1, count).map((tick) => tick.value),
    timeTicks: (count = 6) => timeTicks(d0, d1, count),
  };
}
