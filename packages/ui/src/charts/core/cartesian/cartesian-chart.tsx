"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../../utils/cn.js";
import { AxisBottom, AxisLeft, AxisRight, GridLines } from "../axes.js";
import { ChartFrame } from "../chart-frame.js";
import { ChartDataTable } from "../data-table.js";
import { formatPercent, resolveFormat } from "../format.js";
import { ChartLegend, type LegendItem, type LegendShape } from "../legend.js";
import { EASE_OUT, fadeIn, revealClip, useEntryAnimation } from "../motion.js";
import { seriesColor } from "../palette.js";
import { formatDate } from "../scales/time.js";
import { ChartTooltip, type TooltipRow } from "../tooltip.js";
import { type ChartLabels, resolveLabels, type XValue } from "../types.js";
import { useSeriesState } from "../use-series-state.js";
import { AnnotationLayer } from "./annotations.js";
import { ChartBrush, type IndexRange } from "./brush.js";
import {
  type CartesianLayout,
  computeLayout,
  defaultXLabel,
  type ResolvedSeries,
} from "./layout.js";
import { BarMark, DataLabels, LineAreaMark } from "./marks.js";
import type { CartesianChartProps, MarkKind } from "./types.js";

const BRUSH_HEIGHT = 52;
const BRUSH_GAP = 12;

function legendShape(kind: MarkKind, dashed: boolean): LegendShape {
  if (kind === "line") return dashed ? "dashed" : "line";
  return "square";
}

function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

function titleOf(value: XValue, xLabel: (value: XValue) => string, custom: boolean): string {
  if (value instanceof Date && !custom) return formatDate(value);
  return xLabel(value);
}

/**
 * The cartesian engine. Line, area and column series share one plot, one
 * value axis (plus an optional right axis), the legend, tooltip, keyboard
 * exploration, annotations, entry animation and the zoom brush.
 * `LineChart`, `AreaChart`, `BarChart` and `ComboChart` are presets of it.
 */
export function CartesianChart({
  categories,
  series,
  title,
  description,
  height = 300,
  orientation = "vertical",
  stack = "none",
  curve = "linear",
  markers = false,
  dataLabels = false,
  gradient = true,
  barRadius = 6,
  valueFormat,
  xFormat,
  xScale = "auto",
  yAxis,
  rightAxis,
  grid = true,
  legend,
  tooltip = true,
  annotations,
  brush = false,
  loading = false,
  animate = true,
  initialHidden,
  labels: labelsProp,
  className,
}: CartesianChartProps) {
  const labels = resolveLabels(labelsProp);
  const state = useSeriesState(initialHidden);
  const [range, setRange] = useState<IndexRange | null>(null);
  const count = categories.length;
  const xLabel = xFormat ?? defaultXLabel;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new data length invalidates the zoom window.
  useEffect(() => setRange(null), [count]);

  const resolved = useMemo<ResolvedSeries[]>(
    () =>
      series.map((item, index) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        axis: item.axis ?? "left",
        color: seriesColor(index, item.color),
        dashed: item.dashed ?? false,
        format: resolveFormat(item.format ?? valueFormat),
        data: item.data,
      })),
    [series, valueFormat],
  );

  const empty = count === 0 || resolved.every((item) => item.data.every((value) => value == null));
  const legendPlacement =
    legend === false ? null : legend === true || legend == null ? "top" : legend;
  const showLegend = legendPlacement != null && (legend != null || series.length > 1);
  const brushOn = brush && count > 2 && orientation === "vertical";

  const legendItems: LegendItem[] = resolved.map((item) => ({
    id: item.id,
    name: item.name,
    color: item.color,
    shape: legendShape(item.kind, item.dashed),
    hidden: state.isHidden(item.id),
  }));

  const table = (
    <ChartDataTable
      caption={description ? `${title}. ${description}` : title}
      categoryHeader={labels.category}
      categories={categories.map((value) => titleOf(value, xLabel, xFormat != null))}
      columns={resolved.map((item) => ({
        id: item.id,
        name: item.name,
        values: item.data.map((value) => (value == null ? "" : item.format(value))),
      }))}
    />
  );

  return (
    <ChartFrame
      height={brushOn ? height + BRUSH_HEIGHT + BRUSH_GAP : height}
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton={series.some((item) => item.kind === "column") ? "bars" : "line"}
      legendPosition={legendPlacement ?? "top"}
      legend={
        showLegend ? (
          <ChartLegend
            items={legendItems}
            onToggle={state.toggle}
            onHighlight={state.setHighlighted}
          />
        ) : null
      }
      table={table}
      className={className}
    >
      {(width) => (
        <CartesianPlot
          width={width}
          height={height}
          categories={categories}
          resolved={resolved}
          hidden={state.hidden}
          highlighted={state.highlighted}
          range={range}
          onRangeChange={setRange}
          brush={brushOn}
          title={title}
          labels={labels}
          orientation={orientation}
          stack={stack}
          curve={curve}
          markers={markers}
          dataLabels={dataLabels}
          gradient={gradient}
          barRadius={barRadius}
          valueFormat={valueFormat}
          xLabel={xLabel}
          customXLabel={xFormat != null}
          xScale={xScale}
          yAxis={yAxis}
          rightAxis={rightAxis}
          grid={grid}
          tooltip={tooltip}
          annotations={annotations}
          animate={animate}
        />
      )}
    </ChartFrame>
  );
}

