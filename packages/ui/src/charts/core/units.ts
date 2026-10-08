/**
 * Pure geometry for unit charts (pictograms, waffles, hemicycles, isotypes,
 * rating stars): how many units a value takes, how integer cells are shared
 * between categories, and where every unit sits. No React, no DOM.
 */

const EPSILON = 1e-9;

/** Drops floating point noise (0.6000000000000001 -> 0.6). */
function clean(value: number): number {
  return Math.round(value * 1e9) / 1e9;
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
export function unitFractions(value: number, perUnit = 1): number[] {
  const { full, partial } = unitCount(value, perUnit);
  const fractions: number[] = Array.from({ length: full }, () => 1);
  if (partial > 0) fractions.push(partial);
  return fractions;
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
  const units = Math.max(0, Math.floor(count));
  if (!units || !(max > 0) || !Number.isFinite(value))
    return Array.from({ length: units }, () => 0);
  const clamped = Math.min(max, Math.max(0, roundToStep(value, step)));
  const filled = clean((clamped / max) * units);
  return Array.from({ length: units }, (_, index) =>
    Math.min(1, Math.max(0, clean(filled - index))),
  );
}

/**
 * Shares `total` whole units between weights so they add up exactly
 * (largest remainder method). Negative or missing weights count as zero; all
 * zero weights get nothing.
 */
export function largestRemainder(weights: readonly number[], total: number): number[] {
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  const slots = Math.max(0, Math.round(total));
  if (sum <= 0 || slots === 0) return safe.map(() => 0);
  const exact = safe.map((weight) => (weight / sum) * slots);
  const counts = exact.map((share) => Math.floor(clean(share)));
  let left = slots - counts.reduce((acc, count) => acc + count, 0);
  const order = exact
    .map((share, index) => ({ index, rest: share - (counts[index] as number) }))
    .filter((entry) => (safe[entry.index] as number) > 0)
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let i = 0; left > 0 && order.length > 0; i += 1, left -= 1) {
    const entry = order[i % order.length] as { index: number };
    counts[entry.index] = (counts[entry.index] as number) + 1;
  }
  return counts;
}

/**
 * Cells per category in a waffle of `cells` cells. Without `total` the
 * categories fill the whole grid; with a `total` larger than their sum, the
 * remainder stays empty (e.g. 62 of 100 chairs taken).
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
 * Cell of the `index`-th unit. "row" fills left to right from the top row;
 * "column" fills bottom to top from the left column (the classic waffle).
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
 * Picks the column count that gives the largest units inside `width` x
 * `height`. When the size is capped, the widest layout wins (fewer rows).
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
  const limit = Math.max(1, Math.floor(maxColumns));
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

export interface Seat {
  /** Center relative to the hemicycle center, in outer-radius units (y grows downwards). */
  x: number;
  y: number;
  /** 0 is the innermost row. */
  row: number;
  /** Radians, pi on the left end, 0 on the right end. */
  angle: number;
}

export interface ParliamentLayout {
  rows: number;
  /** Radius of each seat, in outer-radius units. */
  seatRadius: number;
  /** Every seat ordered left to right, so consecutive groups form wedges. */
  seats: Seat[];
  /** Radius of every row, innermost first. */
  radii: number[];
}

function rowRadii(rows: number, inner: number): number[] {
  if (rows <= 1) return [1];
  return Array.from({ length: rows }, (_, row) => inner + ((1 - inner) * row) / (rows - 1));
}

/** Seats that fit in `rows` arcs when neighbours keep the radial row spacing. */
function arcCapacity(rows: number, inner: number): number {
  if (rows <= 1) return 5;
  const spacing = (1 - inner) / (rows - 1);
  return rowRadii(rows, inner).reduce(
    (acc, radius) => acc + Math.floor((Math.PI * radius) / spacing) + 1,
    0,
  );
}

/** Fewest arcs that hold `seats` without crowding. */
export function parliamentRows(seats: number, innerRatio = 0.4): number {
  if (seats <= 0) return 0;
  const inner = Math.min(0.9, Math.max(0, innerRatio));
  let rows = 1;
  while (rows < 60 && arcCapacity(rows, inner) < seats) rows += 1;
  return rows;
}

/**
 * Seats of a hemicycle. Rows are auto-computed for the seat count (or fixed
 * with `rows`), each row gets seats in proportion to its length, and the
 * result is sorted left to right so assigning groups in order draws wedges.
 */
export function parliamentLayout(
  total: number,
  { rows: fixedRows, innerRatio = 0.4 }: { rows?: number; innerRatio?: number } = {},
): ParliamentLayout {
  const seatsWanted = Math.max(0, Math.floor(total));
  if (seatsWanted === 0) return { rows: 0, seatRadius: 0, seats: [], radii: [] };
  const inner = Math.min(0.9, Math.max(0, innerRatio));
  const rows = Math.max(1, Math.min(seatsWanted, fixedRows ?? parliamentRows(seatsWanted, inner)));
  const radii = rowRadii(rows, inner);
  const perRow = largestRemainder(radii, seatsWanted);
  const seats: Seat[] = [];
  let spacing = rows > 1 ? (1 - inner) / (rows - 1) : Number.POSITIVE_INFINITY;
  perRow.forEach((count, row) => {
    const radius = radii[row] as number;
    if (count > 1) spacing = Math.min(spacing, (Math.PI * radius) / (count - 1));
    for (let index = 0; index < count; index += 1) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI - (index * Math.PI) / (count - 1);
      seats.push({
        x: clean(radius * Math.cos(angle)),
        y: clean(-radius * Math.sin(angle)),
        row,
        angle,
      });
    }
  });
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
  const seatRadius = Number.isFinite(spacing) ? spacing * 0.42 : 0.3;
  return { rows, seatRadius, seats, radii };
}

/** Category of each position when `counts` are laid one after the other. */
export function assignUnits(counts: readonly number[]): number[] {
  const owners: number[] = [];
  counts.forEach((count, category) => {
    for (let i = 0; i < count; i += 1) owners.push(category);
  });
  return owners;
}
