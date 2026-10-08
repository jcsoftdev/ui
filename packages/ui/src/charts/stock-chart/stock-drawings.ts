/** A point on the chart in data space: a moment and a price. */
export interface StockAnchor {
  /** Milliseconds since the epoch. */
  time: number;
  price: number;
}

export type StockDrawing =
  | { id: string; type: "trend"; a: StockAnchor; b: StockAnchor }
  | { id: string; type: "horizontal"; price: number }
  | { id: string; type: "range"; a: StockAnchor; b: StockAnchor }
  | { id: string; type: "fib"; a: StockAnchor; b: StockAnchor };

/** Tools of the drawing toolbar: `cursor` selects, `measure` is transient (never persisted). */
export type StockTool = "cursor" | "trend" | "horizontal" | "range" | "fib" | "measure";

export const DEFAULT_STOCK_TOOLS: readonly StockTool[] = [
  "cursor",
  "trend",
  "horizontal",
  "range",
  "fib",
  "measure",
];

export const FIB_LEVELS: readonly number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * Fractional bar index of a moment over ascending `times`: integers are bars,
 * values between two bars interpolate their times, and moments outside the
 * series extrapolate with the nearest gap.
 */
export function indexAtTime(times: readonly number[], time: number): number {
  const last = times.length - 1;
  if (last <= 0) return 0;
  const first = times[0] as number;
  const end = times[last] as number;
  if (time <= first) return (time - first) / ((times[1] as number) - first || 1);
  if (time >= end) return last + (time - end) / (end - (times[last - 1] as number) || 1);
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] as number) <= time) lo = mid;
    else hi = mid;
  }
  const a = times[lo] as number;
  const b = times[hi] as number;
  return lo + (time - a) / (b - a || 1);
}

/** Inverse of `indexAtTime`. */
export function timeAtIndex(times: readonly number[], index: number): number {
  const last = times.length - 1;
  if (last < 0) return 0;
  if (last === 0) return times[0] as number;
  if (index <= 0) {
    return (times[0] as number) + index * ((times[1] as number) - (times[0] as number));
  }
  if (index >= last) {
    const gap = (times[last] as number) - (times[last - 1] as number);
    return (times[last] as number) + (index - last) * gap;
  }
  const lo = Math.floor(index);
  const a = times[lo] as number;
  return a + (index - lo) * ((times[lo + 1] as number) - a);
}

export interface FibLevel {
  ratio: number;
  price: number;
}

/** Retracement levels between two prices: ratio 0 sits at `a`, ratio 1 at `b`. */
export function fibLevels(a: number, b: number): FibLevel[] {
  return FIB_LEVELS.map((ratio) => ({ ratio, price: a + (b - a) * ratio }));
}

export interface Measurement {
  change: number;
  /** Fraction of the start price (0.05 = +5%), negative when falling. */
  percent: number;
  /** Whole bars between the two ends. */
  bars: number;
  /** Milliseconds between the two ends. */
  duration: number;
}

/** What a drag between two anchors measures. */
export function measureRange(
  times: readonly number[],
  a: StockAnchor,
  b: StockAnchor,
): Measurement {
  const change = b.price - a.price;
  return {
    change,
    percent: a.price ? change / Math.abs(a.price) : 0,
    bars: Math.round(Math.abs(indexAtTime(times, b.time) - indexAtTime(times, a.time))),
    duration: Math.abs(b.time - a.time),
  };
}

/** Whole days in a duration. */
export function durationDays(duration: number): number {
  return Math.round(duration / 86_400_000);
}

/** Distance from point `p` to the segment `a`-`b`, in pixels. */
export function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
