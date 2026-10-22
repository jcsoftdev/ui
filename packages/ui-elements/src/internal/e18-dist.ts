// Shared by the distribution charts (box plot, violin, raincloud): series with colors and formats,
// the category axes, the box glyph, observation dots, and the statistics rows of tooltip, key-board
// text and data table. Charts import this file, never each other's entry.

import type { BoxStats, CategoryLayout } from "@jcsoftdev/ui-core/chart/distribution";
import {
  resolveFormat,
  type ValueFormat,
  type ValueFormatter,
} from "@jcsoftdev/ui-core/chart/format";
import type { ChartElement, ChartSnapshot, DrawContext } from "./chart-base.js";
import { svg } from "./chart-dom.js";
import { axisBottom, axisLeft, gridLines, text } from "./e18-plot.js";

/** Samples per category for one series: `data[i]` holds the raw values of `categories[i]`. */
export interface DistributionSeries {
  id: string;
  name: string;
  data: ReadonlyArray<ReadonlyArray<number | null>>;
  /** CSS color; defaults to the palette slot of the series. */
  color?: string;
  /** Overrides the chart `value-format` for this series. */
  format?: ValueFormat;
}

/** Statistic names shown in tooltips and the data table. English defaults. */
export interface StatLabels {
  count: string;
  min: string;
  q1: string;
  median: string;
  q3: string;
  max: string;
  mean: string;
  outliers: string;
  category: string;
}

/** Samples above which a chart paints its dots on the canvas layer instead of SVG circles. */
export const CANVAS_AT = 5000;

export const DEFAULT_STAT_LABELS: StatLabels = {
  count: "n",
  min: "Min",
  q1: "Q1",
  median: "Median",
  q3: "Q3",
  max: "Max",
  mean: "Mean",
  outliers: "Outliers",
  category: "Category",
};

export type PointColoring = "series" | "value";

/** A series with its resolved color and its position in the original list (palette slot). */
export interface ColoredSeries {
  source: DistributionSeries;
  id: string;
  name: string;
  color: string;
  index: number;
}

export const colorSeries = (
  ctx: Pick<DrawContext, "color">,
  series: readonly DistributionSeries[],
): ColoredSeries[] =>
  series.map((item, index) => ({
    source: item,
    id: item.id,
    name: item.name,
    color: ctx.color(index, item.color),
    index,
  }));

/** Formatter of a series: its own `format`, else the chart's. */
export function seriesFormat(
  host: HTMLElement,
  ctx: Pick<DrawContext, "format" | "locale">,
  item: ColoredSeries,
): ValueFormatter {
  return item.source.format
    ? resolveFormat(item.source.format, {
        locale: ctx.locale,
        currency: host.getAttribute("currency") || undefined,
      })
    : ctx.format;
}

/** Name of one box, violin or cloud: `Category · Series` when there are several series. */
export const groupName = (category: string, series: ColoredSeries, seriesCount: number): string =>
  seriesCount > 1 ? `${category} · ${series.name}` : category;

/** Gridlines along the value axis plus both axes of a `categoryLayout`. */
export function categoryAxes(
  layout: CategoryLayout,
  { title, grid = true }: { title?: string | boolean; grid?: boolean },
): SVGGElement {
  const { horizontal, innerWidth, innerHeight, valueTicks, categoryTicks } = layout;
  const group = svg("g");
  const heading = typeof title === "string" && title ? title : undefined;
  if (grid)
    group.append(
      gridLines(
        valueTicks,
        horizontal ? "vertical" : "horizontal",
        horizontal ? innerHeight : innerWidth,
      ),
    );
  if (horizontal) {
    const labels = svg("g", { "aria-hidden": "true" });
    for (const tick of categoryTicks)
      labels.append(
        text(
          tick.label,
          { x: -12, y: tick.position, dy: "0.34em", "text-anchor": "end" },
          "fill:var(--ink-2);font-size:12px;font-weight:600",
        ),
      );
    group.append(labels, axisBottom(valueTicks, innerHeight));
    if (heading)
      group.append(
        text(
          heading,
          { x: innerWidth, y: -10, "text-anchor": "end" },
          "fill:var(--ink-3);font-size:10.5px;font-weight:700",
        ),
      );
  } else group.append(axisLeft(valueTicks, 0, heading), axisBottom(categoryTicks, innerHeight));
  group.append(
    svg("line", {
      x1: 0,
      x2: horizontal ? 0 : innerWidth,
      y1: horizontal ? 0 : innerHeight,
      y2: innerHeight,
      "shape-rendering": "crispEdges",
      "aria-hidden": "true",
      style: "stroke:var(--line-strong)",
    }),
  );
  return group;
}

