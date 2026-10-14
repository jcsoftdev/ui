// Distribution maths for box plots, violins and rainclouds: quartiles, Tukey whiskers, a Gaussian
// kernel density estimate, deterministic jitter, the violin outline and the category layout.
import { type AxisTick, estimateTextWidth, thinTicks } from "./axis.ts";
import { resolveAxisFormat, type ValueFormat } from "./format.ts";
import { type BandScale, bandScale, type ContinuousScale, linearScale } from "./scale.ts";

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
  return boxStatsSorted(sortedFinite(values), whisker);
}

/** `boxStats` of values that are already finite and ascending (see `sortedFinite`): no second sort. */
export function boxStatsSorted(sorted: readonly number[], whisker = 1.5): BoxStats | null {
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

/**
 * Silverman's rule of thumb for a Gaussian kernel:
 * `0.9 · min(sd, IQR / 1.34) · n^(-1/5)`. Falls back to the other spread
 * measure when one of them is zero, and to 1 for constant data.
 */
export function silvermanBandwidth(values: Iterable<number | null | undefined>): number {
  return silvermanBandwidthSorted(sortedFinite(values));
}

/** `silvermanBandwidth` of values that are already finite and ascending. */
export function silvermanBandwidthSorted(sorted: readonly number[]): number {
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
 * integrates to ~1 over the real line.
 */
export function gaussianKde(
  values: Iterable<number | null | undefined>,
  options: KdeOptions = {},
): DensityPoint[] {
  return gaussianKdeSorted(sortedFinite(values), options);
}

/** `gaussianKde` of values that are already finite and ascending. */
export function gaussianKdeSorted(
  sorted: readonly number[],
  options: KdeOptions = {},
): DensityPoint[] {
  const n = sorted.length;
  if (n === 0) return [];
  const h =
    options.bandwidth && options.bandwidth > 0
      ? options.bandwidth
      : silvermanBandwidthSorted(sorted);
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

/** Density of an evenly spaced `curve` at `value`, interpolated linearly and clamped at the ends. */
export function densityAt(curve: readonly DensityPoint[], value: number): number {
  if (curve.length === 0) return 0;
  const first = curve[0] as DensityPoint;
  const last = curve[curve.length - 1] as DensityPoint;
  if (value <= first.value) return first.density;
  if (value >= last.value) return last.density;
  const step = (last.value - first.value) / (curve.length - 1);
  const index = Math.min(curve.length - 2, Math.floor((value - first.value) / step));
  const a = curve[index] as DensityPoint;
  const b = curve[index + 1] as DensityPoint;
  return a.density + ((b.density - a.density) * (value - a.value)) / (b.value - a.value || 1);
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

export interface JitteredValue {
  value: number;
  /** Signed pixel offset from the category axis. */
  offset: number;
}

/**
 * Deterministic jitter for raw observations. `reach(value)` is the largest
 * absolute offset in pixels at that value (a violin passes its density
 * profile, a box a constant), so the dots follow the shape they sit in.
 * Non-finite values are dropped. The same seed always yields the same layout.
 */
export function jitterValues(
  values: Iterable<number | null | undefined>,
  seed: number,
  reach: number | ((value: number) => number),
): JitteredValue[] {
  const random = seededRandom(seed);
  const out: JitteredValue[] = [];
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    const limit = typeof reach === "function" ? reach(value) : reach;
    out.push({ value, offset: (random() * 2 - 1) * Math.max(0, limit) });
  }
  return out;
}

/** Seed of one box or violin, so every group gets its own stable jitter. */
export function groupSeed(seed: number, category: number, series: number): number {
  return seed + category * 977 + series * 131;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** `[value, cross]` to screen `x,y`, swapping axes for horizontal charts. */
export function toXY(horizontal: boolean, value: number, cross: number): string {
  return horizontal ? `${round(value)},${round(cross)}` : `${round(cross)},${round(value)}`;
}

export type ViolinSide = "both" | "start" | "end";

export interface ViolinPathInput {
  density: readonly DensityPoint[];
  /** Value to pixel along the value axis. */
  map: (value: number) => number;
  /** Pixel of the violin axis on the cross axis. */
  center: number;
  /** Pixel half-width given to `maxDensity`. */
  halfWidth: number;
  maxDensity: number;
  horizontal: boolean;
  /**
   * "both" mirrors the curve; "start" draws only the side toward smaller cross
   * pixels (left, or up when horizontal); "end" only the other side.
   */
  side?: ViolinSide;
  /** Value range to keep (the axis domain): the curve is cut there instead of spilling out. */
  domain?: readonly [number, number];
}

/** Closed outline of a (half) violin from a density curve. */
export function violinPath({
  density: curve,
  map,
  center,
  halfWidth,
  maxDensity,
  horizontal,
  side = "both",
  domain,
}: ViolinPathInput): string {
  let density = curve;
  if (domain) {
    const [lo, hi] = domain[0] <= domain[1] ? domain : [domain[1], domain[0]];
    density = density.filter((point) => point.value >= lo && point.value <= hi);
  }
  if (density.length < 2 || maxDensity <= 0) return "";
  const at = (point: DensityPoint, sign: number) =>
    toXY(horizontal, map(point.value), center + sign * (point.density / maxDensity) * halfWidth);
  const axisAt = (point: DensityPoint) => toXY(horizontal, map(point.value), center);
  const first = density[0] as DensityPoint;
  const last = density[density.length - 1] as DensityPoint;
  let points: string[];
  if (side === "both") {
    points = [...density.map((p) => at(p, -1)), ...[...density].reverse().map((p) => at(p, 1))];
  } else {
    const sign = side === "start" ? -1 : 1;
    points = [axisAt(first), ...density.map((p) => at(p, sign)), axisAt(last)];
  }
  return `M${points.join("L")}Z`;
}

/** Value axis options shared by the distribution charts. */
export interface DistributionAxisOptions {
  /** Fixed lower bound; the data decides by default. */
  min?: number;
  /** Fixed upper bound. */
  max?: number;
  /** Approximate number of ticks; derived from the size by default. */
  tickCount?: number;
  /** Tick format; defaults to a short form of the chart `valueFormat`. */
  format?: ValueFormat;
  /** Short axis title, e.g. "min" or "$". Only its presence matters to the layout, so `true` reserves the room. */
  title?: string | boolean;
}

export interface PlotMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

function ticksOf(
  scale: ContinuousScale,
  count: number,
  toText: (value: number) => string,
): AxisTick[] {
  const [d0, d1] = scale.domain;
  return scale
    .ticks(count)
    .filter((value) => value >= Math.min(d0, d1) - 1e-9 && value <= Math.max(d0, d1) + 1e-9)
    .map((value) => ({ key: value, position: scale.map(value), label: toText(value) }));
}

/** Shortens `label` with an ellipsis so it fits `maxWidth` pixels at `fontSize`. */
export function truncateLabel(label: string, maxWidth: number, fontSize = 11): string {
  if (estimateTextWidth(label, fontSize) <= maxWidth) return label;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.58)) - 1);
  return `${label.slice(0, chars).trimEnd()}…`;
}

/** Room past the plot for the last tick label, which is centered on its tick. */
const tailRoom = (ticks: readonly AxisTick[], minimum: number) =>
  Math.max(minimum, estimateTextWidth(ticks[ticks.length - 1]?.label ?? "") / 2 + 4);

const widest = (ticks: readonly AxisTick[], size = 11) =>
  ticks.reduce((max, tick) => Math.max(max, estimateTextWidth(tick.label, size)), 0);

/** Resolves a value domain, honouring fixed bounds and keeping a non-empty span. */
function domainOf(
  extent: readonly [number, number] | null,
  axis: DistributionAxisOptions,
): [number, number] {
  let lo = axis.min ?? extent?.[0] ?? 0;
  let hi = axis.max ?? extent?.[1] ?? 1;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  return lo < hi ? [lo, hi] : [hi, lo];
}

export interface CategoryLayoutInput {
  width: number;
  height: number;
  /** "vertical": categories along x, values up the y axis. "horizontal": rows, values along x. */
  orientation: "vertical" | "horizontal";
  categories: readonly string[];
  /** Series drawn side by side inside every category. */
  seriesCount: number;
  /** Data extent of the value axis. */
  extent: readonly [number, number] | null;
  valueFormat?: ValueFormat;
  axis?: DistributionAxisOptions;
  /** Inner padding between categories, as a fraction of the step (default 0.3). */
  padding?: number;
  /** Locale and currency of the tick labels. */
  locale?: string;
  currency?: string;
  /** Formats the ticks directly; wins over `axis.format`, `valueFormat`, `locale` and `currency`. */
  format?: (value: number) => string;
}

export interface CategoryLayout {
  margin: PlotMargin;
  innerWidth: number;
  innerHeight: number;
  horizontal: boolean;
  valueScale: ContinuousScale;
  band: BandScale;
  valueTicks: AxisTick[];
  categoryTicks: AxisTick[];
  /** Center and thickness of series `s` inside category `c`. */
  slot(category: number, series: number): { center: number; size: number };
}

/**
 * Geometry for charts with a category axis and a continuous value axis
 * (box plots, violins, rainclouds). Pure.
 */
export function categoryLayout(input: CategoryLayoutInput): CategoryLayout {
  const { width, height, categories, seriesCount, valueFormat } = input;
  const axis = input.axis ?? {};
  const horizontal = input.orientation === "horizontal";
  const domain = domainOf(input.extent, axis);
  const fixed = axis.min != null && axis.max != null;
  const toText =
    input.format ??
    resolveAxisFormat(axis.format ?? valueFormat, {
      locale: input.locale,
      currency: input.currency,
    });
  const top = axis.title ? 24 : 10;
  const bottom = 28;

  let margin: PlotMargin;
  let tickCount: number;
  if (horizontal) {
    let labelWidth = 0;
    for (const label of categories) labelWidth = Math.max(labelWidth, estimateTextWidth(label, 12));
    margin = { top, right: 18, bottom, left: clamp(labelWidth + 18, 36, width * 0.34) };
    tickCount =
      axis.tickCount ?? clamp(Math.round((width - margin.left - margin.right) / 90), 2, 9);
    const probe = linearScale({ domain, range: [0, width], nice: !fixed, tickCount });
    margin.right = tailRoom(ticksOf(probe, tickCount, toText), 18);
  } else {
    tickCount = axis.tickCount ?? clamp(Math.round((height - top - bottom) / 50), 2, 8);
    const probe = linearScale({ domain, range: [height, 0], nice: !fixed, tickCount });
    margin = {
      top,
      right: 14,
      bottom,
      left: Math.max(30, widest(ticksOf(probe, tickCount, toText)) + 16),
    };
  }
  const innerWidth = Math.max(10, width - margin.left - margin.right);
  const innerHeight = Math.max(10, height - margin.top - margin.bottom);
  const valueScale = linearScale({
    domain,
    range: horizontal ? [0, innerWidth] : [innerHeight, 0],
    nice: !fixed,
    tickCount,
  });
  const band = bandScale({
    count: categories.length,
    range: horizontal ? [0, innerHeight] : [0, innerWidth],
    paddingInner: input.padding ?? 0.3,
    paddingOuter: 0.18,
  });
  const valueTicks = ticksOf(valueScale, tickCount, toText);
  const categoryTicks = categories.map((label, index) => ({
    key: index,
    position: band.center(index),
    label: horizontal ? truncateLabel(label, margin.left - 18 + 1e-6, 12) : label,
  }));
  const groups = Math.max(1, seriesCount);
  const inner = band.bandwidth / groups;
  return {
    margin,
    innerWidth,
    innerHeight,
    horizontal,
    valueScale,
    band,
    valueTicks: horizontal ? thinTicks(valueTicks) : valueTicks,
    categoryTicks: horizontal ? categoryTicks : thinTicks(categoryTicks),
    slot: (category, s) => ({
      center: band.start(category) + inner * (s + 0.5),
      size: inner * (groups > 1 ? 0.86 : 1),
    }),
  };
}
