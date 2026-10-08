"use client";

import { memo, useId, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { DECORATIVE } from "../core/a11y.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { arcLine, degToRad, polarPoint } from "../core/polar.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { useSeriesState } from "../core/use-series-state.js";

export interface RadialBarDatum {
  id: string;
  name: string;
  value: number;
  /** Value that fills the ring. Defaults to the chart `max`. */
  max?: number;
  color?: string;
  format?: ValueFormat;
}

export interface RadialBarChartProps {
  title: string;
  description?: string;
  /** Rings from the outside in. */
  data: readonly RadialBarDatum[];
  /** Default full-ring value, 100 unless set (a datum can bring its own). */
  max?: number;
  height?: number;
  /** Where the rings start and stop, in degrees from 12 o'clock. 0 -> 270 leaves room for ring labels. */
  startAngle?: number;
  endAngle?: number;
  /** Ring thickness in pixels; derived from the size and ring count by default. */
  thickness?: number;
  /** Space between rings, in pixels. */
  gap?: number;
  /** Faint full ring behind each progress ring. */
  track?: boolean;
  roundedCaps?: boolean;
  /** Soft light-to-full gradient along each ring. */
  gradient?: boolean;
  /** Name and value at the start of each ring (needs the 12-to-9 o'clock quadrant free). */
  ringLabels?: boolean;
  valueFormat?: ValueFormat;
  /** Text in the centre while nothing is hovered. */
  centerValue?: string;
  centerLabel?: string;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}

interface Resolved {
  datum: RadialBarDatum;
  color: string;
  format: (value: number) => string;
  fraction: number;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/**
 * Concentric progress rings ("actividad del día"): one ring per series with
 * a track, rounded caps, optional gradient, labels at the start of each ring
 * and a centre readout that follows the hovered or focused ring.
 */
export function RadialBarChart({
  title,
  description,
  data,
  max = 100,
  height = 320,
  startAngle = 0,
  endAngle = 270,
  thickness,
  gap = 6,
  track = true,
  roundedCaps = true,
  gradient = true,
  ringLabels,
  valueFormat,
  centerValue,
  centerLabel,
  legend,
  tooltip = true,
  loading = false,
  animate = true,
  initialHidden,
  labels: labelsProp,
  className,
}: RadialBarChartProps) {
  const labels = resolveLabels(labelsProp);
  const state = useSeriesState(initialHidden);
  const resolved = useMemo<Resolved[]>(
    () =>
      data.map((datum, index) => {
        const full = datum.max ?? max;
        const fraction = full > 0 ? Math.min(1, Math.max(0, datum.value / full)) : 0;
        return {
          datum,
          color: seriesColor(index, datum.color),
          format: resolveFormat(datum.format ?? valueFormat),
          fraction: Number.isFinite(fraction) ? fraction : 0,
        };
      }),
    [data, max, valueFormat],
  );
  const empty = data.length === 0;
  const legendPlacement =
    legend === false ? null : legend === true || legend == null ? "bottom" : legend;
  const legendItems: LegendItem[] = resolved.map((item) => ({
    id: item.datum.id,
    name: item.datum.name,
    color: item.color,
    shape: "dot",
    hidden: state.isHidden(item.datum.id),
  }));

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
          values: resolved.map((item) => formatPercent(item.fraction, { decimals: 0 })),
        },
      ]}
    />
  );

  return (
    <ChartFrame
      height={height}
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
      {(width) => (
        <RadialPlot
          width={width}
          height={height}
          title={title}
          items={resolved}
          state={state}
          startAngle={startAngle}
          endAngle={endAngle}
          thickness={thickness}
          gap={gap}
          track={track}
          roundedCaps={roundedCaps}
          gradient={gradient}
          ringLabels={ringLabels}
          centerValue={centerValue}
          centerLabel={centerLabel}
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
  items: readonly Resolved[];
  state: ReturnType<typeof useSeriesState>;
  startAngle: number;
  endAngle: number;
  thickness?: number;
  gap: number;
  track: boolean;
  roundedCaps: boolean;
  gradient: boolean;
  ringLabels?: boolean;
  centerValue?: string;
  centerLabel?: string;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
}

interface Ring {
  index: number;
  radius: number;
  trackPath: string;
  valuePath: string;
}

function RadialPlot({
  width,
  height,
  title,
  items,
  state,
  startAngle,
  endAngle,
  thickness,
  gap,
  track,
  roundedCaps,
  gradient,
  ringLabels,
  centerValue,
  centerLabel,
  tooltip,
  animate,
  labels,
}: PlotProps) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const visible = useMemo(
    () =>
      items
        .map((_, index) => index)
        .filter((index) => !state.isHidden(items[index]?.datum.id ?? "")),
    [items, state],
  );
  const nav = useIndexNavigation(visible.length, { wrap: true });

  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.max(30, Math.min(width, height) / 2 - 8);
  const count = Math.max(1, visible.length);
  const hole = outer * 0.26;
  const band = thickness ?? Math.max(8, Math.min(28, (outer - hole - gap * (count - 1)) / count));
  const a0 = degToRad(startAngle);
  const a1 = degToRad(endAngle);
  const span = a1 - a0;
  const showLabels =
    (ringLabels ?? true) &&
    width >= 360 &&
    (ringLabels === true || (Math.abs(endAngle - startAngle) <= 280 && startAngle === 0));

  const rings = useMemo<Ring[]>(
    () =>
      visible.map((index, position) => {
        const radius = outer - band / 2 - position * (band + gap);
        const cap = roundedCaps ? band / 2 / Math.max(radius, 1) : 0;
        const from = a0 + cap;
        const room = span - 2 * cap;
        const fraction = items[index]?.fraction ?? 0;
        const to = fraction > 0 ? from + Math.max(room * fraction, 1e-3) : from;
        return {
          index,
          radius,
          trackPath: arcLine(cx, cy, radius, from, a0 + span - cap),
          valuePath: fraction > 0 ? arcLine(cx, cy, radius, from, to) : "",
        };
      }),
    [visible, items, outer, band, gap, roundedCaps, a0, span, cx, cy],
  );

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-ring]").forEach((node, i) => {
        node.animate(
          [
            { strokeDasharray: "0 1", opacity: 0.2 },
            { strokeDasharray: "1 1", opacity: 1 },
          ],
          { duration: 1000, delay: i * 110, easing: EASE_OUT, fill: "backwards" },
        );
      });
      root.querySelectorAll("[data-fade]").forEach((node) => {
        fadeIn(node, 400, 500);
      });
    },
    { disabled: !animate, replayKey: items.length },
  );

  const activeIndex = nav.active != null ? (visible[nav.active] ?? null) : null;
  const legendIndex = state.highlighted
    ? items.findIndex((item) => item.datum.id === state.highlighted)
    : -1;
  const focusIndex =
    activeIndex ?? (legendIndex >= 0 && visible.includes(legendIndex) ? legendIndex : null);
  const focusItem = focusIndex != null ? items[focusIndex] : undefined;

  const holeRadius = outer - count * band - (count - 1) * gap;
  const valueSize = Math.round(Math.min(30, Math.max(14, holeRadius * 0.5)));
  const captionSize = holeRadius > 46 ? 12 : 10.5;
  const mainText = focusItem ? focusItem.format(focusItem.datum.value) : centerValue;
  const captionText = focusItem ? focusItem.datum.name : centerLabel;
  const showCenter = holeRadius > 22 && mainText != null;
  const block = valueSize + (captionText ? 6 + captionSize : 0);

  const tipItem = activeIndex != null ? items[activeIndex] : null;
  const tipRing = rings.find((ring) => ring.index === activeIndex);
  const anchor =
    nav.pointer ??
    (tipRing
      ? polarPoint(cx, cy, tipRing.radius, a0 + span * (tipItem?.fraction ?? 0) * 0.5)
      : null);
  const rows: TooltipRow[] = tipItem
    ? [
        {
          id: tipItem.datum.id,
          name: tipItem.datum.name,
          value: tipItem.format(tipItem.datum.value),
          color: tipItem.color,
          shape: "dot",
          note: formatPercent(tipItem.fraction, { decimals: 0 }),
        },
      ]
    : [];
  const valueText = tipItem
    ? `${tipItem.datum.name}: ${tipItem.format(tipItem.datum.value)}, ${formatPercent(tipItem.fraction, { decimals: 0 })}`
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
        {gradient ? (
          <defs>
            {rings.map((ring) => {
              const color = items[ring.index]?.color ?? "var(--accent-word)";
              return (
                <linearGradient
                  key={ring.index}
                  id={`${uid}-g${ring.index}`}
                  gradientUnits="userSpaceOnUse"
                  x1={cx + outer}
                  y1={cy - outer}
                  x2={cx - outer}
                  y2={cy + outer}
                >
                  <stop
                    offset="0"
                    style={{ stopColor: `color-mix(in oklab, ${color}, white 42%)` }}
                  />
                  <stop offset="1" style={{ stopColor: color }} />
                </linearGradient>
              );
            })}
          </defs>
        ) : null}

        {rings.map((ring) => {
          const item = items[ring.index];
          if (!item) return null;
          const position = visible.indexOf(ring.index);
          return (
            <RingMark
              key={item.datum.id}
              trackPath={track ? ring.trackPath : ""}
              valuePath={ring.valuePath}
              hitPath={ring.trackPath}
              band={band}
              roundedCaps={roundedCaps}
              stroke={gradient ? `url(#${uid}-g${ring.index})` : item.color}
              dimmed={focusIndex != null && focusIndex !== ring.index}
              onEnter={(event) => nav.hover(position, event)}
              onLeave={nav.leave}
            />
          );
        })}

        {showLabels
          ? rings.map((ring) => {
              const item = items[ring.index];
              if (!item) return null;
              const dimmed = focusIndex != null && focusIndex !== ring.index;
              const maxChars = Math.max(
                4,
                Math.floor((cx - 14) / 6.4) - item.format(item.datum.value).length,
              );
              return (
                <text
                  key={item.datum.id}
                  data-fade=""
                  x={cx - 8}
                  y={cy - ring.radius}
                  textAnchor="end"
                  dominantBaseline="central"
                  {...DECORATIVE}
                  className="pointer-events-none text-[11px] motion-safe:transition-opacity motion-safe:duration-150"
                  style={{ opacity: dimmed ? 0.35 : 1 }}
                >
                  <tspan className="fill-ink-2 font-medium">
                    {truncate(item.datum.name, maxChars)}{" "}
                  </tspan>
                  <tspan className="fill-ink font-bold tabular-nums">
                    {item.format(item.datum.value)}
                  </tspan>
                </text>
              );
            })
          : null}

        {showCenter ? (
          <g data-fade="" {...DECORATIVE} textAnchor="middle" className="pointer-events-none">
            <text
              x={cx}
              y={cy - block / 2 + valueSize * 0.82}
              className="fill-ink font-bold tabular-nums"
              style={{ fontSize: valueSize }}
            >
              {truncate(
                mainText ?? "",
                Math.max(4, Math.floor((holeRadius * 1.7) / (valueSize * 0.58))),
              )}
            </text>
            {captionText ? (
              <text
                x={cx}
                y={cy - block / 2 + valueSize + 6 + captionSize * 0.82}
                className="fill-ink-3 font-semibold"
                style={{ fontSize: captionSize }}
              >
                {truncate(
                  captionText,
                  Math.max(4, Math.floor((holeRadius * 1.6) / (captionSize * 0.58))),
                )}
              </text>
            ) : null}
          </g>
        ) : null}
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

