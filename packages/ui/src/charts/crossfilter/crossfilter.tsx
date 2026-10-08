"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../../utils/cn.js";
import { BarChart } from "../bar-chart/bar-chart.js";
import type { CartesianChartProps } from "../core/cartesian/types.js";
import { type BrushRect, rangesToRect, rectToRanges } from "../core/distribution/brush.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { ScatterChart } from "../scatter-chart/scatter-chart.js";
import {
  type Accessors,
  activeFilterCount,
  binRecords,
  binsInRange,
  type CrossfilterFilters,
  clearFilters,
  type DimensionValue,
  evenEdges,
  filterRecords,
  type Group,
  type GroupOptions,
  groupRecords,
  isSelected,
  NO_FILTERS,
  rangeOfBins,
  setRangeFilter,
  toggleValue,
} from "./crossfilter-engine.js";

export interface CrossfilterApi<T> {
  /** Every record, whatever the filters. */
  records: readonly T[];
  /** Records that pass every filter: feed this to a table or a DataGrid. */
  filtered: readonly T[];
  total: number;
  filters: CrossfilterFilters;
  /** Number of dimensions that currently filter. */
  activeCount: number;
  toggle: (dimension: string, value: DimensionValue) => void;
  setRange: (dimension: string, range: readonly [number, number] | null) => void;
  clear: (dimension?: string) => void;
  /** Groups of `dimension` over the records that pass every OTHER filter. */
  group: (dimension: string, options?: GroupOptions<T>) => Group[];
  /** Totals per group with no filter at all, to compare against. */
  groupAll: (dimension: string, options?: GroupOptions<T>) => Group[];
  /** Per-bin counts of a numeric dimension over the records that pass every OTHER filter. */
  bins: (dimension: string, edges: readonly number[]) => number[];
  binsAll: (dimension: string, edges: readonly number[]) => number[];
  /** Records that pass every filter except `dimension`'s own. */
  inContext: (dimension: string) => T[];
  accessors: Accessors<T>;
}

// biome-ignore lint/suspicious/noExplicitAny: the context holds the record type of whichever provider is above.
const Context = createContext<CrossfilterApi<any> | null>(null);

export interface CrossfilterProviderProps<T> {
  data: readonly T[];
  /** How to read each dimension from a record. Keep the object stable (module level or memoized). */
  dimensions: Accessors<T>;
  /** Filters when the page loads. */
  initialFilters?: CrossfilterFilters;
  children: ReactNode;
}

/**
 * Shares one dataset and its filters with every chart inside: each chart filters by brushing or
 * clicking, and every other chart (and any table fed from `useCrossfilter().filtered`) follows.
 */
