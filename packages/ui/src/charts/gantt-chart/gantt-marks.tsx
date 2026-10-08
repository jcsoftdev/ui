"use client";

import { memo } from "react";
import { DECORATIVE } from "../core/a11y.js";
import { estimateTextWidth } from "../core/axes.js";
import { tint } from "../core/color-scale.js";
import {
  type GanttHeader,
  type GanttRow,
  type GanttScale,
  roundedPolyline,
  routeDependency,
} from "../core/gantt.js";
import type { Point } from "../core/path.js";

export interface GanttTask {
  id: string;
  name: string;
  start: Date | number;
  /** End instant. A task from Monday to Friday ends on Saturday 00:00. */
  end: Date | number;
  /** Completion, 0-1. Parents compute theirs from their children. */
  progress?: number;
  /** Parent task: the row is nested under it and the parent shows a summary bar. */
  parentId?: string;
  /** Drawn as a diamond at `start`. */
  milestone?: boolean;
  /** Predecessors (finish-to-start): this task starts after each of them ends. */
  dependencies?: readonly string[];
  /** CSS color of the bar; the accent by default. */
  color?: string;
  /** Extra line in the tooltip and the table, e.g. who does the work. */
  assignee?: string;
}

export type Row = GanttRow<GanttTask>;

export const HEADER_ROW = 24;
export const HEADER_HEIGHT = HEADER_ROW * 2;
const MILESTONE_COLOR = "var(--ink)";
const SUMMARY_COLOR = "var(--ink-2)";

/** Horizontal geometry of a row's mark in timeline pixels. */
export interface BarBox {
  x0: number;
  x1: number;
  milestone: boolean;
  size: number;
}

export function barBox(row: Row, scale: GanttScale, rowHeight: number): BarBox {
  const milestone = !row.parent && !!row.task.milestone;
  const size = Math.round(rowHeight * 0.44);
  if (milestone) {
    const x = scale.x(row.start);
    return { x0: x - size / 2, x1: x + size / 2, milestone, size };
  }
  const x0 = scale.x(row.start);
  return { x0, x1: Math.max(x0 + 2, scale.x(row.end)), milestone, size };
}

