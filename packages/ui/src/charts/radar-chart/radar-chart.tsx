"use client";

import { memo, useCallback, useMemo, useRef } from "react";
import { DECORATIVE } from "../core/a11y.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveAxisFormat, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { angleOf, degToRad, polarPoint, slotAt, TAU } from "../core/polar.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, type ChartSeries, resolveLabels } from "../core/types.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { useSeriesState } from "../core/use-series-state.js";

export interface RadarChartProps {
  title: string;
  description?: string;
  /** One name per spoke (at least 3). */
  axes: readonly string[];
  /** One value per axis in each series. */
  series: readonly ChartSeries[];
  /** Value at the outer ring. Rounded up from the data by default. */
  max?: number;
  /** Value at the centre. */
  min?: number;
  /** Number of concentric grid rings. */
  levels?: number;
  gridShape?: "polygon" | "circle";
  /** Translucent fill under each series. */
  fill?: boolean;
  fillOpacity?: number;
  markers?: boolean;
  /** Ring values along the first spoke. */
  showValues?: boolean;
  /** Rotation of the first spoke, in degrees from 12 o'clock. */
  startAngle?: number;
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}

interface Resolved {
  id: string;
  name: string;
  color: string;
  format: (value: number) => string;
  data: ReadonlyArray<number | null>;
}

