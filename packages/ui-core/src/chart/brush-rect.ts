import type { BrushRange, BrushRanges, BrushRect } from "./brush.js";

// The rectangle/range conversions on their own, for code that filters by a brush without
// drawing one (the full brush module is a lazy chunk there).

/** One range filter per axis; an unbounded axis gives `null` and is not filtered. */
export function rectToRanges(rect: BrushRect): BrushRanges {
  const bounded = (lo: number, hi: number): BrushRange | null =>
    Number.isFinite(lo) && Number.isFinite(hi) ? [Math.min(lo, hi), Math.max(lo, hi)] : null;
  return { x: bounded(rect.x0, rect.x1), y: bounded(rect.y0, rect.y1) };
}

/** Rectangle of the active range filters; an axis nobody filters stays unbounded. */
export function rangesToRect(x: BrushRange | null, y: BrushRange | null): BrushRect | null {
  if (!x && !y) return null;
  return {
    x0: x ? Math.min(...x) : Number.NEGATIVE_INFINITY,
    x1: x ? Math.max(...x) : Number.POSITIVE_INFINITY,
    y0: y ? Math.min(...y) : Number.NEGATIVE_INFINITY,
    y1: y ? Math.max(...y) : Number.POSITIVE_INFINITY,
  };
}
