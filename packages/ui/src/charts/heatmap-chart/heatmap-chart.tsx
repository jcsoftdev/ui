"use client";

import { useMemo } from "react";
import { ChartFrame } from "../core/chart-frame.js";
import type { ColorRange, ScaleColors } from "../core/color-scale.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { formatDate } from "../core/scales/time.js";
import { datetimeColumnLabels } from "./datetime-columns.js";
import {
  type HeatmapCellInfo,
  HeatmapGrid,
  type HeatmapLabels,
  HeatmapLegend,
  resolveHeatmapLabels,
} from "./heatmap-grid.js";
import { heatmapScale } from "./heatmap-scale.js";

export interface HeatmapChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Row names, top to bottom. */
  rows: readonly string[];
  /**
   * Column names, left to right. When every column is a `Date` the columns are
   * consecutive points in time: the header is labelled only at calendar
   * boundaries (weeks, months, years), like a continuous time axis.
   */
  columns: ReadonlyArray<string | Date>;
  /** `values[row][column]`; `null` is a cell without data. */
  values: ReadonlyArray<ReadonlyArray<number | null>>;
  /** "sequential" (empty to brand) or "diverging" (low hue, neutral at `center`, brand). */
  scale?: "sequential" | "diverging";
  /** Fixed [min, max] of the color scale; the data extent by default. */
  domain?: readonly [number, number];
  /** Neutral value of a diverging scale. */
  center?: number;
  /** Override the scale colors (CSS colors or tokens). */
  colors?: ScaleColors;
  /** Stepped coloring by ranges or thresholds; replaces the continuous scale. */
  ranges?: readonly ColorRange[];
  valueFormat?: ValueFormat;
  /** Values inside the cells (only where they fit). */
  cellLabels?: boolean;
  /** Gap between cells in pixels. */
  gap?: number;
  radius?: number;
  /** "hex" draws a honeycomb: pointy-top hexagons with odd rows shifted half a cell. */
  shape?: "rect" | "hex";
  /**
   * "canvas" paints the cells on a canvas, for matrices with tens of thousands
   * of cells. Labels, tooltip, focus ring and keyboard stay SVG/HTML.
   */
  renderer?: "svg" | "canvas";
  /** Height of the drawing in px or "fill"; 34 px per row plus the column header by default. */
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width. */
  aspectRatio?: number;
  /** Color key (gradient bar or range swatches). */
  legend?: boolean;
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<HeatmapLabels>;
  onCellClick?: (cell: HeatmapCellInfo) => void;
  className?: string;
}

/**
 * Matrix heatmap: one colored cell per row × column, e.g. occupancy by hour
 * and weekday. Continuous sequential or diverging scales come from tokens;
 * `ranges` switches to stepped colors. Hover and keyboard focus light the
 * row and column of the cell.
 */
export function HeatmapChart({
  title,
  rows,
  columns,
  values,
  scale = "sequential",
  domain,
  center = 0,
  colors,
  ranges,
  valueFormat,
  cellLabels = false,
  gap = 3,
  radius = 4,
  shape = "rect",
  renderer = "svg",
  height,
  aspectRatio,
  legend = true,
  tooltip = true,
  animate = true,
  loading,
  labels: labelsProp,
  onCellClick,
  className,
}: HeatmapChartProps) {
  const labels = resolveHeatmapLabels(labelsProp);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const finite = useMemo(
    () =>
      values.flatMap((row) =>
        row.filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      ),
    [values],
  );
  const colorScale = useMemo(
    () => heatmapScale(finite, { scale, domain, center, colors, ranges }),
    [finite, scale, domain, center, colors, ranges],
  );
  const dated = columns.length > 0 && columns.every((column) => column instanceof Date);
  const columnText = useMemo(
    () => columns.map((column) => (column instanceof Date ? formatDate(column) : column)),
    [columns],
  );
  // A table with every cell of a dense canvas matrix would defeat the canvas.
  const tableRows = renderer === "canvas" ? rows.slice(0, 60) : rows;
  const tableColumns = renderer === "canvas" ? columnText.slice(0, 40) : columnText;
  const drawingHeight = height ?? Math.max(120, rows.length * 34 + 22);
  return (
    <ChartFrame
      height={drawingHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={finite.length === 0 || rows.length === 0 || columns.length === 0}
      skeleton="bars"
      className={className}
      footer={
        legend ? (
          <HeatmapLegend
            kind={scale}
            domain={colorScale.domain}
            center={center}
            colors={colors}
            ranges={ranges}
            format={format}
          />
        ) : null
      }
      table={
        <ChartDataTable
          caption={title}
          categoryHeader={labels.category}
          categories={tableRows}
          columns={tableColumns.map((column, index) => ({
            id: `${index}`,
            name: column,
            values: tableRows.map((_, row) => {
              const value = values[row]?.[index];
              return value == null ? labels.noData : format(value);
            }),
          }))}
        />
      }
    >
      {(width, measuredHeight) => (
        <HeatmapGrid
          width={width}
          height={measuredHeight}
          title={title}
          rowLabels={rows}
          columnLabels={
            dated
              ? datetimeColumnLabels(columns as Date[], Math.max(2, Math.floor(width / 72)))
              : columnText
          }
          values={values}
          colorScale={colorScale}
          format={format}
          cellTitle={(row, column) => `${rows[row] ?? ""} · ${columnText[column] ?? ""}`}
          labels={labels}
          cellLabels={cellLabels}
          gap={gap}
          radius={radius}
          square={false}
          shape={shape}
          renderer={renderer}
          tooltip={tooltip}
          animate={animate}
          onCellClick={onCellClick}
        />
      )}
    </ChartFrame>
  );
}