export interface BoxGlyphOptions {
  stats: BoxStats;
  /** Value to pixel along the value axis. */
  map: (value: number) => number;
  /** Pixel of the box axis on the cross axis. */
  center: number;
  /** Box thickness in pixels. */
  size: number;
  horizontal: boolean;
  color: string;
  /** "box": soft fill and colored outline. "inner": slim dark box for violins and rainclouds. */
  variant?: "box" | "inner";
  showMean?: boolean;
  showOutliers?: boolean;
}

/** One box-and-whisker: IQR box, median, whiskers with caps, optional mean diamond and outliers. */
export function boxGlyph({
  stats,
  map,
  center,
  size,
  horizontal,
  color,
  variant = "box",
  showMean = true,
  showOutliers = true,
}: BoxGlyphOptions): SVGGElement {
  const inner = variant === "inner";
  const half = size / 2;
  const q1 = map(stats.q1);
  const q3 = map(stats.q3);
  const lo = map(stats.lowerWhisker);
  const hi = map(stats.upperWhisker);
  const median = map(stats.median);
  const start = Math.min(q1, q3);
  const length = Math.max(1, Math.abs(q3 - q1));
  const cap = inner ? 0 : Math.min(half * 0.55, 14);
  const ink = inner ? "var(--ink-2)" : color;
  const line = (
    v0: number,
    c0: number,
    v1: number,
    c1: number,
    extra: Record<string, string | number> = {},
  ) =>
    svg("line", {
      ...(horizontal ? { x1: v0, y1: c0, x2: v1, y2: c1 } : { x1: c0, y1: v0, x2: c1, y2: v1 }),
      "stroke-width": 1.5,
      ...extra,
      style: `stroke:${ink}`,
    });
  const g = svg("g", { "data-box": "", "aria-hidden": "true" });
  g.append(line(lo, center, start, center), line(start + length, center, hi, center));
  if (cap > 0)
    g.append(
      line(lo, center - cap, lo, center + cap, { "stroke-linecap": "round" }),
      line(hi, center - cap, hi, center + cap, { "stroke-linecap": "round" }),
    );
  g.append(
    svg("rect", {
      x: horizontal ? start : center - half,
      y: horizontal ? center - half : start,
      width: horizontal ? length : size,
      height: horizontal ? size : length,
      rx: inner ? Math.min(2, half) : Math.min(6, half / 2),
      "stroke-width": inner ? 0 : 1.5,
      style: inner ? "fill:var(--ink-2)" : `fill:${color};fill-opacity:.18;stroke:${color}`,
    }),
  );
  if (inner)
    g.append(
      svg("circle", {
        cx: horizontal ? median : center,
        cy: horizontal ? center : median,
        r: Math.max(2, Math.min(3.2, half * 0.9)),
        style: "fill:var(--surface)",
      }),
    );
  else
    g.append(
      line(median, center - half, median, center + half, {
        "stroke-width": 2.5,
        "stroke-linecap": "round",
      }),
    );
  const diamond = inner ? 0 : Math.max(3.5, Math.min(5, half * 0.3));
  if (showMean && diamond > 0) {
    const mean = map(stats.mean);
    g.append(
      svg("path", {
        d: horizontal
          ? `M${mean},${center - diamond}L${mean + diamond},${center}L${mean},${center + diamond}L${mean - diamond},${center}Z`
          : `M${center},${mean - diamond}L${center + diamond},${mean}L${center},${mean + diamond}L${center - diamond},${mean}Z`,
        "stroke-width": 1.5,
        style: `fill:var(--surface);stroke:${color}`,
      }),
    );
  }
  if (showOutliers)
    for (const value of stats.outliers) {
      const at = map(value);
      g.append(
        svg("circle", {
          cx: horizontal ? at : center,
          cy: horizontal ? center : at,
          r: 3.25,
          "stroke-width": 1.5,
          style: `fill:var(--surface);stroke:${inner ? "var(--ink-2)" : color}`,
        }),
      );
    }
  return g;
}