interface RingMarkProps {
  trackPath: string;
  valuePath: string;
  hitPath: string;
  band: number;
  roundedCaps: boolean;
  stroke: string;
  dimmed: boolean;
  onEnter: (event: { clientX: number; clientY: number }) => void;
  onLeave: () => void;
}

const RingMark = memo(function RingMark({
  trackPath,
  valuePath,
  hitPath,
  band,
  roundedCaps,
  stroke,
  dimmed,
  onEnter,
  onLeave,
}: RingMarkProps) {
  const cap = roundedCaps ? "round" : "butt";
  return (
    <g
      className={cn("motion-safe:transition-opacity motion-safe:duration-150")}
      style={{ opacity: dimmed ? 0.4 : 1 }}
    >
      {trackPath ? (
        <path
          d={trackPath}
          fill="none"
          strokeWidth={band}
          strokeLinecap={cap}
          style={{ stroke: "var(--chart-grid)" }}
        />
      ) : null}
      {valuePath ? (
        <path
          data-ring=""
          d={valuePath}
          pathLength={1}
          fill="none"
          strokeWidth={band}
          strokeLinecap={cap}
          style={{ stroke }}
        />
      ) : null}
      <path
        d={hitPath}
        fill="none"
        strokeWidth={band + 4}
        strokeLinecap="butt"
        stroke="transparent"
        pointerEvents="stroke"
        onPointerEnter={onEnter}
        onPointerMove={onEnter}
        onPointerLeave={onLeave}
      />
    </g>
  );
});
