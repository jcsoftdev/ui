// Cell range selection: geometry, TSV for the clipboard and the status-bar statistics.
import type { CellValue } from "./types.js";

export interface CellPos {
  r: number;
  c: number;
}

export interface CellRange {
  anchor: CellPos;
  focus: CellPos;
}

export interface RangeBounds {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

export function rangeBounds(range: CellRange): RangeBounds {
  return {
    r0: Math.min(range.anchor.r, range.focus.r),
    r1: Math.max(range.anchor.r, range.focus.r),
    c0: Math.min(range.anchor.c, range.focus.c),
    c1: Math.max(range.anchor.c, range.focus.c),
  };
}

export function inRange(range: CellRange | null, r: number, c: number): boolean {
  if (!range) return false;
  const b = rangeBounds(range);
  return r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1;
}

/** Moves the focus corner by `dr` / `dc` inside the limits (Shift + arrows). */
export function extendRange(
  range: CellRange,
  dr: number,
  dc: number,
  limits: { minR: number; maxR: number; minC: number; maxC: number },
): CellRange {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    anchor: range.anchor,
    focus: {
      r: clamp(range.focus.r + dr, limits.minR, limits.maxR),
      c: clamp(range.focus.c + dc, limits.minC, limits.maxC),
    },
  };
}

function tsvField(text: string): string {
  return /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Tab separated text of a range. `textAt` returns null for cells that do not belong to the data
 * (group rows, selection column); rows and columns made only of those are left out.
 */
export function rangeToTSV(
  bounds: RangeBounds,
  textAt: (r: number, c: number) => string | null,
): string {
  const cols: number[] = [];
  for (let c = bounds.c0; c <= bounds.c1; c += 1) {
    for (let r = bounds.r0; r <= bounds.r1; r += 1) {
      if (textAt(r, c) !== null) {
        cols.push(c);
        break;
      }
    }
  }
  const lines: string[] = [];
  for (let r = bounds.r0; r <= bounds.r1; r += 1) {
    if (!cols.some((c) => textAt(r, c) !== null)) continue;
    lines.push(cols.map((c) => tsvField(textAt(r, c) ?? "")).join("\t"));
  }
  return lines.join("\n");
}

export interface RangeStats {
  /** Cells with a value. */
  count: number;
  /** Cells holding a number. */
  numeric: number;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

/** Count, sum, average, min and max of the numbers in a range (`undefined` skips the cell). */
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