/** One-line summary of a box: the accessible name of its mark. */
export function boxValueText(
  name: string,
  stats: BoxStats,
  labels: StatLabels,
  format: ValueFormatter,
): string {
  return `${name}: ${labels.median} ${format(stats.median)}, ${labels.q1} ${format(stats.q1)}, ${labels.q3} ${format(stats.q3)}, ${labels.min} ${format(stats.min)}, ${labels.max} ${format(stats.max)}, ${labels.mean} ${format(stats.mean)}, ${labels.count} ${stats.count}${stats.outliers.length ? `, ${labels.outliers} ${stats.outliers.length}` : ""}`;
}

/** The `statLabels` property of the chart over the English defaults. */
export const statLabelsOf = (
  host: ChartElement & { statLabels?: Partial<StatLabels> },
): StatLabels => ({
  ...DEFAULT_STAT_LABELS,
  ...host.statLabels,
});

/** Min and max a set of statistics reaches; `null` when there are none. */
export function extentOf(values: Iterable<[number, number]>): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const [a, b] of values) {
    if (a < lo) lo = a;
    if (b > hi) hi = b;
  }
  return Number.isFinite(lo) ? [lo, hi] : null;
}

/** A module fetched on demand: `get()` is its value once it has arrived. */
interface Chunk<T> {
  get(): T | undefined;
  load(): Promise<unknown>;
}

function chunk<T>(load: () => Promise<T>): Chunk<T> {
  let value: T | undefined;
  let pending: Promise<unknown> | undefined;
  return { get: () => value, load: () => (pending ??= load().then((m) => (value = m))) };
}

/** Tooltip rows and the data table snapshot: only needed on hover, focus and table reads. */
export const textChunk = /* @__PURE__ */ chunk(() => import("./e18-dist-text.js"));
/** Observation dots, canvas painting and `colorResolver`: only needed above `CANVAS_AT` or with `show-points`. */
export const dotsChunk = /* @__PURE__ */ chunk(() => import("./e18-dist-dots.js"));
/** The sequential color scale: only needed with `point-color="value"`. */
export const gradedChunk = /* @__PURE__ */ chunk(
  () => import("@jcsoftdev/ui-core/chart/color-scale"),
);

/** Fetches the chunks in the background and calls `ready` once they have arrived. */
export function loadThen(chunks: ReadonlyArray<Chunk<unknown>>, ready: () => void): void {
  const missing = chunks.filter((item) => item.get() === undefined);
  if (missing.length) Promise.all(missing.map((item) => item.load())).then(ready, () => {});
}

/** What the table and legend hold until the text chunk arrives: valid, with the legend only. */
export function emptySnapshot(
  title: string,
  legend: ReadonlyArray<{ id: string; name: string; color: string }>,
): ChartSnapshot {
  return {
    title,
    categoryHeader: "",
    categories: [],
    series: [],
    legend: legend.map((item) => ({ ...item, shape: "square" as const })),
  };
}