/** Rounds `value` up to a tidy multiple so `levels` rings land on round numbers. */
export function niceRadarMax(value: number, levels: number): number {
  if (!(value > 0)) return levels;
  const raw = value / levels;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * magnitude * levels;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/**
 * Radar (spider) chart: several series over shared spokes, polygon or
 * circular grid, translucent areas, markers and a tooltip that lists every
 * series for the hovered or focused axis.
 */
export function RadarChart({
  title,
  description,
  axes,
  series,
  max,
  min = 0,
  levels = 4,
  gridShape = "polygon",
  fill = true,
  fillOpacity = 0.18,
  markers = true,
  showValues = true,
  startAngle = 0,
  height = 340,
  aspectRatio,
  valueFormat,
  legend,
  tooltip = true,
  loading = false,
  animate = true,
  initialHidden,
  labels: labelsProp,
  className,
}: RadarChartProps) {
  const labels = resolveLabels(labelsProp);
  const state = useSeriesState(initialHidden);
  const resolved = useMemo<Resolved[]>(
    () =>
      series.map((item, index) => ({
        id: item.id,
        name: item.name,
        color: seriesColor(index, item.color),
        format: resolveFormat(item.format ?? valueFormat),
        data: item.data,
      })),
    [series, valueFormat],
  );
  const empty =
    axes.length < 3 || resolved.every((item) => item.data.every((value) => value == null));
  const legendPlacement =
    legend === false ? null : legend === true || legend == null ? "bottom" : legend;
  const showLegend = legendPlacement != null && (legend != null || series.length > 1);

  const legendItems: LegendItem[] = resolved.map((item) => ({
    id: item.id,
    name: item.name,
    color: item.color,
    shape: "square",
    hidden: state.isHidden(item.id),
  }));
  const table = (
    <ChartDataTable
      caption={description ? `${title}. ${description}` : title}
      categoryHeader={labels.category}
      categories={axes}
      columns={resolved.map((item) => ({
        id: item.id,
        name: item.name,
        values: axes.map((_, i) => {
          const value = item.data[i];
          return value == null ? "" : item.format(value);
        }),
      }))}
    />
  );

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      legendAside
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton="ring"
      legend={
        showLegend ? (
          <ChartLegend
            align="center"
            items={legendItems}
            onToggle={state.toggle}
            onHighlight={state.setHighlighted}
          />
        ) : undefined
      }
      legendPosition={legendPlacement ?? "bottom"}
      table={table}
      className={className}
    >
      {(width, measuredHeight) => (
        <RadarPlot
          width={width}
          height={measuredHeight}
          title={title}
          axes={axes}
          items={resolved}
          state={state}
          max={max}
          min={min}
          levels={Math.max(1, Math.round(levels))}
          gridShape={gridShape}
          fill={fill}
          fillOpacity={fillOpacity}
          markers={markers}
          showValues={showValues}
          startAngle={degToRad(startAngle)}
          axisFormat={resolveAxisFormat(valueFormat)}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  title: string;
  axes: readonly string[];
  items: readonly Resolved[];
  state: ReturnType<typeof useSeriesState>;
  max?: number;
  min: number;
  levels: number;
  gridShape: "polygon" | "circle";
  fill: boolean;
  fillOpacity: number;
  markers: boolean;
  showValues: boolean;
  startAngle: number;
  axisFormat: (value: number) => string;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
}

function RadarPlot({
  width,
  height,
  title,
  axes,
  items,
  state,
  max,
  min,
  levels,
  gridShape,
  fill,
  fillOpacity,
  markers,
  showValues,
  startAngle,
  axisFormat,
  tooltip,
  animate,
  labels,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const count = axes.length;
  const nav = useIndexNavigation(count, { wrap: true });
  const compact = width < 420;
  const fontSize = compact ? 10 : 11;
  const maxChars = compact ? 10 : 18;
  const shownAxes = useMemo(() => axes.map((axis) => truncate(axis, maxChars)), [axes, maxChars]);

  const visible = items.filter((item) => !state.isHidden(item.id));
  const top = Math.max(
    0,
    ...visible.flatMap((item) => item.data.map((value) => (value == null ? 0 : value))),
  );
  const ceiling = max ?? niceRadarMax(top - Math.min(0, min), levels) + Math.min(0, min);
  const labelWidth = Math.max(...shownAxes.map((axis) => estimateTextWidth(axis, fontSize)), 0);
  const vertical = 26;
  const radius = Math.max(
    36,
    Math.min(width / 2 - Math.min(labelWidth, width * 0.24) - 16, height / 2 - vertical),
  );
  const cx = width / 2;
  const cy = height / 2;
  const scale = useCallback(
    (value: number) =>
      (radius * (Math.min(ceiling, Math.max(min, value)) - min)) / (ceiling - min || 1),
    [radius, ceiling, min],
  );
  const angleAt = useCallback((i: number) => startAngle + (TAU * i) / count, [startAngle, count]);

  const grid = useMemo(
    () =>
      Array.from({ length: levels }, (_, level) => {
        const r = (radius * (level + 1)) / levels;
        const d =
          gridShape === "circle"
            ? `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
            : `${Array.from({ length: count }, (_, i) => {
                const p = polarPoint(cx, cy, r, startAngle + (TAU * i) / count);
                return `${i === 0 ? "M" : "L"}${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`;
              }).join("")}Z`;
        return { d, value: min + ((ceiling - min) * (level + 1)) / levels, r };
      }),
    [levels, radius, gridShape, cx, cy, count, startAngle, min, ceiling],
  );

  const shapes = useMemo(
    () =>
      items.map((item) => {
        const points = axes.map((_, i) => {
          const value = item.data[i];
          return polarPoint(cx, cy, scale(value == null ? min : value), angleAt(i));
        });
        const d = `${points
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"}${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`,
          )
          .join("")}Z`;
        return { d, points };
      }),
    [items, axes, cx, cy, min, scale, angleAt],
  );

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-shape]").forEach((node, i) => {
        node.animate(
          [
            { opacity: 0, transform: "scale(.15)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 800, delay: i * 120, easing: EASE_OUT, fill: "backwards" },
        );
      });
      root.querySelectorAll("[data-fade]").forEach((node) => {
        fadeIn(node, 420, 300);
      });
    },
    { disabled: !animate, replayKey: `${count}` },
  );

  const active = nav.active;
  const highlighted = state.highlighted;

  const onPointer = (event: { clientX: number; clientY: number }) => {
    const box = nav.ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    if (Math.hypot(x - cx, y - cy) > radius + 36) {
      nav.leave();
      return;
    }
    nav.hover(slotAt(angleOf(cx, cy, x, y), count, startAngle), event);
  };

  const rows: TooltipRow[] =
    active != null
      ? visible.map((item) => {
          const value = item.data[active];
          return {
            id: item.id,
            name: item.name,
            value: value == null ? "–" : item.format(value),
            color: item.color,
            shape: "square",
          };
        })
      : [];
  const anchor =
    nav.pointer ?? (active != null ? polarPoint(cx, cy, radius * 0.6, angleAt(active)) : null);
  const valueText =
    active != null
      ? `${axes[active] ?? ""}: ${visible
          .map((item) => {
            const value = item.data[active];
            return `${item.name} ${value == null ? "–" : item.format(value)}`;
          })
          .join(", ")}`
      : title;

  return (
    <div ref={nav.ref} className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <g fill="none" strokeWidth={1} {...DECORATIVE}>
          {grid.map((ring, i) => (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: rings are positional.
              key={i}
              d={ring.d}
              style={{ stroke: "var(--chart-grid)" }}
            />
          ))}
          {axes.map((_, i) => {
            const end = polarPoint(cx, cy, radius, angleAt(i));
            return (
              <line
                // biome-ignore lint/suspicious/noArrayIndexKey: axes may repeat names.
                key={i}
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                strokeWidth={active === i ? 1.5 : 1}
                style={{ stroke: active === i ? "var(--chart-crosshair)" : "var(--chart-grid)" }}
              />
            );
          })}
        </g>

        {showValues
          ? grid.map((ring, i) => (
              <text
                data-fade=""
                // biome-ignore lint/suspicious/noArrayIndexKey: rings are positional.
                key={i}
                x={cx + 4}
                y={cy - ring.r - 2}
                {...DECORATIVE}
                className="fill-ink-3 text-fs-95 tabular-nums"
              >
                {axisFormat(ring.value)}
              </text>
            ))
          : null}

        {items.map((item, index) => {
          const shape = shapes[index];
          if (!shape || state.isHidden(item.id)) return null;
          return (
            <SeriesMark
              key={item.id}
              d={shape.d}
              points={shape.points}
              color={item.color}
              fill={fill}
              fillOpacity={fillOpacity}
              markers={markers}
              dimmed={highlighted != null && highlighted !== item.id}
              activeIndex={active}
              originX={cx}
              originY={cy}
            />
          );
        })}

        {axes.map((_, i) => {
          const angle = angleAt(i);
          const point = polarPoint(cx, cy, radius + 12, angle);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);
          return (
            <text
              data-fade=""
              // biome-ignore lint/suspicious/noArrayIndexKey: axes may repeat names.
              key={i}
              x={point.x}
              y={point.y + (cos > 0.3 ? -2 : cos < -0.3 ? 10 : 4)}
              textAnchor={sin > 0.25 ? "start" : sin < -0.25 ? "end" : "middle"}
              {...DECORATIVE}
              className={
                active === i
                  ? "fill-ink font-bold"
                  : "fill-ink-2 font-semibold motion-safe:transition-colors"
              }
              style={{ fontSize }}
            >
              {shownAxes[i]}
            </text>
          );
        })}

        <rect
          width={width}
          height={height}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={nav.leave}
        />
      </svg>

      <div
        role="slider"
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, count)}
        aria-valuenow={(active ?? 0) + 1}
        aria-valuetext={valueText}
        tabIndex={0}
        {...nav.sliderProps}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
      />

      {tooltip && anchor && active != null && rows.length ? (
        <ChartTooltip
          x={anchor.x}
          y={anchor.y}
          containerWidth={width}
          title={axes[active]}
          rows={rows}
        />
      ) : null}
    </div>
  );
}

interface SeriesMarkProps {
  d: string;
  points: ReadonlyArray<{ x: number; y: number }>;
  color: string;
  fill: boolean;
  fillOpacity: number;
  markers: boolean;
  dimmed: boolean;
  activeIndex: number | null;
  originX: number;
  originY: number;
}

const SeriesMark = memo(function SeriesMark({
  d,
  points,
  color,
  fill,
  fillOpacity,
  markers,
  dimmed,
  activeIndex,
  originX,
  originY,
}: SeriesMarkProps) {
  return (
    <g
      data-shape=""
      {...DECORATIVE}
      className="pointer-events-none motion-safe:transition-opacity motion-safe:duration-150"
      style={{ opacity: dimmed ? 0.2 : 1, transformOrigin: `${originX}px ${originY}px` }}
    >
      <path
        d={d}
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ stroke: color, fill: fill ? color : "none", fillOpacity }}
      />
      {markers
        ? points.map((point, i) => (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: markers are positional.
              key={i}
              cx={point.x}
              cy={point.y}
              r={activeIndex === i ? 5.5 : 3.5}
              strokeWidth={2}
              className="motion-safe:transition-[r] motion-safe:duration-150"
              style={{ fill: color, stroke: "var(--surface)" }}
            />
          ))
        : null}
    </g>
  );
});
