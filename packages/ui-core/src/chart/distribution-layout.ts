// Geometry for charts with a category axis and a continuous value axis (beeswarm, box plot, violin).
import { type AxisTick, estimateTextWidth, thinTicks } from "./axis.ts";
import { type BandScale, bandScale, type ContinuousScale, linearScale } from "./scale.ts";

/** Value axis options shared by the distribution charts. */
export interface DistributionAxisOptions {
  /** Fixed lower bound; the data decides by default. */
  min?: number;
  /** Fixed upper bound. */
  max?: number;
  /** Approximate number of ticks; derived from the size by default. */
  tickCount?: number;
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
  format: (value: number) => string,
): AxisTick[] {
  const [d0, d1] = scale.domain;
  return scale
    .ticks(count)
    .filter((value) => value >= Math.min(d0, d1) - 1e-9 && value <= Math.max(d0, d1) + 1e-9)
    .map((value) => ({ key: value, position: scale.map(value), label: format(value) }));
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
  /** Formats the value-axis ticks (the chart's short axis format). */
  format: (value: number) => string;
  axis?: DistributionAxisOptions;
  /** Space for an axis title above the plot. */
  title?: boolean;
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

/** Margins, scales and ticks of a category axis against a value axis. Pure. */
export function categoryLayout(input: CategoryLayoutInput): CategoryLayout {
  const { width, height, categories, seriesCount, format } = input;
  const axis = input.axis ?? {};
  const horizontal = input.orientation === "horizontal";
  const domain = domainOf(input.extent, axis);
  const fixed = axis.min != null && axis.max != null;
  const top = input.title ? 24 : 10;
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
