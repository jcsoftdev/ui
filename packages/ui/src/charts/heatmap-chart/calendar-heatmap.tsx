"use client";

import { useMemo } from "react";
import { ChartFrame } from "../core/chart-frame.js";
import type { ColorRange, ScaleColors } from "../core/color-scale.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { formatDate, shortMonth } from "../core/scales/time.js";
import { type CalendarDay, calendarGrid } from "./calendar-layout.js";
import {
  HEATMAP_TOP,
  HeatmapGrid,
  type HeatmapLabels,
  HeatmapLegend,
  resolveHeatmapLabels,
  rowGutter,
} from "./heatmap-grid.js";
import { heatmapScale } from "./heatmap-scale.js";

export interface CalendarHeatmapProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** One entry per day; missing days inside the range are drawn empty. */
  days: readonly CalendarDay[];
  /** First day shown; the earliest entry by default. */
  from?: Date;
  /** Last day shown; the latest entry by default. */
  to?: Date;
  scale?: "sequential" | "diverging";
  domain?: readonly [number, number];
  center?: number;
  colors?: ScaleColors;
  /** Stepped coloring, e.g. "Sin citas", "1-5", "6-10", "Más de 10". */
  ranges?: readonly ColorRange[];
  valueFormat?: ValueFormat;
  /** Smallest cell in pixels; narrow containers show only the most recent weeks that fit. */
  minCellSize?: number;
  /**
   * Height of the drawing in px or "fill". By default it follows the width:
   * cells are square, so the height is the month header plus seven cell sides.
   */
  height?: number | "fill";
  /** Width / height ratio; overrides the width-derived default height. */
  aspectRatio?: number;
  gap?: number;
  radius?: number;
  /** Weekday names Monday to Sunday; only Monday, Wednesday and Friday are drawn. */
  weekdays?: readonly string[];
  legend?: boolean;
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<HeatmapLabels>;
  onDayClick?: (day: CalendarDay) => void;
  className?: string;
}

/** Largest square side when few weeks are shown. */
const MAX_CELL = 40;

/** How many week columns fit the width at the minimum cell size, and the weekday gutter. */
function fitWeeks(
  width: number,
  totalWeeks: number,
  minCellSize: number,
  rowLabels: readonly string[],
) {
  const labelWidth = rowGutter(width, rowLabels);
  const fit = Math.max(1, Math.floor((width - labelWidth) / minCellSize));
  return { labelWidth, shown: Math.max(1, Math.min(totalWeeks, fit)) };
}

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/**
 * Contribution-style calendar: one square per day, weeks as columns (Monday
 * first), months labelled on top. Same color scales, ranges, crosshair and
 * keyboard model as `HeatmapChart`.
 */
export function CalendarHeatmap({
  title,
  days,
  from,
  to,
  scale = "sequential",
  domain,
  center = 0,
  colors,
  ranges,
  valueFormat,
  minCellSize = 11,
  height,
  aspectRatio,
  gap = 3,
  radius = 3,
  weekdays = WEEKDAYS,
  legend = true,
  tooltip = true,
  animate = true,
  loading,
  labels: labelsProp,
  onDayClick,
  className,
}: CalendarHeatmapProps) {
  const labels = resolveHeatmapLabels(labelsProp);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const grid = useMemo(() => calendarGrid(days, from, to), [days, from, to]);
  const finite = useMemo(
    () =>
      days
        .map((day) => day.value)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    [days],
  );
  const colorScale = useMemo(
    () => heatmapScale(finite, { scale, domain, center, colors, ranges }),
    [finite, scale, domain, center, colors, ranges],
  );
  const rowLabels = weekdays.map((name, index) => (index % 2 === 0 && index < 6 ? name : ""));
  const listed = useMemo(
    () =>
      grid.weeks.flatMap((_, week) =>
        grid.cells.flatMap((row) => {
          const cell = row[week];
          return cell ? [cell] : [];
        }),
      ),
    [grid],
  );

  const autoHeight = (width: number) => {
    const { shown, labelWidth } = fitWeeks(width, grid.weeks.length, minCellSize, rowLabels);
    const side = Math.min(MAX_CELL, (width - labelWidth) / shown);
    return HEATMAP_TOP + 7 * side;
  };

  return (
    <ChartFrame
      height={height ?? autoHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={finite.length === 0}
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
          categories={listed.map((cell) => formatDate(cell.date))}
          columns={[
            {
              id: "value",
              name: title,
              values: listed.map((cell) =>
                cell.value == null ? labels.noData : format(cell.value),
              ),
            },
          ]}
        />
      }
    >
      {(width, measuredHeight) => {
        const { shown } = fitWeeks(width, grid.weeks.length, minCellSize, rowLabels);
        const firstWeek = Math.max(0, grid.weeks.length - shown);
        const weeks = grid.weeks.slice(firstWeek);
        const columnLabels = weeks.map((_, index) => {
          const start = grid.monthStarts.find((item) => item.week === index + firstWeek);
          return start ? shortMonth(start.date) : index === 0 ? shortMonth(weeks[0] as Date) : null;
        });
        const values = grid.cells.map((row) =>
          row.slice(firstWeek).map((cell) => (cell ? cell.value : undefined)),
        );
        return (
          <HeatmapGrid
            width={width}
            height={measuredHeight}
            title={title}
            rowLabels={rowLabels}
            columnLabels={columnLabels}
            values={values}
            colorScale={colorScale}
            format={format}
            cellTitle={(row, column) => {
              const cell = grid.cells[row]?.[column + firstWeek];
              return cell ? formatDate(cell.date) : "";
            }}
            labels={labels}
            cellLabels={false}
            gap={gap}
            radius={radius}
            square
            valueName={title}
            tooltip={tooltip}
            animate={animate}
            onCellClick={
              onDayClick
                ? ({ row, column }) => {
                    const cell = grid.cells[row]?.[column + firstWeek];
                    if (cell) onDayClick({ date: cell.date, value: cell.value });
                  }
                : undefined
            }
          />
        );
      }}
    </ChartFrame>
  );
}
