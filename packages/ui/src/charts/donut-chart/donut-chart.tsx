"use client";

import { memo, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { DECORATIVE } from "../core/a11y.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { arcPath, degToRad, polarPoint, sliceAngles, spreadLabels, TAU } from "../core/polar.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { useSeriesState } from "../core/use-series-state.js";

export interface DonutDatum {
  /** Stable identity, used for keys and legend toggling. */
  id: string;
  name: string;
  value: number;
  /** CSS color; defaults to the palette slot of the datum. */
  color?: string;
  /** Overrides the chart `valueFormat` for this slice. */
  format?: ValueFormat;
}

export type DonutOutsideLabels = boolean | "name" | "percent" | "both";

export interface DonutChartProps {
  /** Accessible name of the drawing. */
  title: string;
  description?: string;
  data: readonly DonutDatum[];
  /** `pie` fills the centre (no centre label). */
  variant?: "donut" | "pie";
  /** Half circle opening upwards, like a gauge. */
  semi?: boolean;
  /** Hole size as a fraction of the outer radius (donut only). */
  innerRadius?: number;
  /** Radius of the rounded slice corners, in pixels. 0 = sharp. */
  cornerRadius?: number;
  /** Visible gap between slices, in pixels. */
  gap?: number;
  /** Pixels a hovered or focused slice moves outwards. */
  explode?: number;
  /** Where the first slice starts, in degrees from 12 o'clock (full circle only). */
  startAngle?: number;
  height?: number;
  valueFormat?: ValueFormat;
  /** Caption under the centre value when nothing is hovered. Defaults to the "Total" label. */
  centerLabel?: string;
  /** Replaces the total shown in the centre while nothing is hovered. */
  centerValue?: string;
  /** Names / percentages on leader lines around the ring. `true` shows both. */
  outsideLabels?: DonutOutsideLabels;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  /** Ids hidden at first. */
  initialHidden?: readonly string[];
  onSliceClick?: (datum: DonutDatum) => void;
  labels?: Partial<ChartLabels>;
  className?: string;
}

interface Resolved {
  datum: DonutDatum;
  color: string;
  format: (value: number) => string;
}

function labelMode(value: DonutOutsideLabels | undefined): "name" | "percent" | "both" | null {
  if (!value) return null;
  return value === true ? "both" : value;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/**
 * Donut, pie and semi-donut. Rounded slice corners and a pixel gap between
 * slices, a centre total that follows the hovered slice, slices that step out
 * on hover or keyboard focus, optional outside labels on leader lines (with
 * collision avoidance) and a legend that toggles slices.
 */
export function DonutChart({
  title,
  description,
  data,
  variant = "donut",
  semi = false,
  innerRadius = 0.62,
  cornerRadius = 6,
  gap = 3,
  explode = 8,
  startAngle = 0,
  height = 300,
  valueFormat,
  centerLabel,
  centerValue,
  outsideLabels = false,
  legend,
  tooltip = true,
  loading = false,
  animate = true,
  initialHidden,
  onSliceClick,
  labels: labelsProp,
  className,
}: DonutChartProps) {
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
        <DonutPlot
          width={width}
          height={height}
          title={title}
          items={resolved}
          state={state}
          variant={variant}
          semi={semi}
          innerRatio={innerRadius}
          cornerRadius={cornerRadius}
          gap={gap}
          explode={explode}
          startAngle={startAngle}
          centerLabel={centerLabel ?? labels.total}
          centerValue={centerValue}
          outside={labelMode(outsideLabels)}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          onSliceClick={onSliceClick}
          valueFormat={valueFormat}
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
  variant: "donut" | "pie";
  semi: boolean;
  innerRatio: number;
  cornerRadius: number;
  gap: number;
  explode: number;
  startAngle: number;
  centerLabel: string;
  centerValue?: string;
  outside: "name" | "percent" | "both" | null;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
  onSliceClick?: (datum: DonutDatum) => void;
  valueFormat?: ValueFormat;
}

interface OutsideLabel {
  id: string;
  side: 1 | -1;
  anchor: { x: number; y: number };
  elbow: { x: number; y: number };
  x: number;
  y: number;
  name: string;
  percent: string;
  lines: 1 | 2;
}

const LABEL_ELBOW = 14;
const LABEL_RUN = 30;

function DonutPlot({
  width,
  height,
  title,
  items,
  state,
  variant,
  semi,
  innerRatio,
  cornerRadius,
  gap,
  explode,
  startAngle,
  centerLabel,
  centerValue,
  outside: outsideProp,
  tooltip,
  animate,
  labels,
  onSliceClick,
  valueFormat,
}: PlotProps) {
  // Narrow containers drop the outside labels: the legend carries the names.
  const outside = width < 440 ? null : outsideProp;
  const svgRef = useRef<SVGSVGElement>(null);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);

  // Geometry ----------------------------------------------------------------
  const geometry = useMemo(() => {
    const visible = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !state.isHidden(item.datum.id) && item.datum.value > 0);
    const sum = visible.reduce((acc, { item }) => acc + item.datum.value, 0);
    const edge = explode + 6;
    const labelSpace = outside ? Math.min(170, Math.max(96, width * 0.28)) : 0;
    const fitWidth = width / 2 - labelSpace - edge;
    const fitHeight = semi ? height - edge * 2 - 4 : height / 2 - edge - (outside ? 6 : 0);
    const radius = Math.max(24, Math.min(fitWidth, fitHeight));
    const cx = width / 2;
    const cy = semi ? (height + radius) / 2 : height / 2;
    const inner = variant === "pie" ? 0 : radius * Math.min(0.9, Math.max(0.2, innerRatio));
    const from = semi ? -Math.PI / 2 : degToRad(startAngle);
    const to = semi ? Math.PI / 2 : from + TAU;
    const pad = gap / Math.max(1, (inner + radius) / (variant === "pie" ? 1.6 : 2));
    const slices = sliceAngles(
      items.map((item, index) =>
        visible.some((entry) => entry.index === index) ? item.datum.value : 0,
      ),
      { startAngle: from, endAngle: to, padAngle: pad },
    );
    return { visible: visible.map((entry) => entry.index), sum, radius, inner, cx, cy, slices };
  }, [items, state, width, height, semi, outside, explode, variant, innerRatio, gap, startAngle]);

  const { visible, sum, radius, inner, cx, cy, slices } = geometry;
  const nav = useIndexNavigation(visible.length, { wrap: true });
  const activeIndex = nav.active != null ? (visible[nav.active] ?? null) : null;
  const legendIndex = state.highlighted
    ? items.findIndex((item) => item.datum.id === state.highlighted)
    : -1;
  const focusIndex = activeIndex ?? (legendIndex >= 0 ? legendIndex : null);

  const paths = useMemo(
    () =>
      slices.map((slice) =>
        slice.fraction > 0
          ? arcPath({
              cx,
              cy,
              innerRadius: inner,
              outerRadius: radius,
              startAngle: slice.start,
              endAngle: slice.end,
              cornerRadius,
            })
          : "",
      ),
    [slices, cx, cy, inner, radius, cornerRadius],
  );

  // Outside labels -----------------------------------------------------------
  const outsideLabels = useMemo<OutsideLabel[]>(() => {
    if (!outside) return [];
    const lines = outside === "both" ? 2 : 1;
    const boxHeight = lines === 2 ? 30 : 15;
    const sides: Record<"1" | "-1", OutsideLabel[]> = { "1": [], "-1": [] };
    for (const index of visible) {
      const slice = slices[index];
      const item = items[index];
      if (!slice || !item || slice.fraction < 0.02) continue;
      const side: 1 | -1 = Math.sin(slice.mid) >= 0 ? 1 : -1;
      const anchor = polarPoint(cx, cy, radius + 2, slice.mid);
      const elbow = polarPoint(cx, cy, radius + LABEL_ELBOW, slice.mid);
      sides[String(side) as "1" | "-1"].push({
        id: item.datum.id,
        side,
        anchor,
        elbow,
        x: cx + side * (radius + LABEL_RUN),
        y: elbow.y,
        name: item.datum.name,
        percent: formatPercent(slice.fraction, { decimals: 0 }),
        lines,
      });
    }
    const out: OutsideLabel[] = [];
    for (const group of Object.values(sides)) {
      const ys = spreadLabels(
        group.map((entry) => ({ y: entry.y, height: boxHeight })),
        4,
        height - 4,
        3,
      );
      group.forEach((entry, i) => {
        out.push({ ...entry, y: ys[i] ?? entry.y });
      });
    }
    return out;
  }, [outside, visible, slices, items, cx, cy, radius, height]);

  // Motion -------------------------------------------------------------------
  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-slice]").forEach((node, i) => {
        node.animate(
          [
            { opacity: 0, transform: "rotate(-24deg) scale(.88)" },
            { opacity: 1, transform: "rotate(0deg) scale(1)" },
          ],
          { duration: 760, delay: i * 70, easing: EASE_OUT, fill: "backwards" },
        );
      });
      root.querySelectorAll("[data-fade]").forEach((node) => {
        fadeIn(node, 420, 420);
      });
    },
    { disabled: !animate, replayKey: items.length },
  );

  // Centre text ---------------------------------------------------------------
  const activeItem = focusIndex != null ? items[focusIndex] : undefined;
  const activeSlice = focusIndex != null ? slices[focusIndex] : undefined;
  const showCenter = variant === "donut" && inner > 18;
  const captionSize = inner > 54 ? 12 : 10.5;
  const centerMax = Math.max(4, Math.floor((inner * 1.5) / (captionSize * 0.58)));
  const centerMain = activeItem
    ? activeItem.format(activeItem.datum.value)
    : (centerValue ?? format(sum));
  // A value is never cut: the font shrinks until the whole figure fits the hole.
  const valueSize = Math.round(
    Math.max(
      10,
      Math.min(34, Math.max(15, inner * 0.34), (inner * 1.7) / (centerMain.length * 0.6)),
    ),
  );
  const centerCaption = activeItem
    ? `${activeItem.datum.name}${activeSlice ? ` · ${formatPercent(activeSlice.fraction, { decimals: 0 })}` : ""}`
    : centerLabel;
  const block = valueSize + 6 + captionSize;
  const top = semi ? cy - 6 - block : cy - block / 2;

  // Tooltip -------------------------------------------------------------------
  const tipItem = activeIndex != null ? items[activeIndex] : null;
  const tipSlice = activeIndex != null ? slices[activeIndex] : null;
  const anchor =
    nav.pointer ??
    (tipSlice
      ? (() => {
          const point = polarPoint(cx, cy, (inner + radius) / 2, tipSlice.mid);
          return point;
        })()
      : null);
  const rows: TooltipRow[] =
    tipItem && tipSlice
      ? [
          {
            id: tipItem.datum.id,
            name: tipItem.datum.name,
            value: tipItem.format(tipItem.datum.value),
            color: tipItem.color,
            shape: "dot",
            note: formatPercent(tipSlice.fraction, { decimals: 1 }),
          },
        ]
      : [];

  const valueText = activeItem
    ? `${activeItem.datum.name}: ${activeItem.format(activeItem.datum.value)}, ${formatPercent(
        activeSlice?.fraction ?? 0,
        { decimals: 1 },
      )}`
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
        {slices.map((slice, index) => {
          const item = items[index];
          const path = paths[index];
          if (!item || !path) return null;
          const position = visible.indexOf(index);
          const focused = focusIndex === index;
          const dimmed = focusIndex != null && !focused;
          const shift = focused ? polarPoint(0, 0, explode, slice.mid) : { x: 0, y: 0 };
          return (
            <SliceMark
              key={item.datum.id}
              d={path}
              color={item.color}
              dimmed={dimmed}
              dx={shift.x}
              dy={shift.y}
              originX={cx}
              originY={cy}
              clickable={onSliceClick != null}
              onEnter={(event) => nav.hover(position, event)}
              onLeave={nav.leave}
              onClick={onSliceClick ? () => onSliceClick(item.datum) : undefined}
            />
          );
        })}

        {outsideLabels.map((label) => {
          const dimmed = focusIndex != null && items[focusIndex]?.datum.id !== label.id;
          const avail = Math.max(24, (label.side > 0 ? width - label.x : label.x) - 6);
          const maxChars = Math.floor(avail / (11 * 0.58));
          const end = { x: label.x - label.side * 4, y: label.y };
          return (
            <g
              key={label.id}
              data-fade=""
              className="motion-safe:transition-opacity motion-safe:duration-150"
              style={{ opacity: dimmed ? 0.35 : 1 }}
            >
              <polyline
                fill="none"
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={`${label.anchor.x},${label.anchor.y} ${label.elbow.x},${label.elbow.y} ${end.x},${end.y}`}
                style={{ stroke: "var(--ink-3)", strokeOpacity: 0.55 }}
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor={label.side > 0 ? "start" : "end"}
                className="text-[11px]"
              >
                {label.lines === 2 ? (
                  <>
                    <tspan x={label.x} dy="-0.25em" className="fill-ink-2 font-medium">
                      {truncate(label.name, maxChars)}
                    </tspan>
                    <tspan x={label.x} dy="1.35em" className="fill-ink font-bold tabular-nums">
                      {label.percent}
                    </tspan>
                  </>
                ) : (
                  <tspan
                    dy="0.34em"
                    className={cn(
                      "tabular-nums",
                      outside === "percent" ? "fill-ink font-bold" : "fill-ink-2 font-medium",
                    )}
                  >
                    {outside === "percent" ? label.percent : truncate(label.name, maxChars)}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}

        {showCenter ? (
          <g data-fade="" {...DECORATIVE} textAnchor="middle" className="pointer-events-none">
            <text
              x={cx}
              y={top + valueSize * 0.82}
              className="fill-ink font-bold tabular-nums"
              style={{ fontSize: valueSize }}
            >
              {centerMain}
            </text>
            <text
              x={cx}
              y={top + valueSize + 6 + captionSize * 0.82}
              className="fill-ink-3 font-semibold"
              style={{ fontSize: captionSize }}
            >
              {truncate(centerCaption, centerMax)}
            </text>
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

interface SliceMarkProps {
  d: string;
  color: string;
  dimmed: boolean;
  dx: number;
  dy: number;
  originX: number;
  originY: number;
  clickable: boolean;
  onEnter: (event: { clientX: number; clientY: number }) => void;
  onLeave: () => void;
  onClick?: () => void;
}

const SliceMark = memo(function SliceMark({
  d,
  color,
  dimmed,
  dx,
  dy,
  originX,
  originY,
  clickable,
  onEnter,
  onLeave,
  onClick,
}: SliceMarkProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer hover only; keyboard goes through the chart slider.
    <path
      data-slice=""
      d={d}
      onPointerEnter={onEnter}
      onPointerMove={onEnter}
      onPointerLeave={onLeave}
      onClick={onClick}
      className={cn(
        "motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out",
        clickable && "cursor-pointer",
      )}
      style={{
        fill: color,
        opacity: dimmed ? 0.4 : 1,
        transform: `translate(${Math.round(dx * 100) / 100}px, ${Math.round(dy * 100) / 100}px)`,
        transformOrigin: `${originX}px ${originY}px`,
      }}
    />
  );
});
