"use client";

import { memo, useCallback, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { DECORATIVE } from "../core/a11y.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import {
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { arcPath, degToRad, polarPoint, TAU } from "../core/polar.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { useSeriesState } from "../core/use-series-state.js";
import { niceRadarMax } from "../radar-chart/radar-chart.js";

export interface PolarAreaDatum {
  id: string;
  name: string;
  value: number;
  color?: string;
  format?: ValueFormat;
}

export interface PolarAreaChartProps {
  title: string;
  description?: string;
  data: readonly PolarAreaDatum[];
  /** `radius`: length proportional to value. `area`: sector area proportional to value (Nightingale rose). */
  scale?: "radius" | "area";
  /** Hole in the middle as a fraction of the outer radius. */
  innerRadius?: number;
  cornerRadius?: number;
  /** Gap between sectors, in pixels at the outer ring. */
  gap?: number;
  /** Concentric reference rings. */
  levels?: number;
  /** Names around the rim (hidden automatically in narrow containers). */
  showLabels?: boolean;
  /** Rotation of the first sector, in degrees from 12 o'clock. */
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
  datum: PolarAreaDatum;
  color: string;
  format: (value: number) => string;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/**
 * Polar area (Nightingale rose): equal-angle sectors whose radius, or area,
 * follows the value. Reference rings, rim labels, hover and keyboard focus
 * with a tooltip, legend toggling.
 */
export function PolarAreaChart({
  title,
  description,
  data,
  scale = "radius",
  innerRadius = 0.1,
  cornerRadius = 4,
  gap = 3,
  levels = 4,
  showLabels = true,
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
}: PolarAreaChartProps) {
  const labels = resolveLabels(labelsProp);
  const state = useSeriesState(initialHidden);
  const resolved = useMemo<Resolved[]>(
    () =>
      data.map((datum, index) => ({
        datum,
        color: seriesColor(index, datum.color),
        format: resolveFormat(datum.format ?? valueFormat),
      })),
    [data, valueFormat],
  );
  const empty = resolved.every((item) => !(item.datum.value > 0));
  const legendPlacement =
    legend === false ? null : legend === true || legend == null ? "bottom" : legend;
  const legendItems: LegendItem[] = resolved.map((item) => ({
    id: item.datum.id,
    name: item.datum.name,
    color: item.color,
    shape: "dot",
    hidden: state.isHidden(item.datum.id),
  }));
  const total = resolved.reduce((sum, item) => sum + Math.max(0, item.datum.value || 0), 0);
  const table = (
    <ChartDataTable
      caption={description ? `${title}. ${description}` : title}
      categoryHeader={labels.category}
      categories={resolved.map((item) => item.datum.name)}
      columns={[
        {
          id: "value",
          name: labels.value,
          values: resolved.map((item) => item.format(item.datum.value)),
        },
        {
          id: "share",
          name: labels.share,
          values: resolved.map((item) =>
            formatPercent(total > 0 ? Math.max(0, item.datum.value) / total : 0, { decimals: 1 }),
          ),
        },
      ]}
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
        legendPlacement ? (
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
        <RosePlot
          width={width}
          height={measuredHeight}
          title={title}
          items={resolved}
          state={state}
          scale={scale}
          innerRatio={innerRadius}
          cornerRadius={cornerRadius}
          gap={gap}
          levels={Math.max(1, Math.round(levels))}
          showLabels={showLabels}
          startAngle={degToRad(startAngle)}
          axisFormat={resolveAxisFormat(valueFormat)}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          total={total}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  title: string;
  items: readonly Resolved[];
  state: ReturnType<typeof useSeriesState>;
  scale: "radius" | "area";
  innerRatio: number;
  cornerRadius: number;
  gap: number;
  levels: number;
  showLabels: boolean;
  startAngle: number;
  axisFormat: (value: number) => string;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
  total: number;
}

const EXPLODE = 6;

function RosePlot({
  width,
  height,
  title,
  items,
  state,
  scale,
  innerRatio,
  cornerRadius,
  gap,
  levels,
  showLabels,
  startAngle,
  axisFormat,
  tooltip,
  animate,
  labels,
  total,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const compact = width < 420;
  const rim = showLabels && !compact;

  const visible = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !state.isHidden(item.datum.id) && item.datum.value > 0)
        .map(({ index }) => index),
    [items, state],
  );
  const nav = useIndexNavigation(visible.length, { wrap: true });
  const top = Math.max(0, ...visible.map((index) => items[index]?.datum.value ?? 0));
  const ceiling = niceRadarMax(top, levels);

  const labelRoom = rim
    ? Math.min(
        130,
        Math.max(...items.map((item) => estimateTextWidth(truncate(item.datum.name, 16)))) + 14,
      )
    : 0;
  const radius = Math.max(
    36,
    Math.min(width / 2 - labelRoom - EXPLODE - 4, height / 2 - EXPLODE - (rim ? 18 : 6)),
  );
  const inner = radius * Math.min(0.5, Math.max(0, innerRatio));
  const cx = width / 2;
  const cy = height / 2;
  const slot = TAU / Math.max(1, visible.length);
  const pad = gap / Math.max(1, radius * 0.7);

  const lengthAt = useCallback(
    (value: number) => {
      const ratio = Math.min(1, value / ceiling);
      return inner + (radius - inner) * (scale === "area" ? Math.sqrt(ratio) : ratio);
    },
    [inner, radius, ceiling, scale],
  );

  const sectors = useMemo(
    () =>
      visible.map((index, position) => {
        const item = items[index] as Resolved;
        const mid = startAngle + slot * (position + 0.5);
        const outer = lengthAt(item.datum.value);
        return {
          index,
          mid,
          outer,
          d: arcPath({
            cx,
            cy,
            innerRadius: inner,
            outerRadius: Math.max(outer, inner + 1),
            startAngle: startAngle + slot * position + pad / 2,
            endAngle: startAngle + slot * (position + 1) - pad / 2,
            cornerRadius,
          }),
        };
      }),
    [visible, items, startAngle, slot, cx, cy, inner, lengthAt, pad, cornerRadius],
  );

  const rings = Array.from({ length: levels }, (_, i) => {
    const ratio = (i + 1) / levels;
    return {
      r: inner + (radius - inner) * (scale === "area" ? Math.sqrt(ratio) : ratio),
      value: ceiling * ratio,
    };
  });

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-sector]").forEach((node, i) => {
        node.animate(
          [
            { opacity: 0, transform: "scale(.2)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 720, delay: i * 70, easing: EASE_OUT, fill: "backwards" },
        );
      });
      root.querySelectorAll("[data-fade]").forEach((node) => {
        fadeIn(node, 420, 380);
      });
    },
    { disabled: !animate, replayKey: items.length },
  );

  const activeIndex = nav.active != null ? (visible[nav.active] ?? null) : null;
  const legendIndex = state.highlighted
    ? items.findIndex((item) => item.datum.id === state.highlighted)
    : -1;
  const focusIndex = activeIndex ?? (legendIndex >= 0 ? legendIndex : null);

  const tipItem = activeIndex != null ? items[activeIndex] : null;
  const tipSector = sectors.find((sector) => sector.index === activeIndex);
  const anchor =
    nav.pointer ??
    (tipSector ? polarPoint(cx, cy, (inner + tipSector.outer) / 2, tipSector.mid) : null);
  const share = tipItem && total > 0 ? tipItem.datum.value / total : 0;
  const rows: TooltipRow[] = tipItem
    ? [
        {
          id: tipItem.datum.id,
          name: tipItem.datum.name,
          value: tipItem.format(tipItem.datum.value),
          color: tipItem.color,
          shape: "dot",
          note: formatPercent(share, { decimals: 1 }),
        },
      ]
    : [];
  const valueText = tipItem
    ? `${tipItem.datum.name}: ${tipItem.format(tipItem.datum.value)}, ${formatPercent(share, { decimals: 1 })}`
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
          {rings.map((ring) => (
            <circle
              key={ring.value}
              cx={cx}
              cy={cy}
              r={ring.r}
              strokeDasharray={ring.r === radius ? undefined : "2 4"}
              style={{ stroke: "var(--chart-grid)" }}
            />
          ))}
        </g>

        {sectors.map((sector, position) => {
          const item = items[sector.index];
          if (!item) return null;
          const focused = focusIndex === sector.index;
          const shift = focused ? polarPoint(0, 0, EXPLODE, sector.mid) : { x: 0, y: 0 };
          return (
            <SectorMark
              key={item.datum.id}
              d={sector.d}
              color={item.color}
              dimmed={focusIndex != null && !focused}
              dx={shift.x}
              dy={shift.y}
              originX={cx}
              originY={cy}
              onEnter={(event) => nav.hover(position, event)}
              onLeave={nav.leave}
            />
          );
        })}

        {rings.map((ring) => (
          <text
            data-fade=""
            key={ring.value}
            x={cx + 4}
            y={cy - ring.r - 3}
            {...DECORATIVE}
            className="pointer-events-none fill-ink-3 text-[9.5px] tabular-nums"
            style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}
          >
            {axisFormat(ring.value)}
          </text>
        ))}

        {rim
          ? sectors.map((sector) => {
              const item = items[sector.index];
              if (!item) return null;
              const point = polarPoint(cx, cy, radius + EXPLODE + 8, sector.mid);
              const sin = Math.sin(sector.mid);
              const cos = Math.cos(sector.mid);
              return (
                <text
                  data-fade=""
                  key={item.datum.id}
                  x={point.x}
                  y={point.y + (cos > 0.4 ? -2 : cos < -0.4 ? 10 : 4)}
                  textAnchor={sin > 0.25 ? "start" : sin < -0.25 ? "end" : "middle"}
                  {...DECORATIVE}
                  className={cn(
                    "pointer-events-none text-[11px] motion-safe:transition-opacity motion-safe:duration-150",
                    focusIndex === sector.index ? "fill-ink font-bold" : "fill-ink-2 font-semibold",
                  )}
                  style={{ opacity: focusIndex != null && focusIndex !== sector.index ? 0.4 : 1 }}
                >
                  {truncate(item.datum.name, 16)}
                </text>
              );
            })
          : null}
      </svg>

      <div
        role="slider"
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, visible.length)}
        aria-valuenow={(nav.active ?? 0) + 1}
        aria-valuetext={valueText}
        tabIndex={0}
        {...nav.sliderProps}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
      />

      {tooltip && anchor && rows.length ? (
        <ChartTooltip x={anchor.x} y={anchor.y} containerWidth={width} rows={rows} />
      ) : null}
    </div>
  );
}

interface SectorMarkProps {
  d: string;
  color: string;
  dimmed: boolean;
  dx: number;
  dy: number;
  originX: number;
  originY: number;
  onEnter: (event: { clientX: number; clientY: number }) => void;
  onLeave: () => void;
}

const SectorMark = memo(function SectorMark({
  d,
  color,
  dimmed,
  dx,
  dy,
  originX,
  originY,
  onEnter,
  onLeave,
}: SectorMarkProps) {
  return (
    <path
      data-sector=""
      d={d}
      onPointerEnter={onEnter}
      onPointerMove={onEnter}
      onPointerLeave={onLeave}
      className="motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out"
      style={{
        fill: color,
        fillOpacity: 0.9,
        opacity: dimmed ? 0.4 : 1,
        transform: `translate(${Math.round(dx * 100) / 100}px, ${Math.round(dy * 100) / 100}px)`,
        transformOrigin: `${originX}px ${originY}px`,
      }}
    />
  );
});
