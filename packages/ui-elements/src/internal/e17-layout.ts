// Geometry of the cartesian charts (bar, line, area, combo): margins, scales, ticks, paths and bars.
// Pure, so it is tested against the React kit's `computeLayout` value for value.
import {
  type AxisTick,
  estimateTextWidth,
  thinTicks,
  valueTicks,
} from "@jcsoftdev/ui-core/chart/axis";
import type { ValueFormat, ValueFormatter } from "@jcsoftdev/ui-core/chart/format";
import type { ChartTone } from "@jcsoftdev/ui-core/chart/palette";
import type { Curve } from "@jcsoftdev/ui-core/chart/path";
import {
  type BandScale,
  bandScale,
  type ContinuousScale,
  extent,
  linearScale,
  logScale,
  pointScale,
} from "@jcsoftdev/ui-core/chart/scale";
import { type StackLayer, type StackMode, stackLayers } from "@jcsoftdev/ui-core/chart/stack";
import type { TimeKit } from "./e17-time.js";
import { maxOf, minOf } from "./e17-util.js";

export type XValue = string | number | Date;
export type MarkKind = "line" | "area" | "column";
export type AxisBound = number | ((dataValue: number) => number);

/** Options of a value axis. */
export interface ValueAxisOptions {
  min?: AxisBound;
  max?: AxisBound;
  tickCount?: number;
  format?: ValueFormat;
  title?: string;
  scale?: "linear" | "log";
  /** Force zero into the domain (lines default to "auto": only when the data sits near zero). */
  zero?: boolean;
  /** Values grow downwards (or to the left). */
  reversed?: boolean;
}

/** A value axis of a cartesian chart; `id` is what a series' `axis` names. */
export interface AxisSpec extends ValueAxisOptions {
  id: string;
  side?: "left" | "right";
  color?: string;
}

export interface Point {
  x: number;
  y: number;
}

/** A visible series with its data already cut to the zoom window. */
export interface ResolvedSeries {
  id: string;
  name: string;
  kind: MarkKind;
  axis: string;
  color: string;
  dashed: boolean;
  format: ValueFormatter;
  data: ReadonlyArray<number | null>;
  from?: ReadonlyArray<number | null>;
  stackGroup?: string;
  pointColors?: ReadonlyArray<string | undefined>;
}

export interface BarGeometry {
  key: string;
  index: number;
  d: string;
  x: number;
  y: number;
  width: number;
  height: number;
  negative: boolean;
  color?: string;
}

export interface LabelGeometry {
  key: string;
  x: number;
  y: number;
  text: string;
  anchor: "start" | "middle" | "end";
  inside: boolean;
}

export interface SeriesGeometry {
  id: string;
  kind: MarkKind;
  color: string;
  dashed: boolean;
  points: Array<Point | null>;
  line?: string;
  area?: string;
  bars?: BarGeometry[];
  labels: LabelGeometry[];
}

