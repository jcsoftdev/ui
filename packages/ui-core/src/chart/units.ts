// Unit charts (waffle, pictogram, isotype rows, progress units): how many units a value takes, how
// whole cells are shared, and how a grid of units fits its box.
import { assignUnits, clean, largestRemainder } from "../internal/unit-share.ts";

export { assignUnits };

const EPSILON = 1e-9;

/** Most units any unit chart draws; past it the chart shows the first ones and warns (see `per-unit`). */
export const MAX_UNITS = 2000;

let warned = false;
function warnCapped(): void {
  if (warned) return;
  warned = true;
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
  console.warn(
    `ui-core: a unit chart is capped at ${MAX_UNITS} units; raise \`per-unit\` so each icon stands for more.`,
  );
}

/** `count` units, at most `max` of them; warns once when it cuts. */
export function capUnits(count: number, max = MAX_UNITS): number {
  if (count <= max) return Math.max(0, count);
  warnCapped();
  return Math.max(0, max);
}

/** Rows and columns of a waffle, cut so the grid never holds more than `MAX_UNITS` cells. */
export function capGrid(rows: number, columns: number): [number, number] {
  const cols = Math.max(1, Math.min(columns, MAX_UNITS));
  return [Math.max(1, Math.min(rows, Math.floor(capUnits(rows * cols) / cols) || 1)), cols];
}

export interface UnitCount {
  /** Completely filled units. */
  full: number;
  /** Fill of the last unit, 0 (none) to under 1. */
  partial: number;
  /** Units drawn: `full`, plus one when `partial > 0`. */
  units: number;
}

/** 23 people at 5 per icon -> 4 full icons and a 0.6 icon. */
export function unitCount(value: number, perUnit = 1): UnitCount {
  if (!Number.isFinite(value) || value <= 0 || !(perUnit > 0)) {
    return { full: 0, partial: 0, units: 0 };
  }
  const exact = clean(value / perUnit);
  const full = Math.floor(exact);
  const partial = clean(exact - full);
  return { full, partial, units: full + (partial > 0 ? 1 : 0) };
}

/** Fill of every unit a value takes: `unitFractions(23, 5)` -> `[1, 1, 1, 1, 0.6]`. */
export function unitFractions(value: number, perUnit = 1, max = MAX_UNITS): number[] {
  const { full, partial, units } = unitCount(value, perUnit);
  if (units > max) {
    warnCapped();
    return Array.from({ length: Math.max(0, max) }, () => 1);
  }
  const fractions: number[] = Array.from({ length: full }, () => 1);
  if (partial > 0) fractions.push(partial);
  return fractions;
}

/** `unitFractions` of every value, all of them sharing one budget of `MAX_UNITS` units. */
export function unitRuns(values: readonly number[], perUnit = 1, budget = MAX_UNITS): number[][] {
  let left = budget;
  return values.map((value) => {
    const run = unitFractions(value, perUnit, left);
    left -= run.length;
    return run;
  });
}

/** Rounds to the nearest multiple of `step` (e.g. 0.5 for half stars). No step, no rounding. */
export function roundToStep(value: number, step?: number): number {
  if (!step || !(step > 0)) return value;
  return clean(Math.round(value / step) * step);
}

/**
 * Fill of each of `count` units sharing `max`: a 4.5 rating out of 5 stars is
 * `[1, 1, 1, 1, 0.5]`. The value is clamped to `[0, max]` and rounded to `step`.
 */
export function progressFractions(value: number, max: number, count: number, step?: number) {
  const units = capUnits(Math.max(0, Math.floor(count)));
  if (!units || !(max > 0) || !Number.isFinite(value))
    return Array.from({ length: units }, () => 0);
  const clamped = Math.min(max, Math.max(0, roundToStep(value, step)));
  const filled = clean((clamped / max) * units);
  return Array.from({ length: units }, (_, index) =>
    Math.min(1, Math.max(0, clean(filled - index))),
  );
}

/**
 * Cells per category in a waffle of `cells` cells. Without `total` the categories fill the whole
 * grid; with a `total` larger than their sum, the remainder stays empty (62 of 100 chairs taken).
 */
export function waffleCounts(values: readonly number[], cells: number, total?: number): number[] {
  const sum = values.reduce(
    (acc, value) => acc + (Number.isFinite(value) && value > 0 ? value : 0),
    0,
  );
  if (total != null && total > sum) {
    return largestRemainder([...values, total - sum], cells).slice(0, values.length);
  }
  return largestRemainder(values, cells);
}

export type GridOrder = "row" | "column";

/**
 * Cell of the `index`-th unit. "row" fills left to right from the top row; "column" fills bottom
 * to top from the left column (the classic waffle).
 */
export function gridCell(
  index: number,
  columns: number,
  rows: number,
  order: GridOrder = "row",
): { row: number; column: number } {
  if (order === "column") {
    return { column: Math.floor(index / rows), row: rows - 1 - (index % rows) };
  }
  return { row: Math.floor(index / columns), column: index % columns };
}

export interface UnitGridFit {
  columns: number;
  rows: number;
  /** Side of one unit in pixels. */
  size: number;
}

export interface UnitGridOptions {
  width: number;
  height: number;
  /** Gap between units as a fraction of the unit size. */
  gap?: number;
  /** Largest unit side, in pixels. */
  maxSize?: number;
  /** Most columns worth trying (usually the longest run of units). */
  maxColumns: number;
  /** Rows needed with a given number of columns. */
  rowsFor: (columns: number) => number;
  /** Force a column count instead of searching. */
  columns?: number;
}

/** Side of a unit when `columns` x `rows` units (with gaps) must fit in the box. */
function sideFor(width: number, height: number, columns: number, rows: number, gap: number) {
  const across = columns + Math.max(0, columns - 1) * gap;
  const down = rows + Math.max(0, rows - 1) * gap;
  return Math.min(width / across, height / Math.max(1, down));
}

/**
 * Picks the column count that gives the largest units inside `width` x `height`. When the size is
 * capped, the widest layout wins (fewer rows).
 */
export function fitUnitGrid({
  width,
  height,
  gap = 0.2,
  maxSize = Number.POSITIVE_INFINITY,
  maxColumns,
  rowsFor,
  columns: fixed,
}: UnitGridOptions): UnitGridFit {
  const limit = Math.min(MAX_UNITS, Math.max(1, Math.floor(maxColumns)));
  if (fixed && fixed > 0) {
    const rows = rowsFor(fixed);
    return {
      columns: fixed,
      rows,
      size: Math.min(maxSize, sideFor(width, height, fixed, rows, gap)),
    };
  }
  let best: UnitGridFit = { columns: 1, rows: rowsFor(1), size: 0 };
  for (let columns = 1; columns <= limit; columns += 1) {
    const rows = rowsFor(columns);
    const size = Math.min(maxSize, sideFor(width, height, columns, rows, gap));
    if (size >= best.size - EPSILON) best = { columns, rows, size };
  }
  return best;
}
