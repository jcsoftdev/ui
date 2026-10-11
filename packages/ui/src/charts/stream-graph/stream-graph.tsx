"use client";

import { memo, useId, useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft, estimateTextWidth, GridLines } from "../core/axes.js";
import { buildCategoryAxis, fullCategoryLabel } from "../core/category-axis.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import {
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "../core/format.js";
import { ChartLegend } from "../core/legend.js";
import { fadeIn, revealClip, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { areaPath, type Curve, type Point } from "../core/path.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, type ChartSeries, resolveLabels, type XValue } from "../core/types.js";
import { useSeriesState } from "../core/use-series-state.js";
import { type StreamOffset, type StreamOrder, streamLayout } from "./stream-layout.js";

export interface StreamGraphProps {
  categories: readonly XValue[];
  series: readonly ChartSeries[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  /** Baseline: "wiggle" (default), "silhouette", "zero" (plain stack) or "expand" (100%). */
  offset?: StreamOffset;
  /** Stacking order; "inside-out" keeps the biggest streams in the middle. */
  order?: StreamOrder;
  curve?: Curve;
  /** Names written on the thickest part of each stream (default true). */
  streamLabels?: boolean;
  valueFormat?: ValueFormat;
  xFormat?: (value: XValue) => string;
  xScale?: "auto" | "point" | "time";
  grid?: boolean;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}

const MARGIN = { top: 10, right: 18, bottom: 30 };

interface Stream {
  series: ChartSeries;
  color: string;
  top: Point[];
  bottom: Point[];
  /** Index of the thickest section, for the inline label. */
  thickest: number;
  thickness: number;
}

const StreamShape = memo(function StreamShape({
  stream,
  curve,
  dimmed,
  selected,
}: {
  stream: Stream;
  curve: Curve;
  dimmed: boolean;
  selected: boolean;
}) {
  return (
    <path
      d={areaPath(stream.top, stream.bottom, curve)}
      strokeWidth={selected ? 1.5 : 0.75}
      strokeLinejoin="round"
      className="motion-safe:transition-[fill-opacity,stroke-opacity] motion-safe:duration-150"
      style={{
        fill: stream.color,
        fillOpacity: dimmed ? 0.22 : selected ? 1 : 0.88,
        stroke: "var(--surface)",
        strokeOpacity: dimmed ? 0.4 : 0.9,
      }}
    />
  );
});

/**
 * Flowing stacked areas around a moving baseline. Hover a stream to isolate it
 * (the others fade, the tooltip shows its value); with the keyboard, Left and
 * Right move through time and Up and Down switch stream.
 */
export function StreamGraph({
  categories,
  series,
  title,
  description,
  height = 340,
  aspectRatio,
  offset = "wiggle",
  order = "inside-out",
  curve = "smooth",
  streamLabels = true,
  valueFormat,
  xFormat,
  xScale = "auto",
  grid = true,
  legend,
  tooltip = true,
  loading,
  animate = true,
  initialHidden,
  labels: labelOverrides,
  className,
}: StreamGraphProps) {
  const labels = resolveLabels(labelOverrides);
  const state = useSeriesState(initialHidden);
  const colors = useMemo(() => series.map((item, i) => seriesColor(i, item.color)), [series]);
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const hasData = series.some((item) => item.data.some((value) => value != null && value > 0));
  const showLegend = legend ?? series.length > 1;

  const legendNode = showLegend ? (
    <ChartLegend
      items={series.map((item, i) => ({
        id: item.id,
        name: item.name,
        color: colors[i] as string,
        shape: "square",
        hidden: state.isHidden(item.id),
      }))}
      onToggle={state.toggle}
      onHighlight={state.setHighlighted}
    />
  ) : null;

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={!hasData}
      skeleton="line"
      legend={legendNode}
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={categories.map(fullCategoryLabel)}
          columns={series.map((item) => ({
            id: item.id,
            name: item.name,
            values: categories.map((_, i) => {
              const value = item.data[i];
              return value == null ? "" : (item.format ? resolveFormat(item.format) : fmt)(value);
            }),
          }))}
        />
      }
    >
      {(width, measuredHeight) => (
        <StreamPlot
          width={width}
          height={measuredHeight}
          categories={categories}
          series={series}
          colors={colors}
          hidden={state.hidden}
          highlighted={state.highlighted}
          offset={offset}
          order={order}
          curve={curve}
          streamLabels={streamLabels}
          fmt={fmt}
          valueFormat={valueFormat}
          xFormat={xFormat}
          xScale={xScale}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          title={title}
        />
      )}
    </ChartFrame>
  );
}

