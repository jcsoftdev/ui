"use client";

import { memo, useId, useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft, estimateTextWidth, GridLines } from "../core/axes.js";
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
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels, type ValueAxisOptions } from "../core/types.js";

export interface DumbbellItem {
  id?: string;
  label: string;
  /** First value (the left or bottom dot). Not needed with `values`. */
  from?: number;
  /** Last value (the right or top dot). Not needed with `values`. */
  to?: number;
  /** Any number of measures per row, in the order of `measures`; wins over `from` and `to`. */
  values?: readonly number[];
}

export interface DumbbellMeasure {
  name: string;
  /** CSS color or token; defaults to the palette slot of the measure. */
  color?: string;
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
  /** Names and colors of the dots when rows have `values`; the first and last are compared by the change. */
  measures?: readonly DumbbellMeasure[];
  /** "vertical" draws a column per category with the dots stacked on the value axis. */
  orientation?: "horizontal" | "vertical";
  valueFormat?: ValueFormat;
  /** Order of the rows; "delta" puts the biggest increase first. */
  sort?: DumbbellSort;
  /** Height of every row in pixels (default 38), horizontal only. */
  rowHeight?: number;
  /**
   * Height of the drawing in pixels, or `"fill"` to take the height of the
   * parent. Horizontal rows stretch to it; by default they size themselves.
   */
  height?: number | "fill";
  /** Width / height ratio; stretches the rows to fit it. */
  aspectRatio?: number;
  /** Change (last minus first value) printed next to each row. `false` hides it. */
  delta?: "absolute" | "percent" | false;
  /** Writes the values next to the dots (default true). */
  valueLabels?: boolean;
  /** Colors the change green when it goes down (e.g. cancellations or waiting time). */
  lowerIsBetter?: boolean;
  /** Axis of the values (bottom axis, or left axis when vertical). */
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

interface Row {
  id: string;
  label: string;
  values: readonly number[];
}

const MARGIN = { top: 8, bottom: 30 };
const DELTA_COLUMN = 64;
const DOT_PAD = 40;
const NEUTRAL_LINE = "var(--line-strong)";

const firstOf = (row: Row) => row.values[0] ?? 0;
const lastOf = (row: Row) => row.values[row.values.length - 1] ?? 0;
const diffOf = (row: Row) => lastOf(row) - firstOf(row);

function toRows(items: readonly DumbbellItem[]): Row[] {
  return items.map((item) => ({
    id: item.id ?? item.label,
    label: item.label,
    values: item.values ?? [item.from ?? 0, item.to ?? 0],
  }));
}

function sortRows(rows: readonly Row[], sort: DumbbellSort): Row[] {
  const list = [...rows];
  if (sort === "delta") list.sort((a, b) => diffOf(b) - diffOf(a));
  else if (sort === "abs-delta") list.sort((a, b) => Math.abs(diffOf(b)) - Math.abs(diffOf(a)));
  else if (sort === "to") list.sort((a, b) => lastOf(b) - lastOf(a));
  return list;
}

function changeText(row: Row, mode: "absolute" | "percent", fmt: (v: number) => string): string {
  const diff = diffOf(row);
  const sign = diff > 0 ? "+" : "";
  if (mode === "percent") {
    return firstOf(row) === 0
      ? "—"
      : `${sign}${formatPercent(diff / Math.abs(firstOf(row)), { decimals: 0 })}`;
  }
  return `${sign}${fmt(diff)}`;
}

function fitLabel(text: string, room: number): string {
  const max = Math.max(3, Math.floor(room / 7));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

interface LinkProps {
  /** Pixel of each dot, in measure order. */
  points: ReadonlyArray<{ x: number; y: number }>;
  colors: readonly string[];
  gradientId: string;
  dimmed: boolean;
  active: boolean;
  /** Highlight band behind the row. */
  band: { x: number; y: number; width: number; height: number };
}

/** The bar and the dots of one row; a gradient joins two measures, a neutral bar joins more. */
const Link = memo(function Link({ points, colors, gradientId, dimmed, active, band }: LinkProps) {
  const first = points[0] ?? { x: 0, y: 0 };
  const last = points[points.length - 1] ?? first;
  const lo = {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
  };
  const hi = {
    x: Math.max(...points.map((point) => point.x)),
    y: Math.max(...points.map((point) => point.y)),
  };
  const gradient = points.length === 2;
  return (
    <g
      className="motion-safe:transition-opacity motion-safe:duration-150"
      style={{ opacity: dimmed ? 0.4 : 1 }}
    >
      {active ? (
        <rect
          x={band.x}
          y={band.y}
          width={band.width}
          height={band.height}
          rx={8}
          style={{ fill: "var(--chart-grid)" }}
        />
      ) : null}
      {gradient ? (
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={first.x}
            y1={first.y}
            x2={last.x === first.x && last.y === first.y ? last.x + 1 : last.x}
            y2={last.y}
          >
            <stop offset="0%" style={{ stopColor: colors[0] }} />
            <stop offset="100%" style={{ stopColor: colors[colors.length - 1] }} />
          </linearGradient>
        </defs>
      ) : null}
      <line
        data-bar=""
        x1={lo.x}
        x2={hi.x}
        y1={lo.y}
        y2={hi.y}
        strokeWidth={4}
        strokeLinecap="round"
        style={{
          stroke: gradient ? `url(#${gradientId})` : NEUTRAL_LINE,
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      />
      {points.map((point, index) => (
        <circle
          // biome-ignore lint/suspicious/noArrayIndexKey: one dot per measure, in order.
          key={index}
          cx={point.x}
          cy={point.y}
          r={(active ? 7 : 6) + (index === points.length - 1 ? 0.5 : 0)}
          strokeWidth={2}
          style={{ fill: colors[index], stroke: "var(--surface)" }}
        />
      ))}
    </g>
  );
});

/**
 * Two or more values per category joined by a bar: the length of the line is
 * the spread, the change is last minus first. Rows run top to bottom, or
 * columns left to right with `orientation="vertical"`; use `sort` to rank by change.
 */
export function DumbbellChart({
  items,
  title,
  description,
  fromLabel = "Before",
  toLabel = "After",
  fromColor: fromOverride,
  toColor: toOverride,
  measures: measuresProp,
  orientation = "horizontal",
  valueFormat,
  sort = "none",
  rowHeight = 38,
  height: heightProp,
  aspectRatio,
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
  const rows = useMemo(() => sortRows(toRows(items), sort), [items, sort]);
  const vertical = orientation === "vertical";
  const measures = useMemo<DumbbellMeasure[]>(() => {
    const widest = Math.max(2, ...rows.map((row) => row.values.length));
    if (measuresProp && measuresProp.length > 0) {
      return Array.from({ length: Math.max(widest, measuresProp.length) }, (_, index) => ({
        name: measuresProp[index]?.name ?? `#${index + 1}`,
        color: measuresProp[index]?.color ?? seriesColor(index),
      }));
    }
    if (widest === 2) {
      return [
        { name: fromLabel, color: fromOverride ?? seriesColor(6) },
        { name: toLabel, color: toOverride ?? seriesColor(0) },
      ];
    }
    return Array.from({ length: widest }, (_, index) => ({
      name: `#${index + 1}`,
      color: seriesColor(index),
    }));
  }, [rows, measuresProp, fromLabel, toLabel, fromOverride, toOverride]);
  const stretch = heightProp != null || aspectRatio != null;
  const plotHeight = rows.length * rowHeight + MARGIN.top + MARGIN.bottom;
  const frameHeight =
    heightProp === "fill"
      ? "fill"
      : typeof heightProp === "number"
        ? heightProp
        : vertical
          ? 320
          : Math.max(plotHeight, 120);

  return (
    <ChartFrame
      height={frameHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={rows.length === 0}
      skeleton="bars"
      legend={
        legend ? (
          <ChartLegend
            items={measures.map((measure, index) => ({
              id: String(index),
              name: measure.name,
              color: measure.color as string,
              shape: "dot" as const,
            }))}
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
            ...measures.map((measure, index) => ({
              id: `m${index}`,
              name: measure.name,
              values: rows.map((row) => (row.values[index] == null ? "" : fmt(row.values[index]))),
            })),
            {
              id: "delta",
              name: deltaLabel,
              values: rows.map((row) => changeText(row, delta || "absolute", fmt)),
            },
          ]}
        />
      }
    >
      {(width, measuredHeight) => (
        <DumbbellPlot
          width={width}
          height={vertical ? measuredHeight : stretch ? measuredHeight : plotHeight}
          rows={rows}
          measures={measures}
          fmt={fmt}
          valueFormat={valueFormat}
          vertical={vertical}
          rowHeight={
            stretch
              ? Math.max(20, (measuredHeight - MARGIN.top - MARGIN.bottom) / rows.length)
              : rowHeight
          }
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
  rows: readonly Row[];
  measures: readonly DumbbellMeasure[];
  fmt: (value: number) => string;
  valueFormat?: ValueFormat;
  vertical: boolean;
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
  measures,
  fmt,
  valueFormat,
  vertical,
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
  const narrow = width < 440;
  const dotPad = narrow ? 14 : DOT_PAD;
  const deltaColumn = narrow ? 50 : DELTA_COLUMN;
  const colors = measures.map((measure) => measure.color as string);

  const model = useMemo(() => {
    const all = rows.flatMap((row) => row.values);
    const lo = all.length ? Math.min(...all) : 0;
    const hi = all.length ? Math.max(...all) : 1;
    const domain: [number, number] = [
      xAxis?.min ?? (lo > 0 && lo < hi * 0.4 ? 0 : lo),
      xAxis?.max ?? hi,
    ];
    const format = resolveAxisFormat(xAxis?.format ?? valueFormat);
    if (vertical) {
      const top = delta ? 26 : 12;
      const innerHeight = Math.max(60, height - top - 30);
      const pad = 14;
      const y = linearScale({
        domain,
        range: [innerHeight - pad, pad],
        tickCount: xAxis?.tickCount ?? Math.max(3, Math.round(innerHeight / 52)),
      });
      const ticks = y
        .ticks()
        .map((tick) => ({ key: tick, position: y.map(tick), label: format(tick) }));
      const left = Math.max(...ticks.map((tick) => estimateTextWidth(tick.label)), 16) + 18;
      const innerWidth = Math.max(60, width - left - 8);
      const column = innerWidth / Math.max(1, rows.length);
      return {
        vertical: true as const,
        top,
        left,
        innerWidth,
        innerHeight,
        column,
        scale: y,
        ticks,
      };
    }
    const left = Math.min(
      Math.max(72, width * (narrow ? 0.3 : 0.28)),
      Math.max(...rows.map((row) => estimateTextWidth(row.label, 13)), 40) + 16,
    );
    const rightPad = delta ? deltaColumn : 8;
    const innerWidth = Math.max(60, width - left - rightPad);
    const x = linearScale({
      domain,
      range: [dotPad, innerWidth - dotPad],
      tickCount: xAxis?.tickCount ?? Math.max(3, Math.round(innerWidth / 90)),
    });
    const ticks = x
      .ticks()
      .map((tick) => ({ key: tick, position: x.map(tick), label: format(tick) }));
    return {
      vertical: false as const,
      top: MARGIN.top,
      left,
      innerWidth,
      innerHeight: rows.length * rowHeight,
      column: 0,
      scale: x,
      ticks,
    };
  }, [
    rows,
    width,
    height,
    delta,
    xAxis,
    valueFormat,
    narrow,
    dotPad,
    deltaColumn,
    vertical,
    rowHeight,
  ]);
  const { top, left, innerWidth, innerHeight, column, scale, ticks } = model;

  useEntryAnimation(
    svgRef,
    (root) => {
      const lines = root.querySelectorAll("[data-bar]");
      const per = Math.min(50, 400 / Math.max(1, lines.length));
      const [from, to] = vertical ? ["scaleY(0)", "scaleY(1)"] : ["scaleX(0)", "scaleX(1)"];
      lines.forEach((line, i) => {
        line.animate([{ transform: from }, { transform: to }], {
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

  const current = active != null ? (rows[active] as Row) : null;
  const goodUp = !lowerIsBetter;
  const deltaColor = (row: Row) => {
    const direction = directionOf(diffOf(row));
    if (direction === "flat") return DIRECTION_COLORS.flat;
    return (direction === "up") === goodUp ? DIRECTION_COLORS.up : DIRECTION_COLORS.down;
  };
  const measureText = (row: Row) =>
    measures.map((measure, index) => `${measure.name} ${fmt(row.values[index] ?? 0)}`).join(", ");
  const valueText = current
    ? `${current.label}. ${measureText(current)}, ${deltaLabel} ${changeText(current, delta || "absolute", fmt)}`
    : labels.explore;
  const showValues = valueLabels && (vertical ? column >= 64 : !narrow);

  const tooltipRows = (row: Row): TooltipRow[] => [
    ...measures.map((measure, index) => ({
      id: String(index),
      name: measure.name,
      value: fmt(row.values[index] ?? 0),
      color: measure.color as string,
      shape: "dot" as const,
    })),
    {
      id: "delta",
      name: deltaLabel,
      value: changeText(row, delta || "absolute", fmt),
      color: "transparent",
      emphasis: true,
    },
  ];

  const pixels = (row: Row) => row.values.map((value) => scale.map(value));
  const span = (row: Row) => {
    const px = pixels(row);
    return px.reduce((sum, value) => sum + value, 0) / Math.max(1, px.length) || 0;
  };

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
        <g transform={`translate(${left},${top})`}>
          {vertical ? (
            <>
              {grid ? <GridLines ticks={ticks} direction="horizontal" length={innerWidth} /> : null}
              <AxisLeft ticks={ticks} offset={0} />
              <AxisBottom
                ticks={rows.map((row, i) => ({
                  key: row.id,
                  position: i * column + column / 2,
                  label: fitLabel(row.label, column - 6),
                }))}
                offset={innerHeight}
              />
            </>
          ) : (
            <>
              {grid ? <GridLines ticks={ticks} direction="vertical" length={innerHeight} /> : null}
              <AxisBottom ticks={ticks} offset={innerHeight} />
            </>
          )}
          {rows.map((row, i) => {
            const dimmed = active != null && active !== i;
            const px = pixels(row);
            const lowPx = Math.min(...px);
            const highPx = Math.max(...px);
            if (vertical) {
              const cx = i * column + column / 2;
              return (
                <g key={row.id}>
                  <Link
                    points={px.map((y) => ({ x: cx, y }))}
                    colors={colors}
                    gradientId={`${uid}-g${i}`}
                    dimmed={dimmed}
                    active={active === i}
                    band={{ x: i * column + 2, y: 0, width: column - 4, height: innerHeight }}
                  />
                  {showValues ? (
                    <g
                      data-fade=""
                      className="font-bold text-[11px] tabular-nums"
                      style={{ fill: "var(--ink-2)", opacity: dimmed ? 0.4 : 1 }}
                    >
                      {row.values.map((value, index) => (
                        <text
                          // biome-ignore lint/suspicious/noArrayIndexKey: one label per measure, in order.
                          key={index}
                          x={cx + 12}
                          y={px[index] as number}
                          dy="0.34em"
                          textAnchor="start"
                        >
                          {fmt(value)}
                        </text>
                      ))}
                    </g>
                  ) : null}
                  {delta ? (
                    <text
                      data-fade=""
                      x={cx}
                      y={-10}
                      textAnchor="middle"
                      className="font-bold text-[12px] tabular-nums"
                      style={{ fill: deltaColor(row), opacity: dimmed ? 0.4 : 1 }}
                    >
                      {changeText(row, delta, fmt)}
                    </text>
                  ) : null}
                </g>
              );
            }
            const cy = i * rowHeight + rowHeight / 2;
            return (
              <g key={row.id}>
                <Link
                  points={px.map((x) => ({ x, y: cy }))}
                  colors={colors}
                  gradientId={`${uid}-g${i}`}
                  dimmed={dimmed}
                  active={active === i}
                  band={{
                    x: 0,
                    y: cy - (rowHeight - 4) / 2,
                    width: innerWidth + (delta ? deltaColumn : 0),
                    height: rowHeight - 4,
                  }}
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
                  {fitLabel(row.label, left - 14)}
                </text>
                {showValues ? (
                  <g
                    data-fade=""
                    className="font-bold text-[11px] tabular-nums"
                    style={{ fill: "var(--ink-2)", opacity: dimmed ? 0.4 : 1 }}
                  >
                    {row.values.length === 2 ? (
                      <>
                        <text x={lowPx - 12} y={cy} dy="0.34em" textAnchor="end">
                          {fmt(
                            px[0] === lowPx ? (row.values[0] as number) : (row.values[1] as number),
                          )}
                        </text>
                        <text x={highPx + 12} y={cy} dy="0.34em" textAnchor="start">
                          {fmt(
                            px[0] === lowPx ? (row.values[1] as number) : (row.values[0] as number),
                          )}
                        </text>
                      </>
                    ) : (
                      row.values.map((value, index) => (
                        <text
                          // biome-ignore lint/suspicious/noArrayIndexKey: one label per measure, in order.
                          key={index}
                          x={px[index] as number}
                          y={cy - 12}
                          textAnchor="middle"
                        >
                          {fmt(value)}
                        </text>
                      ))
                    )}
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
        left={vertical ? left : 0}
        top={top}
        width={vertical ? innerWidth : width}
        height={innerHeight}
        label={labels.explore}
        count={rows.length}
        active={active}
        valueText={valueText}
        onActiveChange={setActive}
        keys={vertical ? "horizontal" : "vertical"}
        indexAt={({ x, y }) => {
          if (!rows.length) return null;
          const index = vertical ? Math.floor(x / column) : Math.floor(y / rowHeight);
          return Math.min(rows.length - 1, Math.max(0, index));
        }}
      />
      {tooltip && current && active != null ? (
        <ChartTooltip
          x={vertical ? left + active * column + column / 2 : left + span(current)}
          y={vertical ? top + span(current) : top + active * rowHeight + rowHeight / 2}
          containerWidth={width}
          title={current.label}
          rows={tooltipRows(current)}
        />
      ) : null}
    </div>
  );
}
