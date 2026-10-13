// Chart scales: linear, log, time (calendar ticks, es-PE labels), band and point.
import {
  type Calendar,
  calendarFor,
  type DateLocaleOptions,
  dateFormat,
} from "../internal/chart-calendar.ts";
import { clean, linearTicks, niceDomain, tickStep } from "../internal/chart-ticks.ts";

export type { DateLocaleOptions };
export { clean, linearTicks, niceDomain, tickStep };

export interface ContinuousScale {
  readonly type: "linear" | "log" | "time";
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  map(value: number): number;
  invert(pixel: number): number;
  ticks(count?: number): number[];
}

export interface LinearScaleOptions {
  domain: readonly [number, number];
  range: readonly [number, number];
  /** Extend the domain to round tick values (default true). */
  nice?: boolean;
  /** Approximate number of ticks used by `nice` and `ticks()`. */
  tickCount?: number;
}

export function linearScale({
  domain,
  range,
  nice = true,
  tickCount = 5,
}: LinearScaleOptions): ContinuousScale {
  const [d0, d1] = nice ? niceDomain(domain[0], domain[1], tickCount) : domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return {
    type: "linear",
    domain: [d0, d1],
    range,
    map: (value) => r0 + ((value - d0) / span) * (r1 - r0),
    invert: (pixel) => d0 + ((pixel - r0) / (r1 - r0 || 1)) * span,
    ticks: (count = tickCount) => linearTicks(d0, d1, count),
  };
}

/** Min and max of the finite numbers in `values`, or null when there are none. */
export function extent(values: Iterable<number | null | undefined>): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  return lo === Number.POSITIVE_INFINITY ? null : [lo, hi];
}

export interface LogScaleOptions {
  /** Non-positive values are clamped to the smallest positive number. */
  domain: readonly [number, number];
  range: readonly [number, number];
}

/** Base-10 logarithmic scale, extended to whole decades. */
export function logScale({ domain, range }: LogScaleOptions): ContinuousScale {
  const lo = Math.max(Math.min(domain[0], domain[1]), Number.MIN_VALUE);
  const hi = Math.max(domain[0], domain[1], lo);
  const e0 = Math.floor(Math.log10(lo));
  const e1 = Math.max(Math.ceil(Math.log10(hi)), e0 + 1);
  const [r0, r1] = range;
  const span = e1 - e0;
  return {
    type: "log",
    domain: [10 ** e0, 10 ** e1],
    range,
    map: (value) => r0 + ((Math.log10(Math.max(value, 10 ** e0)) - e0) / span) * (r1 - r0),
    invert: (pixel) => 10 ** (e0 + ((pixel - r0) / (r1 - r0 || 1)) * span),
    ticks: () => {
      const out: number[] = [];
      const multiples = span <= 2 ? [1, 2, 5] : [1];
      for (let e = e0; e <= e1; e += 1) {
        for (const m of multiples) {
          const value = clean(m * 10 ** e);
          if (value <= 10 ** e1) out.push(value);
        }
      }
      return out;
    },
  };
}

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

/**
 * Index-based categorical scale. `band` gives every category a slot with a
 * bar-sized `bandwidth`; `point` spreads categories edge to edge (bandwidth 0),
 * which suits lines and areas.
 */
export interface BandScale {
  readonly type: "band" | "point";
  readonly count: number;
  readonly range: readonly [number, number];
  readonly step: number;
  readonly bandwidth: number;
  /** Leading edge of category `index`. */
  start(index: number): number;
  /** Center of category `index`. */
  center(index: number): number;
  /** Category under `pixel`, clamped to the valid range; -1 when empty. */
  indexAt(pixel: number): number;
}

export interface BandScaleOptions {
  count: number;
  range: readonly [number, number];
  /** Gap between bands, as a fraction of the step (0-1). */
  paddingInner?: number;
  /** Space before the first and after the last band, as a fraction of the step. */
  paddingOuter?: number;
}

export function bandScale({
  count,
  range,
  paddingInner = 0.2,
  paddingOuter = 0.1,
}: BandScaleOptions): BandScale {
  const [r0, r1] = range;
  const slots = Math.max(1, count - paddingInner + paddingOuter * 2);
  const step = (r1 - r0) / slots;
  const bandwidth = step * (1 - paddingInner);
  const offset = r0 + step * paddingOuter;
  return {
    type: "band",
    count,
    range,
    step,
    bandwidth,
    start: (index) => offset + index * step,
    center: (index) => offset + index * step + bandwidth / 2,
    indexAt: (pixel) => {
      if (count === 0) return -1;
      const raw = Math.floor((pixel - offset + (step - bandwidth) / 2) / step);
      return Math.min(count - 1, Math.max(0, raw));
    },
  };
}

export interface PointScaleOptions {
  count: number;
  range: readonly [number, number];
  /** Space before the first and after the last point, as a fraction of the step. */
  padding?: number;
}

export function pointScale({ count, range, padding = 0 }: PointScaleOptions): BandScale {
  const [r0, r1] = range;
  if (count <= 1) {
    const mid = (r0 + r1) / 2;
    return {
      type: "point",
      count,
      range,
      step: r1 - r0,
      bandwidth: 0,
      start: () => mid,
      center: () => mid,
      indexAt: () => (count === 0 ? -1 : 0),
    };
  }
  const step = (r1 - r0) / (count - 1 + padding * 2);
  const offset = r0 + step * padding;
  return {
    type: "point",
    count,
    range,
    step,
    bandwidth: 0,
    start: (index) => offset + index * step,
    center: (index) => offset + index * step,
    indexAt: (pixel) => Math.min(count - 1, Math.max(0, Math.round((pixel - offset) / step))),
  };
}
