"use client";

import { memo, useId, useMemo, useRef, useState } from "react";
import { AxisBottom, estimateTextWidth, GridLines } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import {
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "../core/format.js";
import { ChartLegend } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { DIRECTION_COLORS, directionOf, seriesColor } from "../core/palette.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels, type ValueAxisOptions } from "../core/types.js";

export interface DumbbellItem {
  id?: string;
  label: string;
  from: number;
  to: number;
}

export type DumbbellSort = "none" | "delta" | "abs-delta" | "to";

export interface DumbbellChartProps {
  items: readonly DumbbellItem[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Name of the first value (the left dot), e.g. "Mes pasado". */
  fromLabel?: string;
  /** Name of the second value (the right dot), e.g. "Este mes". */
  toLabel?: string;
  fromColor?: string;
  toColor?: string;
  valueFormat?: ValueFormat;
  /** Order of the rows; "delta" puts the biggest increase first. */
  sort?: DumbbellSort;
  /** Height of every row in pixels (default 38). */
  rowHeight?: number;
  /** Change printed at the end of each row. `false` hides it. */
  delta?: "absolute" | "percent" | false;
  /** Writes both values next to the dots (default true). */
  valueLabels?: boolean;
  /** Colors the change green when it goes down (e.g. cancellations or waiting time). */
  lowerIsBetter?: boolean;
  xAxis?: ValueAxisOptions;
  grid?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  deltaLabel?: string;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const MARGIN = { top: 8, bottom: 30 };
const DELTA_COLUMN = 64;
const DOT_PAD = 40;

function sortItems(items: readonly DumbbellItem[], sort: DumbbellSort): DumbbellItem[] {
  const list = [...items];
  if (sort === "delta") list.sort((a, b) => b.to - b.from - (a.to - a.from));
  else if (sort === "abs-delta")
    list.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
  else if (sort === "to") list.sort((a, b) => b.to - a.to);
  return list;
}

function changeText(
  item: DumbbellItem,
  mode: "absolute" | "percent",
  fmt: (v: number) => string,
): string {
  const diff = item.to - item.from;
  const sign = diff > 0 ? "+" : "";
  if (mode === "percent") {
    return item.from === 0
      ? "—"
      : `${sign}${formatPercent(diff / Math.abs(item.from), { decimals: 0 })}`;
  }
  return `${sign}${fmt(diff)}`;
}

function fitLabel(text: string, room: number): string {
  const max = Math.max(3, Math.floor(room / 7));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

const Row = memo(function Row({
  y,
  x1,
  x2,
  gradientId,
  fromColor,
  toColor,
  dimmed,
  active,
  rowHeight,
  width,
}: {
  y: number;
  x1: number;
  x2: number;
  gradientId: string;
  fromColor: string;
  toColor: string;
  dimmed: boolean;
  active: boolean;
  rowHeight: number;
  width: number;
}) {
  return (
    <g
      className="motion-safe:transition-opacity motion-safe:duration-150"
      style={{ opacity: dimmed ? 0.4 : 1 }}
    >
      {active ? (
        <rect
          x={0}
          y={y - rowHeight / 2}
          width={width}
          height={rowHeight}
          rx={8}
          style={{ fill: "var(--chart-grid)" }}
        />
      ) : null}
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={x1}
          x2={x2 === x1 ? x1 + 1 : x2}
          y1={0}
          y2={0}
        >
          <stop offset="0%" style={{ stopColor: fromColor }} />
          <stop offset="100%" style={{ stopColor: toColor }} />
        </linearGradient>
      </defs>
      <line
        data-bar=""
        x1={x1}
        x2={x2}
        y1={y}
        y2={y}
        strokeWidth={4}
        strokeLinecap="round"
        style={{
          stroke: `url(#${gradientId})`,
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      />
      <circle
        cx={x1}
        cy={y}
        r={active ? 7 : 6}
        strokeWidth={2}
        style={{ fill: fromColor, stroke: "var(--surface)" }}
      />
      <circle
        cx={x2}
        cy={y}
        r={active ? 7.5 : 6.5}
        strokeWidth={2}
        style={{ fill: toColor, stroke: "var(--surface)" }}
      />
    </g>
  );
});

/**
 * Two values per category joined by a bar: the length of the line is the
 * change. Rows run top to bottom; use `sort` to rank by change.
 */
export function DumbbellChart({
  items,
  title,
  description,
  fromLabel = "Before",
  toLabel = "After",
  fromColor: fromOverride,
  toColor: toOverride,
  valueFormat,
  sort = "none",
  rowHeight = 38,
  delta = "absolute",
  valueLabels = true,
  lowerIsBetter = false,
  xAxis,
  grid = true,
  legend = true,
  tooltip = true,
  loading,
  animate = true,
  deltaLabel = "Change",
  labels: labelOverrides,
  className,
}: DumbbellChartProps) {
  const labels = resolveLabels(labelOverrides);
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const rows = useMemo(() => sortItems(items, sort), [items, sort]);
  const fromColor = fromOverride ?? seriesColor(6);
  const toColor = toOverride ?? seriesColor(0);
  const plotHeight = rows.length * rowHeight + MARGIN.top + MARGIN.bottom;

  return (
    <ChartFrame
      height={Math.max(plotHeight, 120)}
      labels={labels}
      loading={loading}
      empty={rows.length === 0}
      skeleton="bars"
      legend={
        legend ? (
          <ChartLegend
            items={[
              { id: "from", name: fromLabel, color: fromColor, shape: "dot" },
              { id: "to", name: toLabel, color: toColor, shape: "dot" },
            ]}
          />
        ) : null
      }
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={rows.map((row) => row.label)}
          columns={[
            { id: "from", name: fromLabel, values: rows.map((row) => fmt(row.from)) },
            { id: "to", name: toLabel, values: rows.map((row) => fmt(row.to)) },
            {
              id: "delta",
              name: deltaLabel,
              values: rows.map((row) => changeText(row, delta || "absolute", fmt)),
            },
          ]}
        />
      }
    >
      {(width) => (
        <DumbbellPlot
          width={width}
          height={plotHeight}
          rows={rows}
          fromLabel={fromLabel}
          toLabel={toLabel}
          fromColor={fromColor}
          toColor={toColor}
          fmt={fmt}
          valueFormat={valueFormat}
          rowHeight={rowHeight}
          delta={delta}
          valueLabels={valueLabels}
          lowerIsBetter={lowerIsBetter}
          xAxis={xAxis}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          deltaLabel={deltaLabel}
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
  rows: readonly DumbbellItem[];
  fromLabel: string;
  toLabel: string;
  fromColor: string;
  toColor: string;
  fmt: (value: number) => string;
  valueFormat?: ValueFormat;
  rowHeight: number;
  delta: "absolute" | "percent" | false;
  valueLabels: boolean;
  lowerIsBetter: boolean;
  xAxis?: ValueAxisOptions;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  deltaLabel: string;
  labels: ChartLabels;
  title: string;
}

function DumbbellPlot({
  width,
  height,
  rows,
  fromLabel,
  toLabel,
  fromColor,
  toColor,
  fmt,
  valueFormat,
  rowHeight,
  delta,
  valueLabels,
  lowerIsBetter,
  xAxis,
  grid,
  tooltip,
  animate,
  deltaLabel,
  labels,
  title,
}: PlotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const innerHeight = rows.length * rowHeight;
  const narrow = width < 440;
  const dotPad = narrow ? 14 : DOT_PAD;
  const deltaColumn = narrow ? 50 : DELTA_COLUMN;
  const showValues = valueLabels && !narrow;

  const model = useMemo(() => {
    const labelWidth = Math.min(
      Math.max(72, width * (narrow ? 0.3 : 0.28)),
      Math.max(...rows.map((row) => estimateTextWidth(row.label, 13)), 40) + 16,
    );
    const rightPad = delta ? deltaColumn : 8;
    const innerWidth = Math.max(60, width - labelWidth - rightPad);
    const values = rows.flatMap((row) => [row.from, row.to]);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const x = linearScale({
      domain: [xAxis?.min ?? (lo > 0 && lo < hi * 0.4 ? 0 : lo), xAxis?.max ?? hi],
      range: [dotPad, innerWidth - dotPad],
      tickCount: xAxis?.tickCount ?? Math.max(3, Math.round(innerWidth / 90)),
    });
    const format = resolveAxisFormat(xAxis?.format ?? valueFormat);
    const ticks = x
      .ticks()
      .map((tick) => ({ key: tick, position: x.map(tick), label: format(tick) }));
    return { labelWidth, innerWidth, x, ticks };
  }, [rows, width, delta, xAxis, valueFormat, narrow, dotPad, deltaColumn]);
  const { labelWidth, innerWidth, x, ticks } = model;

  useEntryAnimation(
    svgRef,
    (root) => {
      const lines = root.querySelectorAll("[data-bar]");
      const per = Math.min(50, 400 / Math.max(1, lines.length));
      lines.forEach((line, i) => {
        line.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          duration: 560,
          delay: i * per,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 360, 420);
    },
    { disabled: !animate },
  );

  const current = active != null ? (rows[active] as DumbbellItem) : null;
  const goodUp = !lowerIsBetter;
  const deltaColor = (item: DumbbellItem) => {
    const direction = directionOf(item.to - item.from);
    if (direction === "flat") return DIRECTION_COLORS.flat;
    return (direction === "up") === goodUp ? DIRECTION_COLORS.up : DIRECTION_COLORS.down;
  };
  const valueText = current
    ? `${current.label}. ${fromLabel} ${fmt(current.from)}, ${toLabel} ${fmt(current.to)}, ${deltaLabel} ${changeText(current, delta || "absolute", fmt)}`
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
        <g transform={`translate(${labelWidth},${MARGIN.top})`}>
          {grid ? <GridLines ticks={ticks} direction="vertical" length={innerHeight} /> : null}
          <AxisBottom ticks={ticks} offset={innerHeight} />
          {rows.map((row, i) => {
            const cy = i * rowHeight + rowHeight / 2;
            const a = x.map(row.from);
            const b = x.map(row.to);
            const dimmed = active != null && active !== i;
            const left = Math.min(a, b);
            const right = Math.max(a, b);
            return (
              <g key={row.id ?? row.label}>
                <Row
                  y={cy}
                  x1={a}
                  x2={b}
                  gradientId={`${uid}-g${i}`}
                  fromColor={fromColor}
                  toColor={toColor}
                  dimmed={dimmed}
                  active={active === i}
                  rowHeight={rowHeight - 4}
                  width={innerWidth + (delta ? deltaColumn : 0)}
                />
                <text
                  x={-12}
                  y={cy}
                  dy="0.34em"
                  textAnchor="end"
                  className="font-semibold text-[12px]"
                  style={{
                    fill: active === i ? "var(--ink)" : "var(--ink-2)",
                    opacity: dimmed ? 0.5 : 1,
                  }}
                >
                  {fitLabel(row.label, labelWidth - 14)}
                </text>
                {showValues ? (
                  <g
                    data-fade=""
                    className="font-bold text-[11px] tabular-nums"
                    style={{ fill: "var(--ink-2)", opacity: dimmed ? 0.4 : 1 }}
                  >
                    <text x={left - 12} y={cy} dy="0.34em" textAnchor="end">
                      {fmt(a <= b ? row.from : row.to)}
                    </text>
                    <text x={right + 12} y={cy} dy="0.34em" textAnchor="start">
                      {fmt(a <= b ? row.to : row.from)}
                    </text>
                  </g>
                ) : null}
                {delta ? (
                  <text
                    data-fade=""
                    x={innerWidth + deltaColumn - 4}
                    y={cy}
                    dy="0.34em"
                    textAnchor="end"
                    className="font-bold text-[12px] tabular-nums"
                    style={{ fill: deltaColor(row), opacity: dimmed ? 0.4 : 1 }}
                  >
                    {changeText(row, delta, fmt)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      <PlotOverlay
        left={0}
        top={MARGIN.top}
        width={width}
        height={innerHeight}
        label={labels.explore}
        count={rows.length}
        active={active}
        valueText={valueText}
        onActiveChange={setActive}
        keys="vertical"
        indexAt={({ y }) =>
          rows.length ? Math.min(rows.length - 1, Math.max(0, Math.floor(y / rowHeight))) : null
        }
      />
      {tooltip && current && active != null ? (
        <ChartTooltip
          x={labelWidth + (x.map(current.from) + x.map(current.to)) / 2}
          y={MARGIN.top + active * rowHeight + rowHeight / 2}
          containerWidth={width}
          title={current.label}
          rows={[
            {
              id: "from",
              name: fromLabel,
              value: fmt(current.from),
              color: fromColor,
              shape: "dot",
            },
            { id: "to", name: toLabel, value: fmt(current.to), color: toColor, shape: "dot" },
            {
              id: "delta",
              name: deltaLabel,
              value: changeText(current, delta || "absolute", fmt),
              color: "transparent",
              emphasis: true,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
