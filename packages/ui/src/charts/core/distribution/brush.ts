// Framework-free math of the rectangular brush: drag corners to a rectangle in data units, the
// rectangle to one range filter per axis (and back), and the keyboard moves and resizes.

export interface BrushPoint {
  x: number;
  y: number;
}

/** Normalized rectangle in data units (x0 <= x1, y0 <= y1). An infinite edge means "unbounded". */
export interface BrushRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type BrushRange = readonly [number, number];

export interface BrushRanges {
  x: BrushRange | null;
  y: BrushRange | null;
}

export type BrushKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Rectangle spanned by two corners, whatever the drag direction. */
export function rectFromCorners(a: BrushPoint, b: BrushPoint): BrushRect {
  return {
    x0: Math.min(a.x, b.x),
    x1: Math.max(a.x, b.x),
    y0: Math.min(a.y, b.y),
    y1: Math.max(a.y, b.y),
  };
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** Keeps the rectangle inside the plot domains; an unbounded edge becomes the domain edge. */
export function clampRect(rect: BrushRect, xDomain: BrushRange, yDomain: BrushRange): BrushRect {
  const [xLo, xHi] = [Math.min(...xDomain), Math.max(...xDomain)];
  const [yLo, yHi] = [Math.min(...yDomain), Math.max(...yDomain)];
  return {
    x0: clamp(rect.x0, xLo, xHi),
    x1: clamp(rect.x1, xLo, xHi),
    y0: clamp(rect.y0, yLo, yHi),
    y1: clamp(rect.y1, yLo, yHi),
  };
}

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

export function rectContains(rect: BrushRect, x: number, y: number): boolean {
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

/** True when the drag moved less than `min` pixels in both axes: it was a click. */
export function isClick(a: BrushPoint, b: BrushPoint, min = 4): boolean {
  return Math.abs(a.x - b.x) < min && Math.abs(a.y - b.y) < min;
}

/** Brush that keyboard users start from: the middle half of both domains. */
export function defaultBrush(xDomain: BrushRange, yDomain: BrushRange): BrushRect {
  const middle = (domain: BrushRange): [number, number] => {
    const lo = Math.min(...domain);
    const span = Math.max(...domain) - lo;
    return [lo + span * 0.25, lo + span * 0.75];
  };
  const [x0, x1] = middle(xDomain);
  const [y0, y1] = middle(yDomain);
  return { x0, x1, y0, y1 };
}

const STEP = 0.05;

function shift(lo: number, hi: number, delta: number, dLo: number, dHi: number): [number, number] {
  const size = hi - lo;
  const start = clamp(lo + delta, dLo, dHi - size);
  return [start, start + size];
}

function resize(lo: number, hi: number, delta: number, min: number, dHi: number): [number, number] {
  return [lo, clamp(hi + delta, Math.min(dHi, lo + min), dHi)];
}

/**
 * Keyboard step. Arrows move the rectangle by 5 % of the domain; with `grow` they resize it instead
 * (right and up make it larger, left and down smaller). It never leaves the domains and never
 * collapses below one step.
 */
export function stepBrush(
  rect: BrushRect,
  key: BrushKey,
  grow: boolean,
  xDomain: BrushRange,
  yDomain: BrushRange,
  fraction = STEP,
): BrushRect {
  const [xLo, xHi] = [Math.min(...xDomain), Math.max(...xDomain)];
  const [yLo, yHi] = [Math.min(...yDomain), Math.max(...yDomain)];
  const dx = (xHi - xLo) * fraction;
  const dy = (yHi - yLo) * fraction;
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  const sign = key === "ArrowRight" || key === "ArrowUp" ? 1 : -1;
  if (horizontal) {
    const [x0, x1] = grow
      ? resize(rect.x0, rect.x1, sign * dx, dx, xHi)
      : shift(rect.x0, rect.x1, sign * dx, xLo, xHi);
    return { ...rect, x0, x1 };
  }
  const [y0, y1] = grow
    ? resize(rect.y0, rect.y1, sign * dy, dy, yHi)
    : shift(rect.y0, rect.y1, sign * dy, yLo, yHi);
  return { ...rect, y0, y1 };
}
