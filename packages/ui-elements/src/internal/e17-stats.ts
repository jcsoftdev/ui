// Descriptive statistics for the histogram and scatter charts (bin rules, normal curve, least-squares
// fit, seeded jitter). Pure; a port of the React kit's `core/distribution/stats`, checked against it.
import { clean, tickStep } from "@jcsoftdev/ui-core/chart/scale";

/** Finite values, sorted ascending (a new array). */
export function sortedFinite(values: Iterable<number | null | undefined>): number[] {
  const out: number[] = [];
  for (const value of values) if (value != null && Number.isFinite(value)) out.push(value);
  return out.sort((a, b) => a - b);
}

/**
 * Quantile `p` (0-1) of an ascending array, interpolating linearly between the
 * two closest ranks (the "type 7" definition used by most spreadsheets).
 */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1 || p <= 0) return sorted[0] as number;
  if (p >= 1) return sorted[n - 1] as number;
  const rank = (n - 1) * p;
  const below = Math.floor(rank);
  const lo = sorted[below] as number;
  const hi = sorted[below + 1] as number;
  return lo + (hi - lo) * (rank - below);
}

/** Quantile `p` of unsorted values. */
export function quantile(values: Iterable<number | null | undefined>, p: number): number {
  return quantileSorted(sortedFinite(values), p);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Sample standard deviation (n - 1 in the denominator); 0 below two values. */
export function standardDeviation(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  let squares = 0;
  for (const value of values) squares += (value - m) ** 2;
  return Math.sqrt(squares / (n - 1));
}

/** Standard normal density scaled to `mean` and `sd`. */
export function normalPdf(x: number, m = 0, sd = 1): number {
  if (sd <= 0) return 0;
  const z = (x - m) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/** Sturges' rule: `ceil(log2 n) + 1` bins. */
export function sturgesBinCount(count: number): number {
  return count < 2 ? 1 : Math.ceil(Math.log2(count)) + 1;
}

/** Freedman–Diaconis bin width: `2 · IQR · n^(-1/3)`; 0 when the IQR is 0. */
export function freedmanDiaconisWidth(values: Iterable<number | null | undefined>): number {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n < 2) return 0;
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  return (2 * iqr) / Math.cbrt(n);
}

export type BinRule = "auto" | "sturges" | "freedman-diaconis";

export interface BinOptions {
  /** A rule or an approximate bin count. `auto` uses Freedman–Diaconis, or Sturges when the IQR is 0. */
  bins?: BinRule | number;
  /** Exact bin width; wins over `bins`. Edges are multiples of it. */
  binWidth?: number;
  /** Range to cover; the data range by default. */
  domain?: readonly [number, number];
  /** Snap the width to 1, 2 or 5 times a power of ten (default true, ignored with `binWidth`). */
  nice?: boolean;
}

export interface Bin {
  /** Inclusive lower edge. */
  x0: number;
  /** Exclusive upper edge (inclusive for the last bin). */
  x1: number;
  count: number;
}

export interface BinnedHistogram {
  bins: Bin[];
  width: number;
  /** Values that fell inside the bins. */
  total: number;
}

/** Bin edges for `values`: a width and a start aligned to it. */
export function binEdges(
  values: Iterable<number | null | undefined>,
  options: BinOptions = {},
): number[] {
  const sorted = sortedFinite(values);
  if (sorted.length === 0 && !options.domain) return [];
  const lo = options.domain?.[0] ?? (sorted[0] as number);
  const hi = options.domain?.[1] ?? (sorted[sorted.length - 1] as number);
  let width: number;
  if (options.binWidth && options.binWidth > 0) {
    width = options.binWidth;
  } else {
    const rule = options.bins ?? "auto";
    let count: number;
    if (typeof rule === "number") count = Math.max(1, Math.round(rule));
    else if (rule === "sturges") count = sturgesBinCount(sorted.length);
    else {
      const fd = freedmanDiaconisWidth(sorted);
      count = fd > 0 ? Math.ceil((hi - lo) / fd) : sturgesBinCount(sorted.length);
    }
    count = Math.min(200, Math.max(1, count));
    width = hi > lo ? (hi - lo) / count : 1;
    if (options.nice !== false && hi > lo) width = tickStep(lo, hi, count);
  }
  const start = clean(Math.floor(lo / width) * width);
  const edges = [start];
  let edge = start;
  // At least one bin; the last edge must be strictly past `hi` unless it lands on it.
  while (edge < hi || edges.length < 2) {
    edge = clean(edge + width);
    edges.push(edge);
    if (edges.length > 1001) break;
  }
  return edges;
}

/** Counts `values` into the bins delimited by ascending `edges`. */
export function binCounts(
  values: Iterable<number | null | undefined>,
  edges: readonly number[],
): Bin[] {
  const bins: Bin[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    bins.push({ x0: edges[i] as number, x1: edges[i + 1] as number, count: 0 });
  }
  if (bins.length === 0) return bins;
  const first = edges[0] as number;
  const last = edges[edges.length - 1] as number;
  for (const value of values) {
    if (value == null || !Number.isFinite(value) || value < first || value > last) continue;
    // Binary search keeps uneven edges correct; the last bin is closed on the right.
    let lo = 0;
    let hi = bins.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (value >= (bins[mid] as Bin).x0) lo = mid;
      else hi = mid - 1;
    }
    (bins[lo] as Bin).count += 1;
  }
  return bins;
}