interface CartesianPlotProps
  extends Pick<
    CartesianChartProps,
    | "orientation"
    | "stack"
    | "curve"
    | "markers"
    | "dataLabels"
    | "gradient"
    | "barRadius"
    | "valueFormat"
    | "xScale"
    | "yAxis"
    | "rightAxis"
    | "grid"
    | "tooltip"
    | "annotations"
    | "animate"
  > {
  width: number;
  height: number;
  categories: readonly XValue[];
  resolved: readonly ResolvedSeries[];
  hidden: ReadonlySet<string>;
  highlighted: string | null;
  range: IndexRange | null;
  onRangeChange: (range: IndexRange | null) => void;
  brush: boolean;
  title: string;
  labels: ChartLabels;
  xLabel: (value: XValue) => string;
  customXLabel: boolean;
}

interface Pointer {
  x: number;
  y: number;
}

function CartesianPlot({
  width,
  height,
  categories,
  resolved,
  hidden,
  highlighted,
  range,
  onRangeChange,
  brush,
  title,
  labels,
  orientation = "vertical",
  stack = "none",
  curve = "linear",
  markers = false,
  dataLabels = false,
  gradient = true,
  barRadius = 6,
  valueFormat,
  xLabel,
  customXLabel,
  xScale = "auto",
  yAxis,
  rightAxis,
  grid = true,
  tooltip = true,
  annotations,
  animate = true,
}: CartesianPlotProps) {
  const uid = safeId(useId());
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null);
  const dragStart = useRef<number | null>(null);

  const total = categories.length;
  const start = range ? range[0] : 0;
  const end = range ? range[1] : total - 1;

  const visible = useMemo(
    () =>
      resolved
        .filter((item) => !hidden.has(item.id))
        .map((item) => (range ? { ...item, data: item.data.slice(start, end + 1) } : item)),
    [resolved, hidden, range, start, end],
  );
  const brushSeries = useMemo(
    () => resolved.filter((item) => !hidden.has(item.id)),
    [resolved, hidden],
  );
  const windowCategories = useMemo(
    () => (range ? categories.slice(start, end + 1) : categories),
    [categories, range, start, end],
  );

  const layout: CartesianLayout = useMemo(
    () =>
      computeLayout({
        width,
        height,
        categories: windowCategories,
        series: visible,
        orientation,
        stack,
        curve,
        dataLabels,
        barRadius,
        xScale,
        xLabel,
        valueFormat,
        yAxis: yAxis ?? {},
        rightAxis: rightAxis ?? {},
        annotations: annotations ?? [],
      }),
    [
      width,
      height,
      windowCategories,
      visible,
      orientation,
      stack,
      curve,
      dataLabels,
      barRadius,
      xScale,
      xLabel,
      valueFormat,
      yAxis,
      rightAxis,
      annotations,
    ],
  );

  const { margin, innerWidth, innerHeight, horizontal } = layout;
  const hasBars = layout.geometry.some((item) => item.kind === "column");
  const stackedAreas = stack !== "none";
  const count = windowCategories.length;

  // Keep the active index valid when zooming or toggling series.
  useEffect(() => {
    setActive((current) => (current != null && current >= count ? null : current));
  }, [count]);

  useEntryAnimation(
    svgRef,
    (root) => {
      const clip = root.querySelector("[data-reveal]");
      if (clip) revealClip(clip, 900);
      const bars = root.querySelectorAll("[data-bar]");
      const perBar = Math.min(28, 420 / Math.max(1, bars.length));
      bars.forEach((bar, index) => {
        bar.animate(
          [
            { transform: horizontal ? "scaleX(0)" : "scaleY(0)" },
            { transform: horizontal ? "scaleX(1)" : "scaleY(1)" },
          ],
          { duration: 620, delay: index * perBar, easing: EASE_OUT, fill: "backwards" },
        );
      });
      for (const label of root.querySelectorAll("[data-fade]")) fadeIn(label, 360, 650);
    },
    { disabled: !animate },
  );

  const valueDomain = layout.valueScale.domain;
  const baseline =
    hasBars && layout.valueScale.type !== "log" && valueDomain[0] <= 0 && valueDomain[1] >= 0
      ? layout.valueScale.map(0)
      : layout.zero;

  // Interaction ------------------------------------------------------------
  const along = (point: Pointer) => (horizontal ? point.y : point.x);
  const localPoint = (event: PointerEvent<HTMLDivElement>): Pointer => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!brush || event.pointerType === "touch" || event.button !== 0) return;
    dragStart.current = localPoint(event).x;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const point = localPoint(event);
    setPointer(point);
    setActive(layout.indexAt(along(point)));
    if (dragStart.current != null && Math.abs(point.x - dragStart.current) > 4) {
      const x = Math.min(Math.max(point.x, 0), innerWidth);
      setSelection({ from: Math.min(dragStart.current, x), to: Math.max(dragStart.current, x) });
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current != null && selection) {
      const lo = layout.indexAt(selection.from);
      const hi = layout.indexAt(selection.to);
      if (hi - lo >= 1) onRangeChange([start + lo, start + hi]);
    }
    dragStart.current = null;
    setSelection(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerLeave = () => {
    if (dragStart.current != null) return;
    setActive(null);
    setPointer(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = count - 1;
    let move: (current: number) => number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      move = (current) => Math.min(last, current + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      move = (current) => Math.max(0, current - 1);
    } else if (event.key === "Home") move = () => 0;
    else if (event.key === "End") move = () => last;
    else if (event.key === "Escape") {
      setActive(null);
      return;
    } else return;
    event.preventDefault();
    setPointer(null);
    // Functional update: fast key repeats never read a stale index.
    setActive((current) => move(current ?? -1));
  };

  // Tooltip content ----------------------------------------------------------
  const describe = useCallback(
    (index: number) => {
      const category = windowCategories[index] as XValue;
      const rows: TooltipRow[] = [];
      let sum = 0;
      let stackable = 0;
      for (const item of visible) {
        const raw = item.data[index];
        const layer = layout.layers.get(item.id);
        let note: string | undefined;
        if (layer && stack === "percent" && raw != null) {
          note = formatPercent((layer.y1[index] as number) - (layer.y0[index] as number));
        }
        if (layer && raw != null) {
          sum += raw;
          stackable += 1;
        }
        rows.push({
          id: item.id,
          name: item.name,
          value: raw == null ? "—" : item.format(raw),
          color: item.color,
          shape: legendShape(item.kind, item.dashed),
          note,
        });
      }
      if (stack === "normal" && stackable > 1) {
        const format = resolveFormat(valueFormat);
        rows.push({
          id: "__total",
          name: labels.total,
          value: format(sum),
          color: "transparent",
          emphasis: true,
        });
      }
      return { title: titleOf(category, xLabel, customXLabel), rows };
    },
    [windowCategories, visible, layout, stack, valueFormat, labels.total, xLabel, customXLabel],
  );

  const details = active != null && active < count ? describe(active) : null;
  const valueText = details
    ? `${details.title}: ${details.rows.map((row) => `${row.name} ${row.value}`).join(", ")}`
    : labels.explore;

  let anchor: Pointer | null = null;
  if (active != null && active < count) {
    const position = layout.positions[active] as number;
    const ends = layout.geometry
      .map((item) => item.points[active])
      .filter((point): point is NonNullable<typeof point> => point != null);
    if (horizontal) {
      const reach = ends.length ? Math.max(...ends.map((point) => point.x)) : innerWidth / 2;
      anchor = {
        x: margin.left + (pointer ? pointer.x : reach),
        y: margin.top + position,
      };
    } else {
      const highest = ends.length ? Math.min(...ends.map((point) => point.y)) : innerHeight / 2;
      const y = pointer && hasBars ? pointer.y : highest;
      anchor = {
        x: margin.left + position,
        y: margin.top + Math.min(Math.max(y, 28), innerHeight - 28),
      };
    }
  }

  const activePosition = active != null ? layout.positions[active] : undefined;
  const bandSize = layout.mode === "band" ? layout.step : 0;
  const gradientId = (seriesId: string) => `${uid}-g-${safeId(seriesId)}`;

  const rangeText = (from: number, to: number) =>
    `${titleOf(categories[from] as XValue, xLabel, customXLabel)} – ${titleOf(
      categories[to] as XValue,
      xLabel,
      customXLabel,
    )}`;

  return (
    <div className="relative" style={{ width }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <defs>
          <clipPath id={`${uid}-reveal`}>
            <rect
              data-reveal=""
              x={-6}
              y={-24}
              width={innerWidth + 12}
              height={innerHeight + 48}
              style={{ transformBox: "fill-box", transformOrigin: "left center" }}
            />
          </clipPath>
          {gradient
            ? layout.geometry
                .filter((item) => item.kind === "area")
                .map((item) => (
                  <linearGradient
                    key={item.id}
                    id={gradientId(item.id)}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      style={{ stopColor: item.color, stopOpacity: stackedAreas ? 0.55 : 0.36 }}
                    />
                    <stop
                      offset="100%"
                      style={{ stopColor: item.color, stopOpacity: stackedAreas ? 0.22 : 0.02 }}
                    />
                  </linearGradient>
                ))
            : null}
        </defs>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {grid ? (
            <GridLines
              ticks={layout.valueTicks}
              direction={horizontal ? "vertical" : "horizontal"}
              length={horizontal ? innerHeight : innerWidth}
            />
          ) : null}
          <AnnotationLayer
            annotations={layout.annotations}
            width={innerWidth}
            height={innerHeight}
            layer="under"
          />
          {activePosition != null && bandSize > 0 ? (
            <rect
              x={horizontal ? 0 : activePosition - bandSize / 2}
              y={horizontal ? activePosition - bandSize / 2 : 0}
              width={horizontal ? innerWidth : bandSize}
              height={horizontal ? bandSize : innerHeight}
              rx={8}
              style={{ fill: "var(--chart-grid)" }}
            />
          ) : null}
          <g clipPath={`url(#${uid}-reveal)`}>
            {layout.geometry.map((item) =>
              item.kind === "area" ? (
                <LineAreaMark
                  key={item.id}
                  geometry={item}
                  dimmed={highlighted != null && highlighted !== item.id}
                  gradientId={gradient ? gradientId(item.id) : undefined}
                  markers={markers && count <= Math.max(2, innerWidth / 9)}
                  stacked={stackedAreas}
                />
              ) : null,
            )}
          </g>
          {layout.geometry.map((item) =>
            item.kind === "column" ? (
              <BarMark
                key={item.id}
                geometry={item}
                horizontal={horizontal}
                dimmed={highlighted != null && highlighted !== item.id}
              />
            ) : null,
          )}
          <g clipPath={`url(#${uid}-reveal)`}>
            {layout.geometry.map((item) =>
              item.kind === "line" ? (
                <LineAreaMark
                  key={item.id}
                  geometry={item}
                  dimmed={highlighted != null && highlighted !== item.id}
                  markers={markers && count <= Math.max(2, innerWidth / 9)}
                  stacked={stackedAreas}
                />
              ) : null,
            )}
          </g>
          {baseline != null ? (
            <line
              x1={horizontal ? baseline : 0}
              x2={horizontal ? baseline : innerWidth}
              y1={horizontal ? 0 : baseline}
              y2={horizontal ? innerHeight : baseline}
              shapeRendering="crispEdges"
              style={{ stroke: "var(--line-strong)" }}
            />
          ) : null}
          {activePosition != null && bandSize === 0 ? (
            <line
              x1={0}
              x2={0}
              y1={0}
              y2={innerHeight}
              strokeDasharray="3 4"
              className="motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-out"
              style={{
                stroke: "var(--chart-crosshair)",
                transform: `translateX(${activePosition}px)`,
              }}
            />
          ) : null}
          <AnnotationLayer
            annotations={layout.annotations}
            width={innerWidth}
            height={innerHeight}
            layer="over"
          />
          {horizontal ? (
            <>
              <AxisLeft ticks={layout.categoryTicks} offset={0} />
              <AxisBottom ticks={layout.valueTicks} offset={innerHeight} />
            </>
          ) : (
            <>
              <AxisLeft ticks={layout.valueTicks} offset={0} title={yAxis?.title} />
              <AxisBottom ticks={layout.categoryTicks} offset={innerHeight} />
              {layout.rightScale ? (
                <AxisRight ticks={layout.rightTicks} offset={innerWidth} title={rightAxis?.title} />
              ) : null}
            </>
          )}
          {dataLabels
            ? layout.geometry.map((item) => (
                <DataLabels
                  key={item.id}
                  geometry={item}
                  dimmed={highlighted != null && highlighted !== item.id}
                />
              ))
            : null}
          {active != null
            ? layout.geometry.map((item) => {
                const point = item.points[active];
                if (!point || item.kind === "column") return null;
                return (
                  <circle
                    key={item.id}
                    cx={point.x}
                    cy={point.y}
                    r={5}
                    strokeWidth={2.5}
                    style={{ fill: item.color, stroke: "var(--surface)" }}
                  />
                );
              })
            : null}
          {selection ? (
            <rect
              x={selection.from}
              y={0}
              width={selection.to - selection.from}
              height={innerHeight}
              rx={6}
              strokeWidth={1}
              style={{ fill: "var(--accent)", fillOpacity: 0.14, stroke: "var(--accent-word)" }}
            />
          ) : null}
        </g>
      </svg>

      <div
        role="slider"
        tabIndex={0}
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, count)}
        aria-valuenow={(active ?? 0) + 1}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? 0)}
        onBlur={() => setActive(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        className={cn(
          "absolute rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4",
          brush ? "cursor-crosshair" : "cursor-default",
        )}
        style={{ left: margin.left, top: margin.top, width: innerWidth, height: innerHeight }}
      />

      {tooltip && details && anchor ? (
        <ChartTooltip
          x={anchor.x}
          y={anchor.y}
          containerWidth={width}
          title={details.title}
          rows={details.rows}
        />
      ) : null}

      {range ? (
        <button
          type="button"
          onClick={() => onRangeChange(null)}
          className="absolute top-0 right-0 inline-flex h-7 cursor-pointer items-center gap-1 rounded-pill border-0 bg-surface-2 px-3 font-semibold text-[12px] text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
            <path
              d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {labels.resetZoom}
        </button>
      ) : null}

      {brush ? (
        <ChartBrush
          className="mt-3"
          count={total}
          width={width}
          left={margin.left}
          right={margin.right}
          height={BRUSH_HEIGHT}
          series={brushSeries}
          range={range ?? [0, total - 1]}
          onChange={(next) => onRangeChange(next[0] === 0 && next[1] === total - 1 ? null : next)}
          label={labels.brush}
          valueText={rangeText(start, end)}
        />
      ) : null}
    </div>
  );
}
