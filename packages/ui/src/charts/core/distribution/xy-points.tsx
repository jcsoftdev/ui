"use client";

import {
  type KeyboardEvent,
  memo,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../../utils/cn.js";
import { estimateTextWidth } from "../axes.js";
import { ChartFrame } from "../chart-frame.js";
import { tint } from "../color-scale.js";
import { ChartDataTable } from "../data-table.js";
import { formatNumber, resolveFormat, type ValueFormat } from "../format.js";
import { useEntryAnimation } from "../motion.js";
import { type ChartTone, TONE_COLORS } from "../palette.js";
import { formatDate } from "../scales/time.js";
import { ChartTooltip, type TooltipRow } from "../tooltip.js";
import { useCanvasPaint } from "../use-canvas.js";
import {
  type BrushKey,
  type BrushRect,
  clampRect,
  defaultBrush,
  isClick,
  rectFromCorners,
  stepBrush,
} from "./brush.js";
import { PlotExplorer } from "./explorer.js";
import { type DistributionLabels, resolveDistributionLabels } from "./labels.js";
import { type DistributionAxisOptions, tooltipFit, truncateLabel, xyLayout } from "./layout.js";
import { XYAxes } from "./marks.js";
import { createPointIndex } from "./point-index.js";
import { linearRegression, mean, seededRandom } from "./stats.js";
import { type ColoredSeries, useDistributionLegend } from "./use-legend.js";

export interface XYPoint {
  x: number;
  y: number;
  /** Bubble size (bubble charts): drives the area of the circle. */
  size?: number;
  /** Name in the tooltip, the data table and bubble labels, e.g. a barber. */
  label?: string;
  /** Image drawn inside the marker instead of a plain dot (URL or data URI), e.g. an avatar. */
  image?: string;
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

/** Rectangular selection drawn over the plot: drag with the pointer or use the keyboard. */
export interface XYBrush {
  /** Applied rectangle in data units (an infinite edge covers the whole axis); `null` for none. */
  value: BrushRect | null;
  /** Called with the finished rectangle (drag released, Enter) or `null` (click, Escape). */
  onChange: (rect: BrushRect | null) => void;
  /** Accessible name of the keyboard brush, e.g. "Seleccionar un rectángulo". */
  label: string;
  /** Text a screen reader announces for a rectangle while it is moved or applied. */
  describe?: (rect: BrushRect, applied: boolean) => string;
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
  /** "time": `x` is epoch milliseconds and the axis shows calendar ticks. */
  xType?: "linear" | "time";
  /**
   * Deterministic displacement in pixels that separates overlapping points
   * (a number applies to both axes). Tooltips still show the true values.
   */
  jitter?: number | { x?: number; y?: number };
  /** Seed of the jitter, so points are stable between renders. */
  seed?: number;
  /**
   * "canvas" paints the marks on a canvas for tens of thousands of points;
   * axes, tooltip and keyboard stay SVG/HTML. Falls back to SVG when points
   * carry images or `shading` is "shaded".
   */
  renderer?: "svg" | "canvas";
  /** Rectangular brush over the plot (pointer drag plus keyboard). */
  brush?: XYBrush;
  /** "shaded" fills bubbles with an off-centre radial gradient so they read as spheres. */
  shading?: "flat" | "shaded";
  /** Text labels next to (or inside) the points that have a `label`. */
  showLabels?: boolean;
  /** Reference circles explaining the bubble sizes, under the plot. */
  sizeLegend?: boolean;
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
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
  xType = "linear",
  jitter,
  seed = 17,
  renderer = "svg",
  brush,
  shading = "flat",
  height = 340,
  aspectRatio,
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
  const time = xType === "time";
  const fx = time && !xFormat ? formatDate : resolveFormat(xFormat);
  const fy = resolveFormat(yFormat);
  const fs = resolveFormat(sizeFormat);
  const finite = (point: XYPoint) => Number.isFinite(point.x) && Number.isFinite(point.y);
  const empty = !series.some((item) => item.points.some(finite));
  const maxSize = Math.max(
    0,
    ...legendState.visible.flatMap((item) => item.source.points.map((point) => point.size ?? 0)),
  );
  const canvas =
    renderer === "canvas" &&
    shading !== "shaded" &&
    !series.some((item) => item.points.some((point) => point.image));
  // A table with tens of thousands of rows would drown the DOM the canvas avoids.
  const tableLimit = canvas ? 500 : Number.POSITIVE_INFINITY;
  const rows = legendState.all
    .flatMap((item) =>
      item.source.points.filter(finite).map((point, index) => ({ item, point, index })),
    )
    .slice(0, tableLimit);
  const xName = xAxis?.title ?? "x";
  const yName = yAxis?.title ?? "y";
  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
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
      {(width, measuredHeight) => (
        <XYPointPlot
          width={width}
          height={measuredHeight}
          title={title}
          visible={legendState.visible}
          xFormat={xFormat}
          yFormat={yFormat}
          sizeFormat={sizeFormat}
          xAxis={xAxis}
          yAxis={yAxis}
          xTime={time}
          jitter={jitter}
          seed={seed}
          canvas={canvas}
          brush={brush}
          shading={shading}
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
  shadeId,
  isDimmed,
}: {
  points: readonly PlacedPoint[];
  sized: boolean;
  /** Gradient id for a series index when bubbles are shaded. */
  shadeId?: (seriesIndex: number) => string;
  isDimmed: (id: string) => boolean;
}) {
  return (
    <g>
      {points.map((point) => {
        const dimmed = isDimmed(point.series.id);
        const image = point.point.image;
        if (image) {
          return (
            <g
              key={point.key}
              data-point=""
              className="transition-opacity duration-150"
              style={{
                opacity: dimmed ? 0.18 : 1,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            >
              <circle cx={point.x} cy={point.y} r={point.r} style={{ fill: "var(--surface-2)" }} />
              <image
                href={image}
                x={point.x - point.r}
                y={point.y - point.r}
                width={point.r * 2}
                height={point.r * 2}
                preserveAspectRatio="xMidYMid slice"
                style={{ clipPath: "circle(50%)" }}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={point.r}
                fill="none"
                strokeWidth={2}
                style={{ stroke: point.series.color }}
              />
            </g>
          );
        }
        return (
          <circle
            key={point.key}
            data-point=""
            cx={point.x}
            cy={point.y}
            r={point.r}
            strokeWidth={sized ? 1.5 : 1.25}
            className="transition-opacity duration-150"
            style={{
              fill: shadeId ? `url(#${shadeId(point.series.index)})` : point.series.color,
              fillOpacity: shadeId ? 0.96 : sized ? 0.42 : 0.8,
              stroke: shadeId
                ? tint(point.series.color, 70, "black")
                : sized
                  ? point.series.color
                  : "var(--surface)",
              opacity: dimmed ? 0.18 : 1,
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          />
        );
      })}
    </g>
  );
});

/** Radial gradient that turns a bubble into a lit sphere (highlight up and left, shade down and right). */
function SphereGradient({ id, color }: { id: string; color: string }) {
  return (
    <radialGradient id={id} cx="0.5" cy="0.5" r="0.62" fx="0.34" fy="0.3">
      <stop offset="0%" style={{ stopColor: tint(color, 30, "white") }} />
      <stop offset="38%" style={{ stopColor: color }} />
      <stop offset="100%" style={{ stopColor: tint(color, 58, "black") }} />
    </radialGradient>
  );
}

/** Paints every mark on one canvas; used for dense scatter plots. */
function CanvasMarks({
  points,
  visible,
  width,
  height,
  sized,
  dimmedKey,
  isDimmed,
}: {
  points: readonly PlacedPoint[];
  visible: readonly ColoredSeries<XYSeries>[];
  width: number;
  height: number;
  sized: boolean;
  dimmedKey: string;
  isDimmed: (id: string) => boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasPaint(
    ref,
    width,
    height,
    ({ ctx, resolve }) => {
      const fills = resolve(visible.map((item) => item.color));
      const ring = resolve(["var(--surface)"])[0] as string;
      visible.forEach((item, seriesIndex) => {
        const mine = points.filter((point) => point.series.id === item.id);
        if (mine.length === 0) return;
        ctx.globalAlpha = (isDimmed(item.id) ? 0.12 : 1) * (sized ? 0.5 : 0.75);
        ctx.fillStyle = fills[seriesIndex] as string;
        ctx.beginPath();
        for (const point of mine) {
          ctx.moveTo(point.x + point.r, point.y);
          ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        }
        ctx.fill();
        if (sized || (mine[0] && mine[0].r >= 3)) {
          ctx.globalAlpha = isDimmed(item.id) ? 0.12 : 0.9;
          ctx.lineWidth = 1;
          ctx.strokeStyle = sized ? (fills[seriesIndex] as string) : ring;
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    },
    [points, visible, sized, dimmedKey],
  );
  return (
    <canvas
      ref={ref}
      data-canvas=""
      className="pointer-events-none absolute"
      style={{ left: 0, top: 0, width, height }}
    />
  );
}

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
  xTime: boolean;
  jitter?: number | { x?: number; y?: number };
  seed: number;
  canvas: boolean;
  brush?: XYBrush;
  shading: "flat" | "shaded";
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
  xTime,
  jitter,
  seed,
  canvas,
  brush,
  shading,
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
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => onWidth?.(width), [onWidth, width]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `${uid}-plot`;
  const shaded = sized && shading === "shaded";
  const shadeId = (seriesIndex: number) => `${uid}-sphere-${seriesIndex}`;
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
      xTime,
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
    const spread = typeof jitter === "number" ? { x: jitter, y: jitter } : (jitter ?? {});
    const jx = Math.max(0, spread.x ?? 0);
    const jy = Math.max(0, spread.y ?? 0);
    const placed: PlacedPoint[] = [];
    for (const item of visible) {
      const random = seededRandom(seed + item.index * 131);
      item.source.points.forEach((point, index) => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
        // Both draws always happen, so a point keeps its offset when the spread changes.
        const dx = (random() * 2 - 1) * jx;
        const dy = (random() * 2 - 1) * jy;
        placed.push({
          key: `${item.id}-${index}`,
          series: item,
          point,
          x: xScale.map(point.x) + dx,
          y: yScale.map(point.y) + dy,
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
    xTime,
    jitter,
    seed,
    trendLine,
    quadrants,
    radius,
    sized,
    sizeRange,
    maxSize,
  ]);

  const { layout, drawOrder, readOrder, trends, quadrant } = geometry;
  const { margin, innerWidth, innerHeight } = layout;

  const [draft, setDraft] = useState<BrushRect | null>(null);
  const [spoken, setSpoken] = useState("");
  const dragFrom = useRef<{ x: number; y: number } | null>(null);
  const xDomain = layout.xScale.domain;
  const yDomain = layout.yScale.domain;
  const applied = brush?.value ? clampRect(brush.value, xDomain, yDomain) : null;
  const shownBrush = draft ?? applied;
  const speak = (rect: BrushRect, done: boolean) => {
    setSpoken(brush?.describe?.(rect, done) ?? "");
  };
  const plotPoint = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(innerWidth, Math.max(0, event.clientX - box.left - margin.left)),
      y: Math.min(innerHeight, Math.max(0, event.clientY - box.top - margin.top)),
    };
  };
  const rectAt = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    clampRect(
      rectFromCorners(
        { x: layout.xScale.invert(a.x), y: layout.yScale.invert(a.y) },
        { x: layout.xScale.invert(b.x), y: layout.yScale.invert(b.y) },
      ),
      xDomain,
      yDomain,
    );
  const brushHandlers = brush
    ? {
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          if (event.button !== 0) return;
          const box = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - box.left - margin.left;
          const y = event.clientY - box.top - margin.top;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragFrom.current = { x, y };
        },
        onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
          const from = dragFrom.current;
          if (!from) return;
          const to = plotPoint(event);
          if (!isClick(from, to)) {
            setActive(null);
            setDraft(rectAt(from, to));
          }
        },
        onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
          const from = dragFrom.current;
          if (!from) return;
          dragFrom.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          const to = plotPoint(event);
          setDraft(null);
          if (isClick(from, to)) {
            if (brush.value) brush.onChange(null);
            return;
          }
          const rect = rectAt(from, to);
          brush.onChange(rect);
          speak(rect, true);
        },
        onPointerCancel: () => {
          dragFrom.current = null;
          setDraft(null);
        },
      }
    : {};
  const onBrushKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!brush) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      if (brush.value) brush.onChange(null);
      setSpoken("");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!draft) return;
      brush.onChange(draft);
      speak(draft, true);
      setDraft(null);
      return;
    }
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown"
    ) {
      return;
    }
    event.preventDefault();
    const base = draft ?? applied ?? defaultBrush(xDomain, yDomain);
    const next = stepBrush(base, event.key as BrushKey, event.shiftKey, xDomain, yDomain);
    setDraft(next);
    speak(next, false);
  };

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

  useEntryAnimation(
    wrapRef,
    (root) => {
      root.querySelectorAll("[data-canvas]").forEach((layer) => {
        layer.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 450,
          easing: "ease-out",
          fill: "backwards",
        });
      });
    },
    { disabled: !animate || !canvas, replayKey: readOrder.length },
  );

  const fx = xTime && !xFormat ? formatDate : resolveFormat(xFormat);
  const fy = resolveFormat(yFormat);
  const fs = resolveFormat(sizeFormat);
  const pointIndex = useMemo(() => createPointIndex(readOrder, 24), [readOrder]);
  const dimmedKey = visible
    .filter((item) => isDimmed(item.id))
    .map((item) => item.id)
    .join("|");
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

  const brushBox = shownBrush
    ? (() => {
        const xa = layout.xScale.map(shownBrush.x0);
        const xb = layout.xScale.map(shownBrush.x1);
        const ya = layout.yScale.map(shownBrush.y0);
        const yb = layout.yScale.map(shownBrush.y1);
        return {
          x: Math.min(xa, xb),
          y: Math.min(ya, yb),
          width: Math.abs(xb - xa),
          height: Math.abs(yb - ya),
        };
      })()
    : null;

  const over = (
    <>
      {brushBox ? (
        <rect
          data-brush=""
          pointerEvents="none"
          x={brushBox.x}
          y={brushBox.y}
          width={brushBox.width}
          height={brushBox.height}
          strokeWidth={1.5}
          strokeDasharray={draft ? undefined : "5 3"}
          style={{
            fill: "color-mix(in oklab, var(--accent) 12%, transparent)",
            stroke: "var(--accent)",
          }}
        />
      ) : null}
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
            if (!inside && (narrow || point.x + point.r + 4 + textWidth > innerWidth)) return null;
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
    </>
  );

  return (
    <div
      ref={wrapRef}
      className={cn("relative h-full w-full", brush && "touch-none select-none")}
      {...brushHandlers}
    >
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
          {shaded
            ? visible.map((item) => (
                <SphereGradient key={item.id} id={shadeId(item.index)} color={item.color} />
              ))
            : null}
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
          {canvas ? null : (
            <g clipPath={sized ? undefined : `url(#${clipId})`}>
              <Points
                points={drawOrder}
                sized={sized}
                shadeId={shaded ? shadeId : undefined}
                isDimmed={isDimmed}
              />
            </g>
          )}
          {canvas ? null : over}
        </g>
      </svg>
      {canvas ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: margin.left, top: margin.top, width: innerWidth, height: innerHeight }}
          >
            <CanvasMarks
              points={drawOrder}
              visible={visible}
              width={innerWidth}
              height={innerHeight}
              sized={sized}
              dimmedKey={dimmedKey}
              isDimmed={isDimmed}
            />
          </div>
          <svg
            aria-hidden="true"
            width={width}
            height={height}
            className="pointer-events-none absolute top-0 left-0 overflow-visible"
          >
            <g transform={`translate(${margin.left},${margin.top})`}>{over}</g>
          </svg>
        </>
      ) : null}
      <PlotExplorer
        count={readOrder.length}
        active={active}
        onActiveChange={setActive}
        pick={(x, y) => pointIndex.nearest(x, y, 16)}
        label={labels.explore}
        valueText={valueText}
        margin={margin}
        width={innerWidth}
        height={innerHeight}
      />
      {brush ? (
        <>
          <div
            role="slider"
            aria-label={brush.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={draft ? 100 : 0}
            aria-valuetext={spoken || brush.label}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowRight Enter Escape"
            tabIndex={0}
            onKeyDown={onBrushKey}
            onBlur={() => setDraft(null)}
            className="pointer-events-none absolute rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4"
            style={{ left: margin.left, top: margin.top, width: innerWidth, height: innerHeight }}
          />
          <span className="sr-only" aria-live="polite">
            {spoken}
          </span>
        </>
      ) : null}
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
