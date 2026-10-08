"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../../utils/cn.js";
import { estimateTextWidth } from "../axes.js";
import { ChartFrame } from "../chart-frame.js";
import { ChartDataTable } from "../data-table.js";
import { formatNumber, resolveFormat, type ValueFormat } from "../format.js";
import { useEntryAnimation } from "../motion.js";
import { type ChartTone, TONE_COLORS } from "../palette.js";
import { ChartTooltip, type TooltipRow } from "../tooltip.js";
import { PlotExplorer } from "./explorer.js";
import { type DistributionLabels, resolveDistributionLabels } from "./labels.js";
import {
  type DistributionAxisOptions,
  nearestPoint,
  tooltipFit,
  truncateLabel,
  xyLayout,
} from "./layout.js";
import { XYAxes } from "./marks.js";
import { linearRegression, mean } from "./stats.js";
import { type ColoredSeries, useDistributionLegend } from "./use-legend.js";

export interface XYPoint {
  x: number;
  y: number;
  /** Bubble size (bubble charts): drives the area of the circle. */
  size?: number;
  /** Name in the tooltip, the data table and bubble labels, e.g. a barber. */
  label?: string;
}

export interface XYSeries {
  id: string;
  name: string;
  points: readonly XYPoint[];
  color?: string;
}

export type QuadrantCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export interface QuadrantOptions {
  /** Vertical divider; the mean of the visible x values by default. */
  x?: number;
  /** Horizontal divider; the mean of the visible y values by default. */
  y?: number;
  /** Corner captions, e.g. "Rápidos y caros". */
  labels?: Partial<Record<QuadrantCorner, string>>;
  /** Soft background per corner. */
  tones?: Partial<Record<QuadrantCorner, ChartTone>>;
}

export interface XYPointChartProps {
  title: string;
  series: readonly XYSeries[];
  xFormat?: ValueFormat;
  yFormat?: ValueFormat;
  sizeFormat?: ValueFormat;
  xAxis?: DistributionAxisOptions;
  yAxis?: DistributionAxisOptions;
  /** Least-squares line per series, drawn over its x range. */
  trendLine?: boolean;
  quadrants?: QuadrantOptions;
  /** Point radius when there are no sizes (pixels). */
  radius?: number;
  /** Bubble mode: radius from `size`, area-proportional, the largest gets `sizeRange[1]`. */
  sized?: boolean;
  sizeRange?: readonly [number, number];
  /** Text labels next to (or inside) the points that have a `label`. */
  showLabels?: boolean;
  /** Reference circles explaining the bubble sizes, under the plot. */
  sizeLegend?: boolean;
  height?: number;
  legend?: boolean | "top" | "bottom";
  grid?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<DistributionLabels>;
  className?: string;
}

/** Bubbles shrink in narrow frames (down to 55%) so they keep some separation. */
export function bubbleRadiusScale(width: number): number {
  return Math.min(1, Math.max(0.55, width / 640));
}

interface PlacedPoint {
  key: string;
  series: ColoredSeries<XYSeries>;
  point: XYPoint;
  x: number;
  y: number;
  r: number;
}

/**
 * Shared engine of `ScatterChart` and `BubbleChart`: two continuous axes,
 * multi-series points, optional bubbles, trend lines and quadrants.
 */
