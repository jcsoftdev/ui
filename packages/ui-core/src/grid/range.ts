import type { CellValue } from "./model.js";

/** A cell of the grid: `r` is the row of the view (0-based), `c` the rendered column (0-based). */
export interface CellPos {
  r: number;
  c: number;
}

export interface RangeBounds {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

/** The rectangle two corners span, whichever way round they are. */
export function rangeBounds(anchor: CellPos, focus: CellPos): RangeBounds {
  return {
    r0: Math.min(anchor.r, focus.r),
    r1: Math.max(anchor.r, focus.r),
    c0: Math.min(anchor.c, focus.c),
    c1: Math.max(anchor.c, focus.c),
  };
}

export function inBounds(bounds: RangeBounds, r: number, c: number): boolean {
  return r >= bounds.r0 && r <= bounds.r1 && c >= bounds.c0 && c <= bounds.c1;
}

export interface ExtendLimits {
  rows: number;
  cols: number;
  /** First column a range may cover (the checkbox column is out). */
  minC: number;
  /** Rows a PageUp / PageDown step covers. */
  page: number;
  rtl: boolean;
}

/**
 * Where Shift + a navigation key moves the free corner of a range, or `null` for any other key.
 * Arrows step one cell (left and right swap in right-to-left), Ctrl / Cmd + arrow runs to the edge,
 * Home / End go to the first / last column (with Ctrl / Cmd also the first / last row) and
 * PageUp / PageDown move a page.
 */
export function extendFocus(
  focus: CellPos,
  key: string,
  mod: boolean,
  limits: ExtendLimits,
): CellPos | null {
  const { rows, cols, minC, page, rtl } = limits;
  const last = { r: rows - 1, c: cols - 1 };
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const to = (r: number, c: number): CellPos => ({
    r: clamp(r, 0, last.r),
    c: clamp(c, minC, last.c),
  });
  const side = rtl ? -1 : 1;
  switch (key) {
    case "ArrowUp":
      return to(mod ? 0 : focus.r - 1, focus.c);
    case "ArrowDown":
      return to(mod ? last.r : focus.r + 1, focus.c);
    case "ArrowLeft":
      return to(focus.r, mod ? (rtl ? last.c : minC) : focus.c - side);
    case "ArrowRight":
      return to(focus.r, mod ? (rtl ? minC : last.c) : focus.c + side);
    case "Home":
      return to(mod ? 0 : focus.r, minC);
    case "End":
      return to(mod ? last.r : focus.r, last.c);
    case "PageUp":
      return to(focus.r - page, focus.c);
    case "PageDown":
      return to(focus.r + page, focus.c);
    default:
      return null;
  }
}

export interface RangeStats {
  /** Cells with a value. */
  count: number;
  /** Cells holding a finite number. */
  numeric: number;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

/** Count, sum, average, min and max of a range (`undefined` skips a cell that is not data). */
export function rangeStats(
  bounds: RangeBounds,
  valueAt: (r: number, c: number) => CellValue | undefined,
): RangeStats {
  let count = 0;
  let numeric = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let r = bounds.r0; r <= bounds.r1; r += 1) {
    for (let c = bounds.c0; c <= bounds.c1; c += 1) {
      const value = valueAt(r, c);
      if (value === undefined || value === null || value === "") continue;
      count += 1;
      if (typeof value === "number" && Number.isFinite(value)) {
        numeric += 1;
        sum += value;
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
  }
  return {
    count,
    numeric,
    sum: numeric ? sum : null,
    avg: numeric ? sum / numeric : null,
    min: numeric ? min : null,
    max: numeric ? max : null,
  };
}
