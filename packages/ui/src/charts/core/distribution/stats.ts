/**
 * Descriptive statistics for the distribution charts. Pure functions over
 * plain numbers: non-finite values are ignored everywhere.
 */

import { clean, tickStep } from "../scales/linear.js";

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

export interface BoxStats {
  count: number;
  min: number;
  max: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  mean: number;
  /** Most extreme values inside the Tukey fences (`q1 - k·IQR`, `q3 + k·IQR`). */
  lowerWhisker: number;
  upperWhisker: number;
  /** Values outside the fences, ascending. */
  outliers: number[];
}

/**
 * Five-number summary plus mean and Tukey outliers. `whisker` is the fence
 * multiplier `k` (1.5 by default); `Infinity` makes the whiskers reach min and max.
 */
export function boxStats(
  values: Iterable<number | null | undefined>,
  whisker = 1.5,
): BoxStats | null {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n === 0) return null;
  const q1 = quantileSorted(sorted, 0.25);
  const median = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - whisker * iqr;
  const highFence = q3 + whisker * iqr;
  let lowerWhisker = q1;
  let upperWhisker = q3;
  const outliers: number[] = [];
  for (const value of sorted) {
    if (value < lowFence || value > highFence) outliers.push(value);
    else {
      if (value < lowerWhisker) lowerWhisker = value;
      if (value > upperWhisker) upperWhisker = value;
    }
  }
  return {
    count: n,
    min: sorted[0] as number,
    max: sorted[n - 1] as number,
    q1,
    median,
    q3,
    iqr,
    mean: mean(sorted),
    lowerWhisker,
    upperWhisker,
    outliers,
  };
}

/** Standard normal density scaled to `mean` and `sd`. */
export function normalPdf(x: number, m = 0, sd = 1): number {
  if (sd <= 0) return 0;
  const z = (x - m) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Silverman's rule of thumb for a Gaussian kernel:
 * `0.9 · min(sd, IQR / 1.34) · n^(-1/5)`. Falls back to the other spread
 * measure when one of them is zero, and to 1 for constant data.
 */
export function silvermanBandwidth(values: Iterable<number | null | undefined>): number {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n < 2) return 1;
  const sd = standardDeviation(sorted);
  const iqr = (quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25)) / 1.34;
  const spread = sd > 0 && iqr > 0 ? Math.min(sd, iqr) : Math.max(sd, iqr);
  if (spread <= 0) return Math.abs(sorted[0] as number) * 0.1 || 1;
  return 0.9 * spread * n ** -0.2;
}

export interface DensityPoint {
  /** Position on the value axis. */
  value: number;
  density: number;
}

export interface KdeOptions {
  /** Kernel bandwidth; Silverman's rule by default. */
  bandwidth?: number;
  /** Number of evaluation points (default 64). */
  points?: number;
  /** Evaluation range; by default the data range widened by `cut` bandwidths. */
  extent?: readonly [number, number];
  /** Bandwidths added past the data on each side when `extent` is omitted (default 2). */
  cut?: number;
}

/**
 * Gaussian kernel density estimate, evaluated on an even grid. The curve
 * integrates to ~1 over the real line, so it can share an axis with a
 * histogram drawn as a density.
 */
export function gaussianKde(
  values: Iterable<number | null | undefined>,
  options: KdeOptions = {},
): DensityPoint[] {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n === 0) return [];
  const h =
    options.bandwidth && options.bandwidth > 0 ? options.bandwidth : silvermanBandwidth(sorted);
  const cut = options.cut ?? 2;
  const [lo, hi] = options.extent ?? [
    (sorted[0] as number) - cut * h,
    (sorted[n - 1] as number) + cut * h,
  ];
  const count = Math.max(2, Math.round(options.points ?? 64));
  const step = (hi - lo) / (count - 1);
  const norm = 1 / (n * h * Math.sqrt(2 * Math.PI));
  const out: DensityPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = lo + i * step;
    let sum = 0;
    for (const value of sorted) {
      const z = (x - value) / h;
      if (z > -8 && z < 8) sum += Math.exp(-0.5 * z * z);
    }
    out.push({ value: x, density: sum * norm });
  }
  return out;
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

export interface SwarmItem {
  /** Pixel position along the value axis. */
  position: number;
  radius: number;
}

export interface SwarmOptions {
  /** Extra space between circles in pixels (default 1). */
  gap?: number;
  /** "both" grows the swarm on both sides of the axis; "positive" only to one side. */
  side?: "both" | "positive";
}

/**
 * Beeswarm layout: offsets perpendicular to the value axis so that no two
 * circles overlap. Circles are placed in value order; each one takes the free
 * offset closest to the axis, tested against the circles already placed that
 * are close enough along the axis to touch it. Returns one offset per item,
 * in the input order.
 */
export function beeswarm(items: readonly SwarmItem[], options: SwarmOptions = {}): number[] {
  const gap = options.gap ?? 1;
  const both = (options.side ?? "both") === "both";
  const order = items
    .map((_, index) => index)
    .sort((a, b) => {
      const pa = (items[a] as SwarmItem).position;
      const pb = (items[b] as SwarmItem).position;
      return pa - pb || a - b;
    });
  const offsets = new Array<number>(items.length).fill(0);
  const placed: number[] = [];
  let maxRadius = 0;
  for (const index of order) {
    const item = items[index] as SwarmItem;
    maxRadius = Math.max(maxRadius, item.radius);
    const reach = item.radius + maxRadius + gap;
    // Neighbours along the axis: placed is in position order, walk back from the end.
    const near: number[] = [];
    for (let k = placed.length - 1; k >= 0; k -= 1) {
      const other = placed[k] as number;
      if (item.position - (items[other] as SwarmItem).position > reach) break;
      near.push(other);
    }
    const collides = (offset: number) =>
      near.some((other) => {
        const o = items[other] as SwarmItem;
        const min = item.radius + o.radius + gap;
        const dx = item.position - o.position;
        const dy = offset - (offsets[other] as number);
        return dx * dx + dy * dy < min * min - 1e-6;
      });
    const candidates = [0];
    for (const other of near) {
      const o = items[other] as SwarmItem;
      const min = item.radius + o.radius + gap;
      const dx = item.position - o.position;
      if (Math.abs(dx) >= min) continue;
      const dy = Math.sqrt(min * min - dx * dx);
      const base = offsets[other] as number;
      candidates.push(base + dy, base - dy);
    }
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (!both && candidate < 0) continue;
      if (Math.abs(candidate) < Math.abs(best) && !collides(candidate)) best = candidate;
    }
    offsets[index] = Number.isFinite(best) ? best : 0;
    placed.push(index);
  }
  return offsets;
}
