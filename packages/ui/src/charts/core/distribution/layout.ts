import { type AxisTick, estimateTextWidth, thinTicks } from "../axes.js";
import { resolveAxisFormat, type ValueFormat } from "../format.js";
import { type BandScale, bandScale } from "../scales/band.js";
import { type ContinuousScale, linearScale } from "../scales/linear.js";
import { timeScale, timeTicks } from "../scales/time.js";

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
  /** Short axis title, e.g. "min" or "S/". */
  title?: string;
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
  format: ValueFormat | undefined,
): AxisTick[] {
  const toText = resolveAxisFormat(format);
  const [d0, d1] = scale.domain;
  return scale
    .ticks(count)
    .filter((value) => value >= Math.min(d0, d1) - 1e-9 && value <= Math.max(d0, d1) + 1e-9)
    .map((value) => ({ key: value, position: scale.map(value), label: toText(value) }));
}

const clock = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });

/** Calendar ticks; spans shorter than two days fall back to evenly spaced clock times. */
function timeAxisTicks(scale: ContinuousScale, count: number): AxisTick[] {
  const [d0, d1] = scale.domain;
  const calendar = timeTicks(d0, d1, count);
  if (calendar.length >= 2) {
    return calendar.map((tick) => ({
      key: tick.value,
      position: scale.map(tick.value),
      label: tick.label,
    }));
  }
  const steps = Math.max(2, Math.min(count, 6));
  return Array.from({ length: steps }, (_unused, i) => {
    const value = d0 + ((d1 - d0) * i) / (steps - 1);
    return { key: value, position: scale.map(value), label: clock.format(value) };
  });
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
 * (box plots, violins, rainclouds, beeswarms). Pure.
 */
export function categoryLayout(input: CategoryLayoutInput): CategoryLayout {
  const { width, height, categories, seriesCount, valueFormat } = input;
  const axis = input.axis ?? {};
  const horizontal = input.orientation === "horizontal";
  const domain = domainOf(input.extent, axis);
  const fixed = axis.min != null && axis.max != null;
  const format = axis.format ?? valueFormat;
  const top = axis.title ? 24 : 10;
  const bottom = 28;

  let margin: PlotMargin;
  let tickCount: number;
  if (horizontal) {
    const labelWidth = Math.max(0, ...categories.map((label) => estimateTextWidth(label, 12)));
    margin = { top, right: 18, bottom, left: clamp(labelWidth + 18, 36, width * 0.34) };
    tickCount =
      axis.tickCount ?? clamp(Math.round((width - margin.left - margin.right) / 90), 2, 9);
    const probe = linearScale({ domain, range: [0, width], nice: !fixed, tickCount });
    margin.right = tailRoom(ticksOf(probe, tickCount, format), 18);
  } else {
    tickCount = axis.tickCount ?? clamp(Math.round((height - top - bottom) / 50), 2, 8);
    const probe = linearScale({ domain, range: [height, 0], nice: !fixed, tickCount });
    margin = {
      top,
      right: 14,
      bottom,
      left: Math.max(30, widest(ticksOf(probe, tickCount, format)) + 16),
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
  const valueTicks = ticksOf(valueScale, tickCount, format);
  const categoryTicks = categories.map((label, index) => ({
    key: index,
    position: band.center(index),
    label: horizontal ? truncateLabel(label, margin.left - 18, 12) : label,
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
    slot: (category, series) => ({
      center: band.start(category) + inner * (series + 0.5),
      size: inner * (groups > 1 ? 0.86 : 1),
    }),
  };
}

export interface XYLayoutInput {
  width: number;
  height: number;
  xExtent: readonly [number, number] | null;
  yExtent: readonly [number, number] | null;
  xFormat?: ValueFormat;
  yFormat?: ValueFormat;
  xAxis?: DistributionAxisOptions;
  yAxis?: DistributionAxisOptions;
  /** Extra room inside the plot for marks with a radius (pixels). */
  inset?: number;
  /** x values are epoch milliseconds: a calendar axis with es-PE tick labels. */
  xTime?: boolean;
}

export interface XYLayout {
  margin: PlotMargin;
  innerWidth: number;
  innerHeight: number;
  xScale: ContinuousScale;
  yScale: ContinuousScale;
  xTicks: AxisTick[];
  yTicks: AxisTick[];
}

/** Two continuous axes (scatter, bubble, histogram). Pure. */
export function xyLayout(input: XYLayoutInput): XYLayout {
  const { width, height, inset = 0 } = input;
  const xAxis = input.xAxis ?? {};
  const yAxis = input.yAxis ?? {};
  const xDomain = domainOf(input.xExtent, xAxis);
  const yDomain = domainOf(input.yExtent, yAxis);
  const xFixed = xAxis.min != null && xAxis.max != null;
  const yFixed = yAxis.min != null && yAxis.max != null;
  const xFormat = xAxis.format ?? input.xFormat;
  const yFormat = yAxis.format ?? input.yFormat;
  const top = yAxis.title ? 24 : 10;
  const bottom = xAxis.title ? 46 : 28;
  const yCount = yAxis.tickCount ?? clamp(Math.round((height - top - bottom) / 50), 2, 8);
  const probe = linearScale({
    domain: yDomain,
    range: [height, 0],
    nice: !yFixed,
    tickCount: yCount,
  });
  const margin: PlotMargin = {
    top,
    right: 16,
    bottom,
    left: Math.max(30, widest(ticksOf(probe, yCount, yFormat)) + 16),
  };
  const innerWidth = Math.max(10, width - margin.left - margin.right);
  const innerHeight = Math.max(10, height - margin.top - margin.bottom);
  const xCount = xAxis.tickCount ?? clamp(Math.round(innerWidth / 90), 2, 10);
  const xRange: [number, number] = [inset, Math.max(inset + 1, innerWidth - inset)];
  const xScale: ContinuousScale = input.xTime
    ? timeScale({ domain: xDomain, range: xRange })
    : linearScale({ domain: xDomain, range: xRange, nice: !xFixed, tickCount: xCount });
  const yScale = linearScale({
    domain: yDomain,
    range: [Math.max(inset + 1, innerHeight - inset), inset],
    nice: !yFixed,
    tickCount: yCount,
  });
  return {
    margin,
    innerWidth,
    innerHeight,
    xScale,
    yScale,
    xTicks: thinTicks(
      input.xTime ? timeAxisTicks(xScale, xCount) : ticksOf(xScale, xCount, xFormat),
    ),
    yTicks: ticksOf(yScale, yCount, yFormat),
  };
}

/**
 * Index of the item closest to `(x, y)` within `radius` pixels, or null.
 * Linear scan: distribution charts hold hundreds of marks, not millions.
 */
export function nearestPoint(
  points: ReadonlyArray<{ x: number; y: number; r?: number } | null>,
  x: number,
  y: number,
  radius = 24,
): number | null {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    if (!point) return;
    const distance = Math.hypot(point.x - x, point.y - y) - (point.r ?? 0);
    if (distance < bestDistance && distance <= radius) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * Keeps the tooltip inside narrow frames: below 480 px it flips at the middle
 * and its width is capped to half the container (`cqw`, the chart frame is a
 * size container).
 */
export function tooltipFit(width: number): { containerWidth: number; className?: string } {
  if (width >= 480) return { containerWidth: width };
  return {
    containerWidth: width * 1.2,
    className: "min-w-28 max-w-[calc(50cqw-16px)]",
  };
}
