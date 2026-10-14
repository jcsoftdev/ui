import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { svg } from "../internal/chart-base.js";
import {
  addUnits,
  type CriticalPath,
  criticalPath,
  DAY_MS,
  daysBetween,
  GANTT_ZOOMS,
  type GanttScale,
  type GanttZoom,
  snapTime,
} from "../internal/e23-gantt.js";
import {
  dependencyLinks,
  LABEL_LANE,
  type Link,
  type PlacedAnnotation,
  placeAnnotations,
  type Row,
} from "../internal/e23-gantt-layout.js";
import type { GanttTaskChange } from "./gantt.js";
import css from "./gantt-extras.css.js";

/** The styles of these parts, adopted by the chart when this module loads. */
export const styles = css;

// Optional parts of <ui-gantt>, loaded only when the chart uses them: dependency arrows, the
// critical path, annotations, baselines and editing. A plain task list never fetches this module.

export type { CriticalPath, Link, PlacedAnnotation };
export { criticalPath, dependencyLinks, placeAnnotations };

export function annotationNodes(
  item: PlacedAnnotation,
  scrollY: number,
  bodyHeight: number,
  scrollX: number,
  viewport: number,
): SVGElement[] {
  const label = estimateTextWidth(item.label, 10.5) + 14;
  const y = scrollY + 4 + item.lane * LABEL_LANE;
  const out: SVGElement[] = [];
  const color = `stroke:${item.color}`;
  if (item.x1 != null)
    out.push(
      svg("rect", {
        class: "band-note",
        x: item.x0,
        y: scrollY,
        width: Math.max(1, item.x1 - item.x0),
        height: bodyHeight,
        style: `fill:${item.color}`,
      }),
    );
  out.push(
    svg("line", {
      class: "note-line",
      x1: item.x0,
      x2: item.x0,
      y1: scrollY,
      y2: scrollY + bodyHeight,
      style: color,
    }),
  );
  if (item.x0 + label < scrollX - 40 || item.x0 > scrollX + viewport + 40) return out;
  out.push(
    svg("rect", {
      class: "note-pill",
      x: item.x0 + 3,
      y,
      width: label,
      height: 15,
      rx: 7.5,
      style: color,
    }),
    svg("text", { class: "note-label", x: item.x0 + 10, y: y + 7.5, dy: "0.34em" }, item.label),
  );
  return out;
}

export function linkNodes(
  links: readonly Link[],
  activeId: string | null,
  critical: CriticalPath | null,
  marker: string,
): SVGElement[] {
  return links.map((link) => {
    const active = activeId != null && (link.from === activeId || link.to === activeId);
    const hot = !!critical?.links.has(link.key);
    const tone = link.late || hot ? "late" : active ? "active" : "base";
    return svg("path", {
      class: `link link-${tone}`,
      d: link.d,
      "marker-end": `url(#${marker}-${tone})`,
      "stroke-width": hot ? 2.25 : active ? 1.75 : 1.25,
      style: `stroke-opacity:${hot || activeId == null || active ? 0.9 : 0.35}`,
    });
  });
}

export function baselineNode(
  task: { baseline?: { start: Date | number; end: Date | number } },
  scale: GanttScale,
  top: number,
  h: number,
): SVGElement | null {
  if (!task.baseline) return null;
  const a = scale.x(+task.baseline.start);
  const b = scale.x(+task.baseline.end);
  return svg("rect", {
    class: "baseline",
    x: a,
    y: top + h + 2,
    width: Math.max(2, b - a),
    height: 4,
    rx: 2,
  });
}

