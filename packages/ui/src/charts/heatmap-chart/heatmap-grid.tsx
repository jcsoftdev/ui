"use client";

import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { estimateTextWidth } from "../core/axes.js";
import {
  type ColorRange,
  inkOn,
  rangeColor,
  type ScaleColors,
  scaleGradient,
} from "../core/color-scale.js";
import type { ValueFormatter } from "../core/format.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, DEFAULT_LABELS } from "../core/types.js";
import type { HeatmapScale } from "./heatmap-scale.js";

/** Visible strings of the heatmaps. */
export interface HeatmapLabels extends ChartLabels {
  /** Tooltip value of a cell without data. */
  noData: string;
}

export const DEFAULT_HEATMAP_LABELS: HeatmapLabels = {
  ...DEFAULT_LABELS,
  explore: "Heatmap cells. Use the arrow keys to move between rows and columns.",
  category: "Row",
  noData: "No data",
};

export function resolveHeatmapLabels(labels?: Partial<HeatmapLabels>): HeatmapLabels {
  return labels ? { ...DEFAULT_HEATMAP_LABELS, ...labels } : DEFAULT_HEATMAP_LABELS;
}

/** A cell: a number, `null` for no data (drawn empty), `undefined` for no cell at all. */
export type HeatmapValue = number | null | undefined;

export interface HeatmapCellInfo {
  row: number;
  column: number;
  value: number | null;
}

export interface HeatmapGridProps {
  width: number;
  height: number;
  title: string;
  rowLabels: readonly string[];
  /** `null` leaves a column without a label (e.g. calendar weeks inside a month). */
  columnLabels: ReadonlyArray<string | null>;
  /** `values[row][column]`. */
  values: ReadonlyArray<ReadonlyArray<HeatmapValue>>;
  colorScale: HeatmapScale;
  format: ValueFormatter;
  /** Tooltip title and spoken name of a cell. */
  cellTitle: (row: number, column: number) => string;
  labels: HeatmapLabels;
  cellLabels: boolean;
  gap: number;
  radius: number;
  /** Square cells (calendar) instead of filling the whole area. */
  square: boolean;
  tooltip: boolean;
  animate: boolean;
  onCellClick?: (cell: HeatmapCellInfo) => void;
  /** Name of the value in the tooltip; the row label by default. */
  valueName?: string;
}

/** Height of the column-label header above the cells. */
export const HEATMAP_TOP = 22;

/** Width of the row-label gutter, from the measured labels (capped on narrow containers). */
export function rowGutter(width: number, rowLabels: readonly string[]): number {
  return Math.min(
    width < 420 ? 52 : 120,
    Math.max(0, ...rowLabels.map((label) => estimateTextWidth(label, 11))) + 10,
  );
}
const TOP = HEATMAP_TOP;

/**
 * Rows × columns of colored cells. Hover (or keyboard focus) lights its row and
 * column like a crosshair and dims the rest. Column labels thin out when they
 * would collide; cell values only show where they fit.
 */
