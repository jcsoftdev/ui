/**
 * Pure geometry behind the Gantt chart: calendar units, the date → x scale
 * of each zoom level, the two-tier header, non-working day spans, the task
 * tree flattened into rows (with summary bars for parents) and orthogonal
 * routing of finish-to-start dependency arrows.
 */

import { type Calendar, calendarFor } from "@jcsoftdev/ui-core/chart/calendar";
import type { Point } from "@jcsoftdev/ui-core/chart/path";
import {
  type DateLocaleOptions,
  shortMonth,
  shortWeekday,
} from "@jcsoftdev/ui-core/chart/scale-time";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export type CalendarUnit = "hour" | "day" | "week" | "month" | "quarter" | "year";
export type GanttZoom = "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface GanttZoomLevel {
  /** Pixels per day before stretching to fill the pane. */
  pxPerDay: number;
  /** Upper and lower header rows. */
  top: CalendarUnit;
  bottom: CalendarUnit;
  /** Calendar unit the domain is padded and rounded to. */
  pad: CalendarUnit;
  /** Drag and keyboard step, in milliseconds. */
  snap: number;
  /** Shade weekends and holidays (too thin to read on long zooms). */
  shadeNonWorking: boolean;
}

export const GANTT_ZOOMS: Record<GanttZoom, GanttZoomLevel> = {
  hour: {
    pxPerDay: 24 * 32,
    top: "day",
    bottom: "hour",
    pad: "day",
    snap: HOUR_MS,
    shadeNonWorking: true,
  },
  day: {
    pxPerDay: 40,
    top: "month",
    bottom: "day",
    pad: "week",
    snap: DAY_MS,
    shadeNonWorking: true,
  },
  week: {
    pxPerDay: 16,
    top: "month",
    bottom: "week",
    pad: "month",
    snap: DAY_MS,
    shadeNonWorking: true,
  },
  month: {
    pxPerDay: 5,
    top: "year",
    bottom: "month",
    pad: "month",
    snap: DAY_MS,
    shadeNonWorking: false,
  },
  quarter: {
    pxPerDay: 1.9,
    top: "year",
    bottom: "quarter",
    pad: "quarter",
    snap: DAY_MS,
    shadeNonWorking: false,
  },
  year: {
    pxPerDay: 0.55,
    top: "year",
    bottom: "quarter",
    pad: "year",
    snap: DAY_MS,
    shadeNonWorking: false,
  },
};

export const GANTT_ZOOM_ORDER: readonly GanttZoom[] = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

/** Milliseconds the wall clock of `tz` (the local zone when omitted) is ahead of UTC at `time`. */
export function wallOffset(time: number, tz?: string): number {
  if (!tz) return -new Date(time).getTimezoneOffset() * 60_000;
  return calendarFor(tz).wall(time).getTime() - time;
}

/** Start of the calendar unit holding `time`, in `tz` (local time by default). Weeks start on Monday. */
export function startOf(time: number, unit: CalendarUnit, tz?: string): number {
  const cal: Calendar = calendarFor(tz);
  const d = cal.wall(time);
  if (unit === "hour") {
    // Zones with a half-hour offset still start their hours on the hour of the wall clock.
    d.setUTCMinutes(0, 0, 0);
    return tz ? cal.instant(d) : new Date(time).setMinutes(0, 0, 0);
  }
  cal.midnight(d);
  if (unit === "week") cal.setDate(d, cal.date(d) - ((cal.day(d) + 6) % 7));
  else if (unit === "month") cal.setDate(d, 1);
  else if (unit === "quarter") {
    cal.setMonth(d, Math.floor(cal.month(d) / 3) * 3);
    cal.setDate(d, 1);
  } else if (unit === "year") {
    cal.setMonth(d, 0);
    cal.setDate(d, 1);
  }
  return cal.instant(d);
}

/** `time` moved by `count` calendar units (daylight saving safe for days and above). */
export function addUnits(time: number, unit: CalendarUnit, count: number, tz?: string): number {
  if (unit === "hour") return time + count * HOUR_MS;
  const cal = calendarFor(tz);
  const d = cal.wall(time);
  if (unit === "day") cal.setDate(d, cal.date(d) + count);
  else if (unit === "week") cal.setDate(d, cal.date(d) + count * 7);
  else if (unit === "month") cal.setMonth(d, cal.month(d) + count);
  else if (unit === "quarter") cal.setMonth(d, cal.month(d) + count * 3);
  else cal.setYear(d, cal.year(d) + count);
  return cal.instant(d);
}