export interface AxisGeometry {
  id: string;
  side: "left" | "right";
  scale: ContinuousScale;
  ticks: AxisTick[];
  offset: number;
  title?: string;
  color?: string;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CartesianLayout {
  width: number;
  height: number;
  margin: Margin;
  innerWidth: number;
  innerHeight: number;
  horizontal: boolean;
  mode: "band" | "point" | "time";
  positions: number[];
  bandwidth: number;
  step: number;
  indexAt: (pixel: number) => number;
  valueScale: ContinuousScale;
  axes: AxisGeometry[];
  categoryTicks: AxisTick[];
  valueTicks: AxisTick[];
  zero: number | null;
  layers: ReadonlyMap<string, StackLayer>;
  geometry: SeriesGeometry[];
}

/** Reference marks, as in the React kit. `axis: "y"` is the value axis, `"x"` the category axis. */
export type ChartAnnotation = AnnotationBase &
  (
    | { type: "line"; axis: "y"; value: number; yAxis?: string }
    | { type: "range"; axis: "y"; from: number; to: number; yAxis?: string }
    | { type: "line"; axis: "x"; value: XValue }
    | { type: "range"; axis: "x"; from: XValue; to: XValue }
    | { type: "point"; x: XValue; y: number; yAxis?: string }
    | { type: "text"; x: XValue; y: number; yAxis?: string }
  );

interface AnnotationBase {
  label?: string;
  /** Extra sentence for the native tooltip of a `point` or `text` mark. */
  tooltip?: string;
  /** Color family, `neutral` by default. */
  tone?: ChartTone;
}

/** What the column code needs from the layout; supplied by the bar and combo entries only. */
export interface BarContext {
  horizontal: boolean;
  band: BandScale;
  bandwidth: number;
  innerHeight: number;
  dataLabels: boolean;
  barRadius: number;
  scaleOf: (axis: string) => ContinuousScale;
  reversedOf: (axis: string) => boolean | undefined;
}
export interface BarPlan {
  /** More than one bar slot per category: the bands get tighter padding. */
  multi: boolean;
  build: (item: ResolvedSeries, ctx: BarContext) => SeriesGeometry;
}
export type BarKit = (
  series: readonly ResolvedSeries[],
  stack: StackMode,
  layers: ReadonlyMap<string, StackLayer>,
) => BarPlan;

/** What the line and area code needs from the layout; supplied by the line, area and combo entries. */
export interface LineContext {
  positions: readonly number[];
  curve: Curve;
  scale: ContinuousScale;
  /** Pixel of the zero line (or the domain start) on `scale`, where an area is anchored. */
  baseline: number;
  count: number;
  innerWidth: number;
  dataLabels: boolean;
}
export interface LineKit {
  build: (item: ResolvedSeries, ctx: LineContext, layer: StackLayer | undefined) => SeriesGeometry;
  /** Shared indices (LTTB) of the data when it is denser than `max` points, else `null`. */
  sample: (data: ReadonlyArray<ReadonlyArray<number | null>>, max: number) => number[] | null;
  /** Draws the lines (or areas) of `layout` into `plot`; areas add their gradients to `defs`. */
  paint: (
    plot: SVGGElement,
    defs: SVGDefsElement,
    layout: CartesianLayout,
    options: {
      kind: "line" | "area";
      clipId: string;
      markers: boolean;
      stacked: boolean;
      gradient: boolean;
    },
  ) => void;
}

export interface LayoutInput {
  /** Line and area geometry (`e17-lines`); without it those series are not drawn. */
  lines?: LineKit;
  /** Locale and time zone of a calendar axis. */
  locale?: string;
  timeZone?: string;
  /** Column geometry (`e17-bars`); without it column series are not drawn. */
  bars?: BarKit;
  /** Calendar axis helpers (`e17-time`), loaded on demand; without them dates use a band axis. */
  time?: TimeKit;
  annotations?: readonly ChartAnnotation[];
  width: number;
  height: number;
  categories: readonly XValue[];
  series: readonly ResolvedSeries[];
  orientation: "vertical" | "horizontal";
  stack: StackMode;
  curve: Curve;
  dataLabels: boolean;
  barRadius: number;
  xScale: "auto" | "band" | "time";
  xLabel: (value: XValue) => string;
  /** Resolves a tick format (a preset, a function or undefined) for the chart's locale. */
  axisFormat: (format: ValueFormat | undefined) => ValueFormatter;
  valueFormat?: ValueFormat;
  yAxis: ValueAxisOptions;
  rightAxis: ValueAxisOptions;
  axes?: readonly AxisSpec[];
  labelRotation?: number;
  categoryTickEvery?: number;
  /** Pixels reserved under the category axis (the brush strip). */
  reserveBottom?: number;
}

/** Height of the overview strip under a zoomable plot, and the gap above it. */
export const BRUSH_HEIGHT = 52;
export const BRUSH_GAP = 12;

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const resolveBound = (bound: AxisBound | undefined, value: number) =>
  bound == null ? value : typeof bound === "function" ? bound(value) : bound;

interface ResolvedAxis {
  id: string;
  side: "left" | "right";
  options: ValueAxisOptions;
  color?: string;
}

/**
 * Axes in drawing order. `yAxis` and `rightAxis` are sugar for the ids "left" and "right"; `extra`
 * entries merge into those or add more (on the right unless they say otherwise). Axes no series
 * uses are dropped, and the first remaining one is the primary axis.
 */
export function resolveAxes(
  yAxis: ValueAxisOptions,
  rightAxis: ValueAxisOptions,
  extra: readonly AxisSpec[],
  used: ReadonlySet<string>,
): ResolvedAxis[] {
  const list: ResolvedAxis[] = [
    { id: "left", side: "left", options: yAxis },
    { id: "right", side: "right", options: rightAxis },
  ];
  for (const { id, side, color, ...options } of extra) {
    const at = list.findIndex((axis) => axis.id === id);
    const current = list[at];
    if (current) {
      list[at] = {
        ...current,
        side: side ?? current.side,
        color: color ?? current.color,
        options: { ...current.options, ...options },
      };
    } else list.push({ id, side: side ?? "right", options, color });
  }
  const others = list.some((axis) => axis.id !== "left" && used.has(axis.id));
  return list.filter((axis) => used.has(axis.id) || (axis.id === "left" && !others));
}

/** Margins and offsets for axes that stack outward from the plot on each side, in order. */
export function stackAxes(
  slots: ReadonlyArray<{ id: string; side: "left" | "right"; width: number }>,
  { minLeft, rightFallback }: { minLeft: number; rightFallback: number },
) {
  const used = { left: 0, right: 0 };
  const offsets = new Map<string, number>();
  for (const slot of slots) {
    offsets.set(slot.id, used[slot.side]);
    used[slot.side] += slot.width;
  }
  const hasRight = slots.some((slot) => slot.side === "right");
  return {
    left: Math.max(minLeft, used.left),
    right: hasRight ? used.right : rightFallback,
    offsets,
  };
}

export const isStackable = (series: ResolvedSeries, stack: StackMode) =>
  stack !== "none" && series.kind !== "line" && !series.from;

/** Stacks areas and columns separately, per axis and group. */
function buildLayers(series: readonly ResolvedSeries[], stack: StackMode): Map<string, StackLayer> {
  const out = new Map<string, StackLayer>();
  if (stack === "none") return out;
  const groups = new Map<string, ResolvedSeries[]>();
  for (const item of series) {
    if (!isStackable(item, stack)) continue;
    const key = `${item.kind}:${item.axis}:${item.stackGroup ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const group of groups.values()) {
    const layers = stackLayers(
      group.map((item) => item.data),
      stack,
    );
    group.forEach((item, index) => {
      out.set(item.id, layers[index] as StackLayer);
    });
  }
  return out;
}

export function axisDomain(
  series: readonly ResolvedSeries[],
  layers: ReadonlyMap<string, StackLayer>,
  options: ValueAxisOptions,
  annotationValues: readonly number[] = [],
): [number, number] {
  const values: number[] = [];
  for (const value of annotationValues) values.push(value);
  for (const item of series) {
    const layer = layers.get(item.id);
    if (layer) {
      for (const value of layer.y0) values.push(value);
      for (const value of layer.y1) values.push(value);
    } else {
      for (const value of item.data) if (value != null) values.push(value);
      if (item.from) for (const value of item.from) if (value != null) values.push(value);
    }
  }
  let [lo, hi] = extent(values) ?? [0, 1];
  const onlyLines = series.every((item) => item.kind === "line");
  const autoZero = !onlyLines || (lo >= 0 && hi > 0 && lo / hi < 0.5) || (hi <= 0 && lo < 0);
  if (options.zero ?? autoZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  return [resolveBound(options.min, lo), resolveBound(options.max, hi)];
}

function makeValueScale(
  domain: [number, number],
  range: readonly [number, number],
  options: ValueAxisOptions,
  tickCount: number,
  fixed: boolean,
): ContinuousScale {
  if (options.scale === "log") return logScale({ domain, range });
  return linearScale({ domain, range, tickCount, nice: !fixed });
}

/** `thinTicks` measures every label, so a huge axis is first reduced to an even sample of it. */
const MAX_TICKS = 600;
const sampleTicks = (ticks: AxisTick[]): AxisTick[] => {
  if (ticks.length <= MAX_TICKS) return ticks;
  const step = ticks.length / MAX_TICKS;
  const out: AxisTick[] = [];
  for (let i = 0; i < MAX_TICKS; i += 1) out.push(ticks[Math.floor(i * step)] as AxisTick);
  return out;
};

const widestLabel = (ticks: readonly AxisTick[]) =>
  ticks.reduce((max, tick) => Math.max(max, estimateTextWidth(tick.label)), 0);

/** Every pixel of a cartesian chart: margins, scales, ticks, paths, bars and labels. */
export function computeLayout(input: LayoutInput): CartesianLayout {
  const { width, height, categories, series, orientation, stack, curve, dataLabels } = input;
  const horizontal = orientation === "horizontal";
  const count = categories.length;
  const hasColumns = input.bars != null && series.some((item) => item.kind === "column");
  const percent = stack === "percent";

  const layers = buildLayers(series, stack);
  const plan = hasColumns ? input.bars?.(series, stack, layers) : undefined;
  const axisSpecs = resolveAxes(
    input.yAxis,
    input.rightAxis,
    input.axes ?? [],
    new Set(series.map((item) => item.axis)),
  );
  const primaryId = (axisSpecs[0] as { id: string }).id;
  const axisIds = new Set(axisSpecs.map((axis) => axis.id));
  const axisOf = (id: string) => (axisIds.has(id) ? id : primaryId);

  const yAnnotations = (axis: string) =>
    (input.annotations ?? []).flatMap((note) => {
      if (note.type === "point" || note.type === "text") return [];
      if (note.axis !== "y" || axisOf(note.yAxis ?? primaryId) !== axis) return [];
      return note.type === "line" ? [note.value] : [note.from, note.to];
    });

  const categoryLabels = categories.map((value) => input.xLabel(value));
  const rotation = horizontal ? 0 : (input.labelRotation ?? 0);
  const rotationExtra = rotation
    ? Math.min(
        90,
        Math.ceil(
          maxOf(categoryLabels.map((label) => estimateTextWidth(label))) *
            Math.abs(Math.sin((rotation * Math.PI) / 180)),
        ),
      )
    : 0;
  const top =
    8 +
    (dataLabels && !horizontal ? 12 : 0) +
    (axisSpecs.some((axis) => axis.options.title) ? 16 : 0);
  const bottom = 26 + rotationExtra + (input.reserveBottom ?? 0);
  const innerHeightGuess = Math.max(40, height - top - bottom);

  const percentAxis = (axisSeries: readonly ResolvedSeries[]) =>
    percent && axisSeries.length > 0 && axisSeries.every((item) => isStackable(item, stack));
  const axisInfo = axisSpecs.map((spec) => {
    const own = series.filter((item) => axisOf(item.axis) === spec.id);
    return {
      spec,
      domain: axisDomain(own, layers, spec.options, yAnnotations(spec.id)),
      format: input.axisFormat(
        spec.options.format ?? (percentAxis(own) ? "percent" : input.valueFormat),
      ),
    };
  });

  const lastLabelOverhang = clamp(
    Math.ceil(estimateTextWidth(categoryLabels[categoryLabels.length - 1] ?? "", 12) / 2),
    6,
    36,
  );
  let margin: Margin;
  let valueTickCount: number;
  let offsets = new Map<string, number>();
  const tickCountOf = (options: ValueAxisOptions) => options.tickCount ?? valueTickCount;
  if (horizontal) {
    const widestCategory = maxOf(categoryLabels.map((label) => estimateTextWidth(label, 12)));
    margin = {
      top: 8,
      right: dataLabels ? 48 : 10,
      bottom,
      left: clamp(widestCategory + 10, 32, width * 0.36),
    };
    valueTickCount =
      input.yAxis.tickCount ?? clamp(Math.round((width - margin.left - margin.right) / 96), 2, 8);
  } else {
    valueTickCount = input.yAxis.tickCount ?? clamp(Math.round(innerHeightGuess / 52), 2, 8);
    const slots = axisInfo.map(({ spec, domain, format }) => {
      const probe = makeValueScale(
        domain,
        [innerHeightGuess, 0],
        spec.options,
        tickCountOf(spec.options),
        false,
      );
      const labels = widestLabel(valueTicks(probe, tickCountOf(spec.options), format));
      const title = spec.options.title ? estimateTextWidth(spec.options.title, 10.5) : 0;
      const shared = axisInfo.filter((other) => other.spec.side === spec.side).length > 1;
      return {
        id: spec.id,
        side: spec.side,
        width: Math.max(labels, shared ? title : 0) + 10 + (shared ? 10 : 0),
      };
    });
    const stacked = stackAxes(slots, { minLeft: 20, rightFallback: lastLabelOverhang });
    offsets = stacked.offsets;
    margin = { top, right: stacked.right, bottom, left: stacked.left };
  }

  const innerWidth = Math.max(10, width - margin.left - margin.right);
  const innerHeight = Math.max(10, height - margin.top - margin.bottom);
  const rangeFor = (reversed: boolean | undefined): [number, number] => {
    const forward: [number, number] = horizontal ? [0, innerWidth] : [innerHeight, 0];
    return reversed ? [forward[1], forward[0]] : forward;
  };
  const categoryRange: [number, number] = horizontal ? [0, innerHeight] : [0, innerWidth];

  const scales = new Map<string, ContinuousScale>(
    axisInfo.map(({ spec, domain }) => [
      spec.id,
      makeValueScale(
        domain,
        rangeFor(spec.options.reversed ?? input.yAxis.reversed),
        spec.options,
        tickCountOf(spec.options),
        spec.options.min != null && spec.options.max != null,
      ),
    ]),
  );
  const scaleOf = (id: string) => scales.get(axisOf(id)) as ContinuousScale;
  const valueScale = scaleOf(primaryId);
  const axes: AxisGeometry[] = axisInfo.map(({ spec, format }) => {
    const scale = scales.get(spec.id) as ContinuousScale;
    return {
      id: spec.id,
      side: spec.side,
      scale,
      ticks: valueTicks(scale, tickCountOf(spec.options), format),
      offset: offsets.get(spec.id) ?? 0,
      title: spec.options.title,
      color: spec.color,
    };
  });

  const useTime =
    input.time != null &&
    !horizontal &&
    !hasColumns &&
    count > 1 &&
    input.xScale !== "band" &&
    categories.every((value) => value instanceof Date);
  const multi = plan?.multi ?? false;
  const band: BandScale =
    hasColumns || horizontal
      ? bandScale({
          count,
          range: categoryRange,
          paddingInner: multi ? 0.24 : 0.34,
          paddingOuter: 0.16,
        })
      : pointScale({ count, range: categoryRange, padding: count > 1 ? 0 : 0.5 });
  let positions: number[];
  let categoryTicks: AxisTick[];
  let indexAt: (pixel: number) => number;
  let mode: CartesianLayout["mode"];
  if (useTime) {
    const times = categories.map((value) => +value);
    const time = (input.time as TimeKit).timeScale({
      domain: [minOf(times), maxOf(times)],
      range: categoryRange,
      locale: input.locale,
      timeZone: input.timeZone,
    });
    positions = times.map((value) => time.map(value));
    categoryTicks = time
      .timeTicks(clamp(Math.floor(innerWidth / 84), 2, 12))
      .map((tick) => ({ key: tick.value, position: time.map(tick.value), label: tick.label }));
    indexAt = (pixel) => {
      let best = 0;
      for (let i = 1; i < positions.length; i += 1)
        if (
          Math.abs((positions[i] as number) - pixel) < Math.abs((positions[best] as number) - pixel)
        )
          best = i;
      return best;
    };
    mode = "time";
  } else {
    positions = categories.map((_, index) => band.center(index));
    const ticks = categoryLabels.map((label, index) => ({
      key: index,
      position: positions[index] as number,
      label,
    }));
    const every = input.categoryTickEvery;
    categoryTicks =
      every != null
        ? ticks.filter((_, index) => index % Math.max(1, Math.floor(every)) === 0)
        : horizontal
          ? ticks
          : rotation
            ? ticks.filter((_, index) => index % Math.max(1, Math.ceil(14 / band.step)) === 0)
            : thinTicks(sampleTicks(ticks), 12);
    indexAt = band.indexAt;
    mode = band.type;
  }

  const zeroPixel = (scale: ContinuousScale) => {
    const [d0, d1] = scale.domain;
    if (scale.type === "log") return scale.map(Math.min(d0, d1));
    return scale.map(clamp(0, Math.min(d0, d1), Math.max(d0, d1)));
  };
  const zeroInside =
    valueScale.type !== "log" && valueScale.domain[0] < 0 && valueScale.domain[1] > 0;

  const barContext: BarContext = {
    horizontal,
    band,
    bandwidth: band.bandwidth,
    innerHeight,
    dataLabels,
    barRadius: input.barRadius,
    scaleOf: (id) => scaleOf(id),
    reversedOf: (id) =>
      axisInfo.find((info) => info.spec.id === axisOf(id))?.spec.options.reversed ??
      input.yAxis.reversed,
  };
  const bandwidth = band.bandwidth;

  const geometry: SeriesGeometry[] = series.map((item) => {
    const scale = scaleOf(item.axis);
    const layer = layers.get(item.id);
    if (item.kind === "column") {
      return (
        plan?.build(item, barContext) ?? {
          id: item.id,
          kind: item.kind,
          color: item.color,
          dashed: item.dashed,
          points: [],
          labels: [],
        }
      );
    }
    const empty: SeriesGeometry = {
      id: item.id,
      kind: item.kind,
      color: item.color,
      dashed: item.dashed,
      points: [],
      labels: [],
    };
    if (!input.lines) return empty;
    return input.lines.build(
      item,
      {
        positions,
        curve,
        scale,
        baseline: zeroPixel(scale),
        count,
        innerWidth,
        dataLabels,
      },
      layer,
    );
  });

  return {
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    horizontal,
    mode,
    positions,
    bandwidth,
    step: mode === "band" ? band.step : count > 1 ? innerWidth / (count - 1) : innerWidth,
    indexAt,
    valueScale,
    axes,
    categoryTicks,
    valueTicks: (axes[0] as AxisGeometry).ticks,
    zero: zeroInside ? valueScale.map(0) : null,
    layers,
    geometry,
  };
}
