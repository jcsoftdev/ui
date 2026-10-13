// Pure planning of the fill handle: how far a drag extends a range, and the values it writes.
// A numeric run continues linearly, dates continue by days, months or years, text ending in a
// number counts up ("Silla 1" -> "Silla 2"), and anything else repeats. Dragging up or left runs
// the series backwards (10, 20, 30 gives 0, -10; "Silla 3" gives "Silla 2").
import { decimalsOf, roundTo } from "../internal/decimals.js";
import type { CellValue } from "./model.js";

export interface FillBounds {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

export type HandleDirection = "down" | "right" | "up" | "left";

export interface HandleExtent {
  direction: HandleDirection;
  /** The range once the fill is applied. */
  bounds: FillBounds;
}

/** Whether a direction counts backwards (up and left continue the series in reverse). */
export const isBackward = (direction: HandleDirection) =>
  direction === "up" || direction === "left";

/**
 * Range a drag of the handle to cell `to` extends to, or null when the pointer is still inside the
 * range. The axis with the larger overshoot (in cells) wins, so a drag stays a straight fill; the
 * pointer above or left of the range fills up or left. `minR` / `minC` default to 0.
 */
export function handleExtent(
  base: FillBounds,
  to: { r: number; c: number },
  limits: { maxR: number; maxC: number; minR?: number; minC?: number },
): HandleExtent | null {
  const down = Math.min(to.r, limits.maxR) - base.r1;
  const right = Math.min(to.c, limits.maxC) - base.c1;
  const up = base.r0 - Math.max(to.r, limits.minR ?? 0);
  const left = base.c0 - Math.max(to.c, limits.minC ?? 0);
  const best = Math.max(down, right, up, left);
  if (best <= 0) return null;
  if (down === best) return { direction: "down", bounds: { ...base, r1: base.r1 + down } };
  if (right === best) return { direction: "right", bounds: { ...base, c1: base.c1 + right } };
  if (up === best) return { direction: "up", bounds: { ...base, r0: base.r0 - up } };
  return { direction: "left", bounds: { ...base, c0: base.c0 - left } };
}

/**
 * Scroll step (pixels per frame) for a pointer at `pos` along an axis whose viewport spans
 * `lo..hi`: zero in the middle, ramping up inside `zone` pixels of an edge and capped at `max`
 * (also beyond the edge). Negative scrolls towards the start.
 */
export function edgeScrollStep(pos: number, lo: number, hi: number, zone = 40, max = 22): number {
  const ratio = (limit: number, sign: 1 | -1) => sign * Math.min(1, Math.abs(limit) / zone) * max;
  if (pos < lo + zone) return Math.round(ratio(lo + zone - pos, -1));
  if (pos > hi - zone) return Math.round(ratio(pos - (hi - zone), 1));
  return 0;
}

export interface FillLane {
  /** Cells of the original range this lane reads, in order (a column going down, a row going right). */
  source: Array<{ r: number; c: number }>;
  /** Cells it writes, nearest first. */
  targets: Array<{ r: number; c: number }>;
}

/**
 * One lane per column (fill down or up) or row (fill right or left) of the original range. The
 * source keeps reading order; targets run away from the range, nearest first.
 */
export function fillLanes(base: FillBounds, extent: HandleExtent): FillLane[] {
  const lanes: FillLane[] = [];
  const vertical = extent.direction === "down" || extent.direction === "up";
  const outer = vertical ? [base.c0, base.c1] : [base.r0, base.r1];
  for (let lane = outer[0] as number; lane <= (outer[1] as number); lane += 1) {
    const cell = (index: number) => (vertical ? { r: index, c: lane } : { r: lane, c: index });
    const [from, to] = vertical ? [base.r0, base.r1] : [base.c0, base.c1];
    const source = [];
    const targets = [];
    for (let i = from; i <= to; i += 1) source.push(cell(i));
    if (extent.direction === "down" || extent.direction === "right") {
      const end = vertical ? extent.bounds.r1 : extent.bounds.c1;
      for (let i = to + 1; i <= end; i += 1) targets.push(cell(i));
    } else {
      const end = vertical ? extent.bounds.r0 : extent.bounds.c0;
      for (let i = from - 1; i >= end; i -= 1) targets.push(cell(i));
    }
    lanes.push({ source, targets });
  }
  return lanes;
}

/** A filled value: either computed (series) or a copy of the source cell at `from` (index in the lane). */
export type FillResult = { value: CellValue } | { from: number };

const isBlank = (value: CellValue) => value === null || value === undefined || value === "";
const isFormula = (value: CellValue) =>
  typeof value === "string" && value.trimStart().startsWith("=");

const near = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Constant difference between consecutive numbers, or null. A single number has none. */
function constantStep(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const step = (values[1] as number) - (values[0] as number);
  for (let i = 2; i < values.length; i += 1) {
    if (!near((values[i] as number) - (values[i - 1] as number), step)) return null;
  }
  return step;
}

const DAY = 86_400_000;
const utcDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

/** The date `months` months after `date`, keeping the day of the month (clamped to the month's end). */
export function addMonths(date: Date, months: number, endOfMonth = false): Date {
  const total = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const next = new Date(date.getTime());
  next.setFullYear(year, month, endOfMonth ? lastDay : Math.min(date.getDate(), lastDay));
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * How a run of dates picks its step: "auto" reads months when they share the day of the month and
 * days otherwise; "day" always counts days; "month" always counts whole months.
 */
export type DateStepMode = "auto" | "day" | "month";

export type DateStep =
  | { unit: "days"; amount: number }
  /** `endOfMonth`: the dates are month ends (31 Jan, 28 Feb), so results stay month ends. */
  | { unit: "months"; amount: number; endOfMonth: boolean };

/**
 * Step of a run of dates: a whole number of months when they share the day of the month (monthly
 * and yearly series, e.g. the 1st of every month), otherwise a constant number of days (daily,
 * weekly). Null when the dates do not follow one step.
 */
export function dateStep(dates: readonly Date[], mode: DateStepMode = "auto"): DateStep | null {
  if (dates.length < 2) return null;
  const first = dates[0] as Date;
  const second = dates[1] as Date;
  const monthly = (b: Date, a: Date) =>
    (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  const months = monthly(second, first);
  const sameDay = dates.every((date) => date.getDate() === first.getDate());
  const endOfMonth = dates.every(
    (date) => date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
  );
  if (mode === "month") {
    const steady =
      months !== 0 &&
      dates.every((date, i) => i === 0 || monthly(date, dates[i - 1] as Date) === months);
    return steady ? { unit: "months", amount: months, endOfMonth: endOfMonth && !sameDay } : null;
  }
  if (mode === "auto" && months !== 0 && (sameDay || endOfMonth)) {
    const steady = dates.every(
      (date, i) => i === 0 || monthly(date, dates[i - 1] as Date) === months,
    );
    return steady ? { unit: "months", amount: months, endOfMonth: endOfMonth && !sameDay } : null;
  }
  const days = Math.round((utcDay(second) - utcDay(first)) / DAY);
  const steady = dates.every(
    (date, i) =>
      i === 0 || Math.round((utcDay(date) - utcDay(dates[i - 1] as Date)) / DAY) === days,
  );
  return steady && days !== 0 ? { unit: "days", amount: days } : null;
}

const TRAILING_NUMBER = /^(.*?)(\d+)$/s;

interface Counted {
  prefix: string;
  value: number;
  width: number;
  padded: boolean;
}

function parseCounted(text: string): Counted | null {
  const match = TRAILING_NUMBER.exec(text);
  if (!match) return null;
  const digits = match[2] as string;
  // Past 15 digits a number no longer holds every digit, so such text is copied, not counted.
  if (digits.length > 15) return null;
  return {
    prefix: match[1] as string,
    value: Number(digits),
    width: digits.length,
    padded: digits.length > 1 && digits.startsWith("0"),
  };
}

function formatCounted(prefix: string, value: number, width: number, padded: boolean): string {
  const digits = String(Math.abs(value));
  return `${prefix}${value < 0 ? "-" : ""}${padded ? digits.padStart(width, "0") : digits}`;
}

/** Plain copy: the lane repeats from its first cell. */
export const copyFill = (count: number, length: number, backward = false): FillResult[] =>
  Array.from({ length: count }, (_unused, i) => ({
    from: backward ? length - 1 - (i % length) : i % length,
  }));

export interface SeriesOptions {
  /** Continue before the first cell (fill up or left): the run is read from its last cell backwards. */
  backward?: boolean;
  dateStep?: DateStepMode;
  /** Step of a lone text counter; set internally so "Silla 3" going backwards gives "Silla 2". */
  loneStep?: number;
}

/**
 * The `count` values that continue `source` (a column read top to bottom, or a row left to right).
 * Series are detected from the whole source; a lone number, date or word is copied, except text
 * that ends in a number, which counts up. Formulas are always copied (the caller shifts them).
 */
export function seriesFill(
  source: readonly CellValue[],
  count: number,
  options: SeriesOptions = {},
): FillResult[] {
  if (count <= 0 || source.length === 0) return [];
  const backward = options.backward === true;
  if (source.some(isFormula) || source.some(isBlank)) {
    return copyFill(count, source.length, backward);
  }
  if (backward) {
    const last = source.length - 1;
    const reversed = source.slice().reverse();
    return seriesFill(reversed, count, { ...options, backward: false, loneStep: -1 }).map((item) =>
      "from" in item ? { from: last - item.from } : item,
    );
  }

  if (source.every((value): value is number => typeof value === "number")) {
    const step = constantStep(source);
    if (step === null) return copyFill(count, source.length);
    const last = source[source.length - 1] as number;
    const places = Math.max(decimalsOf(last), decimalsOf(step));
    return Array.from({ length: count }, (_unused, i) => ({
      value: roundTo(last + step * (i + 1), places),
    }));
  }

  if (source.every((value): value is Date => value instanceof Date)) {
    const step = dateStep(source, options.dateStep);
    if (!step) return copyFill(count, source.length);
    const last = source[source.length - 1] as Date;
    return Array.from({ length: count }, (_unused, i) => ({
      value:
        step.unit === "months"
          ? addMonths(last, step.amount * (i + 1), step.endOfMonth)
          : addDays(last, step.amount * (i + 1)),
    }));
  }

  if (source.every((value): value is string => typeof value === "string")) {
    const counted = source.map(parseCounted);
    const first = counted[0];
    if (first && counted.every((item) => item !== null && item.prefix === first.prefix)) {
      const items = counted as Counted[];
      const step =
        items.length === 1
          ? (options.loneStep ?? 1)
          : constantStep(items.map((item) => item.value));
      if (step !== null) {
        const last = items[items.length - 1] as Counted;
        const padded = items.some((item) => item.padded);
        const width = Math.max(...items.map((item) => item.width));
        return Array.from({ length: count }, (_unused, i) => ({
          value: formatCounted(first.prefix, Math.max(0, last.value + step * (i + 1)), width, padded),
        }));
      }
    }
  }
  return copyFill(count, source.length);
}
