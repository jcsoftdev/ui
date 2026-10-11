"use client";

import { useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft, estimateTextWidth, GridLines, thinTicks } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveAxisFormat, resolveFormat, type ValueFormat } from "../core/format.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { bandScale } from "../core/scales/band.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels, type ValueAxisOptions } from "../core/types.js";

export interface LollipopItem {
  id?: string;
  label: string;
  value: number;
  /** CSS color or token for this stick; defaults to the chart color. */
  color?: string;
}

export interface LollipopChartProps {
  items: readonly LollipopItem[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Name of the measure (tooltip and data table). */
  seriesName?: string;
  /** Color of the sticks and dots (default: the brand slot of the palette). */
  color?: string;
  orientation?: "horizontal" | "vertical";
  /** Largest first, smallest first, or in data order (default). */
  sort?: "none" | "desc" | "asc";
  valueFormat?: ValueFormat;
  /** Height in pixels, `"fill"` for the parent height. Rows size themselves in horizontal charts when omitted. */
  height?: number | "fill";
  aspectRatio?: number;
  /** Height of every row in pixels (default 34), horizontal charts without `height`. */
  rowHeight?: number;
  /** Radius of the dots in pixels (default 7). */
  dotSize?: number;
  /** Values printed beside the dots (default true). */
  dataLabels?: boolean;
  yAxis?: ValueAxisOptions;
  grid?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const PAD = { top: 12, bottom: 28 };

function fitLabel(text: string, room: number): string {
  const max = Math.max(3, Math.floor(room / 6.6));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * A stick and a dot per category: the quiet cousin of the bar chart, good for
 * many categories or when the exact end value matters more than the area.
 * Negative values hang from the zero line.
 */
export function LollipopChart({
  items,
  title,
  description,
  seriesName = "Value",
  color,
  orientation = "horizontal",
  sort = "none",
  valueFormat,
  height,
  aspectRatio,
  rowHeight = 34,
  dotSize = 7,
  dataLabels = true,
  yAxis,
  grid = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelOverrides,
  className,
}: LollipopChartProps) {
  const labels = resolveLabels(labelOverrides);
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const rows = useMemo(() => {
    const list = [...items];
    if (sort === "desc") list.sort((a, b) => b.value - a.value);
    else if (sort === "asc") list.sort((a, b) => a.value - b.value);
    return list;
  }, [items, sort]);
  const vertical = orientation === "vertical";
  const fixed = height != null || aspectRatio != null || vertical;
  const frameHeight =
    height === "fill"
      ? "fill"
      : typeof height === "number"
        ? height
        : vertical
          ? 300
          : Math.max(120, rows.length * rowHeight + PAD.top + PAD.bottom);

  return (
    <ChartFrame
      height={frameHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={rows.length === 0}
      skeleton="bars"
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={rows.map((row) => row.label)}
          columns={[{ id: "value", name: seriesName, values: rows.map((row) => fmt(row.value)) }]}
        />
      }
    >
      {(width, measuredHeight) => (
        <LollipopPlot
          width={width}
          height={
            fixed ? measuredHeight : Math.max(120, rows.length * rowHeight + PAD.top + PAD.bottom)
          }
          rows={rows}
          seriesName={seriesName}
          color={color ?? seriesColor(0)}
          vertical={vertical}
          fmt={fmt}
          valueFormat={valueFormat}
          dotSize={dotSize}
          dataLabels={dataLabels}
          yAxis={yAxis}
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

interface PlotProps {
  width: number;
  height: number;
  rows: readonly LollipopItem[];
  seriesName: string;
  color: string;
  vertical: boolean;
  fmt: (value: number) => string;
  valueFormat?: ValueFormat;
  dotSize: number;
  dataLabels: boolean;
  yAxis?: ValueAxisOptions;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
  title: string;
}

function LollipopPlot({
  width,
  height,
  rows,
  seriesName,
  color,
  vertical,
  fmt,
  valueFormat,
  dotSize,
  dataLabels,
  yAxis,
  grid,
  tooltip,
  animate,
  labels,
  title,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const model = useMemo(() => {
    const values = rows.map((row) => row.value);
    const domain: [number, number] = [
      yAxis?.min ?? Math.min(0, ...values),
      yAxis?.max ?? Math.max(0, ...values),
    ];
    const format = resolveAxisFormat(yAxis?.format ?? valueFormat);
    const top = PAD.top + (vertical && dataLabels ? 8 : 0);
    const innerHeight = Math.max(40, height - top - PAD.bottom);
    if (vertical) {
      const scale = linearScale({
        domain,
        range: [innerHeight, 0],
        tickCount: yAxis?.tickCount ?? Math.max(2, Math.round(innerHeight / 52)),
      });
      const ticks = scale
        .ticks()
        .map((tick) => ({ key: tick, position: scale.map(tick), label: format(tick) }));
      const left = Math.max(...ticks.map((tick) => estimateTextWidth(tick.label)), 16) + 14;
      const innerWidth = Math.max(40, width - left - 10);
      const band = bandScale({
        count: rows.length,
        range: [0, innerWidth],
        paddingInner: 0.3,
        paddingOuter: 0.15,
      });
      const catTicks = thinTicks(
        rows.map((row, i) => ({
          key: row.id ?? row.label,
          position: band.center(i),
          label: row.label,
        })),
        12,
      );
      return { top, left, innerWidth, innerHeight, scale, ticks, band, catTicks };
    }
    const left = Math.min(
      width * 0.36,
      Math.max(48, ...rows.map((row) => estimateTextWidth(row.label, 12))) + 14,
    );
    const innerWidth = Math.max(40, width - left - (dataLabels ? 56 : 14));
    const scale = linearScale({
      domain,
      range: [0, innerWidth],
      tickCount: yAxis?.tickCount ?? Math.max(2, Math.round(innerWidth / 110)),
    });
    const ticks = scale
      .ticks()
      .map((tick) => ({ key: tick, position: scale.map(tick), label: format(tick) }));
    const band = bandScale({
      count: rows.length,
      range: [0, innerHeight],
      paddingInner: 0.2,
      paddingOuter: 0.1,
    });
    const catTicks = rows.map((row, i) => ({
      key: row.id ?? row.label,
      position: band.center(i),
      label: fitLabel(row.label, left - 14),
    }));
    return { top, left, innerWidth, innerHeight, scale, ticks, band, catTicks };
  }, [rows, width, height, yAxis, valueFormat, vertical, dataLabels]);
  const { top, left, innerWidth, innerHeight, scale, ticks, band, catTicks } = model;
  const zero = scale.map(0);

  useEntryAnimation(
    svgRef,
    (root) => {
      const sticks = root.querySelectorAll("[data-stick]");
      const per = Math.min(40, 360 / Math.max(1, sticks.length));
      const [from, to] = vertical ? ["scaleY(0)", "scaleY(1)"] : ["scaleX(0)", "scaleX(1)"];
      sticks.forEach((stick, i) => {
        stick.animate([{ transform: from }, { transform: to }], {
          duration: 520,
          delay: i * per,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 360, 420);
    },
    { disabled: !animate },
  );

  const current = active != null ? (rows[active] as LollipopItem) : null;
  const valueText = current ? `${current.label}: ${fmt(current.value)}` : labels.explore;
  const endOf = (value: number) => scale.map(value);

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
          {grid ? (
            <GridLines
              ticks={ticks}
              direction={vertical ? "horizontal" : "vertical"}
              length={vertical ? innerWidth : innerHeight}
              zero={zero}
            />
          ) : null}
          {vertical ? (
            <>
              <AxisLeft ticks={ticks} offset={0} title={yAxis?.title} />
              <AxisBottom ticks={catTicks} offset={innerHeight} />
            </>
          ) : (
            <>
              <AxisLeft ticks={catTicks} offset={0} />
              <AxisBottom ticks={ticks} offset={innerHeight} />
            </>
          )}
          {rows.map((row, i) => {
            const fill = row.color ?? color;
            const center = band.center(i);
            const end = endOf(row.value);
            const dimmed = active != null && active !== i;
            const negative = row.value < 0;
            const radius = active === i ? dotSize + 1.5 : dotSize;
            const cx = vertical ? center : end;
            const cy = vertical ? end : center;
            return (
              <g
                key={row.id ?? row.label}
                className="motion-safe:transition-opacity motion-safe:duration-150"
                style={{ opacity: dimmed ? 0.4 : 1 }}
              >
                <line
                  data-stick=""
                  x1={vertical ? center : zero}
                  x2={cx}
                  y1={vertical ? zero : center}
                  y2={cy}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  style={{
                    stroke: fill,
                    transformBox: "fill-box",
                    transformOrigin: vertical
                      ? negative
                        ? "center top"
                        : "center bottom"
                      : negative
                        ? "right center"
                        : "left center",
                  }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  strokeWidth={2}
                  style={{ fill, stroke: "var(--surface)" }}
                />
                {dataLabels ? (
                  <text
                    data-fade=""
                    x={vertical ? cx : cx + (negative ? -(radius + 6) : radius + 6)}
                    y={vertical ? cy + (negative ? radius + 14 : -(radius + 6)) : cy}
                    dy={vertical ? undefined : "0.34em"}
                    textAnchor={vertical ? "middle" : negative ? "end" : "start"}
                    className="font-bold text-fs-110 tabular-nums"
                    style={{ fill: "var(--ink-2)" }}
                  >
                    {fmt(row.value)}
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
        indexAt={({ x, y }) => (rows.length ? band.indexAt(vertical ? x : y) : null)}
      />
      {tooltip && current && active != null ? (
        <ChartTooltip
          x={vertical ? left + band.center(active) : left + endOf(current.value)}
          y={vertical ? top + endOf(current.value) : top + band.center(active)}
          containerWidth={width}
          title={current.label}
          rows={[
            {
              id: "value",
              name: seriesName,
              value: fmt(current.value),
              color: current.color ?? color,
              shape: "dot",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
