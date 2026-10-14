/** Layout of the Gantt marks in timeline pixels: bar boxes, label placement, links and annotations. */
import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import type { Point } from "@jcsoftdev/ui-core/chart/path";
import { type GanttRow, type GanttScale, roundedPolyline, routeDependency } from "./e23-gantt.js";

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
  /** The planned dates; with `baselines` a thin bar under the bar shows the plan against the actual. */
  baseline?: { start: Date | number; end: Date | number };
}

/** A date line, or a band when `to` is set, with a label. */
export interface GanttAnnotation {
  id: string;
  at: Date | number;
  /** End of a band; omit for a line. */
  to?: Date | number;
  label: string;
  /** CSS color, the warning tone by default. */
  color?: string;
}

export type Row = GanttRow<GanttTask>;

export const HEADER_ROW = 24;
export const HEADER_HEIGHT = HEADER_ROW * 2;

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

const LABEL_GAP = 8;
const LABEL_EDGE = 4;

/**
 * Places a label beside its bar: to the right when it fits inside the plot, otherwise
 * flipped to the left, otherwise truncated on the roomier side. Never crosses the plot edge.
 */
export function outsideLabel(
  box: { x0: number; x1: number },
  text: string,
  plotWidth: number,
  strong?: boolean,
): { x: number; text: string; end?: boolean } {
  const size = strong ? 11.5 : 11;
  const full = estimateTextWidth(text, size);
  const right = plotWidth - LABEL_EDGE - (box.x1 + LABEL_GAP);
  if (full <= right) return { x: box.x1 + LABEL_GAP, text };
  const left = box.x0 - LABEL_GAP - LABEL_EDGE;
  if (full <= left) return { x: box.x0 - LABEL_GAP, text, end: true };
  const useRight = right >= left;
  const room = Math.max(0, useRight ? right : left);
  let cut = text;
  while (cut.length > 1 && estimateTextWidth(`${cut}…`, size) > room) cut = cut.slice(0, -1);
  const label = room > 0 ? `${cut.trimEnd()}…` : "";
  return useRight
    ? { x: box.x1 + LABEL_GAP, text: label }
    : { x: box.x0 - LABEL_GAP, text: label, end: true };
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
      links.push({
        key: `${id}>${row.task.id}`,
        from: id,
        to: row.task.id,
        d: roundedPolyline(routeDependency(start, end, { gap, rowHeight }), 4),
        late: row.start < source.end,
      });
    }
  });
  return links;
}

/** Annotation placed in pixels, with the lane its label sits in so labels never overlap. */
export interface PlacedAnnotation {
  id: string;
  x0: number;
  x1: number | null;
  label: string;
  color: string;
  lane: number;
}

export const LABEL_LANE = 18;

/** Positions annotations on the scale and stacks overlapping labels into lanes. */
export function placeAnnotations(
  annotations: readonly GanttAnnotation[],
  scale: GanttScale,
): PlacedAnnotation[] {
  const sorted = annotations
    .filter((a) => +a.at >= scale.domain[0] - 1 && +a.at <= scale.domain[1] + 1)
    .sort((a, b) => +a.at - +b.at);
  const ends: number[] = [];
  return sorted.map((a) => {
    const x0 = scale.x(+a.at);
    const x1 = a.to == null ? null : scale.x(+a.to);
    const width = estimateTextWidth(a.label, 10.5) + 14;
    let lane = ends.findIndex((end) => end + 4 <= x0);
    if (lane < 0) lane = ends.length;
    ends[lane] = x0 + width;
    return { id: a.id, x0, x1, label: a.label, color: a.color ?? "var(--warning)", lane };
  });
}
