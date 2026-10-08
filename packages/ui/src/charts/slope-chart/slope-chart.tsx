"use client";

import { memo, useMemo, useRef, useState } from "react";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { DIRECTION_COLORS, directionOf, seriesColor } from "../core/palette.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { spreadSlopeLabels } from "./label-layout.js";

export interface SlopeItem {
  id?: string;
  label: string;
  from: number;
  to: number;
  /** CSS color; overrides `colorBy`. */
  color?: string;
}

export interface SlopeChartProps {
  items: readonly SlopeItem[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Header of the left column, e.g. "Septiembre". */
  fromLabel?: string;
  /** Header of the right column, e.g. "Octubre". */
  toLabel?: string;
  /** "direction" colors by up, down or flat; "series" uses the palette. */
  colorBy?: "direction" | "series";
  /** With `colorBy="direction"`, going down is the good news (e.g. cancellations). */
  lowerIsBetter?: boolean;
  valueFormat?: ValueFormat;
  /** Height of the plot; by default it grows with the number of items. */
  height?: number | "fill";
  /** Width / height ratio; sizes the chart from the container width. */
  aspectRatio?: number;
  legend?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  /** Word for the change column of the data table and tooltip. */
  deltaLabel?: string;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const MARGIN = { top: 34, bottom: 14 };
const LABEL_GAP = 17;

function fit(text: string, room: number, size = 12): string {
  if (estimateTextWidth(text, size) <= room) return text;
  const chars = Math.floor(room / (size * 0.58)) - 1;
  return chars >= 2 ? `${text.slice(0, chars).trimEnd()}…` : "";
}

const Line = memo(function Line({
  x1,
  y1,
  x2,
  y2,
  color,
  state,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  state: "idle" | "active" | "muted";
}) {
  return (
    <g
      className="motion-safe:transition-opacity motion-safe:duration-150"
      style={{ opacity: state === "muted" ? 0.2 : 1 }}
    >
      <line
        data-line=""
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeLinecap="round"
        strokeWidth={state === "active" ? 3.5 : 2.25}
        style={{ stroke: color, transformBox: "fill-box", transformOrigin: "left center" }}
      />
      <circle
        cx={x1}
        cy={y1}
        r={state === "active" ? 5.5 : 4.5}
        style={{ fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
      />
      <circle
        cx={x2}
        cy={y2}
        r={state === "active" ? 5.5 : 4.5}
        style={{ fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
      />
    </g>
  );
});

/**
 * Two columns, one line per category: the slope is the change. Labels with
 * values sit on both sides and are nudged apart when values are close, so
 * every name stays readable.
 */
export function SlopeChart({
  items,
  title,
  description,
  fromLabel = "Before",
  toLabel = "After",
  colorBy = "direction",
  lowerIsBetter = false,
  valueFormat,
  height,
  aspectRatio,
  legend,
  tooltip = true,
  loading,
  animate = true,
  deltaLabel = "Change",
  labels: labelOverrides,
  className,
}: SlopeChartProps) {
  const labels = resolveLabels(labelOverrides);
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const plotHeight =
    height ?? Math.max(260, items.length * (LABEL_GAP + 5) + MARGIN.top + MARGIN.bottom);
  const colors = useMemo(
    () =>
      items.map((item, i) => {
        if (item.color) return item.color;
        if (colorBy === "series") return seriesColor(i);
        const direction = directionOf(item.to - item.from);
        if (direction === "flat") return DIRECTION_COLORS.flat;
        return (direction === "up") === !lowerIsBetter
          ? DIRECTION_COLORS.up
          : DIRECTION_COLORS.down;
      }),
    [items, colorBy, lowerIsBetter],
  );
  const change = (item: SlopeItem) => {
    const diff = item.to - item.from;
    const pct = item.from
      ? `${diff > 0 ? "+" : ""}${formatPercent(diff / Math.abs(item.from), { decimals: 0 })}`
      : "—";
    return `${diff > 0 ? "+" : ""}${fmt(diff)} (${pct})`;
  };
  const showLegend = legend ?? (colorBy === "direction" && items.length > 0);

  return (
    <ChartFrame
      height={plotHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={items.length === 0}
      skeleton="line"
      legend={
        showLegend && colorBy === "direction" ? (
          <ChartLegend
            items={[
              {
                id: "up",
                name: lowerIsBetter ? "▼" : "▲",
                color: DIRECTION_COLORS.up,
                shape: "line",
              },
              {
                id: "down",
                name: lowerIsBetter ? "▲" : "▼",
                color: DIRECTION_COLORS.down,
                shape: "line",
              },
            ]}
          />
        ) : null
      }
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={items.map((item) => item.label)}
          columns={[
            { id: "from", name: fromLabel, values: items.map((item) => fmt(item.from)) },
            { id: "to", name: toLabel, values: items.map((item) => fmt(item.to)) },
            { id: "delta", name: deltaLabel, values: items.map(change) },
          ]}
        />
      }
    >
      {(width, measuredHeight) => (
        <SlopePlot
          width={width}
          height={measuredHeight}
          items={items}
          colors={colors}
          fromLabel={fromLabel}
          toLabel={toLabel}
          fmt={fmt}
          change={change}
          deltaLabel={deltaLabel}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          title={title}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  items: readonly SlopeItem[];
  colors: readonly string[];
  fromLabel: string;
  toLabel: string;
  fmt: (value: number) => string;
  change: (item: SlopeItem) => string;
  deltaLabel: string;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
  title: string;
}

function SlopePlot({
  width,
  height,
  items,
  colors,
  fromLabel,
  toLabel,
  fmt,
  change,
  deltaLabel,
  tooltip,
  animate,
  labels,
  title,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const narrow = width < 440;

  const model = useMemo(() => {
    const size = narrow ? 11 : 12;
    const side = (pick: (item: SlopeItem) => number) =>
      Math.max(
        ...items.map((item) => estimateTextWidth(`${item.label}  ${fmt(pick(item))}`, size)),
        40,
      ) + 16;
    const room = Math.min(width * (narrow ? 0.4 : 0.34), 230);
    const leftWidth = Math.min(
      room,
      side((item) => item.from),
    );
    const rightWidth = Math.min(
      room,
      side((item) => item.to),
    );
    const xL = leftWidth;
    const xR = Math.max(xL + 40, width - rightWidth);
    const values = items.flatMap((item) => [item.from, item.to]);
    const y = linearScale({
      domain: [Math.min(...values), Math.max(...values)],
      range: [height - MARGIN.top - MARGIN.bottom, 0],
      nice: false,
    });
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const ysFrom = items.map((item) => y.map(item.from));
    const ysTo = items.map((item) => y.map(item.to));
    return {
      size,
      leftWidth,
      rightWidth,
      xL,
      xR,
      innerHeight,
      ysFrom,
      ysTo,
      labelFrom: spreadSlopeLabels(ysFrom, LABEL_GAP, 0, innerHeight),
      labelTo: spreadSlopeLabels(ysTo, LABEL_GAP, 0, innerHeight),
    };
  }, [items, width, height, narrow, fmt]);
  const { size, leftWidth, rightWidth, xL, xR, innerHeight, ysFrom, ysTo, labelFrom, labelTo } =
    model;

  useEntryAnimation(
    svgRef,
    (root) => {
      const lines = root.querySelectorAll("[data-line]");
      const per = Math.min(40, 400 / Math.max(1, lines.length));
      lines.forEach((line, i) => {
        line.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          duration: 620,
          delay: i * per,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 380, 420);
    },
    { disabled: !animate },
  );

  const nearest = (values: readonly number[], target: number) => {
    let best = -1;
    let gap = Number.POSITIVE_INFINITY;
    values.forEach((value, i) => {
      const d = Math.abs(value - target);
      if (d < gap) {
        best = i;
        gap = d;
      }
    });
    return best;
  };
  const indexAt = ({ x, y: py }: { x: number; y: number }): number | null => {
    if (!items.length) return null;
    const ly = py - MARGIN.top;
    if (x <= xL) return nearest(labelFrom, ly);
    if (x >= xR) return nearest(labelTo, ly);
    const t = (x - xL) / (xR - xL);
    const onLine = items.map(
      (_, i) => (ysFrom[i] as number) + ((ysTo[i] as number) - (ysFrom[i] as number)) * t,
    );
    const best = nearest(onLine, ly);
    return Math.abs((onLine[best] as number) - ly) <= 16 ? best : null;
  };

  const current = active != null ? (items[active] as SlopeItem) : null;
  const valueText = current
    ? `${current.label}. ${fromLabel} ${fmt(current.from)}, ${toLabel} ${fmt(current.to)}, ${deltaLabel} ${change(current)}`
    : labels.explore;

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
        <g className="font-bold text-[11px]" style={{ fill: "var(--ink-3)" }}>
          <text x={xL} y={12} textAnchor="middle">
            {fit(fromLabel, leftWidth + 40, 11)}
          </text>
          <text x={xR} y={12} textAnchor="middle">
            {fit(toLabel, rightWidth + 40, 11)}
          </text>
        </g>
        <g transform={`translate(0,${MARGIN.top})`}>
          {[xL, xR].map((x) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={-8}
              y2={innerHeight + 8}
              shapeRendering="crispEdges"
              style={{ stroke: "var(--chart-grid)", strokeWidth: 2 }}
            />
          ))}
          {items.map((item, i) => (
            <Line
              key={item.id ?? item.label}
              x1={xL}
              y1={ysFrom[i] as number}
              x2={xR}
              y2={ysTo[i] as number}
              color={colors[i] as string}
              state={active == null ? "idle" : active === i ? "active" : "muted"}
            />
          ))}
          {items.map((item, i) => {
            const dim = active != null && active !== i;
            const style = {
              fill: active === i ? "var(--ink)" : "var(--ink-2)",
              opacity: dim ? 0.3 : 1,
            };
            return (
              <g key={item.id ?? item.label} data-fade="" className="pointer-events-none">
                <text
                  x={xL - 12}
                  y={labelFrom[i] as number}
                  dy="0.34em"
                  textAnchor="end"
                  className="font-semibold tabular-nums"
                  fontSize={size}
                  style={style}
                >
                  {fit(
                    item.label,
                    leftWidth - 16 - estimateTextWidth(fmt(item.from), size) - 8,
                    size,
                  )}{" "}
                  <tspan className="font-bold" style={{ fill: colors[i] as string }}>
                    {fmt(item.from)}
                  </tspan>
                </text>
                <text
                  x={xR + 12}
                  y={labelTo[i] as number}
                  dy="0.34em"
                  textAnchor="start"
                  className="font-semibold tabular-nums"
                  fontSize={size}
                  style={style}
                >
                  <tspan className="font-bold" style={{ fill: colors[i] as string }}>
                    {fmt(item.to)}
                  </tspan>{" "}
                  {fit(
                    item.label,
                    rightWidth - 16 - estimateTextWidth(fmt(item.to), size) - 8,
                    size,
                  )}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <PlotOverlay
        left={0}
        top={0}
        width={width}
        height={height}
        label={labels.explore}
        count={items.length}
        active={active}
        valueText={valueText}
        onActiveChange={setActive}
        keys="both"
        indexAt={indexAt}
      />
      {tooltip && current && active != null ? (
        <ChartTooltip
          x={(xL + xR) / 2}
          y={MARGIN.top + ((ysFrom[active] as number) + (ysTo[active] as number)) / 2}
          containerWidth={width}
          title={current.label}
          rows={[
            {
              id: "from",
              name: fromLabel,
              value: fmt(current.from),
              color: colors[active] as string,
              shape: "dot",
            },
            {
              id: "to",
              name: toLabel,
              value: fmt(current.to),
              color: colors[active] as string,
              shape: "dot",
            },
            {
              id: "delta",
              name: deltaLabel,
              value: change(current),
              color: "transparent",
              emphasis: true,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
