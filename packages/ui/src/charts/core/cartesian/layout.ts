import { type AxisTick, estimateTextWidth, thinTicks } from "../axes.js";
import {
  formatNumber,
  resolveAxisFormat,
  type ValueFormat,
  type ValueFormatter,
} from "../format.js";
import type { ChartTone } from "../palette.js";
import { areaPath, type BarEnd, barPath, type Curve, linePath, type Point } from "../path.js";
import type { ChartPattern } from "../patterns.js";
import { bandScale, pointScale } from "../scales/band.js";
import { type ContinuousScale, extent, linearScale } from "../scales/linear.js";
import { logScale } from "../scales/log.js";
import { shortMonth, timeScale } from "../scales/time.js";
import { type StackLayer, type StackMode, stackLayers } from "../stack.js";
import type { ChartAnnotation, ValueAxisOptions, XValue } from "../types.js";
import { type CartesianAxisSpec, resolveAxes, stackAxes } from "./axis-stack.js";
import type { MarkKind } from "./types.js";

/** A visible series with its data already cut to the zoom window. */
export interface ResolvedSeries {
  id: string;
  name: string;
  kind: MarkKind;
  /** Id of the value axis the series is measured against. */
  axis: string;
  color: string;
  dashed: boolean;
  format: ValueFormatter;
  data: ReadonlyArray<number | null>;
  from?: ReadonlyArray<number | null>;
  stackGroup?: string;
  pointColors?: ReadonlyArray<string | undefined>;
  pattern?: ChartPattern;
}

export interface BarGeometry {
  key: string;
  index: number;
  d: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The value end of the bar points down (vertical) or left (horizontal) on screen. */
  negative: boolean;
  /** Own color of this bar (series `pointColors`). */
  color?: string;
}

export interface LabelGeometry {
  key: string;
  x: number;
  y: number;
  text: string;
  anchor: "start" | "middle" | "end";
  /** Drawn on top of a bar fill rather than next to it. */
  inside: boolean;
}

export interface SeriesGeometry {
  id: string;
  kind: MarkKind;
  color: string;
  dashed: boolean;
  pattern?: ChartPattern;
  /** Value end of the mark at each index (null for gaps); anchors markers and tooltips. */
  points: Array<Point | null>;
  line?: string;
  area?: string;
  bars?: BarGeometry[];
  labels: LabelGeometry[];
}

interface AnnotationBaseGeometry {
  key: string;
  label?: string;
  tooltip?: string;
  tone: ChartTone;
}

export interface AnnotationSpanGeometry extends AnnotationBaseGeometry {
  kind: "line" | "range";
  /** Screen direction of the line (or the long side of the range). */
  direction: "horizontal" | "vertical";
  from: number;
  to: number;
}

/** A dot or text anchored at a pixel of the plot. */
export interface AnnotationMarkerGeometry extends AnnotationBaseGeometry {
  kind: "point" | "text";
  x: number;
  y: number;
}

export type AnnotationGeometry = AnnotationSpanGeometry | AnnotationMarkerGeometry;

/** A value axis ready to draw: its scale, ticks and where it hangs. */
export interface AxisGeometry {
  id: string;
  side: "left" | "right";
  scale: ContinuousScale;
  ticks: AxisTick[];
  /** Distance outward from the plot edge on its side (0 for the first axis of a side). */
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
  /** Center of each category along the category axis. */
  positions: number[];
  bandwidth: number;
  step: number;
  /** Category index nearest to a pixel on the category axis. */
  indexAt: (pixel: number) => number;
  valueScale: ContinuousScale;
  /** Scale of the first right-hand axis, if any. */
  rightScale: ContinuousScale | null;
  /** Every value axis in drawing order; the first is the primary one. */
  axes: AxisGeometry[];
  categoryTicks: AxisTick[];
  valueTicks: AxisTick[];
  /** Ticks of the first right-hand axis. */
  rightTicks: AxisTick[];
  /** Pixel of the zero value on the value axis, when inside the plot. */
  zero: number | null;
  layers: ReadonlyMap<string, StackLayer>;
  geometry: SeriesGeometry[];
  annotations: AnnotationGeometry[];
}