export function XYPointChart({
  title,
  series,
  xFormat,
  yFormat,
  sizeFormat,
  xAxis,
  yAxis,
  trendLine = false,
  quadrants,
  radius = 5,
  sized = false,
  sizeRange = [4, 30],
  showLabels = false,
  sizeLegend = sized,
  height = 340,
  legend,
  grid = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelsProp,
  className,
}: XYPointChartProps) {
  const labels = resolveDistributionLabels(labelsProp);
  const legendState = useDistributionLegend(series, legend, "dot");
  // The size key lives outside the plot, so the plot reports the width it got.
  const [plotWidth, setPlotWidth] = useState<number | null>(null);
  const fx = resolveFormat(xFormat);
  const fy = resolveFormat(yFormat);
  const fs = resolveFormat(sizeFormat);
  const finite = (point: XYPoint) => Number.isFinite(point.x) && Number.isFinite(point.y);
  const empty = !series.some((item) => item.points.some(finite));
  const maxSize = Math.max(
    0,
    ...legendState.visible.flatMap((item) => item.source.points.map((point) => point.size ?? 0)),
  );
  const rows = legendState.all.flatMap((item) =>
    item.source.points.filter(finite).map((point, index) => ({ item, point, index })),
  );
  const xName = xAxis?.title ?? "x";
  const yName = yAxis?.title ?? "y";
  return (
    <ChartFrame
      height={height}
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton="line"
      className={cn("@container", className)}
      legend={legendState.node}
      legendPosition={legendState.position}
      footer={
        sized && sizeLegend && maxSize > 0 ? (
          <SizeKey
            maxSize={maxSize}
            maxRadius={sizeRange[1] * bubbleRadiusScale(plotWidth ?? 640)}
            format={fs}
            label={labels.size}
          />
        ) : null
      }
      table={
        <ChartDataTable
          caption={title}
          categoryHeader={labels.point}
          categories={rows.map(
            ({ item, point, index }) => point.label ?? `${item.name} ${index + 1}`,
          )}
          columns={[
            { id: "series", name: labels.series, values: rows.map(({ item }) => item.name) },
            { id: "x", name: xName, values: rows.map(({ point }) => fx(point.x)) },
            { id: "y", name: yName, values: rows.map(({ point }) => fy(point.y)) },
            ...(sized
              ? [
                  {
                    id: "size",
                    name: labels.size,
                    values: rows.map(({ point }) => (point.size != null ? fs(point.size) : "")),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      {(width) => (
        <XYPointPlot
          width={width}
          height={height}
          title={title}
          visible={legendState.visible}
          xFormat={xFormat}
          yFormat={yFormat}
          sizeFormat={sizeFormat}
          xAxis={xAxis}
          yAxis={yAxis}
          trendLine={trendLine}
          quadrants={quadrants}
          radius={radius}
          sized={sized}
          sizeRange={sizeRange}
          maxSize={maxSize}
          showLabels={showLabels}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          isDimmed={legendState.isDimmed}
          onWidth={setPlotWidth}
        />
      )}
    </ChartFrame>
  );
}

/** Three nested reference circles for bubble sizes. HTML row that wraps in narrow frames. */
function SizeKey({
  maxSize,
  maxRadius,
  format,
  label,
}: {
  maxSize: number;
  maxRadius: number;
  format: (value: number) => string;
  label: string;
}) {
  const steps = [1, 0.5, 0.15].map((share) => ({
    size: maxSize * share,
    r: maxRadius * Math.sqrt(share),
  }));
  const box = maxRadius * 2 + 2;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-[12px] text-ink-3">
      <span className="font-semibold">{label}</span>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        {steps.map((step) => (
          <span key={step.r} className="inline-flex items-center gap-1.5">
            <svg aria-hidden="true" width={box} height={box} className="shrink-0">
              <circle
                cx={box / 2}
                cy={box / 2}
                r={step.r}
                strokeWidth={1.25}
                style={{ fill: "var(--chart-grid)", stroke: "var(--ink-3)" }}
              />
            </svg>
            <span className="font-medium tabular-nums">{format(step.size)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const Points = memo(function Points({
  points,
  sized,
  isDimmed,
}: {
  points: readonly PlacedPoint[];
  sized: boolean;
  isDimmed: (id: string) => boolean;
}) {
  return (
    <g>
      {points.map((point) => (
        <circle
          key={point.key}
          data-point=""
          cx={point.x}
          cy={point.y}
          r={point.r}
          strokeWidth={sized ? 1.5 : 1.25}
          className="transition-opacity duration-150"
          style={{
            fill: point.series.color,
            fillOpacity: sized ? 0.42 : 0.8,
            stroke: sized ? point.series.color : "var(--surface)",
            opacity: isDimmed(point.series.id) ? 0.18 : 1,
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
        />
      ))}
    </g>
  );
});

interface PlotProps {
  width: number;
  height: number;
  title: string;
  visible: ColoredSeries<XYSeries>[];
  xFormat?: ValueFormat;
  yFormat?: ValueFormat;
  sizeFormat?: ValueFormat;
  xAxis?: DistributionAxisOptions;
  yAxis?: DistributionAxisOptions;
  trendLine: boolean;
  quadrants?: QuadrantOptions;
  radius: number;
  sized: boolean;
  sizeRange: readonly [number, number];
  maxSize: number;
  showLabels: boolean;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: DistributionLabels;
  isDimmed: (id: string) => boolean;
  onWidth?: (width: number) => void;
}

const CORNERS: QuadrantCorner[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];

function XYPointPlot({
  width,
  height,
  title,
  visible,
  xFormat,
  yFormat,
  sizeFormat,
  xAxis,
  yAxis,
  trendLine,
  quadrants,
  radius,
  sized,
  sizeRange,
  maxSize,
  showLabels,
  grid,
  tooltip,
  animate,
  labels,
  isDimmed,
  onWidth,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => onWidth?.(width), [onWidth, width]);
  const clipId = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-plot`;
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const item of visible) {
      for (const point of item.source.points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        xs.push(point.x);
        ys.push(point.y);
      }
    }
    const extentOf = (values: number[]): [number, number] | null =>
      values.length ? [Math.min(...values), Math.max(...values)] : null;
    const qx = quadrants ? (quadrants.x ?? mean(xs)) : null;
    const qy = quadrants ? (quadrants.y ?? mean(ys)) : null;
    const withQuadrant = (values: number[], q: number | null) =>
      q != null && Number.isFinite(q) ? [...values, q] : values;
    const maxRadius = sized ? sizeRange[1] * bubbleRadiusScale(width) : radius;
    const layout = xyLayout({
      width,
      height,
      xExtent: extentOf(withQuadrant(xs, qx)),
      yExtent: extentOf(withQuadrant(ys, qy)),
      xFormat,
      yFormat,
      xAxis,
      yAxis,
      inset: sized ? maxRadius * 0.7 : radius + 2,
    });
    const { xScale, yScale } = layout;
    const radiusOf = (point: XYPoint) =>
      sized
        ? Math.max(
            sizeRange[0],
            maxRadius * Math.sqrt(Math.max(0, point.size ?? 0) / (maxSize || 1)),
          )
        : radius;
    const placed: PlacedPoint[] = [];
    for (const item of visible) {
      item.source.points.forEach((point, index) => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
        placed.push({
          key: `${item.id}-${index}`,
          series: item,
          point,
          x: xScale.map(point.x),
          y: yScale.map(point.y),
          r: radiusOf(point),
        });
      });
    }
    // Big bubbles first so small ones stay visible on top.
    const drawOrder = sized ? [...placed].sort((a, b) => b.r - a.r) : placed;
    // Reading order for the keyboard: left to right, then bottom to top.
    const readOrder = [...placed].sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y);
    const trends = trendLine
      ? visible.flatMap((item) => {
          const finite = item.source.points.filter(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          );
          const fit = linearRegression(finite);
          if (!fit) return [];
          const lo = Math.min(...finite.map((point) => point.x));
          const hi = Math.max(...finite.map((point) => point.x));
          return [
            {
              series: item,
              fit,
              x1: xScale.map(lo),
              y1: yScale.map(fit.predict(lo)),
              x2: xScale.map(hi),
              y2: yScale.map(fit.predict(hi)),
            },
          ];
        })
      : [];
    return {
      layout,
      drawOrder,
      readOrder,
      trends,
      quadrant:
        qx != null && qy != null && Number.isFinite(qx) && Number.isFinite(qy)
          ? { x: xScale.map(qx), y: yScale.map(qy) }
          : null,
    };
  }, [
    width,
    height,
    visible,
    xFormat,
    yFormat,
    xAxis,
    yAxis,
    trendLine,
    quadrants,
    radius,
    sized,
    sizeRange,
    maxSize,
  ]);

  const { layout, drawOrder, readOrder, trends, quadrant } = geometry;
  const { margin, innerWidth, innerHeight } = layout;

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-point]").forEach((point, index) => {
        point.animate(
          [
            { opacity: 0, transform: "scale(0)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 480,
            delay: Math.min(700, index * 12),
            easing: "cubic-bezier(.34,1.56,.64,1)",
            fill: "backwards",
          },
        );
      });
      root.querySelectorAll("[data-trend]").forEach((line) => {
        line.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 500,
          delay: 500,
          easing: "ease-out",
          fill: "backwards",
        });
      });
    },
    { disabled: !animate, replayKey: readOrder.length },
  );

  const fx = resolveFormat(xFormat);
  const fy = resolveFormat(yFormat);
  const fs = resolveFormat(sizeFormat);
  const xName = xAxis?.title ?? "x";
  const yName = yAxis?.title ?? "y";
  const current = active != null ? readOrder[active] : undefined;
  const rows: TooltipRow[] = current
    ? [
        {
          id: "x",
          name: xName,
          value: fx(current.point.x),
          color: current.series.color,
          shape: "dot",
        },
        { id: "y", name: yName, value: fy(current.point.y), color: "transparent" },
        ...(sized && current.point.size != null
          ? [{ id: "size", name: labels.size, value: fs(current.point.size), color: "transparent" }]
          : []),
      ]
    : [];
  const pointTitle = (point: PlacedPoint) =>
    point.point.label
      ? visible.length > 1
        ? `${point.point.label} · ${point.series.name}`
        : point.point.label
      : point.series.name;
  const valueText = current
    ? `${pointTitle(current)}: ${rows.map((row) => `${row.name} ${row.value}`).join(", ")}`
    : title;
  const narrow = width < 480;
  const half = (size: number) => size / 2 - 12;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {quadrant && quadrants?.tones
            ? CORNERS.map((corner) => {
                const tone = quadrants.tones?.[corner];
                if (!tone) return null;
                const left = corner.endsWith("Left");
                const top = corner.startsWith("top");
                return (
                  <rect
                    key={corner}
                    x={left ? 0 : quadrant.x}
                    y={top ? 0 : quadrant.y}
                    width={Math.max(0, left ? quadrant.x : innerWidth - quadrant.x)}
                    height={Math.max(0, top ? quadrant.y : innerHeight - quadrant.y)}
                    style={{ fill: TONE_COLORS[tone].soft, opacity: 0.55 }}
                  />
                );
              })
            : null}
          <XYAxes layout={layout} xTitle={xAxis?.title} yTitle={yAxis?.title} grid={grid} />
          {quadrant ? (
            <g>
              <line
                x1={quadrant.x}
                x2={quadrant.x}
                y1={0}
                y2={innerHeight}
                strokeDasharray="4 4"
                style={{ stroke: "var(--line-strong)" }}
              />
              <line
                x1={0}
                x2={innerWidth}
                y1={quadrant.y}
                y2={quadrant.y}
                strokeDasharray="4 4"
                style={{ stroke: "var(--line-strong)" }}
              />
              {CORNERS.map((corner) => {
                const text = quadrants?.labels?.[corner];
                if (!text) return null;
                const left = corner.endsWith("Left");
                const top = corner.startsWith("top");
                const tone = quadrants?.tones?.[corner];
                return (
                  <text
                    key={corner}
                    x={left ? 8 : innerWidth - 8}
                    y={top ? 16 : innerHeight - 8}
                    textAnchor={left ? "start" : "end"}
                    className="font-bold text-[11px]"
                    style={{ fill: tone ? TONE_COLORS[tone].ink : "var(--ink-3)" }}
                  >
                    {truncateLabel(text, half(innerWidth))}
                  </text>
                );
              })}
            </g>
          ) : null}
          <g clipPath={sized ? undefined : `url(#${clipId})`}>
            <Points points={drawOrder} sized={sized} isDimmed={isDimmed} />
          </g>
          {trends.map((trend) => (
            <g key={trend.series.id} data-trend="">
              <line
                x1={trend.x1}
                y1={trend.y1}
                x2={trend.x2}
                y2={trend.y2}
                strokeWidth={4}
                strokeLinecap="round"
                style={{ stroke: "var(--surface)", opacity: 0.8 }}
              />
              <line
                x1={trend.x1}
                y1={trend.y1}
                x2={trend.x2}
                y2={trend.y2}
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinecap="round"
                style={{ stroke: trend.series.color }}
              />
              {narrow ? null : (
                <text
                  x={Math.min(trend.x2, innerWidth) - 4}
                  y={trend.y2 - 8}
                  textAnchor="end"
                  className="font-bold text-[10.5px] tabular-nums"
                  style={{ fill: trend.series.color }}
                >
                  {`R² ${formatNumber(trend.fit.r2, { maximumFractionDigits: 2 })}`}
                </text>
              )}
            </g>
          ))}
          {showLabels
            ? drawOrder.map((point) => {
                const text = point.point.label;
                if (!text) return null;
                const textWidth = estimateTextWidth(text, 11);
                const inside = textWidth <= point.r * 1.8 && point.r >= 12;
                // Outside labels only where there is room for them.
                if (!inside && (narrow || point.x + point.r + 4 + textWidth > innerWidth))
                  return null;
                return (
                  <text
                    key={`label-${point.key}`}
                    x={inside ? point.x : point.x + point.r + 4}
                    y={point.y}
                    dy="0.34em"
                    textAnchor={inside ? "middle" : "start"}
                    className={cn(
                      "pointer-events-none font-semibold text-[11px] transition-opacity duration-150",
                      inside ? "fill-ink" : "fill-ink-2",
                    )}
                    style={{ opacity: isDimmed(point.series.id) ? 0.2 : 1 }}
                  >
                    {text}
                  </text>
                );
              })
            : null}
          {current ? (
            <circle
              cx={current.x}
              cy={current.y}
              r={current.r + 3.5}
              strokeWidth={2}
              fill="none"
              style={{ stroke: current.series.color }}
            />
          ) : null}
        </g>
      </svg>
      <PlotExplorer
        count={readOrder.length}
        active={active}
        onActiveChange={setActive}
        pick={(x, y) => {
          // Inside overlapping bubbles the smallest one wins, so it stays reachable.
          let inside: number | null = null;
          readOrder.forEach((point, index) => {
            if (Math.hypot(point.x - x, point.y - y) > point.r + 3) return;
            if (inside == null || point.r < (readOrder[inside] as PlacedPoint).r) inside = index;
          });
          return inside ?? nearestPoint(readOrder, x, y, 16);
        }}
        label={labels.explore}
        valueText={valueText}
        margin={margin}
        width={innerWidth}
        height={innerHeight}
      />
      {tooltip && current ? (
        <ChartTooltip
          x={margin.left + current.x + current.r}
          y={margin.top + current.y}
          {...tooltipFit(width)}
          title={pointTitle(current)}
          rows={rows}
        />
      ) : null}
    </div>
  );
}
