"use client";

import { memo, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { PlotExplorer } from "../core/distribution/explorer.js";
import { type DistributionLabels, resolveDistributionLabels } from "../core/distribution/labels.js";
import {
  categoryLayout,
  type DistributionAxisOptions,
  nearestPoint,
  tooltipFit,
} from "../core/distribution/layout.js";
import { CategoryAxes } from "../core/distribution/marks.js";
import { beeswarm } from "../core/distribution/stats.js";
import { type ColoredSeries, useDistributionLegend } from "../core/distribution/use-legend.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { useEntryAnimation } from "../core/motion.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";

export interface BeeswarmPoint {
  value: number;
  /** Row (or column) of the point; all points share one row when omitted. */
  category?: string;
  /** Drives the radius (area-proportional) when the chart has sizes. */
  size?: number;
  /** Name shown in the tooltip and data table, e.g. the client. */
  label?: string;
}

export interface BeeswarmSeries {
  id: string;
  name: string;
  points: readonly BeeswarmPoint[];
  color?: string;
}

export interface BeeswarmChartProps {
  title: string;
  /** Colors and legend; points of every series share the rows. */
  series: readonly BeeswarmSeries[];
  /** Row order; derived from the points (first seen first) when omitted. */
  categories?: readonly string[];
  /** "horizontal": values along x, one row per category. "vertical": one column per category. */
  orientation?: "horizontal" | "vertical";
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  /** Radius of every point when there are no sizes (pixels). */
  radius?: number;
  /** Radius range for sized points: the largest size gets `max`, area-proportional. */
  sizeRange?: readonly [number, number];
  sizeFormat?: ValueFormat;
  /** Space between points (pixels). */
  gap?: number;
  /** Height of the drawing; grows with the number of rows by default. */
  height?: number;
  legend?: boolean | "top" | "bottom";
  grid?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<DistributionLabels>;
  className?: string;
}

interface PlacedPoint {
  key: string;
  series: ColoredSeries<BeeswarmSeries>;
  point: BeeswarmPoint;
  category: number;
  x: number;
  y: number;
  r: number;
}

/**
 * Beeswarm: every observation is a dot on the value axis, nudged sideways
 * just enough that no two overlap, so clusters read as density while each
 * point stays individually explorable.
 */
export function BeeswarmChart({
  title,
  series,
  categories: categoriesProp,
  orientation = "horizontal",
  valueFormat,
  valueAxis,
  radius = 4.5,
  sizeRange = [3, 14],
  sizeFormat,
  gap = 1.25,
  height: heightProp,
  legend,
  grid = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelsProp,
  className,
}: BeeswarmChartProps) {
  const labels = resolveDistributionLabels(labelsProp);
  const legendState = useDistributionLegend(series, legend, "dot");
  const categories = useMemo(() => {
    if (categoriesProp) return categoriesProp;
    const seen: string[] = [];
    for (const item of series) {
      for (const point of item.points) {
        const name = point.category ?? "";
        if (!seen.includes(name)) seen.push(name);
      }
    }
    return seen.length ? seen : [""];
  }, [categoriesProp, series]);
  const height =
    heightProp ?? (orientation === "horizontal" ? Math.max(200, categories.length * 96 + 48) : 340);
  const format = resolveFormat(valueFormat);
  const formatSize = resolveFormat(sizeFormat);
  const sized = series.some((item) => item.points.some((point) => point.size != null));
  const empty = !series.some((item) => item.points.some((point) => Number.isFinite(point.value)));
  const tableRows = legendState.all.flatMap((item) =>
    item.source.points
      .filter((point) => Number.isFinite(point.value))
      .map((point, index) => ({ item, point, index })),
  );
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
      table={
        <ChartDataTable
          caption={title}
          categoryHeader={labels.point}
          categories={tableRows.map(
            ({ item, point, index }) =>
              point.label ?? `${point.category ?? item.name} ${index + 1}`,
          )}
          columns={[
            { id: "series", name: labels.series, values: tableRows.map(({ item }) => item.name) },
            {
              id: "row",
              name: labels.category,
              values: tableRows.map(({ point }) => point.category ?? ""),
            },
            {
              id: "value",
              name: labels.value,
              values: tableRows.map(({ point }) => format(point.value)),
            },
            ...(sized
              ? [
                  {
                    id: "size",
                    name: labels.size,
                    values: tableRows.map(({ point }) =>
                      point.size != null ? formatSize(point.size) : "",
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      {(width) => (
        <BeeswarmPlot
          width={width}
          height={height}
          title={title}
          categories={categories}
          visible={legendState.visible}
          orientation={orientation}
          valueFormat={valueFormat}
          valueAxis={valueAxis}
          radius={radius}
          sizeRange={sized ? sizeRange : null}
          sizeFormat={sizeFormat}
          gap={gap}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          isDimmed={legendState.isDimmed}
        />
      )}
    </ChartFrame>
  );
}

const Dots = memo(function Dots({
  points,
  isDimmed,
}: {
  points: readonly PlacedPoint[];
  isDimmed: (id: string) => boolean;
}) {
  return (
    <g>
      {points.map((point) => (
        <circle
          key={point.key}
          data-dot=""
          cx={point.x}
          cy={point.y}
          r={point.r}
          strokeWidth={1}
          className="transition-opacity duration-150"
          style={{
            fill: point.series.color,
            fillOpacity: 0.82,
            stroke: "var(--surface)",
            opacity: isDimmed(point.series.id) ? 0.2 : 1,
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
  categories: readonly string[];
  visible: ColoredSeries<BeeswarmSeries>[];
  orientation: "horizontal" | "vertical";
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  radius: number;
  sizeRange: readonly [number, number] | null;
  sizeFormat?: ValueFormat;
  gap: number;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: DistributionLabels;
  isDimmed: (id: string) => boolean;
}

function BeeswarmPlot({
  width,
  height,
  title,
  categories,
  visible,
  orientation,
  valueFormat,
  valueAxis,
  radius,
  sizeRange,
  sizeFormat,
  gap,
  grid,
  tooltip,
  animate,
  labels,
  isDimmed,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const { layout, points } = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    let maxSize = 0;
    for (const item of visible) {
      for (const point of item.source.points) {
        if (!Number.isFinite(point.value)) continue;
        lo = Math.min(lo, point.value);
        hi = Math.max(hi, point.value);
        if (point.size != null && point.size > maxSize) maxSize = point.size;
      }
    }
    const layout = categoryLayout({
      width,
      height,
      orientation,
      categories,
      seriesCount: 1,
      extent: Number.isFinite(lo) ? [lo, hi] : null,
      valueFormat,
      axis: valueAxis,
      padding: 0.1,
    });
    const horizontal = layout.horizontal;
    const radiusOf = (point: BeeswarmPoint) =>
      sizeRange
        ? Math.max(
            sizeRange[0],
            sizeRange[1] * Math.sqrt(Math.max(0, point.size ?? 0) / (maxSize || 1)),
          )
        : radius;
    const placed: PlacedPoint[] = [];
    categories.forEach((category, row) => {
      const members: Array<{
        item: ColoredSeries<BeeswarmSeries>;
        point: BeeswarmPoint;
        index: number;
      }> = [];
      for (const item of visible) {
        item.source.points.forEach((point, index) => {
          if (Number.isFinite(point.value) && (point.category ?? categories[0]) === category) {
            members.push({ item, point, index });
          }
        });
      }
      if (members.length === 0) return;
      const slot = layout.slot(row, 0);
      const limit = slot.size / 2;
      // Shrink the dots until the swarm fits its row (a few passes converge).
      let scale = 1;
      let offsets: number[] = [];
      for (let pass = 0; pass < 4; pass += 1) {
        const swarm = members.map(({ point }) => ({
          position: layout.valueScale.map(point.value),
          radius: radiusOf(point) * scale,
        }));
        offsets = beeswarm(swarm, { gap });
        const reach = Math.max(
          ...offsets.map((offset, i) => Math.abs(offset) + (swarm[i]?.radius ?? 0)),
        );
        if (reach <= limit) break;
        scale *= Math.max(0.35, (limit / reach) * 0.98);
      }
      members.forEach(({ item, point, index }, i) => {
        const along = layout.valueScale.map(point.value);
        const cross = slot.center + Math.max(-limit, Math.min(limit, offsets[i] ?? 0));
        placed.push({
          key: `${item.id}-${index}`,
          series: item,
          point,
          category: row,
          x: horizontal ? along : cross,
          y: horizontal ? cross : along,
          r: Math.max(1.25, radiusOf(point) * scale),
        });
      });
    });
    // Reading order: row by row, then along the value axis.
    placed.sort((a, b) => a.category - b.category || a.point.value - b.point.value);
    return { layout, points: placed };
  }, [
    width,
    height,
    orientation,
    categories,
    visible,
    valueFormat,
    valueAxis,
    radius,
    sizeRange,
    gap,
  ]);

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-dot]").forEach((dot, index) => {
        dot.animate(
          [
            { opacity: 0, transform: "scale(0.2)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 420,
            delay: Math.min(900, index * 6),
            easing: "cubic-bezier(.34,1.56,.64,1)",
            fill: "backwards",
          },
        );
      });
    },
    { disabled: !animate, replayKey: points.length },
  );

  const { margin, innerWidth, innerHeight } = layout;
  const format = resolveFormat(valueFormat);
  const formatSize = resolveFormat(sizeFormat);
  const current = active != null ? points[active] : undefined;
  const titleOf = (point: PlacedPoint) =>
    point.point.label ?? (categories[point.category] || point.series.name);
  const rows: TooltipRow[] = current
    ? [
        {
          id: "value",
          name: visible.length > 1 ? current.series.name : labels.value,
          value: format(current.point.value),
          color: current.series.color,
          shape: "dot",
        },
        ...(current.point.size != null && sizeRange
          ? [
              {
                id: "size",
                name: labels.size,
                value: formatSize(current.point.size),
                color: "transparent",
              },
            ]
          : []),
      ]
    : [];
  const valueText = current
    ? `${titleOf(current)}${current.point.label && categories[current.category] ? `, ${categories[current.category]}` : ""}: ${rows
        .map((row) => `${row.name} ${row.value}`)
        .join(", ")}`
    : title;

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
        <g transform={`translate(${margin.left},${margin.top})`}>
          <CategoryAxes layout={layout} title={valueAxis?.title} grid={grid} />
          <Dots points={points} isDimmed={isDimmed} />
          {current ? (
            <circle
              cx={current.x}
              cy={current.y}
              r={current.r + 3}
              strokeWidth={2}
              fill="none"
              style={{ stroke: current.series.color }}
            />
          ) : null}
        </g>
      </svg>
      <PlotExplorer
        count={points.length}
        active={active}
        onActiveChange={setActive}
        pick={(x, y) => nearestPoint(points, x, y, 14)}
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
          title={
            current.point.label && categories[current.category]
              ? `${current.point.label} · ${categories[current.category]}`
              : titleOf(current)
          }
          rows={rows}
        />
      ) : null}
    </div>
  );
}