export function CrossfilterProvider<T>({
  data,
  dimensions,
  initialFilters = NO_FILTERS,
  children,
}: CrossfilterProviderProps<T>) {
  const [filters, setFilters] = useState<CrossfilterFilters>(initialFilters);
  const filtered = useMemo(
    () => filterRecords(data, dimensions, filters),
    [data, dimensions, filters],
  );
  const toggle = useCallback(
    (dimension: string, value: DimensionValue) =>
      setFilters((current) => toggleValue(current, dimension, value)),
    [],
  );
  const setRange = useCallback(
    (dimension: string, range: readonly [number, number] | null) =>
      setFilters((current) => setRangeFilter(current, dimension, range)),
    [],
  );
  const clear = useCallback(
    (dimension?: string) => setFilters((current) => clearFilters(current, dimension)),
    [],
  );
  const api = useMemo<CrossfilterApi<T>>(
    () => ({
      records: data,
      filtered,
      total: data.length,
      filters,
      activeCount: activeFilterCount(filters),
      toggle,
      setRange,
      clear,
      group: (dimension, options) => groupRecords(data, dimensions, filters, dimension, options),
      groupAll: (dimension, options) =>
        groupRecords(data, dimensions, NO_FILTERS, dimension, options),
      bins: (dimension, edges) => binRecords(data, dimensions, filters, dimension, edges),
      binsAll: (dimension, edges) => binRecords(data, dimensions, NO_FILTERS, dimension, edges),
      inContext: (dimension) => filterRecords(data, dimensions, filters, dimension),
      accessors: dimensions,
    }),
    [data, dimensions, filtered, filters, toggle, setRange, clear],
  );
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

/** The shared dataset and filters of the nearest `CrossfilterProvider`. */
export function useCrossfilter<T = unknown>(): CrossfilterApi<T> {
  const api = useContext(Context);
  if (!api) throw new Error("useCrossfilter must be used inside a CrossfilterProvider");
  return api as CrossfilterApi<T>;
}

export interface CrossfilterLabels {
  /** Series of the unfiltered totals. */
  total: string;
  /** Series of what the other charts leave in. */
  filtered: string;
  /** "128 of 480" caption; receives both numbers. */
  count: (filtered: number, total: number) => string;
  clear: string;
  clearAll: string;
  /** Series of points the filters leave out (scatter). */
  excluded: string;
  /** Accessible name of the scatter's keyboard brush. */
  brush: string;
  /** Spoken range of a scatter brush, given the text of each axis range. */
  selection: (x: string, y: string) => string;
}

export const DEFAULT_CROSSFILTER_LABELS: CrossfilterLabels = {
  total: "Total",
  filtered: "Filtered",
  count: (filtered, total) => `${filtered} of ${total}`,
  clear: "Clear",
  clearAll: "Clear all filters",
  excluded: "Filtered out",
  brush:
    "Select a rectangle: arrows move it, Shift and arrows resize it, Enter applies, Escape clears",
  selection: (x, y) => `${x}; ${y}`,
};

const DIMMED = "color-mix(in oklab, var(--accent) 30%, transparent)";

function ChartHeader({
  title,
  dimension,
  records,
  labels,
}: {
  title: string;
  /** Dimension (or dimensions, for a 2D brush) this chart filters. */
  dimension: string | readonly string[];
  records: number;
  labels: CrossfilterLabels;
}) {
  const xf = useCrossfilter();
  const owned = typeof dimension === "string" ? [dimension] : dimension;
  const own = owned.some((id) => xf.filters[id] != null);
  return (
    <div className="mb-1 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 className="m-0 min-w-0 truncate font-bold text-[13px] text-ink">{title}</h3>
      <div className="flex shrink-0 items-center gap-2 font-semibold text-[12px] text-ink-3 tabular-nums">
        <span aria-live="polite">{labels.count(records, xf.total)}</span>
        {own ? (
          <button
            type="button"
            onClick={() => {
              for (const id of owned) xf.clear(id);
            }}
            className="cursor-pointer rounded-button border-0 bg-surface-2 px-2 py-0.5 font-semibold text-[11px] text-ink-2 hover:text-ink"
          >
            {labels.clear}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type PassThrough = Pick<
  CartesianChartProps,
  "height" | "aspectRatio" | "valueFormat" | "legend" | "animate" | "yAxis"
>;

export interface CrossfilterBarChartProps extends PassThrough {
  title: string;
  /** Dimension id (a key of the provider's `dimensions`). */
  dimension: string;
  /** Categories in display order; otherwise the order of first appearance. */
  keys?: readonly DimensionValue[];
  /** Text of a category on the axis. */
  keyLabel?: (key: DimensionValue) => string;
  /** Add this instead of counting records, e.g. `(sale) => sale.total` for revenue. */
  measure?: (record: never) => number;
  orientation?: "vertical" | "horizontal";
  labels?: Partial<CrossfilterLabels>;
  className?: string;
}

/**
 * Bars per category of one dimension. Click a bar to filter by it (click again to undo, several
 * bars add up). The light bars are the totals, the accent ones what the OTHER charts leave in;
 * categories outside this chart's own filter are dimmed.
 */
export function CrossfilterBarChart({
  title,
  dimension,
  keys,
  keyLabel = String,
  measure,
  orientation = "vertical",
  labels: labelsProp,
  className,
  ...chart
}: CrossfilterBarChartProps) {
  const xf = useCrossfilter();
  const labels = { ...DEFAULT_CROSSFILTER_LABELS, ...labelsProp };
  const options = { keys, value: measure } as GroupOptions<unknown>;
  const all = xf.groupAll(dimension, options);
  const inContext = xf.group(dimension, {
    ...options,
    keys: keys ?? all.map((group) => group.key),
  });
  const read = (group: Group) => (measure ? group.sum : group.count);
  const own = xf.filters[dimension];
  const shown = inContext.reduce((sum, group) => sum + group.count, 0);
  const selected = own ? xf.filtered.length : shown;
  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <ChartHeader title={title} dimension={dimension} records={selected} labels={labels} />
      <BarChart
        title={title}
        categories={inContext.map((group) => keyLabel(group.key))}
        orientation={orientation}
        series={[
          {
            id: "total",
            name: labels.total,
            color: "var(--line-strong)",
            data: inContext.map((group) =>
              read(all.find((item) => item.key === group.key) ?? group),
            ),
          },
          {
            id: "filtered",
            name: labels.filtered,
            color: "var(--accent)",
            data: inContext.map(read),
            colors: inContext.map((group) =>
              isSelected(xf.filters, dimension, group.key) ? undefined : DIMMED,
            ),
          },
        ]}
        onCategoryClick={(index) => {
          const group = inContext[index];
          if (group) xf.toggle(dimension, group.key);
        }}
        {...chart}
      />
    </figure>
  );
}

export interface CrossfilterHistogramProps extends PassThrough {
  title: string;
  /** Numeric dimension to bin. */
  dimension: string;
  /** Bin edges; or give `domain` and `bins` to split evenly. */
  edges?: readonly number[];
  domain?: readonly [number, number];
  bins?: number;
  /** Format of the bin edges in the axis and tooltip. */
  edgeFormat?: ValueFormat;
  labels?: Partial<CrossfilterLabels>;
  className?: string;
}

/**
 * Distribution of a numeric dimension. Drag across the bars to filter by that interval, or click a
 * bin; the band stays drawn until you click it again or press Clear.
 */
export function CrossfilterHistogram({
  title,
  dimension,
  edges: edgesProp,
  domain = [0, 100],
  bins = 10,
  edgeFormat,
  labels: labelsProp,
  className,
  ...chart
}: CrossfilterHistogramProps) {
  const xf = useCrossfilter();
  const labels = { ...DEFAULT_CROSSFILTER_LABELS, ...labelsProp };
  const edges = useMemo(
    () => edgesProp ?? evenEdges(domain[0], domain[1], bins),
    [edgesProp, domain, bins],
  );
  const format = resolveFormat(edgeFormat);
  const all = xf.binsAll(dimension, edges);
  const inContext = xf.bins(dimension, edges);
  const own = xf.filters[dimension];
  const band = own?.kind === "range" ? binsInRange(edges, own.min, own.max) : null;
  const inRange = band
    ? inContext.slice(band[0], band[1] + 1).reduce((sum, value) => sum + value, 0)
    : inContext.reduce((sum, value) => sum + value, 0);
  const records = own ? xf.filtered.length : inRange;
  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <ChartHeader title={title} dimension={dimension} records={records} labels={labels} />
      <BarChart
        title={title}
        categories={inContext.map((_, index) => format(edges[index] as number))}
        series={[
          { id: "total", name: labels.total, color: "var(--line-strong)", data: all },
          { id: "filtered", name: labels.filtered, color: "var(--accent)", data: inContext },
        ]}
        rangeSelect={{
          value: band,
          onChange: (range) =>
            xf.setRange(dimension, range ? rangeOfBins(edges, range[0], range[1]) : null),
        }}
        {...chart}
      />
    </figure>
  );
}

export interface CrossfilterScatterProps {
  title: string;
  /** Numeric dimensions on each axis. */
  x: string;
  y: string;
  xFormat?: ValueFormat;
  yFormat?: ValueFormat;
  /** Name of the point in tooltips, e.g. the client. */
  pointLabel?: (record: never) => string;
  /** Names of the axes in the spoken brush range; the dimension ids by default. */
  xLabel?: string;
  yLabel?: string;
  /** Rectangular brush on both dimensions (drag, or focus the plot and use the keys). On by default. */
  brush?: boolean;
  /** Pixels of deterministic spread for dimensions with few distinct values. */
  jitter?: number;
  height?: number | "fill";
  aspectRatio?: number;
  labels?: Partial<CrossfilterLabels>;
  className?: string;
}

/**
 * One dot per record: accent for the records every filter leaves in, faint for the rest, so the
 * dots you filtered out stay visible as context. Drag a rectangle to filter both dimensions at
 * once (a click clears it). From the keyboard, focus the brush after the plot: arrows move the
 * rectangle, Shift and arrows resize it, Enter applies it and Escape clears it.
 */
export function CrossfilterScatter({
  title,
  x,
  y,
  xFormat,
  yFormat,
  pointLabel,
  xLabel,
  yLabel,
  brush = true,
  labels: labelsProp,
  className,
  ...chart
}: CrossfilterScatterProps) {
  const xf = useCrossfilter();
  const labels = { ...DEFAULT_CROSSFILTER_LABELS, ...labelsProp };
  const accessX = xf.accessors[x];
  const accessY = xf.accessors[y];
  const kept = useMemo(() => new Set<unknown>(xf.filtered), [xf.filtered]);
  const series = useMemo(() => {
    if (!accessX || !accessY) return [];
    const point = (record: unknown) => ({
      x: Number(accessX(record)),
      y: Number(accessY(record)),
      label: pointLabel ? (pointLabel as (r: unknown) => string)(record) : undefined,
    });
    return [
      {
        id: "out",
        name: labels.excluded,
        color: "var(--line-strong)",
        points: xf.records.filter((record) => !kept.has(record)).map(point),
      },
      {
        id: "in",
        name: labels.filtered,
        color: "var(--accent)",
        points: xf.filtered.map(point),
      },
    ];
  }, [
    xf.records,
    xf.filtered,
    kept,
    accessX,
    accessY,
    pointLabel,
    labels.excluded,
    labels.filtered,
  ]);
  const fx = resolveFormat(xFormat);
  const fy = resolveFormat(yFormat);
  const rangeOf = (id: string) => {
    const filter = xf.filters[id];
    return filter?.kind === "range" ? ([filter.min, filter.max] as const) : null;
  };
  const brushProp = brush
    ? {
        value: rangesToRect(rangeOf(x), rangeOf(y)),
        onChange: (rect: BrushRect | null) => {
          const ranges = rect ? rectToRanges(rect) : { x: null, y: null };
          xf.setRange(x, ranges.x);
          xf.setRange(y, ranges.y);
        },
        label: labels.brush,
        describe: (rect: BrushRect) =>
          labels.selection(
            `${xLabel ?? x} ${fx(rect.x0)} – ${fx(rect.x1)}`,
            `${yLabel ?? y} ${fy(rect.y0)} – ${fy(rect.y1)}`,
          ),
      }
    : undefined;
  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <ChartHeader title={title} dimension={[x, y]} records={xf.filtered.length} labels={labels} />
      <ScatterChart
        title={title}
        series={series}
        brush={brushProp}
        xFormat={xFormat}
        yFormat={yFormat}
        radius={3.5}
        {...chart}
      />
    </figure>
  );
}

/** "128 of 480" plus a button that clears every filter. */
export function CrossfilterSummary({
  noun,
  labels: labelsProp,
  className,
}: {
  /** What the records are, e.g. "ventas". */
  noun: string;
  labels?: Partial<CrossfilterLabels>;
  className?: string;
}) {
  const xf = useCrossfilter();
  const labels = { ...DEFAULT_CROSSFILTER_LABELS, ...labelsProp };
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <p className="m-0 font-bold text-ink text-sm tabular-nums" aria-live="polite">
        {labels.count(xf.filtered.length, xf.total)} {noun}
      </p>
      {xf.activeCount > 0 ? (
        <button
          type="button"
          onClick={() => xf.clear()}
          className="cursor-pointer rounded-button border-0 bg-surface-2 px-3 py-1 font-semibold text-[12px] text-ink-2 hover:text-ink"
        >
          {labels.clearAll}
        </button>
      ) : null}
    </div>
  );
}