interface StreamPlotProps {
  width: number;
  height: number;
  categories: readonly XValue[];
  series: readonly ChartSeries[];
  colors: readonly string[];
  hidden: ReadonlySet<string>;
  highlighted: string | null;
  offset: StreamOffset;
  order: StreamOrder;
  curve: Curve;
  streamLabels: boolean;
  fmt: (value: number) => string;
  valueFormat?: ValueFormat;
  xFormat?: (value: XValue) => string;
  xScale: "auto" | "point" | "time";
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
  title: string;
}

function StreamPlot({
  width,
  height,
  categories,
  series,
  colors,
  hidden,
  highlighted,
  offset,
  order,
  curve,
  streamLabels,
  fmt,
  valueFormat,
  xFormat,
  xScale,
  grid,
  tooltip,
  animate,
  labels,
  title,
}: StreamPlotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pointed, setPointed] = useState<string | null>(null);
  const showAxis = offset === "zero" || offset === "expand";
  const left = showAxis ? 52 : 14;
  const innerWidth = Math.max(40, width - left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const visible = useMemo(() => series.filter((item) => !hidden.has(item.id)), [series, hidden]);
  const model = useMemo(() => {
    const layout = streamLayout(
      visible.map((item) => item.data),
      offset,
      order,
    );
    const axis = buildCategoryAxis(categories, innerWidth, {
      mode: xScale === "point" ? "point" : "time",
      format: xFormat,
    });
    const [lo, hi] = layout.domain;
    const pad = (hi - lo) * 0.04;
    const y = linearScale({
      domain: [lo - pad, hi + pad],
      range: [innerHeight, 0],
      nice: showAxis,
      tickCount: 5,
    });
    const streams: Stream[] = visible.map((item, k) => {
      const layer = layout.layers[k] as { y0: number[]; y1: number[] };
      const top = axis.positions.map((x, i) => ({ x, y: y.map(layer.y1[i] as number) }));
      const bottom = axis.positions.map((x, i) => ({ x, y: y.map(layer.y0[i] as number) }));
      let thickest = 0;
      let thickness = 0;
      top.forEach((point, i) => {
        const t = (bottom[i] as Point).y - point.y;
        if (t > thickness) {
          thickness = t;
          thickest = i;
        }
      });
      return {
        series: item,
        color: colors[series.indexOf(item)] as string,
        top,
        bottom,
        thickest,
        thickness,
      };
    });
    const axisFormat =
      offset === "expand"
        ? (v: number) => formatPercent(v, { decimals: 0 })
        : resolveAxisFormat(valueFormat);
    const yTicks = showAxis
      ? y.ticks().map((tick) => ({ key: tick, position: y.map(tick), label: axisFormat(tick) }))
      : [];
    // Visual order, top of the screen first: used by the tooltip and Up/Down.
    const topToBottom = layout.order.slice().reverse();
    return { layout, axis, y, streams, yTicks, topToBottom };
  }, [
    visible,
    offset,
    order,
    categories,
    innerWidth,
    innerHeight,
    xScale,
    xFormat,
    colors,
    series,
    showAxis,
    valueFormat,
  ]);

  const { layout, axis, y, streams, yTicks, topToBottom } = model;

  useEntryAnimation(
    svgRef,
    (root) => {
      const clip = root.querySelector("[data-reveal]");
      if (clip) revealClip(clip, 1000);
      for (const label of root.querySelectorAll("[data-fade]")) fadeIn(label, 420, 750);
    },
    { disabled: !animate },
  );

  const focusId = pointed ?? highlighted;
  const streamAt = (x: number, py: number): string | null => {
    const index = axis.indexAt(x);
    if (index < 0) return null;
    const value = y.invert(py);
    for (let k = 0; k < visible.length; k += 1) {
      const layer = layout.layers[k] as { y0: number[]; y1: number[] };
      if (value >= (layer.y0[index] as number) && value <= (layer.y1[index] as number)) {
        return (visible[k] as ChartSeries).id;
      }
    }
    return null;
  };

  const pick = (id: string | null, delta: number) => {
    const ids = topToBottom.map((k) => (visible[k] as ChartSeries).id);
    if (!ids.length) return null;
    if (id == null) return ids[delta > 0 ? 0 : ids.length - 1] as string;
    const next = ids.indexOf(id) + delta;
    return next < 0 || next >= ids.length ? null : (ids[next] as string);
  };

  const rows: TooltipRow[] =
    active != null
      ? topToBottom.map((k) => {
          const item = visible[k] as ChartSeries;
          const value = item.data[active] ?? 0;
          const f = item.format ? resolveFormat(item.format) : fmt;
          const total = layout.totals[active] as number;
          return {
            id: item.id,
            name: item.name,
            value: f(value),
            color: colors[series.indexOf(item)] as string,
            shape: "square" as const,
            note: total ? formatPercent(value / total, { decimals: 0 }) : undefined,
          };
        })
      : [];
  if (rows.length && active != null) {
    rows.push({
      id: "__total",
      name: labels.total,
      value: fmt(layout.totals[active] as number),
      color: "transparent",
      emphasis: true,
    });
  }

  const focusedItem = visible.find((item) => item.id === focusId);
  const valueText =
    active != null
      ? `${fullCategoryLabel(categories[active] as XValue)}. ${
          focusedItem
            ? `${focusedItem.name}: ${fmt(focusedItem.data[active] ?? 0)}.`
            : visible.map((item) => `${item.name}: ${fmt(item.data[active] ?? 0)}`).join(", ")
        }`
      : labels.explore;
  const activeX = active != null ? (axis.positions[active] as number) : null;
  const activeStream = streams.find((stream) => stream.series.id === focusId);
  const anchorY =
    active != null
      ? MARGIN.top +
        (activeStream
          ? ((activeStream.top[active] as Point).y + (activeStream.bottom[active] as Point).y) / 2
          : innerHeight / 2)
      : 0;

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
        </defs>
        <g transform={`translate(${left},${MARGIN.top})`}>
          {grid ? (
            <GridLines ticks={showAxis ? yTicks : []} direction="horizontal" length={innerWidth} />
          ) : null}
          {grid && !showAxis ? (
            <GridLines ticks={axis.ticks} direction="vertical" length={innerHeight} />
          ) : null}
          {showAxis ? <AxisLeft ticks={yTicks} offset={0} /> : null}
          <AxisBottom ticks={axis.ticks} offset={innerHeight} />
          <g clipPath={`url(#${uid}-reveal)`}>
            {streams.map((stream) => (
              <StreamShape
                key={stream.series.id}
                stream={stream}
                curve={curve}
                dimmed={focusId != null && focusId !== stream.series.id}
                selected={focusId === stream.series.id}
              />
            ))}
          </g>
          {streamLabels
            ? streams.map((stream) => {
                const text = stream.series.name;
                const need = estimateTextWidth(text, 12) + 8;
                if (stream.thickness < 17 || need > innerWidth * 0.5) return null;
                const x = Math.min(
                  innerWidth - need / 2,
                  Math.max(need / 2, stream.top[stream.thickest]?.x ?? 0),
                );
                const cy =
                  ((stream.top[stream.thickest] as Point).y +
                    (stream.bottom[stream.thickest] as Point).y) /
                  2;
                return (
                  <text
                    key={stream.series.id}
                    data-fade=""
                    x={x}
                    y={cy}
                    dy="0.34em"
                    textAnchor="middle"
                    className="pointer-events-none font-bold text-fs-120"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    style={{
                      fill: "var(--ink)",
                      stroke: "var(--surface)",
                      strokeOpacity: 0.85,
                      paintOrder: "stroke",
                      opacity: focusId != null && focusId !== stream.series.id ? 0.3 : 1,
                    }}
                  >
                    {text}
                  </text>
                );
              })
            : null}
          {activeX != null ? (
            <line
              x1={activeX}
              x2={activeX}
              y1={0}
              y2={innerHeight}
              strokeDasharray="3 4"
              style={{ stroke: "var(--chart-crosshair)" }}
            />
          ) : null}
        </g>
      </svg>
      <PlotOverlay
        left={left}
        top={MARGIN.top}
        width={innerWidth}
        height={innerHeight}
        label={labels.explore}
        count={categories.length}
        active={active}
        valueText={valueText}
        onActiveChange={(index) => {
          setActive(index);
          if (index == null) setPointed(null);
        }}
        indexAt={({ x, y: py }) => {
          setPointed(streamAt(x, py));
          return axis.indexAt(x);
        }}
        onKey={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false;
          setPointed(pick(pointed, event.key === "ArrowDown" ? 1 : -1));
          return true;
        }}
      />
      {tooltip && active != null && rows.length ? (
        <ChartTooltip
          x={left + (activeX as number)}
          y={anchorY}
          containerWidth={width}
          title={fullCategoryLabel(categories[active] as XValue)}
          rows={rows}
        />
      ) : null}
    </div>
  );
}