export interface LayoutInput {
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
  valueFormat?: ValueFormat;
  yAxis: ValueAxisOptions;
  rightAxis: ValueAxisOptions;
  /** More value axes; `yAxis` and `rightAxis` are the axes with id "left" and "right". */
  axes?: readonly CartesianAxisSpec[];
  /** Lower bound for the margins, to line this plot up with others (synced charts). */
  minMargin?: { left: number; right: number };
  annotations: readonly ChartAnnotation[];
  /** Reserve a row under the category axis for group labels. */
  categoryGroups?: boolean;
  /** Degrees to tilt the category labels (vertical charts). */
  labelRotation?: number;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** Default category label: Spanish short dates, grouped numbers, strings as given. */
export function defaultXLabel(value: XValue): string {
  if (value instanceof Date) return `${value.getDate()} ${shortMonth(value)}`;
  if (typeof value === "number") return formatNumber(value);
  return value;
}

function sameX(a: XValue, b: XValue): boolean {
  if (a instanceof Date || b instanceof Date) return +a === +b;
  return a === b;
}

function isStackable(series: ResolvedSeries, stack: StackMode): boolean {
  return stack !== "none" && series.kind !== "line" && !series.from;
}

/** Stacks areas and columns separately, per axis. */
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

function axisDomain(
  series: readonly ResolvedSeries[],
  layers: ReadonlyMap<string, StackLayer>,
  options: ValueAxisOptions,
  annotationValues: readonly number[],
): [number, number] {
  const values: number[] = [...annotationValues];
  for (const item of series) {
    const layer = layers.get(item.id);
    if (layer) {
      values.push(...layer.y0, ...layer.y1);
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
  if (options.min != null) lo = options.min;
  if (options.max != null) hi = options.max;
  return [lo, hi];
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

function valueTicks(scale: ContinuousScale, count: number, format: ValueFormatter): AxisTick[] {
  const [d0, d1] = scale.domain;
  return scale
    .ticks(count)
    .filter((value) => value >= Math.min(d0, d1) - 1e-9 && value <= Math.max(d0, d1) + 1e-9)
    .map((value) => ({ key: value, position: scale.map(value), label: format(value) }));
}

function widestLabel(ticks: readonly AxisTick[]): number {
  return ticks.reduce((max, tick) => Math.max(max, estimateTextWidth(tick.label)), 0);
}

/**
 * Computes every pixel of a cartesian chart: margins, scales, ticks, paths,
 * bars, labels and annotations. Pure, so it is memoised by the component and
 * hover never recomputes it.
 */
export function computeLayout(input: LayoutInput): CartesianLayout {
  const { width, height, categories, series, orientation, stack, curve, dataLabels } = input;
  const horizontal = orientation === "horizontal";
  const count = categories.length;
  const hasColumns = series.some((item) => item.kind === "column");
  const percent = stack === "percent";

  const layers = buildLayers(series, stack);
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
    input.annotations.flatMap((note) => {
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
          Math.max(0, ...categoryLabels.map((label) => estimateTextWidth(label))) *
            Math.abs(Math.sin((rotation * Math.PI) / 180)),
        ),
      )
    : 0;
  const top =
    8 +
    (dataLabels && !horizontal ? 12 : 0) +
    (axisSpecs.some((axis) => axis.options.title) ? 16 : 0);
  const bottom = 26 + rotationExtra + (input.categoryGroups && !horizontal ? 24 : 0);
  const innerHeightGuess = Math.max(40, height - top - bottom);

  const percentAxis = (axisSeries: readonly ResolvedSeries[]) =>
    percent && axisSeries.length > 0 && axisSeries.every((item) => isStackable(item, stack));
  const axisInfo = axisSpecs.map((spec) => {
    const own = series.filter((item) => axisOf(item.axis) === spec.id);
    return {
      spec,
      domain: axisDomain(own, layers, spec.options, yAnnotations(spec.id)),
      format: resolveAxisFormat(
        spec.options.format ?? (percentAxis(own) ? "percent" : input.valueFormat),
      ),
    };
  });

  // The last x label is centred on its tick: only reserve what overhangs the plot.
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
    const widestCategory = Math.max(
      0,
      ...categoryLabels.map((label) => estimateTextWidth(label, 12)),
    );
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
  if (input.minMargin) {
    margin = {
      ...margin,
      left: Math.max(margin.left, input.minMargin.left),
      right: Math.max(margin.right, input.minMargin.right),
    };
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
  const firstRight = axes.find((axis) => axis.side === "right");

  // Category axis.
  const useTime =
    !horizontal &&
    !hasColumns &&
    count > 1 &&
    input.xScale !== "band" &&
    categories.every((value) => value instanceof Date) &&
    (input.xScale === "time" || input.xScale === "auto");
  const columns = series.filter((item) => item.kind === "column");
  // Stackable columns of one group share a slot; every other column takes its own.
  const slotKeys: string[] = [];
  const slotKeyOf = (item: ResolvedSeries) =>
    isStackable(item, stack) ? `g:${item.axis}:${item.stackGroup ?? ""}` : `s:${item.id}`;
  for (const item of columns) {
    const key = slotKeyOf(item);
    if (!slotKeys.includes(key)) slotKeys.push(key);
  }
  const multi = slotKeys.length > 1;
  const band =
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
    const time = timeScale({
      domain: [Math.min(...times), Math.max(...times)],
      range: categoryRange,
    });
    positions = times.map((value) => time.map(value));
    categoryTicks = time
      .timeTicks(clamp(Math.floor(innerWidth / 84), 2, 12))
      .map((tick) => ({ key: tick.value, position: time.map(tick.value), label: tick.label }));
    indexAt = (pixel) => {
      let best = 0;
      for (let i = 1; i < positions.length; i += 1) {
        if (
          Math.abs((positions[i] as number) - pixel) < Math.abs((positions[best] as number) - pixel)
        ) {
          best = i;
        }
      }
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
    categoryTicks = horizontal
      ? ticks
      : rotation
        ? ticks.filter((_, index) => index % Math.max(1, Math.ceil(14 / band.step)) === 0)
        : thinTicks(ticks, 12);
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

  // Marks.
  const groupCount = Math.max(1, slotKeys.length);
  const anyStacked = columns.some((item) => isStackable(item, stack));
  const bandwidth = band.bandwidth;
  const gap = groupCount > 1 ? clamp(bandwidth * 0.08, 2, 6) : 0;
  const barThickness =
    groupCount === 1
      ? Math.min(bandwidth, anyStacked ? 64 : 48)
      : Math.min((bandwidth - gap * (groupCount - 1)) / groupCount, 48);
  const groupWidth = barThickness * groupCount + gap * (groupCount - 1);
  // Last layer that moves each side of a pile, so only the outer bar gets rounded.
  const outer = new Map<string, { up?: string; down?: string }>();
  for (const item of columns) {
    const layer = layers.get(item.id);
    if (!layer) continue;
    const slotKey = slotKeyOf(item);
    layer.y1.forEach((end, index) => {
      const start = layer.y0[index] as number;
      if (end === start) return;
      const entry = outer.get(`${slotKey}:${index}`) ?? {};
      if (end > start) entry.up = item.id;
      else entry.down = item.id;
      outer.set(`${slotKey}:${index}`, entry);
    });
  }
  const pixelSign = (reversed: boolean | undefined) => (horizontal ? 1 : -1) * (reversed ? -1 : 1);

  const labelEvery = (spacing: number) => Math.max(1, Math.ceil(34 / Math.max(1, spacing)));
  const geometry: SeriesGeometry[] = series.map((item) => {
    const scale = scaleOf(item.axis);
    const layer = layers.get(item.id);
    const startOf = (index: number) => layer?.y0[index] ?? item.from?.[index] ?? 0;
    const endOf = (index: number) => (layer ? (layer.y1[index] as number) : item.data[index]);
    const base: SeriesGeometry = {
      id: item.id,
      kind: item.kind,
      color: item.color,
      dashed: item.dashed,
      pattern: item.pattern,
      points: [],
      labels: [],
    };

    if (item.kind === "column") {
      const slotKey = slotKeyOf(item);
      const slot = slotKeys.indexOf(slotKey);
      const stacked = isStackable(item, stack);
      const floating = item.from != null;
      const pixelDir = pixelSign(
        item.axis === "right"
          ? (input.rightAxis.reversed ?? input.yAxis.reversed)
          : input.yAxis.reversed,
      );
      const bars: BarGeometry[] = [];
      const radius = Math.min(input.barRadius, barThickness / 2);
      item.data.forEach((raw, index) => {
        if (raw == null || (floating && item.from?.[index] == null)) {
          base.points.push(null);
          return;
        }
        const startValue = startOf(index);
        const endValue = endOf(index) as number;
        const v0 = scale.map(startValue);
        const v1 = scale.map(endValue);
        const valueDown = endValue < startValue;
        // Which way the value end lies from the start on screen: +1 right/down, -1 left/up.
        const dir = (valueDown ? -1 : 1) * pixelDir;
        const negative = horizontal ? dir < 0 : dir > 0;
        const along =
          band.start(index) + (bandwidth - groupWidth) / 2 + slot * (barThickness + gap);
        const isOuter =
          !stacked || outer.get(`${slotKey}:${index}`)?.[valueDown ? "down" : "up"] === item.id;
        const inset = stacked && startValue !== 0 ? 1.5 : 0;
        let length = Math.abs(v1 - v0);
        if (raw !== 0 && length < 1) length = 1;
        // Start edge on the screen axis, then pulled in by the inset between stacked layers.
        let lo = dir > 0 ? v0 : v0 - length;
        if (dir > 0) lo += inset;
        length = Math.max(0, length - inset);
        let end: BarEnd = "none";
        if (floating) end = "all";
        else if (isOuter) {
          end = horizontal ? (dir > 0 ? "right" : "left") : dir > 0 ? "bottom" : "top";
        }
        const color = item.pointColors?.[index];
        if (horizontal) {
          bars.push({
            key: `${item.id}-${index}`,
            index,
            x: lo,
            y: along,
            width: length,
            height: barThickness,
            negative,
            color,
            d: barPath(lo, along, length, barThickness, radius, end),
          });
          base.points.push({ x: dir > 0 ? lo + length : lo, y: along + barThickness / 2 });
        } else {
          bars.push({
            key: `${item.id}-${index}`,
            index,
            x: along,
            y: lo,
            width: barThickness,
            height: length,
            negative,
            color,
            d: barPath(along, lo, barThickness, length, radius, end),
          });
          base.points.push({ x: along + barThickness / 2, y: dir > 0 ? lo + length : lo });
        }
      });
      base.bars = bars;
      if (dataLabels) {
        for (const bar of bars) {
          const text = item.format(item.data[bar.index] as number);
          if (stacked) {
            const room = horizontal ? bar.width : bar.height;
            const fits = horizontal
              ? room >= estimateTextWidth(text, 10.5) + 8 && bar.height >= 14
              : room >= 16 && bar.width >= estimateTextWidth(text, 10.5) + 4;
            if (!fits) continue;
            base.labels.push({
              key: bar.key,
              x: bar.x + bar.width / 2,
              y: bar.y + bar.height / 2 + 3.5,
              text,
              anchor: "middle",
              inside: true,
            });
          } else if (horizontal) {
            base.labels.push({
              key: bar.key,
              x: bar.negative ? bar.x - 6 : bar.x + bar.width + 6,
              y: bar.y + bar.height / 2 + 3.5,
              text,
              anchor: bar.negative ? "end" : "start",
              inside: false,
            });
          } else {
            if (bar.width + gap < estimateTextWidth(text, 10.5) && groupCount > 1) continue;
            const outside = bar.negative ? bar.y + bar.height + 13 : bar.y - 6;
            // No room past the bar end (it touches the plot edge): print inside it.
            const inside = bar.negative ? outside > innerHeight - 2 : outside < 8;
            base.labels.push({
              key: bar.key,
              x: bar.x + bar.width / 2,
              y: inside ? (bar.negative ? bar.y + bar.height - 6 : bar.y + 14) : outside,
              text,
              anchor: "middle",
              inside: inside && bar.height >= 18,
            });
          }
        }
      }
      return base;
    }

    const points: Array<Point | null> = item.data.map((raw, index) => {
      const value = endOf(index);
      if (raw == null || value == null) return null;
      return { x: positions[index] as number, y: scale.map(value) };
    });
    base.points = points;
    base.line = linePath(points, curve);
    if (item.kind === "area") {
      const baseline = zeroPixel(scale);
      const bottomEdge = points.map((point, index) => ({
        x: point?.x ?? (positions[index] as number),
        y: layer ? scale.map(startOf(index)) : baseline,
      }));
      base.area = areaPath(points, bottomEdge, curve);
    }
    if (dataLabels) {
      const spacing = count > 1 ? innerWidth / (count - 1) : innerWidth;
      const every = labelEvery(spacing);
      points.forEach((point, index) => {
        if (!point || index % every !== 0) return;
        base.labels.push({
          key: `${item.id}-${index}`,
          x: point.x,
          y: point.y - 10,
          text: item.format(item.data[index] as number),
          anchor: "middle",
          inside: false,
        });
      });
    }
    return base;
  });

  // Annotations.
  const annotations: AnnotationGeometry[] = [];
  const valueLength = horizontal ? innerWidth : innerHeight;
  const categoryLength = horizontal ? innerHeight : innerWidth;
  const categoryPixel = (value: XValue): number | null => {
    if (useTime) {
      const time = +value;
      const times = categories.map((item) => +item);
      const lo = Math.min(...times);
      const hi = Math.max(...times);
      if (time < lo || time > hi) return null;
      return ((time - lo) / (hi - lo || 1)) * categoryLength;
    }
    const index = categories.findIndex((item) => sameX(item, value));
    return index < 0 ? null : (positions[index] as number);
  };
  const halfSlot =
    mode === "band" ? band.step / 2 : count > 1 ? categoryLength / (count - 1) / 2 : 0;
  input.annotations.forEach((note, index) => {
    const tone = note.tone ?? "neutral";
    const key = `note-${index}`;
    if (note.type === "point" || note.type === "text") {
      const along = categoryPixel(note.x);
      const scale = scaleOf(note.yAxis ?? primaryId);
      const across = scale.map(note.y);
      if (along == null || across < -0.5 || across > valueLength + 0.5) return;
      annotations.push({
        key,
        kind: note.type,
        x: horizontal ? across : along,
        y: horizontal ? along : across,
        label: note.label,
        tooltip: note.tooltip,
        tone,
      });
      return;
    }
    if (note.axis === "y") {
      const scale = scaleOf(note.yAxis ?? primaryId);
      const direction = horizontal ? "vertical" : "horizontal";
      if (note.type === "line") {
        const at = scale.map(note.value);
        if (at < -0.5 || at > valueLength + 0.5) return;
        annotations.push({
          key,
          kind: "line",
          direction,
          from: at,
          to: at,
          label: note.label,
          tone,
        });
      } else {
        const a = clamp(scale.map(note.from), 0, valueLength);
        const b = clamp(scale.map(note.to), 0, valueLength);
        if (a === b) return;
        annotations.push({
          key,
          kind: "range",
          direction,
          from: Math.min(a, b),
          to: Math.max(a, b),
          label: note.label,
          tone,
        });
      }
      return;
    }
    const direction = horizontal ? "horizontal" : "vertical";
    if (note.type === "line") {
      const at = categoryPixel(note.value);
      if (at == null) return;
      annotations.push({ key, kind: "line", direction, from: at, to: at, label: note.label, tone });
    } else {
      const a = categoryPixel(note.from);
      const b = categoryPixel(note.to);
      if (a == null || b == null) return;
      annotations.push({
        key,
        kind: "range",
        direction,
        from: clamp(Math.min(a, b) - halfSlot, 0, categoryLength),
        to: clamp(Math.max(a, b) + halfSlot, 0, categoryLength),
        label: note.label,
        tone,
      });
    }
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
    rightScale: firstRight?.scale ?? null,
    axes,
    categoryTicks,
    valueTicks: (axes[0] as AxisGeometry).ticks,
    rightTicks: firstRight?.ticks ?? [],
    zero: zeroInside ? valueScale.map(0) : null,
    layers,
    geometry,
    annotations,
  };
}