/** Whole calendar days from `from` to `to` (a day is 23 or 25 hours across a daylight saving change). */
export function daysBetween(from: number, to: number, tz?: string): number {
  const cal = calendarFor(tz);
  const a = cal.wall(from);
  const b = cal.wall(to);
  const utc = (d: Date) => Date.UTC(cal.year(d), cal.month(d), cal.date(d));
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

/** Hours and minutes on the wall clock of `tz` (the local zone when omitted). */
export function wallClock(time: number, tz?: string): { hours: number; minutes: number } {
  const t = (((time + wallOffset(time, tz)) % DAY_MS) + DAY_MS) % DAY_MS;
  return { hours: Math.floor(t / HOUR_MS), minutes: Math.floor((t % HOUR_MS) / 60_000) };
}

/** Day of the month of `time` on the calendar of `tz`. */
export function dayOfMonth(time: number, tz?: string): number {
  const cal = calendarFor(tz);
  return cal.date(cal.wall(time));
}

/**
 * Parses a date. A date-only string (`2026-10-05`) is midnight of that day in `tz` (local time by
 * default), not UTC midnight; anything else goes through `Date.parse`. NaN when it is not a date.
 */
export function parseWallDate(text: string, tz?: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return Date.parse(text);
  const [year = 0, month = 1, date = 1] = match.slice(1).map(Number);
  if (!tz) return new Date(year, month - 1, date).getTime();
  return calendarFor(tz).instant(new Date(Date.UTC(year, month - 1, date)));
}

/** Visible window for a zoom: the tasks padded by one `pad` unit on each side, on unit boundaries. */
export function ganttDomain(
  times: readonly number[],
  zoom: GanttZoom,
  tz?: string,
): [number, number] {
  const { pad } = GANTT_ZOOMS[zoom];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const time of times) {
    if (time < min) min = time;
    if (time > max) max = time;
  }
  const start = startOf(min, pad, tz);
  const end = addUnits(startOf(max, pad, tz), pad, 1, tz);
  return [start, end];
}

export interface GanttScale {
  domain: readonly [number, number];
  /** Pixels per millisecond. */
  k: number;
  /** Width of the whole timeline in pixels. */
  width: number;
  x(time: number): number;
  invert(pixel: number): number;
}

/**
 * Linear date → x scale. The zoom fixes the density; when the timeline would
 * be narrower than `minWidth` it stretches so it always fills its pane.
 */
export function ganttScale(
  domain: readonly [number, number],
  zoom: GanttZoom,
  minWidth = 0,
): GanttScale {
  const [start, end] = domain;
  const span = Math.max(1, end - start);
  const k = Math.max(GANTT_ZOOMS[zoom].pxPerDay / DAY_MS, minWidth / span);
  return {
    domain,
    k,
    width: span * k,
    x: (time) => (time - start) * k,
    invert: (pixel) => start + pixel / k,
  };
}

/** Rounds `time` to the nearest hour (`step` under a day) or the nearest midnight of `tz`. */
export function snapTime(time: number, step: number, tz?: string): number {
  if (step >= DAY_MS) {
    const before = startOf(time, "day", tz);
    const after = addUnits(before, "day", 1, tz);
    return time - before < after - time ? before : after;
  }
  const offset = wallOffset(time, tz);
  return Math.round((time + offset) / step) * step - offset;
}

export interface HeaderCell {
  key: number;
  x: number;
  width: number;
  label: string;
}

export interface GanttHeader {
  top: HeaderCell[];
  bottom: HeaderCell[];
}

export interface HeaderLabelOptions extends DateLocaleOptions {
  /** "Q3" for the third quarter by default. */
  quarter?: (quarter: number) => string;
}

