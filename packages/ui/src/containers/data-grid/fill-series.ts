// Pure planning of the fill handle: how far a drag extends a range, and the values it writes.
// A numeric run continues linearly, dates continue by days, months or years, text ending in a
// number counts up ("Silla 1" -> "Silla 2"), and anything else repeats.
import type { CellValue } from "./types.js";

export interface FillBounds {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

export type HandleDirection = "down" | "right";

export interface HandleExtent {
  direction: HandleDirection;
  /** The range once the fill is applied. */
  bounds: FillBounds;
}

/**
 * Range a drag of the handle to cell `to` extends to, or null when the pointer is still inside the
 * range. The axis with the larger overshoot (in cells) wins, so a drag stays a straight fill.
 */
export function handleExtent(
  base: FillBounds,
  to: { r: number; c: number },
  limits: { maxR: number; maxC: number },
): HandleExtent | null {
  const down = Math.min(to.r, limits.maxR) - base.r1;
  const right = Math.min(to.c, limits.maxC) - base.c1;
  if (down <= 0 && right <= 0) return null;
  if (down >= right) return { direction: "down", bounds: { ...base, r1: base.r1 + down } };
  return { direction: "right", bounds: { ...base, c1: base.c1 + right } };
}

export interface FillLane {
  /** Cells of the original range this lane reads, in order (a column going down, a row going right). */
  source: Array<{ r: number; c: number }>;
  /** Cells it writes, nearest first. */
  targets: Array<{ r: number; c: number }>;
}

/** One lane per column (fill down) or row (fill right) of the original range. */
export function fillLanes(base: FillBounds, extent: HandleExtent): FillLane[] {
  const lanes: FillLane[] = [];
  if (extent.direction === "down") {
    for (let c = base.c0; c <= base.c1; c += 1) {
      const source = [];
      const targets = [];
      for (let r = base.r0; r <= base.r1; r += 1) source.push({ r, c });
      for (let r = base.r1 + 1; r <= extent.bounds.r1; r += 1) targets.push({ r, c });
      lanes.push({ source, targets });
    }
  } else {
    for (let r = base.r0; r <= base.r1; r += 1) {
      const source = [];
      const targets = [];
      for (let c = base.c0; c <= base.c1; c += 1) source.push({ r, c });
      for (let c = base.c1 + 1; c <= extent.bounds.c1; c += 1) targets.push({ r, c });
      lanes.push({ source, targets });
    }
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

export type DateStep =
  | { unit: "days"; amount: number }
  /** `endOfMonth`: the dates are month ends (31 Jan, 28 Feb), so results stay month ends. */
  | { unit: "months"; amount: number; endOfMonth: boolean };

/**
 * Step of a run of dates: a whole number of months when they share the day of the month (monthly
 * and yearly series, e.g. the 1st of every month), otherwise a constant number of days (daily,
 * weekly). Null when the dates do not follow one step.
 */
export function dateStep(dates: readonly Date[]): DateStep | null {
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
  if (months !== 0 && (sameDay || endOfMonth)) {
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
export const copyFill = (count: number, length: number): FillResult[] =>
  Array.from({ length: count }, (_unused, i) => ({ from: i % length }));

/**
 * The `count` values that continue `source` (a column read top to bottom, or a row left to right).
 * Series are detected from the whole source; a lone number, date or word is copied, except text
 * that ends in a number, which counts up. Formulas are always copied (the caller shifts them).
 */
export function seriesFill(source: readonly CellValue[], count: number): FillResult[] {
  if (count <= 0 || source.length === 0) return [];
  if (source.some(isFormula) || source.some(isBlank)) return copyFill(count, source.length);

  if (source.every((value): value is number => typeof value === "number")) {
    const step = constantStep(source);
    if (step === null) return copyFill(count, source.length);
    const last = source[source.length - 1] as number;
    return Array.from({ length: count }, (_unused, i) => ({ value: last + step * (i + 1) }));
  }

  if (source.every((value): value is Date => value instanceof Date)) {
    const step = dateStep(source);
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
      const step = items.length === 1 ? 1 : constantStep(items.map((item) => item.value));
      if (step !== null) {
        const last = items[items.length - 1] as Counted;
        const padded = items.some((item) => item.padded);
        const width = Math.max(...items.map((item) => item.width));
        return Array.from({ length: count }, (_unused, i) => ({
          value: formatCounted(first.prefix, last.value + step * (i + 1), width, padded),
        }));
      }
    }
  }
  return copyFill(count, source.length);
}