export const TimelineHeader = memo(function TimelineHeader({
  header,
  width,
  scrollLeft,
  viewport,
  todayX,
  todayLabel,
}: {
  header: GanttHeader;
  width: number;
  scrollLeft: number;
  viewport: number;
  todayX: number | null;
  todayLabel: string;
}) {
  return (
    <svg aria-hidden="true" width={width} height={HEADER_HEIGHT} className="block">
      {header.top.map((cell) => {
        // The label of a long cell sticks to the left edge of the visible window.
        const room = cell.width - 16;
        const textWidth = estimateTextWidth(cell.label, 11.5);
        const x = Math.min(
          Math.max(cell.x, scrollLeft) + 8,
          cell.x + Math.max(8, room - textWidth),
        );
        return (
          <g key={cell.key}>
            <line
              x1={cell.x}
              x2={cell.x}
              y1={0}
              y2={HEADER_ROW}
              shapeRendering="crispEdges"
              style={{ stroke: "var(--line)" }}
            />
            {room > 10 ? (
              <text
                x={x}
                y={HEADER_ROW / 2}
                dy="0.34em"
                className="fill-ink-2 font-semibold text-[11.5px]"
              >
                {cell.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <line
        x1={0}
        x2={width}
        y1={HEADER_ROW + 0.5}
        y2={HEADER_ROW + 0.5}
        style={{ stroke: "var(--line)" }}
      />
      {header.bottom.map((cell) =>
        cell.x + cell.width < scrollLeft - 40 || cell.x > scrollLeft + viewport + 40 ? null : (
          <g key={cell.key}>
            <line
              x1={cell.x}
              x2={cell.x}
              y1={HEADER_ROW}
              y2={HEADER_HEIGHT}
              shapeRendering="crispEdges"
              style={{ stroke: "var(--chart-grid)" }}
            />
            {estimateTextWidth(cell.label, 10.5) <= cell.width - 4 ? (
              <text
                x={cell.x + cell.width / 2}
                y={HEADER_ROW + HEADER_ROW / 2}
                dy="0.34em"
                textAnchor="middle"
                className="fill-ink-3 font-medium text-[10.5px] tabular-nums"
              >
                {cell.label}
              </text>
            ) : null}
          </g>
        ),
      )}
      {todayX != null ? (
        <g transform={`translate(${todayX},4)`}>
          <rect
            x={-estimateTextWidth(todayLabel, 10) / 2 - 6}
            y={0}
            width={estimateTextWidth(todayLabel, 10) + 12}
            height={16}
            rx={8}
            style={{ fill: "var(--danger)" }}
          />
          <text
            y={8}
            dy="0.34em"
            textAnchor="middle"
            className="font-bold text-[10px]"
            style={{ fill: "var(--surface)" }}
          >
            {todayLabel}
          </text>
        </g>
      ) : null}
      <line
        x1={0}
        x2={width}
        y1={HEADER_HEIGHT - 0.5}
        y2={HEADER_HEIGHT - 0.5}
        style={{ stroke: "var(--line-strong)" }}
      />
    </svg>
  );
});

/** Background: non-working days, vertical grid, row separators and the today line. */
export const TimelineBackdrop = memo(function TimelineBackdrop({
  header,
  scale,
  shading,
  rows,
  rowHeight,
  todayX,
}: {
  header: GanttHeader;
  scale: GanttScale;
  shading: ReadonlyArray<readonly [number, number]>;
  rows: number;
  rowHeight: number;
  todayX: number | null;
}) {
  const height = rows * rowHeight;
  return (
    <g {...DECORATIVE}>
      {shading.map(([from, to]) => (
        <rect
          key={from}
          x={scale.x(from)}
          y={0}
          width={scale.x(to) - scale.x(from)}
          height={height}
          style={{ fill: "var(--surface-2)", fillOpacity: 0.8 }}
        />
      ))}
      {header.bottom.map((cell) => (
        <line
          key={cell.key}
          x1={cell.x}
          x2={cell.x}
          y1={0}
          y2={height}
          shapeRendering="crispEdges"
          style={{ stroke: "var(--chart-grid)" }}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: one separator per row position.
          key={i}
          x1={0}
          x2={scale.width}
          y1={(i + 1) * rowHeight - 0.5}
          y2={(i + 1) * rowHeight - 0.5}
          style={{ stroke: "var(--chart-grid)" }}
        />
      ))}
      {todayX != null ? (
        <line
          x1={todayX}
          x2={todayX}
          y1={0}
          y2={height}
          strokeWidth={1.5}
          style={{ stroke: "var(--danger)" }}
        />
      ) : null}
    </g>
  );
});

export interface BarDraft {
  id: string;
  start: number;
  end: number;
  progress: number;
}

/** Bars, summary bars and milestones. Pointer handling lives on the parent SVG (`data-*`). */
export const TimelineBars = memo(function TimelineBars({
  rows,
  scale,
  rowHeight,
  editable,
  draft,
}: {
  rows: readonly Row[];
  scale: GanttScale;
  rowHeight: number;
  editable: boolean;
  draft: BarDraft | null;
}) {
  return (
    <g>
      {rows.map((source, i) => {
        const row =
          draft && draft.id === source.task.id
            ? { ...source, start: draft.start, end: draft.end, progress: draft.progress }
            : source;
        const box = barBox(row, scale, rowHeight);
        const cy = i * rowHeight + rowHeight / 2;
        const color = row.task.color ?? (box.milestone ? MILESTONE_COLOR : "var(--accent-word)");
        if (box.milestone) {
          const half = box.size / 2;
          const x = box.x0 + half;
          return (
            <g
              key={row.task.id}
              data-task={row.task.id}
              data-bar=""
              className={editable ? "cursor-grab" : undefined}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <path
                data-handle="move"
                d={`M${x},${cy - half - 1}L${x + half + 1},${cy}L${x},${cy + half + 1}L${x - half - 1},${cy}Z`}
                strokeLinejoin="round"
                strokeWidth={2}
                style={{ fill: color, stroke: color }}
              />
              <BarLabel x={box.x1 + 8} y={cy} text={row.task.name} outside />
            </g>
          );
        }
        const width = box.x1 - box.x0;
        if (row.parent) {
          const h = 8;
          const top = cy - h / 2;
          return (
            <g
              key={row.task.id}
              data-task={row.task.id}
              data-bar=""
              style={{ transformBox: "fill-box", transformOrigin: "left center" }}
            >
              <rect
                x={box.x0}
                y={top}
                width={width}
                height={h}
                rx={2}
                style={{ fill: tint(SUMMARY_COLOR, 30) }}
              />
              <rect
                x={box.x0}
                y={top}
                width={width * row.progress}
                height={h}
                rx={2}
                style={{ fill: SUMMARY_COLOR }}
              />
              <path
                d={`M${box.x0},${top}h7l-7,9Z M${box.x1},${top}h-7l7,9Z`}
                style={{ fill: SUMMARY_COLOR }}
              />
              <BarLabel x={box.x1 + 8} y={cy} text={row.task.name} outside strong />
            </g>
          );
        }
        const h = Math.round(rowHeight * 0.58);
        const top = cy - h / 2;
        const label = row.task.name;
        const inside = estimateTextWidth(label, 11) + 16 <= width;
        return (
          <g
            key={row.task.id}
            data-task={row.task.id}
            data-bar=""
            className={editable ? "group/bar" : undefined}
            style={{ transformBox: "fill-box", transformOrigin: "left center" }}
          >
            <rect
              data-handle="move"
              x={box.x0}
              y={top}
              width={width}
              height={h}
              rx={6}
              className={editable ? "cursor-grab" : undefined}
              style={{ fill: tint(color, 30) }}
            />
            {row.progress > 0 ? (
              <rect
                data-handle="move"
                x={box.x0}
                y={top}
                width={Math.max(Math.min(width, 6), width * row.progress)}
                height={h}
                rx={6}
                className={editable ? "cursor-grab" : undefined}
                style={{ fill: color }}
              />
            ) : null}
            {inside ? (
              <BarLabel x={box.x0 + 8} y={cy} text={label} onFill={row.progress > 0.35} />
            ) : (
              <BarLabel x={box.x1 + 8} y={cy} text={label} outside />
            )}
            {editable ? (
              <g className="opacity-0 group-hover/bar:opacity-100 motion-safe:transition-opacity">
                <rect
                  data-handle="start"
                  x={box.x0 - 3}
                  y={top}
                  width={8}
                  height={h}
                  rx={3}
                  className="cursor-ew-resize"
                  style={{ fill: "var(--ink)", fillOpacity: 0.001 }}
                />
                <rect
                  data-handle="end"
                  x={box.x1 - 5}
                  y={top}
                  width={8}
                  height={h}
                  rx={3}
                  className="cursor-ew-resize"
                  style={{ fill: "var(--ink)", fillOpacity: 0.001 }}
                />
                <rect
                  x={box.x1 - 4}
                  y={cy - 6}
                  width={3}
                  height={12}
                  rx={1.5}
                  className="pointer-events-none"
                  style={{ fill: "var(--surface)", fillOpacity: 0.9 }}
                />
                <path
                  data-handle="progress"
                  d={`M${box.x0 + width * row.progress},${top + h - 2}l6,9h-12Z`}
                  strokeWidth={1.25}
                  className="cursor-col-resize"
                  style={{ fill: "var(--float)", stroke: "var(--ink-2)" }}
                />
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
});

function BarLabel({
  x,
  y,
  text,
  outside,
  strong,
  onFill,
}: {
  x: number;
  y: number;
  text: string;
  outside?: boolean;
  strong?: boolean;
  onFill?: boolean;
}) {
  return (
    <text
      {...DECORATIVE}
      x={x}
      y={y}
      dy="0.34em"
      className={
        outside
          ? `pointer-events-none fill-ink-2 text-[11px] ${strong ? "font-bold" : "font-medium"}`
          : "pointer-events-none font-semibold text-[11px]"
      }
      style={outside ? undefined : { fill: onFill ? "var(--surface)" : "var(--ink)" }}
    >
      {text}
    </text>
  );
}

export interface Link {
  key: string;
  from: string;
  to: string;
  d: string;
  /** The successor starts before the predecessor ends. */
  late: boolean;
}

/** Finish-to-start links between the visible rows, routed orthogonally. */
export function dependencyLinks(
  rows: readonly Row[],
  scale: GanttScale,
  rowHeight: number,
): Link[] {
  // Short runs on compressed zooms, so links between close tasks stay readable.
  const gap = Math.min(10, Math.max(4, (scale.k * 86_400_000) / 2));
  const index = new Map(rows.map((row, i) => [row.task.id, i]));
  const links: Link[] = [];
  rows.forEach((row, to) => {
    for (const id of row.task.dependencies ?? []) {
      const from = index.get(id);
      if (from == null || from === to) continue;
      const source = rows[from] as Row;
      const a = barBox(source, scale, rowHeight);
      const b = barBox(row, scale, rowHeight);
      const start: Point = { x: a.x1, y: from * rowHeight + rowHeight / 2 };
      const end: Point = { x: b.x0 - 2, y: to * rowHeight + rowHeight / 2 };
      const points = routeDependency(start, end, { gap, rowHeight });
      links.push({
        key: `${id}>${row.task.id}`,
        from: id,
        to: row.task.id,
        d: roundedPolyline(points, 4),
        late: row.start < source.end,
      });
    }
  });
  return links;
}

const MARKER_TONES = [
  ["base", "var(--ink-3)"],
  ["active", "var(--ink)"],
  ["late", "var(--danger)"],
] as const;

export const DependencyLayer = memo(function DependencyLayer({
  links,
  activeId,
  markerId,
}: {
  links: readonly Link[];
  activeId: string | null;
  markerId: string;
}) {
  return (
    <g {...DECORATIVE} fill="none" className="pointer-events-none">
      <defs>
        {MARKER_TONES.map(([tone, color]) => (
          <marker
            key={tone}
            id={`${markerId}-${tone}`}
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M0,0L8,4L0,8Z" style={{ fill: color }} />
          </marker>
        ))}
      </defs>
      {links.map((link) => {
        const active = activeId != null && (link.from === activeId || link.to === activeId);
        const tone = link.late ? "late" : active ? "active" : "base";
        return (
          <path
            key={link.key}
            d={link.d}
            strokeWidth={active ? 1.75 : 1.25}
            markerEnd={`url(#${markerId}-${tone})`}
            className="motion-safe:transition-[stroke-opacity] motion-safe:duration-150"
            style={{
              stroke: link.late ? "var(--danger)" : active ? "var(--ink)" : "var(--ink-3)",
              strokeOpacity: activeId == null || active ? 0.9 : 0.35,
            }}
          />
        );
      })}
    </g>
  );
});
