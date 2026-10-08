import { memo } from "react";
import { AxisBottom, AxisLeft, GridLines } from "../axes.js";
import { ChartDataTable } from "../data-table.js";
import type { ValueFormatter } from "../format.js";
import type { TooltipRow } from "../tooltip.js";
import type { DistributionLabels } from "./labels.js";
import type { CategoryLayout, XYLayout } from "./layout.js";
import type { BoxStats } from "./stats.js";

const TITLE = "fill-ink-3 font-bold text-[10.5px]";

/** Gridlines along the value axis plus both axes of a `categoryLayout`. */
export const CategoryAxes = memo(function CategoryAxes({
  layout,
  title,
  grid = true,
}: {
  layout: CategoryLayout;
  title?: string;
  grid?: boolean;
}) {
  const { horizontal, innerWidth, innerHeight, valueTicks, categoryTicks } = layout;
  return (
    <>
      {grid ? (
        <GridLines
          ticks={valueTicks}
          direction={horizontal ? "vertical" : "horizontal"}
          length={horizontal ? innerHeight : innerWidth}
        />
      ) : null}
      {horizontal ? (
        <>
          <g transform="translate(0,0)">
            {categoryTicks.map((tick) => (
              <text
                key={tick.key}
                x={-12}
                y={tick.position}
                dy="0.34em"
                textAnchor="end"
                className="fill-ink-2 font-semibold text-[12px]"
              >
                {tick.label}
              </text>
            ))}
          </g>
          <AxisBottom ticks={valueTicks} offset={innerHeight} />
          {title ? (
            <text x={innerWidth} y={-10} textAnchor="end" className={TITLE}>
              {title}
            </text>
          ) : null}
        </>
      ) : (
        <>
          <AxisLeft ticks={valueTicks} offset={0} title={title} />
          <AxisBottom ticks={categoryTicks} offset={innerHeight} />
        </>
      )}
      <line
        x1={0}
        x2={horizontal ? 0 : innerWidth}
        y1={horizontal ? 0 : innerHeight}
        y2={innerHeight}
        shapeRendering="crispEdges"
        style={{ stroke: "var(--line-strong)" }}
      />
    </>
  );
});

/** Gridlines in both directions and the x/y axes of an `xyLayout`. */
export const XYAxes = memo(function XYAxes({
  layout,
  xTitle,
  yTitle,
  grid = true,
}: {
  layout: XYLayout;
  xTitle?: string;
  yTitle?: string;
  grid?: boolean;
}) {
  const { innerWidth, innerHeight, xTicks, yTicks } = layout;
  return (
    <>
      {grid ? (
        <>
          <GridLines ticks={yTicks} direction="horizontal" length={innerWidth} />
          <g opacity={0.6}>
            <GridLines ticks={xTicks} direction="vertical" length={innerHeight} />
          </g>
        </>
      ) : null}
      <line
        x1={0}
        x2={innerWidth}
        y1={innerHeight}
        y2={innerHeight}
        shapeRendering="crispEdges"
        style={{ stroke: "var(--line-strong)" }}
      />
      <AxisLeft ticks={yTicks} offset={0} title={yTitle} />
      <AxisBottom ticks={xTicks} offset={innerHeight} />
      {xTitle ? (
        <text x={innerWidth} y={innerHeight + 40} textAnchor="end" className={TITLE}>
          {xTitle}
        </text>
      ) : null}
    </>
  );
});

export interface BoxGlyphProps {
  stats: BoxStats;
  /** Value to pixel along the value axis. */
  map: (value: number) => number;
  /** Pixel of the box axis on the cross axis. */
  center: number;
  /** Box thickness in pixels. */
  size: number;
  horizontal: boolean;
  color: string;
  /** "box": soft fill and colored outline. "inner": slim dark box for violins and rainclouds. */
  variant?: "box" | "inner";
  showMean?: boolean;
  showOutliers?: boolean;
  /** Highlighted outlier value (keyboard or pointer). */
  activeOutlier?: number | null;
  dimmed?: boolean;
  active?: boolean;
}

/**
 * One box-and-whisker: IQR box, median line, whiskers with caps, optional
 * mean diamond and outlier dots. Pure SVG, memoised.
 */