export function HeatmapGrid({
  width,
  height,
  title,
  rowLabels,
  columnLabels,
  values,
  colorScale,
  format,
  cellTitle,
  labels,
  cellLabels,
  gap,
  radius,
  square,
  tooltip,
  animate,
  onCellClick,
  valueName,
}: HeatmapGridProps) {
  const rows = rowLabels.length;
  const columns = columnLabels.length;
  const rowLabelWidth = rowGutter(width, rowLabels);
  const left = rowLabelWidth;
  const availableWidth = Math.max(0, width - left);
  const availableHeight = Math.max(0, height - TOP);
  const cellWidth = columns > 0 ? availableWidth / columns : 0;
  const cellHeight = rows > 0 ? availableHeight / rows : 0;
  const side = Math.min(cellWidth, cellHeight);
  const w = square ? side : cellWidth;
  const h = square ? side : cellHeight;
  const pad = Math.min(gap, w * 0.2, h * 0.2);

  const visibleColumnLabels = useMemo(() => {
    const out: Array<{ index: number; label: string }> = [];
    let lastEnd = Number.NEGATIVE_INFINITY;
    columnLabels.forEach((label, index) => {
      if (!label) return;
      const x = left + index * w + (square ? 0 : w / 2);
      const textWidth = estimateTextWidth(label, 11);
      const start = square ? x : x - textWidth / 2;
      if (start < lastEnd + 6 || start + textWidth > width + 2) return;
      out.push({ index, label });
      lastEnd = start + textWidth;
    });
    return out;
  }, [columnLabels, left, w, square, width]);

  const [hover, setHover] = useState<{ row: number; column: number } | null>(null);
  const [active, setActive] = useState<{ row: number; column: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEntryAnimation(
    svgRef,
    (element) => {
      element.querySelectorAll("[data-column]").forEach((group, index) => {
        group.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 420,
          delay: Math.min(index * (360 / Math.max(1, columns)), 360),
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
    },
    { disabled: !animate },
  );

  const valueAt = (row: number, column: number): HeatmapValue => values[row]?.[column];
  const lit = hover ?? active;

  const local = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - left;
    const y = event.clientY - box.top - TOP;
    const column = Math.floor(x / w);
    const row = Math.floor(y / h);
    if (x < 0 || y < 0 || column >= columns || row >= rows) return null;
    if (valueAt(row, column) === undefined) return null;
    return { row, column };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? { row: 0, column: 0 };
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (active && onCellClick) {
        event.preventDefault();
        onCellClick({ ...active, value: valueAt(active.row, active.column) ?? null });
      }
      return;
    }
    let next: { row: number; column: number } | null = null;
    if (event.key === "Home") next = { row: current.row, column: 0 };
    else if (event.key === "End") next = { row: current.row, column: columns - 1 };
    else {
      const move = moves[event.key];
      if (!move) return;
      let { row, column } = current;
      do {
        row += move[0];
        column += move[1];
      } while (
        row >= 0 &&
        row < rows &&
        column >= 0 &&
        column < columns &&
        valueAt(row, column) === undefined
      );
      if (row >= 0 && row < rows && column >= 0 && column < columns) next = { row, column };
    }
    event.preventDefault();
    if (next) {
      setActive(next);
      setHover(null);
    }
  };

  const describe = (row: number, column: number) => {
    const value = valueAt(row, column);
    return `${cellTitle(row, column)}: ${value == null ? labels.noData : format(value)}`;
  };

  const shown = lit;
  const shownValue = shown ? valueAt(shown.row, shown.column) : undefined;
  const shownColor =
    shown && typeof shownValue === "number"
      ? (colorScale.color(shownValue)?.color ?? "var(--surface-2)")
      : "var(--surface-2)";

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
        {rowLabels.map((label, row) => (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: rows follow the data order.
            key={row}
            x={left - 8}
            y={TOP + row * h + h / 2}
            textAnchor="end"
            dominantBaseline="central"
            className={cn(
              "select-none text-[11px] transition-[fill] duration-150",
              lit?.row === row ? "fill-ink font-bold" : "fill-ink-3 font-semibold",
            )}
          >
            {estimateTextWidth(label, 11) > left - 10
              ? `${label.slice(0, Math.max(1, Math.floor((left - 14) / 6.4)))}…`
              : label}
          </text>
        ))}
        {visibleColumnLabels.map(({ index, label }) => (
          <text
            key={index}
            x={left + index * w + (square ? pad / 2 : w / 2)}
            y={TOP - 8}
            textAnchor={square ? "start" : "middle"}
            className={cn(
              "select-none text-[11px] transition-[fill] duration-150",
              lit?.column === index ? "fill-ink font-bold" : "fill-ink-3 font-semibold",
            )}
          >
            {label}
          </text>
        ))}
        {Array.from({ length: columns }, (_, column) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: columns follow the data order.
          <g key={column} data-column="">
            {Array.from({ length: rows }, (_, row) => {
              const value = valueAt(row, column);
              if (value === undefined) return null;
              const stop = value == null ? null : colorScale.color(value);
              const inCross = lit != null && (lit.row === row || lit.column === column);
              const dimmed = lit != null && !inCross;
              const x = left + column * w + pad / 2;
              const y = TOP + row * h + pad / 2;
              const cw = Math.max(0, w - pad);
              const ch = Math.max(0, h - pad);
              const text = value == null ? "" : format(value);
              const showText =
                cellLabels && value != null && cw >= estimateTextWidth(text, 11) + 6 && ch >= 16;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows follow the data order.
                <g key={row}>
                  <rect
                    x={x}
                    y={y}
                    width={cw}
                    height={ch}
                    rx={Math.min(radius, cw / 2, ch / 2)}
                    style={{
                      fill: stop?.color ?? "var(--surface-2)",
                      opacity: dimmed ? 0.42 : 1,
                      transition: "opacity 150ms ease-out",
                    }}
                  />
                  {showText ? (
                    <text
                      x={x + cw / 2}
                      y={y + ch / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="pointer-events-none select-none font-bold text-[11px] tabular-nums"
                      style={{
                        fill: inkOn(stop?.strength ?? 0),
                        opacity: dimmed ? 0.5 : 1,
                      }}
                    >
                      {text}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ))}
        {lit ? (
          <rect
            x={left + lit.column * w + pad / 2 - 1}
            y={TOP + lit.row * h + pad / 2 - 1}
            width={Math.max(0, w - pad) + 2}
            height={Math.max(0, h - pad) + 2}
            rx={radius + 1}
            strokeWidth={2}
            className="pointer-events-none"
            style={{ fill: "none", stroke: "var(--ink)" }}
          />
        ) : null}
      </svg>

      <div
        role="slider"
        tabIndex={0}
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, rows * columns)}
        aria-valuenow={active ? active.row * columns + active.column + 1 : 1}
        aria-valuetext={active ? describe(active.row, active.column) : title}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (!event.currentTarget.matches(":focus-visible")) return;
          setActive((current) => {
            if (current) return current;
            for (let column = 0; column < columns; column++) {
              for (let row = 0; row < rows; row++) {
                if (valueAt(row, column) !== undefined) return { row, column };
              }
            }
            return null;
          });
        }}
        onBlur={() => setActive(null)}
        onPointerMove={(event) => setHover(local(event))}
        onPointerLeave={() => setHover(null)}
        onPointerUp={(event) => {
          const cell = local(event);
          if (cell && onCellClick) {
            onCellClick({ ...cell, value: valueAt(cell.row, cell.column) ?? null });
          }
        }}
        className={cn(
          "absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4",
          hover && onCellClick ? "cursor-pointer" : "cursor-default",
        )}
      />

      {tooltip && shown ? (
        <ChartTooltip
          x={left + shown.column * w + w / 2}
          y={TOP + shown.row * h + h / 2}
          containerWidth={width}
          title={cellTitle(shown.row, shown.column)}
          rows={[
            {
              id: "value",
              name: valueName ?? rowLabels[shown.row] ?? "",
              value: shownValue == null ? labels.noData : format(shownValue),
              color: shownColor,
            },
          ]}
        />
      ) : null}
    </div>
  );
}

export interface HeatmapLegendProps {
  kind: "sequential" | "diverging";
  domain: readonly [number, number];
  center?: number;
  colors?: ScaleColors;
  ranges?: readonly ColorRange[];
  format: ValueFormatter;
}

/**
 * Color key: a gradient bar with its extremes (and center when diverging), or
 * one swatch per range. Sits below the drawing in narrow containers and above
 * it, aligned to the end, from `@md`.
 */
export function HeatmapLegend({
  kind,
  domain,
  center = 0,
  colors,
  ranges,
  format,
}: HeatmapLegendProps) {
  if (ranges && ranges.length > 0) {
    return (
      <ul className="@md/chart:-order-1 m-0 flex list-none flex-wrap @md/chart:justify-end gap-x-3 gap-y-1 p-0 text-[12px]">
        {ranges.map((range, index) => (
          <li
            key={range.label}
            className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink-2"
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{
                background: rangeColor(range, index, ranges.length).color,
              }}
            />
            <span className="truncate">{range.label}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="@md/chart:-order-1 flex w-full max-w-[260px] @md/chart:self-end flex-col gap-1 text-[11px] text-ink-3 tabular-nums"
    >
      <span
        className="h-2 w-full rounded-pill"
        style={{ background: scaleGradient(kind, colors) }}
      />
      <span className="flex justify-between font-semibold">
        <span>{format(domain[0])}</span>
        {kind === "diverging" ? <span>{format(center)}</span> : null}
        <span>{format(domain[1])}</span>
      </span>
    </div>
  );
}
