// Two continuous axes (scatter, bubble, histogram) and a category-free plot box. Pure; a port of
// the React kit's `xyLayout`, with the locale passed in instead of read from es-PE.
import { type AxisTick, estimateTextWidth, thinTicks } from "@jcsoftdev/ui-core/chart/axis";
import type { ValueFormat, ValueFormatter } from "@jcsoftdev/ui-core/chart/format";
import { type ContinuousScale, linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { timeScale } from "@jcsoftdev/ui-core/chart/scale-time";

/** Value axis options of the distribution charts. */
export interface DistributionAxisOptions {
  min?: number;
  max?: number;
  tickCount?: number;
  format?: ValueFormat;
  /** Short axis title, e.g. "min". */
  title?: string;
}

export interface PlotMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

const ticksOf = (scale: ContinuousScale, count: number, toText: ValueFormatter): AxisTick[] => {
  const [d0, d1] = scale.domain;
  return scale
    .ticks(count)
    .filter((value) => value >= Math.min(d0, d1) - 1e-9 && value <= Math.max(d0, d1) + 1e-9)
    .map((value) => ({ key: value, position: scale.map(value), label: toText(value) }));
};

const widest = (ticks: readonly AxisTick[], size = 11) =>
  ticks.reduce((max, tick) => Math.max(max, estimateTextWidth(tick.label, size)), 0);

/** Resolves a value domain, honouring fixed bounds and keeping a non-empty span. */
export function domainOf(
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

/** Shortens `label` with an ellipsis so it fits `maxWidth` pixels at `fontSize`. */
export function truncateLabel(label: string, maxWidth: number, fontSize = 11): string {
  if (estimateTextWidth(label, fontSize) <= maxWidth) return label;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.58)) - 1);
  return `${label.slice(0, chars).trimEnd()}…`;
}

export interface XYLayoutInput {
  width: number;
  height: number;
  xExtent: readonly [number, number] | null;
  yExtent: readonly [number, number] | null;
  xAxis?: DistributionAxisOptions;
  yAxis?: DistributionAxisOptions;
  /** Tick formatters, already resolved for the chart's locale. */
  xText: ValueFormatter;
  yText: ValueFormatter;
  /** Extra room inside the plot for marks with a radius (pixels). */
  inset?: number;
  /** x values are epoch milliseconds: a calendar axis. */
  xTime?: boolean;
  locale?: string;
  timeZone?: string;
  /** Pixels kept free under the x axis (a size key). */
  reserveBottom?: number;
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

export function xyLayout(input: XYLayoutInput): XYLayout {
  const { width, height, inset = 0 } = input;
  const xAxis = input.xAxis ?? {};
  const yAxis = input.yAxis ?? {};
  const xDomain = domainOf(input.xExtent, xAxis);
  const yDomain = domainOf(input.yExtent, yAxis);
  const xFixed = xAxis.min != null && xAxis.max != null;
  const yFixed = yAxis.min != null && yAxis.max != null;
  const top = yAxis.title ? 24 : 10;
  const bottom = (xAxis.title ? 46 : 28) + (input.reserveBottom ?? 0);
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
    left: Math.max(30, widest(ticksOf(probe, yCount, input.yText)) + 16),
  };
  const innerWidth = Math.max(10, width - margin.left - margin.right);
  const innerHeight = Math.max(10, height - margin.top - margin.bottom);
  const xCount = xAxis.tickCount ?? clamp(Math.round(innerWidth / 90), 2, 10);
  const xRange: [number, number] = [inset, Math.max(inset + 1, innerWidth - inset)];
  const xScale: ContinuousScale = input.xTime
    ? timeScale({ domain: xDomain, range: xRange, locale: input.locale, timeZone: input.timeZone })
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
      input.xTime ? timeAxisTicks(xScale, xCount, input) : ticksOf(xScale, xCount, input.xText),
    ),
    yTicks: ticksOf(yScale, yCount, input.yText),
  };
}

/** Calendar ticks; spans shorter than two days fall back to evenly spaced clock times. */
function timeAxisTicks(
  scale: ContinuousScale,
  count: number,
  { locale, timeZone }: { locale?: string; timeZone?: string },
): AxisTick[] {
  const calendar =
    (
      scale as ContinuousScale & {
        timeTicks?: (n: number) => Array<{ value: number; label: string }>;
      }
    ).timeTicks?.(count) ?? [];
  if (calendar.length >= 2)
    return calendar.map((tick) => ({
      key: tick.value,
      position: scale.map(tick.value),
      label: tick.label,
    }));
  const [d0, d1] = scale.domain;
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone });
  const steps = Math.max(2, Math.min(count, 6));
  return Array.from({ length: steps }, (_unused, i) => {
    const value = d0 + ((d1 - d0) * i) / (steps - 1);
    return { key: value, position: scale.map(value), label: clock.format(value) };
  });
}