export const BoxGlyph = memo(function BoxGlyph({
  stats,
  map,
  center,
  size,
  horizontal,
  color,
  variant = "box",
  showMean = true,
  showOutliers = true,
  activeOutlier,
  dimmed,
  active,
}: BoxGlyphProps) {
  const inner = variant === "inner";
  const half = size / 2;
  const q1 = map(stats.q1);
  const q3 = map(stats.q3);
  const lo = map(stats.lowerWhisker);
  const hi = map(stats.upperWhisker);
  const median = map(stats.median);
  const start = Math.min(q1, q3);
  const length = Math.max(1, Math.abs(q3 - q1));
  const cap = inner ? 0 : Math.min(half * 0.55, 14);
  const line = (v0: number, c0: number, v1: number, c1: number) =>
    horizontal ? { x1: v0, y1: c0, x2: v1, y2: c1 } : { x1: c0, y1: v0, x2: c1, y2: v1 };
  const ink = inner ? "var(--ink-2)" : color;
  const mean = map(stats.mean);
  const diamond = inner ? 0 : Math.max(3.5, Math.min(5, half * 0.3));
  return (
    <g
      className="transition-opacity duration-150"
      style={{ opacity: dimmed ? 0.3 : 1 }}
      data-box=""
    >
      <line
        {...line(lo, center, start, center)}
        strokeWidth={inner ? 1.5 : 1.5}
        style={{ stroke: ink }}
      />
      <line
        {...line(start + length, center, hi, center)}
        strokeWidth={1.5}
        style={{ stroke: ink }}
      />
      {cap > 0 ? (
        <>
          <line
            {...line(lo, center - cap, lo, center + cap)}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ stroke: ink }}
          />
          <line
            {...line(hi, center - cap, hi, center + cap)}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ stroke: ink }}
          />
        </>
      ) : null}
      <rect
        x={horizontal ? start : center - half}
        y={horizontal ? center - half : start}
        width={horizontal ? length : size}
        height={horizontal ? size : length}
        rx={inner ? Math.min(2, half) : Math.min(6, half / 2)}
        strokeWidth={inner ? 0 : active ? 2.25 : 1.5}
        style={
          inner
            ? { fill: "var(--ink-2)" }
            : { fill: color, fillOpacity: active ? 0.3 : 0.18, stroke: color }
        }
      />
      {inner ? (
        <circle
          cx={horizontal ? median : center}
          cy={horizontal ? center : median}
          r={Math.max(2, Math.min(3.2, half * 0.9))}
          style={{ fill: "var(--surface)" }}
        />
      ) : (
        <line
          {...line(median, center - half, median, center + half)}
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ stroke: color }}
        />
      )}
      {showMean && diamond > 0 ? (
        <path
          d={
            horizontal
              ? `M${mean},${center - diamond}L${mean + diamond},${center}L${mean},${center + diamond}L${mean - diamond},${center}Z`
              : `M${center},${mean - diamond}L${center + diamond},${mean}L${center},${mean + diamond}L${center - diamond},${mean}Z`
          }
          strokeWidth={1.5}
          style={{ fill: "var(--surface)", stroke: color }}
        />
      ) : null}
      {showOutliers
        ? stats.outliers.map((value, index) => {
            const at = map(value);
            const highlighted = activeOutlier === value;
            return (
              <circle
                // biome-ignore lint/suspicious/noArrayIndexKey: outliers can repeat; order is stable.
                key={index}
                cx={horizontal ? at : center}
                cy={horizontal ? center : at}
                r={highlighted ? 4.5 : 3.25}
                strokeWidth={1.5}
                style={{
                  fill: highlighted ? color : "var(--surface)",
                  stroke: inner ? "var(--ink-2)" : color,
                }}
              />
            );
          })
        : null}
    </g>
  );
});

/** Tooltip rows for a five-number summary. */
export function boxTooltipRows(
  stats: BoxStats,
  labels: DistributionLabels,
  format: ValueFormatter,
  color: string,
  showMean = true,
): TooltipRow[] {
  const row = (id: string, name: string, value: string, emphasis = false): TooltipRow => ({
    id,
    name,
    value,
    color,
    shape: "square",
    emphasis,
  });
  const rows = [
    row("max", labels.max, format(stats.max)),
    row("q3", labels.q3, format(stats.q3)),
    row("median", labels.median, format(stats.median)),
    row("q1", labels.q1, format(stats.q1)),
    row("min", labels.min, format(stats.min)),
  ];
  if (showMean) rows.push(row("mean", labels.mean, format(stats.mean)));
  rows.push(row("count", labels.count, String(stats.count), true));
  if (stats.outliers.length) {
    rows.push(row("outliers", labels.outliers, String(stats.outliers.length)));
  }
  return rows;
}

/** One-line summary of a box for `aria-valuetext`. */
export function boxValueText(
  name: string,
  stats: BoxStats,
  labels: DistributionLabels,
  format: ValueFormatter,
): string {
  return `${name}: ${labels.median} ${format(stats.median)}, ${labels.q1} ${format(stats.q1)}, ${labels.q3} ${format(
    stats.q3,
  )}, ${labels.min} ${format(stats.min)}, ${labels.max} ${format(stats.max)}, ${labels.mean} ${format(
    stats.mean,
  )}, ${labels.count} ${stats.count}${stats.outliers.length ? `, ${labels.outliers} ${stats.outliers.length}` : ""}`;
}

export interface BoxStatsTableProps {
  caption: string;
  labels: DistributionLabels;
  rows: ReadonlyArray<{ name: string; stats: BoxStats | null; format: ValueFormatter }>;
}

/** Hidden data table with the summary of every box, violin or cloud. */
export function BoxStatsTable({ caption, labels, rows }: BoxStatsTableProps) {
  const keys = ["count", "min", "q1", "median", "q3", "max", "mean", "outliers"] as const;
  return (
    <ChartDataTable
      caption={caption}
      categoryHeader={labels.category}
      categories={rows.map((row) => row.name)}
      columns={keys.map((key) => ({
        id: key,
        name: labels[key],
        values: rows.map(({ stats, format }) => {
          if (!stats) return "";
          if (key === "count") return String(stats.count);
          if (key === "outliers") return stats.outliers.map(format).join(", ");
          return format(stats[key]);
        }),
      }))}
    />
  );
}