/** Bins `values` with the chosen rule. */
export function histogram(
  values: Iterable<number | null | undefined>,
  options: BinOptions = {},
): BinnedHistogram {
  const sorted = sortedFinite(values);
  const edges = binEdges(sorted, options);
  const bins = binCounts(sorted, edges);
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const width = bins.length ? (bins[0] as Bin).x1 - (bins[0] as Bin).x0 : 0;
  return { bins, width, total };
}

export interface Regression {
  slope: number;
  intercept: number;
  /** Coefficient of determination, 0-1. */
  r2: number;
  predict(x: number): number;
}

/** Ordinary least squares fit `y = slope · x + intercept`; null below two distinct x. */
export function linearRegression(
  points: ReadonlyArray<{ x: number; y: number }>,
): Regression | null {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const n = finite.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  for (const point of finite) {
    sx += point.x;
    sy += point.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const point of finite) {
    sxx += (point.x - mx) ** 2;
    sxy += (point.x - mx) * (point.y - my);
    syy += (point.y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, predict: (x) => slope * x + intercept };
}

/** Deterministic pseudo-random numbers in [0, 1) (mulberry32), so jitter is stable across renders. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface IndexedPoint {
  x: number;
  y: number;
  /** Mark radius in pixels (0 for plain points). */
  r?: number;
}

export interface PointIndex {
  /**
   * Index of the mark closest to `(x, y)` within `radius` pixels of its edge
   * (a pointer inside a mark counts as distance 0), or null. Ties go to the
   * smaller mark, so a small bubble inside a big one stays reachable.
   */
  nearest(x: number, y: number, radius?: number): number | null;
}

/**
 * Uniform-grid spatial index for high-density scatter plots. Building is
 * O(n), a lookup only visits the few buckets around the pointer, so hit
 * testing 50 000 points costs microseconds instead of a full scan.
 */
export function createPointIndex(
  points: ReadonlyArray<IndexedPoint | null>,
  cellSize = 24,
): PointIndex {
  const cell = Math.max(4, cellSize);
  const buckets = new Map<number, number[]>();
  let maxRadius = 0;
  const key = (cx: number, cy: number) => cx * 73_856_093 + cy * 19_349_663;
  points.forEach((point, index) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    maxRadius = Math.max(maxRadius, point.r ?? 0);
    const id = key(Math.floor(point.x / cell), Math.floor(point.y / cell));
    const bucket = buckets.get(id);
    if (bucket) bucket.push(index);
    else buckets.set(id, [index]);
  });
  return {
    nearest(x, y, radius = 16) {
      const reach = radius + maxRadius;
      const x0 = Math.floor((x - reach) / cell);
      const x1 = Math.floor((x + reach) / cell);
      const y0 = Math.floor((y - reach) / cell);
      const y1 = Math.floor((y + reach) / cell);
      let best: number | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestRadius = Number.POSITIVE_INFINITY;
      for (let cx = x0; cx <= x1; cx += 1) {
        for (let cy = y0; cy <= y1; cy += 1) {
          const bucket = buckets.get(key(cx, cy));
          if (!bucket) continue;
          for (const index of bucket) {
            const point = points[index] as IndexedPoint;
            const r = point.r ?? 0;
            const distance = Math.max(0, Math.hypot(point.x - x, point.y - y) - r);
            if (distance > radius) continue;
            if (distance < bestDistance || (distance === bestDistance && r < bestRadius)) {
              best = index;
              bestDistance = distance;
              bestRadius = r;
            }
          }
        }
      }
      return best;
    },
  };
}