/** Resize handles, the grip and the progress knob of an editable bar. */
export function handleNodes(
  box: { x0: number; x1: number },
  progress: number,
  top: number,
  h: number,
  cy: number,
): SVGElement {
  const width = box.x1 - box.x0;
  return svg(
    "g",
    { class: "handles" },
    svg("rect", {
      class: "ew",
      "data-handle": "start",
      x: box.x0 - 3,
      y: top,
      width: 8,
      height: h,
      rx: 3,
    }),
    svg("rect", {
      class: "ew",
      "data-handle": "end",
      x: box.x1 - 5,
      y: top,
      width: 8,
      height: h,
      rx: 3,
    }),
    svg("rect", { class: "grip", x: box.x1 - 4, y: cy - 6, width: 3, height: 12, rx: 1.5 }),
    svg("path", {
      class: "knob",
      "data-handle": "progress",
      d: `M${box.x0 + width * progress},${top + h - 2}l6,9h-12Z`,
    }),
  );
}

export interface DragState {
  id: string;
  mode: "move" | "start" | "end" | "progress";
  originX: number;
  start: number;
  end: number;
  progress: number;
  barLeft: number;
  barWidth: number;
  moved: boolean;
}

export interface Draft {
  id: string;
  start: number;
  end: number;
  progress: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The dates and progress a drag has reached at pointer position `clientX`. */
export function dragDraft(
  drag: DragState,
  clientX: number,
  zoom: GanttZoom,
  scaleK: number,
  tz: string | undefined,
): Draft {
  const level = GANTT_ZOOMS[zoom];
  const snap = (time: number) => snapTime(time, level.snap, tz);
  const dt = (clientX - drag.originX) / scaleK;
  const { id, progress } = drag;
  if (drag.mode === "move") {
    const start = snap(drag.start + dt);
    // Whole days move by calendar days, so a daylight saving change keeps the hours of the day.
    const end =
      level.snap >= DAY_MS
        ? addUnits(drag.end, "day", daysBetween(drag.start, start, tz), tz)
        : start + (drag.end - drag.start);
    return { id, start, end, progress };
  }
  if (drag.mode === "start")
    return {
      id,
      start: Math.min(drag.end - level.snap, snap(drag.start + dt)),
      end: drag.end,
      progress,
    };
  if (drag.mode === "end")
    return {
      id,
      start: drag.start,
      end: Math.max(drag.start + level.snap, snap(drag.end + dt)),
      progress,
    };
  const ratio = (clientX - drag.barLeft) / Math.max(1, drag.barWidth);
  return {
    id,
    start: drag.start,
    end: drag.end,
    progress: Math.round(clamp(ratio, 0, 1) * 20) / 20,
  };
}

/** The edit an Alt/Shift + arrow or +/- key asks for on a leaf row, or `null` for any other key. */
export function keyEdit(
  row: Row,
  key: string,
  alt: boolean,
  shift: boolean,
  zoom: GanttZoom,
  tz: string | undefined,
): GanttTaskChange | null {
  const level = GANTT_ZOOMS[zoom];
  const sign = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  const id = row.task.id;
  if (sign !== 0 && (alt || shift)) {
    const days = level.snap >= DAY_MS ? Math.round(level.snap / DAY_MS) * sign : 0;
    const shifted = (time: number) =>
      days ? addUnits(time, "day", days, tz) : time + level.snap * sign;
    if (alt || row.task.milestone)
      return {
        id,
        start: new Date(shifted(row.start)),
        end: new Date(shifted(row.end)),
        progress: row.progress,
        source: "move",
      };
    const minEnd = days ? addUnits(row.start, "day", 1, tz) : row.start + level.snap;
    return {
      id,
      start: new Date(row.start),
      end: new Date(Math.max(minEnd, shifted(row.end))),
      progress: row.progress,
      source: "resize",
    };
  }
  if (!row.task.milestone && (key === "+" || key === "=" || key === "-"))
    return {
      id,
      start: new Date(row.start),
      end: new Date(row.end),
      progress: Math.round(clamp(row.progress + (key === "-" ? -0.1 : 0.1), 0, 1) * 100) / 100,
      source: "progress",
    };
  return null;
}