function unitLabel(time: number, unit: CalendarUnit, width: number, options: HeaderLabelOptions) {
  const tz = options.timeZone;
  const cal = calendarFor(tz);
  const d = new Date(time);
  const wall = cal.wall(time);
  const day = cal.date(wall);
  if (unit === "hour") {
    const hours = Math.floor(
      ((((time + wallOffset(time, tz)) % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS,
    );
    return String(hours).padStart(2, "0");
  }
  if (unit === "day") {
    if (width >= 120) return `${shortWeekday(d, options)} ${day} ${shortMonth(d, options)}`;
    return width >= 34 ? `${shortWeekday(d, options).slice(0, 2)} ${day}` : String(day);
  }
  if (unit === "week") return width >= 52 ? `${day} ${shortMonth(d, options)}` : String(day);
  if (unit === "month") {
    if (width >= 140) return `${shortMonth(d, options)} ${cal.year(wall)}`;
    return width >= 30 ? shortMonth(d, options) : shortMonth(d, options).slice(0, 1);
  }
  if (unit === "quarter")
    return (options.quarter ?? ((q) => `Q${q}`))(Math.floor(cal.month(wall) / 3) + 1);
  return String(cal.year(wall));
}

/** Cells of one header row, clipped to the scale. */
export function headerCells(
  scale: GanttScale,
  unit: CalendarUnit,
  options: HeaderLabelOptions = {},
): HeaderCell[] {
  const [start, end] = scale.domain;
  const tz = options.timeZone;
  const cells: HeaderCell[] = [];
  for (let t = startOf(start, unit, tz); t < end; t = addUnits(t, unit, 1, tz)) {
    const next = addUnits(t, unit, 1, tz);
    const x0 = Math.max(0, scale.x(t));
    const x1 = Math.min(scale.width, scale.x(next));
    if (x1 <= x0) continue;
    cells.push({ key: t, x: x0, width: x1 - x0, label: unitLabel(t, unit, x1 - x0, options) });
  }
  return cells;
}

/** Both header rows of a zoom level. */
export function ganttHeader(
  scale: GanttScale,
  zoom: GanttZoom,
  options: HeaderLabelOptions = {},
): GanttHeader {
  const level = GANTT_ZOOMS[zoom];
  return {
    top: headerCells(scale, level.top, options),
    bottom: headerCells(scale, level.bottom, options),
  };
}

/** Midnight key of a date in `tz`, for holiday lookups. */
export function dayKey(time: number, tz?: string): number {
  return startOf(time, "day", tz);
}

/**
 * Contiguous spans of non-working days inside the domain: days whose weekday
 * (0 = Sunday) is not in `workingDays`, plus `holidays`.
 */
export function nonWorkingSpans(
  domain: readonly [number, number],
  workingDays: readonly number[],
  holidays: ReadonlyArray<Date | number> = [],
  tz?: string,
): Array<[number, number]> {
  const cal = calendarFor(tz);
  const off = new Set<number>();
  for (const day of holidays) off.add(dayKey(+day, tz));
  const spans: Array<[number, number]> = [];
  for (let t = startOf(domain[0], "day", tz); t < domain[1]; t = addUnits(t, "day", 1, tz)) {
    const free = !workingDays.includes(cal.day(cal.wall(t))) || off.has(t);
    if (!free) continue;
    const next = addUnits(t, "day", 1, tz);
    const last = spans[spans.length - 1];
    if (last && last[1] === t) last[1] = next;
    else spans.push([t, next]);
  }
  return spans;
}

export interface RouteOptions {
  /** Horizontal run out of the predecessor and into the successor. */
  gap?: number;
  /** Row height; a backward link turns in the gutter between rows. */
  rowHeight: number;
}

/**
 * Finish-to-start arrow from the end of a predecessor (`from`) to the start
 * of its successor (`to`), with right angles only. When the successor starts
 * far enough to the right the link steps down once; otherwise it leaves to
 * the right, turns back along the row gutter and enters from the left.
 */
export function routeDependency(
  from: Point,
  to: Point,
  { gap = 10, rowHeight }: RouteOptions,
): Point[] {
  if (from.y === to.y) return [from, to];
  const out = from.x + gap;
  if (to.x - gap >= out) {
    return [from, { x: out, y: from.y }, { x: out, y: to.y }, to];
  }
  const down = to.y > from.y ? 1 : -1;
  const gutter = from.y + (down * rowHeight) / 2;
  const enter = to.x - gap;
  return [
    from,
    { x: out, y: from.y },
    { x: out, y: gutter },
    { x: enter, y: gutter },
    { x: enter, y: to.y },
    to,
  ];
}

/** SVG path through orthogonal points with corners rounded by up to `radius`. */
export function roundedPolyline(points: readonly Point[], radius = 4): string {
  if (points.length === 0) return "";
  const first = points[0] as Point;
  let d = `M${first.x},${first.y}`;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i] as Point;
    const next = points[i + 1];
    if (!next) {
      d += `L${point.x},${point.y}`;
      break;
    }
    const prev = points[i - 1] as Point;
    const inLength = Math.hypot(point.x - prev.x, point.y - prev.y);
    const outLength = Math.hypot(next.x - point.x, next.y - point.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r <= 0) {
      d += `L${point.x},${point.y}`;
      continue;
    }
    const ax = point.x - (Math.sign(point.x - prev.x) * r || 0);
    const ay = point.y - (Math.sign(point.y - prev.y) * r || 0);
    const bx = point.x + (Math.sign(next.x - point.x) * r || 0);
    const by = point.y + (Math.sign(next.y - point.y) * r || 0);
    d += `L${ax},${ay}Q${point.x},${point.y} ${bx},${by}`;
  }
  return d;
}

export interface GanttTaskLike {
  id: string;
  parentId?: string;
  start: Date | number;
  end: Date | number;
  progress?: number;
  /** Predecessors (finish-to-start). */
  dependencies?: readonly string[];
}

export interface GanttRow<T extends GanttTaskLike = GanttTaskLike> {
  task: T;
  /** Unique within the plan: the task id, or `id#2` for a repeated id. */
  key: string;
  depth: number;
  /** Has visible or collapsed children: drawn as a summary bar. */
  parent: boolean;
  collapsed: boolean;
  /** Own dates, or the span of every descendant for parents. */
  start: number;
  end: number;
  /** 0-1; parents average their children weighted by duration. */
  progress: number;
}

interface Rollup {
  start: number;
  end: number;
  done: number;
  span: number;
}

/**
 * Depth-first rows of the task tree, children right after their parent in
 * input order. Parents roll up the dates and the duration-weighted progress
 * of all their descendants; children of collapsed parents are left out.
 * Tasks whose parent is missing become roots.
 */
export function ganttRows<T extends GanttTaskLike>(
  tasks: readonly T[],
  collapsed: ReadonlySet<string> = new Set(),
): GanttRow<T>[] {
  const valid: T[] = [];
  for (const task of tasks) {
    if (Number.isFinite(+task.start) && Number.isFinite(+task.end)) valid.push(task);
    else warnOnce(`ui-gantt: task "${task.id}" has an invalid date and was skipped.`);
  }
  tasks = valid;
  const ids = new Set(tasks.map((task) => task.id));
  const seen = new Map<string, number>();
  const keys = new Map<T, string>();
  for (const task of tasks) {
    const count = (seen.get(task.id) ?? 0) + 1;
    seen.set(task.id, count);
    keys.set(task, count === 1 ? task.id : `${task.id}#${count}`);
    if (count === 2) warnOnce(`ui-gantt: the task id "${task.id}" repeats; ids should be unique.`);
  }
  const children = new Map<string | undefined, T[]>();
  for (const task of tasks) {
    const key = task.parentId && ids.has(task.parentId) ? task.parentId : undefined;
    const list = children.get(key);
    if (list) list.push(task);
    else children.set(key, [task]);
  }

  const rollups = new Map<T, Rollup>();
  const visiting = new Set<string>();
  const rollup = (task: T): Rollup => {
    const cached = rollups.get(task);
    if (cached) return cached;
    const kids =
      visiting.has(task.id) || keys.get(task) !== task.id ? [] : (children.get(task.id) ?? []);
    visiting.add(task.id);
    let result: Rollup;
    if (kids.length === 0) {
      const start = +task.start;
      const end = Math.max(start, +task.end);
      const span = end - start;
      result = { start, end, span, done: span * clamp01(task.progress ?? 0) };
    } else {
      result = { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY, span: 0, done: 0 };
      for (const kid of kids) {
        const r = rollup(kid);
        result.start = Math.min(result.start, r.start);
        result.end = Math.max(result.end, r.end);
        result.span += r.span;
        result.done += r.done;
      }
    }
    rollups.set(task, result);
    return result;
  };

  const rows: GanttRow<T>[] = [];
  const walk = (parent: string | undefined, depth: number) => {
    for (const task of children.get(parent) ?? []) {
      const r = rollup(task);
      const parentRow = keys.get(task) === task.id && (children.get(task.id)?.length ?? 0) > 0;
      const isCollapsed = parentRow && collapsed.has(task.id);
      rows.push({
        task,
        key: keys.get(task) ?? task.id,
        depth,
        parent: parentRow,
        collapsed: isCollapsed,
        start: r.start,
        end: r.end,
        progress: parentRow ? (r.span > 0 ? r.done / r.span : 0) : clamp01(task.progress ?? 0),
      });
      if (parentRow && !isCollapsed && depth < 32) walk(task.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return rows;
}

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface CriticalPath {
  /** Leaf tasks with no slack: delaying any of them delays the project end. */
  tasks: Set<string>;
  /** Dependency links `"from>to"` between critical tasks that are tight (no waiting). */
  links: Set<string>;
  /** Slack of every scheduled leaf task, in milliseconds. */
  slack: Map<string, number>;
  /** Earliest finish of the whole plan. */
  end: number;
}

/**
 * Critical path method over finish-to-start dependencies. Each leaf task keeps
 * its duration; tasks without predecessors start at their own start date and the
 * rest as soon as every predecessor ends (a dependency on a parent means all of
 * its leaves), so waiting gaps in the plan do not count. A forward
 * pass finds the earliest dates and the project end, a backward pass the latest
 * ones; tasks whose slack is within `tolerance` form the critical path. Tasks
 * caught in a dependency cycle are left out.
 */
export function criticalPath(tasks: readonly GanttTaskLike[], tolerance = 60_000): CriticalPath {
  const rows = ganttRows(tasks);
  const leaves = rows.filter((row) => !row.parent);
  const leafIds = new Set(leaves.map((row) => row.task.id));
  const parentOf = new Map(tasks.map((task) => [task.id, task.parentId]));
  const under = new Map<string, string[]>();
  for (const leaf of leaves) {
    for (let id = parentOf.get(leaf.task.id), hops = 0; id && hops < 32; hops += 1) {
      const list = under.get(id);
      if (list) list.push(leaf.task.id);
      else under.set(id, [leaf.task.id]);
      id = parentOf.get(id);
    }
  }

  const preds = new Map<string, Set<string>>();
  const succs = new Map<string, Set<string>>();
  for (const leaf of leaves) {
    preds.set(leaf.task.id, new Set());
    succs.set(leaf.task.id, new Set());
  }
  for (const leaf of leaves) {
    for (const dep of leaf.task.dependencies ?? []) {
      const sources = leafIds.has(dep) ? [dep] : (under.get(dep) ?? []);
      for (const source of sources) {
        if (source === leaf.task.id) continue;
        preds.get(leaf.task.id)?.add(source);
        succs.get(source)?.add(leaf.task.id);
      }
    }
  }

  const info = new Map(leaves.map((row) => [row.task.id, row]));
  const indegree = new Map([...preds].map(([id, set]) => [id, set.size]));
  const order: string[] = [];
  const queue = [...indegree].filter(([, count]) => count === 0).map(([id]) => id);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of succs.get(id) ?? []) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }

  const duration = (id: string) => {
    const row = info.get(id) as GanttRow;
    return Math.max(0, row.end - row.start);
  };
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();
  let end = Number.NEGATIVE_INFINITY;
  for (const id of order) {
    const before = [...(preds.get(id) ?? [])].map((pred) => earliestFinish.get(pred) ?? 0);
    const start = before.length > 0 ? Math.max(...before) : (info.get(id) as GanttRow).start;
    earliestStart.set(id, start);
    earliestFinish.set(id, start + duration(id));
    end = Math.max(end, start + duration(id));
  }

  const latestFinish = new Map<string, number>();
  const slack = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i] as string;
    let finish = end;
    for (const next of succs.get(id) ?? []) {
      finish = Math.min(finish, (latestFinish.get(next) ?? end) - duration(next));
    }
    latestFinish.set(id, finish);
    slack.set(id, finish - (earliestFinish.get(id) as number));
  }

  const critical = new Set(order.filter((id) => (slack.get(id) as number) <= tolerance));
  const links = new Set<string>();
  for (const id of critical) {
    for (const pred of preds.get(id) ?? []) {
      if (
        critical.has(pred) &&
        (earliestFinish.get(pred) as number) + tolerance >= (earliestStart.get(id) as number)
      ) {
        links.add(`${pred}>${id}`);
      }
    }
  }
  return { tasks: critical, links, slack, end: order.length > 0 ? end : 0 };
}
