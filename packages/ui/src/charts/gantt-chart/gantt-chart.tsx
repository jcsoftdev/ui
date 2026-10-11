"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { DEFAULT_EXPORT_TEXTS, ExportMenu, type ExportTexts } from "../core/export-menu.js";
import { formatPercent } from "../core/format.js";
import {
  type CriticalPath,
  criticalPath,
  DAY_MS,
  GANTT_ZOOM_ORDER,
  GANTT_ZOOMS,
  type GanttZoom,
  ganttDomain,
  ganttHeader,
  ganttRows,
  ganttScale,
  HOUR_MS,
  nonWorkingSpans,
  snapTime,
} from "../core/gantt.js";
import { EASE_OUT, useEntryAnimation, useReducedMotion } from "../core/motion.js";
import { formatDate, shortMonth } from "../core/scales/time.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useIsomorphicLayoutEffect } from "../core/use-chart-size.js";
import { buildTaskListSvg } from "./gantt-export.js";
import {
  AnnotationLayer,
  type BarDraft,
  barBox,
  DependencyLayer,
  dependencyLinks,
  type GanttAnnotation,
  type GanttTask,
  HEADER_HEIGHT,
  placeAnnotations,
  type Row,
  TimelineBackdrop,
  TimelineBars,
  TimelineHeader,
} from "./gantt-marks.js";

export type { GanttAnnotation, GanttTask } from "./gantt-marks.js";

export interface GanttTaskChange {
  id: string;
  start: Date;
  end: Date;
  progress: number;
  /** What changed it. */
  source: "move" | "resize" | "progress";
}

export interface GanttTexts {
  /** Accessible name of the task list and header of its first column. */
  tasks: string;
  start: string;
  end: string;
  progress: string;
  duration: string;
  milestone: string;
  assignee: string;
  dependsOn: string;
  /** Unit words for durations. */
  day: string;
  days: string;
  hours: string;
  today: string;
  /** Accessible name of the zoom buttons. */
  zoom: string;
  zoomLevels: Record<GanttZoom, string>;
  /** One or two letters for narrow containers. */
  zoomShort: Record<GanttZoom, string>;
  /** Baseline (plan) and critical path wording. */
  baseline: string;
  variance: string;
  criticalPath: string;
  critical: string;
  slack: string;
  annotations: string;
  /** Export buttons. */
  exportTexts: ExportTexts;
  /** Accessible name of the divider between the task list and the timeline. */
  divider: string;
  /** Read after a row: how to move, collapse and edit with the keyboard. */
  keyboardHint: string;
  /** Quarter label in the header, "T3" by default. */
  quarter: (quarter: number) => string;
}

/** Texts the caller may override; per-zoom words can be given for some levels only. */
export type GanttTextsInput = Partial<
  Omit<GanttTexts, "zoomLevels" | "zoomShort"> & {
    zoomLevels: Partial<GanttTexts["zoomLevels"]>;
    zoomShort: Partial<GanttTexts["zoomShort"]>;
  }
>;

const DEFAULT_TEXTS: GanttTexts = {
  tasks: "Tasks",
  start: "Start",
  end: "End",
  progress: "Progress",
  duration: "Duration",
  milestone: "Milestone",
  assignee: "Assignee",
  dependsOn: "Depends on",
  day: "day",
  days: "days",
  hours: "h",
  today: "Today",
  zoom: "Zoom",
  zoomLevels: {
    hour: "Hours",
    day: "Days",
    week: "Weeks",
    month: "Months",
    quarter: "Quarters",
    year: "Year",
  },
  zoomShort: { hour: "H", day: "D", week: "W", month: "M", quarter: "Q", year: "Y" },
  baseline: "Baseline",
  variance: "Variance",
  criticalPath: "Critical path",
  critical: "Critical",
  slack: "Slack",
  annotations: "Annotations",
  exportTexts: DEFAULT_EXPORT_TEXTS,
  divider: "Resize the task list",
  keyboardHint:
    "Up and down move between tasks, left and right collapse or expand. Editable tasks: Alt plus arrows move, Shift plus arrows change the end, plus and minus change the progress.",
  quarter: (quarter) => `Q${quarter}`,
};

export interface GanttChartProps {
  tasks: readonly GanttTask[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Controlled zoom level. */
  zoom?: GanttZoom;
  /** Initial zoom when uncontrolled, "day" by default. */
  defaultZoom?: GanttZoom;
  onZoomChange?: (zoom: GanttZoom) => void;
  /** Zoom buttons offered in the toolbar; all five by default. */
  zoomLevels?: readonly GanttZoom[];
  /** Today line. "auto" uses the current date (default); false hides it. */
  today?: Date | number | "auto" | false;
  /**
   * Pixels, or `"fill"` to take the parent's height (rows scroll inside).
   * By default the chart is as tall as its rows, between 220 and 560 px.
   */
  height?: number | "fill";
  /** Width / height ratio; sizes the chart from the container width. */
  aspectRatio?: number;
  /** Height of one task row, 36 by default. */
  rowHeight?: number;
  /** Initial width of the task list; by default about 40% of the chart, 120-380 px. */
  gridWidth?: number;
  /** Optional columns of the task list, shown while they fit. */
  columns?: ReadonlyArray<"start" | "end" | "progress">;
  /** Drag bars to move or resize them and drag the progress handle; keyboard alternatives too. */
  editable?: boolean;
  /** Receives every committed edit; update `tasks` to apply it (controlled). */
  onTaskChange?: (change: GanttTaskChange) => void;
  /** Weekdays that are worked, 0 = Sunday. Monday to Friday by default. */
  workingDays?: readonly number[];
  /** Extra non-working days (holidays), shaded like weekends. */
  holidays?: ReadonlyArray<Date | number>;
  /** Parent ids collapsed at first render. */
  defaultCollapsed?: readonly string[];
  /** Finish-to-start arrows (default true). */
  dependencies?: boolean;
  /**
   * Highlight the critical path: the chain of tasks and links with no slack,
   * computed from the dependencies (`criticalPath`). Others show their slack in the tooltip.
   */
  showCriticalPath?: boolean;
  /** Draw each task's `baseline` as a thin bar under the actual one, with the variance in the tooltip. */
  showBaselines?: boolean;
  /** Dated lines and bands (releases, deadlines, closures) over the timeline. */
  annotations?: readonly GanttAnnotation[];
  /** Show SVG and PNG export buttons in the toolbar. */
  exportable?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  texts?: GanttTextsInput;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const TOOLBAR_HEIGHT = 32;
const TOOLBAR_GAP = 8;
const BORDER = 2;
const MIN_PANE = 96;

/**
 * Project plan: a task list (name, start, end, progress; collapsible parents
 * with summary bars) beside a zoomable timeline (hours to quarters) with
 * progress bars, milestones, finish-to-start dependency arrows, a today line
 * and shaded non-working days. Both panes share one scroller, so they scroll
 * together; the header and the list stay pinned. Optional editing by drag or
 * keyboard reports changes through `onTaskChange`.
 */
export function GanttChart({
  tasks,
  title,
  description,
  zoom: zoomProp,
  defaultZoom = "day",
  onZoomChange,
  zoomLevels = GANTT_ZOOM_ORDER,
  today = "auto",
  height,
  aspectRatio,
  rowHeight = 36,
  gridWidth,
  columns = ["start", "end", "progress"],
  editable = false,
  onTaskChange,
  workingDays = [1, 2, 3, 4, 5],
  holidays,
  defaultCollapsed,
  dependencies = true,
  showCriticalPath = false,
  showBaselines = false,
  annotations,
  exportable = false,
  tooltip = true,
  loading,
  animate = true,
  texts: textOverrides,
  labels: labelOverrides,
  className,
}: GanttChartProps) {
  const labels = resolveLabels(labelOverrides);
  const texts: GanttTexts = {
    ...DEFAULT_TEXTS,
    ...textOverrides,
    zoomLevels: { ...DEFAULT_TEXTS.zoomLevels, ...textOverrides?.zoomLevels },
    zoomShort: { ...DEFAULT_TEXTS.zoomShort, ...textOverrides?.zoomShort },
  };
  const [zoomState, setZoomState] = useState<GanttZoom>(defaultZoom);
  const zoom = zoomProp ?? zoomState;
  const setZoom = (next: GanttZoom) => {
    if (zoomProp == null) setZoomState(next);
    onZoomChange?.(next);
  };
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(defaultCollapsed ?? []),
  );
  const rows = useMemo(() => ganttRows(tasks, collapsed), [tasks, collapsed]);
  const allRows = useMemo(() => ganttRows(tasks), [tasks]);
  const chrome = TOOLBAR_HEIGHT + TOOLBAR_GAP + HEADER_HEIGHT + BORDER + 12;
  const autoHeight = Math.min(560, Math.max(220, chrome + rows.length * rowHeight));
  const names = useMemo(() => new Map(tasks.map((task) => [task.id, task.name])), [tasks]);
  const critical = useMemo(
    () => (showCriticalPath ? criticalPath(tasks) : null),
    [showCriticalPath, tasks],
  );
  const hasBaselines = showBaselines && tasks.some((task) => task.baseline);

  return (
    <ChartFrame
      height={height ?? autoHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={tasks.length === 0}
      skeleton="bars"
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={texts.tasks}
          categories={allRows.map((row) => `${"· ".repeat(row.depth)}${row.task.name}`)}
          columns={[
            {
              id: "start",
              name: texts.start,
              values: allRows.map((row) => formatDate(row.start)),
            },
            {
              id: "end",
              name: texts.end,
              values: allRows.map((row) => formatDate(displayEnd(row.start, row.end))),
            },
            {
              id: "duration",
              name: texts.duration,
              values: allRows.map((row) => durationText(row.end - row.start, texts)),
            },
            {
              id: "progress",
              name: texts.progress,
              values: allRows.map((row) =>
                row.task.milestone && !row.parent ? texts.milestone : formatPercent(row.progress),
              ),
            },
            {
              id: "dependsOn",
              name: texts.dependsOn,
              values: allRows.map((row) =>
                (row.task.dependencies ?? []).map((id) => names.get(id) ?? id).join(", "),
              ),
            },
            ...(hasBaselines
              ? [
                  {
                    id: "baseline",
                    name: texts.baseline,
                    values: allRows.map((row) =>
                      row.task.baseline
                        ? `${formatDate(+row.task.baseline.start)} - ${formatDate(+row.task.baseline.end)}`
                        : "",
                    ),
                  },
                ]
              : []),
            ...(critical
              ? [
                  {
                    id: "critical",
                    name: texts.criticalPath,
                    values: allRows.map((row) =>
                      critical.tasks.has(row.task.id) ? texts.critical : "",
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      {(width, drawingHeight) => (
        <GanttBody
          width={width}
          height={drawingHeight}
          title={title}
          rows={rows}
          names={names}
          zoom={zoom}
          zoomLevels={zoomLevels}
          onZoom={setZoom}
          today={today}
          rowHeight={rowHeight}
          initialGridWidth={gridWidth}
          columns={columns}
          editable={editable}
          onTaskChange={onTaskChange}
          workingDays={workingDays}
          holidays={holidays}
          dependencies={dependencies}
          critical={critical}
          baselines={hasBaselines}
          annotations={annotations}
          exportable={exportable}
          tooltip={tooltip}
          animate={animate}
          texts={texts}
          onToggle={(id) =>
            setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      )}
    </ChartFrame>
  );
}

/** A task ending at midnight is shown ending the day before (inclusive end). */
function displayEnd(start: number, end: number): number {
  const midnight = new Date(end).setHours(0, 0, 0, 0) === end;
  return midnight && end - start >= DAY_MS ? end - 1 : end;
}

function durationText(ms: number, texts: GanttTexts): string {
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)} ${texts.hours}`;
  const days = Math.round(ms / DAY_MS);
  return `${days} ${days === 1 ? texts.day : texts.days}`;
}

function clockText(time: number): string {
  const d = new Date(time);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shortDate(time: number, withTime: boolean): string {
  const d = new Date(time);
  const day = `${d.getDate()} ${shortMonth(d)}`;
  return withTime ? `${day} ${clockText(time)}` : day;
}

type Column = "start" | "end" | "progress";
const COLUMN_WIDTH: Record<Column, number> = { start: 64, end: 64, progress: 52 };
const NAME_MIN = 120;

interface DragState {
  id: string;
  mode: "move" | "start" | "end" | "progress";
  originX: number;
  start: number;
  end: number;
  progress: number;
  /** Left edge of the bar in client pixels, for the progress handle. */
  barLeft: number;
  barWidth: number;
  milestone: boolean;
}

interface BodyProps {
  width: number;
  height: number;
  title: string;
  rows: readonly Row[];
  names: ReadonlyMap<string, string>;
  zoom: GanttZoom;
  zoomLevels: readonly GanttZoom[];
  onZoom: (zoom: GanttZoom) => void;
  today: Date | number | "auto" | false;
  rowHeight: number;
  initialGridWidth?: number;
  columns: readonly Column[];
  editable: boolean;
  onTaskChange?: (change: GanttTaskChange) => void;
  workingDays: readonly number[];
  holidays?: ReadonlyArray<Date | number>;
  dependencies: boolean;
  critical: CriticalPath | null;
  baselines: boolean;
  annotations?: readonly GanttAnnotation[];
  exportable: boolean;
  tooltip: boolean;
  animate: boolean;
  texts: GanttTexts;
  onToggle: (id: string) => void;
}

function GanttBody({
  width,
  height,
  title,
  rows,
  names,
  zoom,
  zoomLevels,
  onZoom,
  today,
  rowHeight,
  initialGridWidth,
  columns,
  editable,
  onTaskChange,
  workingDays,
  holidays,
  dependencies,
  critical,
  baselines,
  annotations,
  exportable,
  tooltip,
  animate,
  texts,
  onToggle,
}: BodyProps) {
  const uid = useId().replace(/:/g, "");
  const reducedMotion = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollbar, setScrollbar] = useState(0);
  // Classic (non-overlay) scrollbars take room: keep the timeline inside the visible width.
  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const next = scroller.offsetWidth - scroller.clientWidth - BORDER;
    if (next !== scrollbar && next >= 0) setScrollbar(next);
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState<number | null>(initialGridWidth ?? null);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [hover, setHover] = useState<{ row: number; x: number; y: number; onBar: boolean } | null>(
    null,
  );
  const [focusRow, setFocusRow] = useState(0);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<BarDraft | null>(null);
  const drag = useRef<DragState | null>(null);

  const narrow = width < 440;
  const defaultGrid = Math.round(Math.min(380, Math.max(120, width * (narrow ? 0.38 : 0.4))));
  const gridW = Math.round(Math.min(Math.max(split ?? defaultGrid, MIN_PANE), width - MIN_PANE));
  const viewport = Math.max(MIN_PANE, width - gridW - BORDER - scrollbar);
  const withTime = zoom === "hour";

  const visibleColumns = useMemo(() => {
    let room = gridW - NAME_MIN;
    const out: Column[] = [];
    for (const column of ["progress", "start", "end"] as const) {
      if (!columns.includes(column) || room < COLUMN_WIDTH[column]) continue;
      out.push(column);
      room -= COLUMN_WIDTH[column];
    }
    return (["start", "end", "progress"] as const).filter((column) => out.includes(column));
  }, [gridW, columns]);

  const todayTime = today === false ? null : today === "auto" ? Date.now() : +today;
  const level = GANTT_ZOOMS[zoom];
  const domainKey = rows.map((row) => `${row.start}-${row.end}`).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key captures every date that matters.
  const domain = useMemo(() => {
    const times = rows.flatMap((row) => [row.start, row.end]);
    if (baselines) {
      for (const row of rows) {
        if (row.task.baseline) times.push(+row.task.baseline.start, +row.task.baseline.end);
      }
    }
    for (const a of annotations ?? []) times.push(+a.at, +(a.to ?? a.at));
    if (todayTime != null) times.push(todayTime);
    return ganttDomain(times.length ? times : [Date.now()], zoom);
  }, [domainKey, zoom, baselines, annotations, todayTime != null ? startOfDay(todayTime) : null]);
  const scale = useMemo(() => ganttScale(domain, zoom, viewport), [domain, zoom, viewport]);
  const header = useMemo(
    () => ganttHeader(scale, zoom, { quarter: texts.quarter }),
    [scale, zoom, texts.quarter],
  );
  const shading = useMemo(
    () => (level.shadeNonWorking ? nonWorkingSpans(domain, workingDays, holidays) : []),
    [level.shadeNonWorking, domain, workingDays, holidays],
  );
  const links = useMemo(
    () => (dependencies ? dependencyLinks(rows, scale, rowHeight) : []),
    [dependencies, rows, scale, rowHeight],
  );
  const placed = useMemo(() => placeAnnotations(annotations ?? [], scale), [annotations, scale]);
  const todayX =
    todayTime != null && todayTime >= domain[0] && todayTime <= domain[1]
      ? scale.x(todayTime)
      : null;
  const bodyHeight = rows.length * rowHeight;

  useEntryAnimation(
    svgRef,
    (root) => {
      const bars = root.querySelectorAll("[data-bar]");
      const per = Math.min(40, 500 / Math.max(1, bars.length));
      bars.forEach((bar, i) => {
        bar.animate(
          [
            { transform: "scaleX(0)", opacity: 0 },
            { transform: "scaleX(1)", opacity: 1 },
          ],
          { duration: 520, delay: i * per, easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate },
  );

  const clampedFocus = Math.min(focusRow, Math.max(0, rows.length - 1));
  useEffect(() => {
    if (focusRow !== clampedFocus) setFocusRow(clampedFocus);
  }, [focusRow, clampedFocus]);

  const scrollToTime = (time: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      left: Math.max(0, scale.x(time) - viewport * 0.2),
      behavior: smooth && !reducedMotion ? "smooth" : "auto",
    });
  };
  // On mount and on every zoom change, bring today (or the first task) into view.
  const firstStart = rows[0]?.start;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the zoom changes.
  useEffect(() => {
    const target = todayX != null && todayTime != null ? todayTime : (firstStart ?? domain[0]);
    scrollToTime(target, false);
  }, [zoom]);

  const ensureVisible = (index: number) => {
    const scroller = scrollerRef.current;
    const row = rows[index];
    if (!scroller || !row) return;
    const top = index * rowHeight;
    const visible = scroller.clientHeight - HEADER_HEIGHT;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + rowHeight > scroller.scrollTop + visible) {
      scroller.scrollTop = top + rowHeight - visible;
    }
    const box = barBox(row, scale, rowHeight);
    if (box.x0 < scroller.scrollLeft || box.x0 > scroller.scrollLeft + viewport - 40) {
      scroller.scrollLeft = Math.max(0, box.x0 - 24);
    }
  };

  const moveFocus = (index: number) => {
    const next = Math.min(Math.max(0, index), rows.length - 1);
    setFocusRow(next);
    ensureVisible(next);
    const item = treeRef.current?.querySelector<HTMLElement>(`[data-row="${next}"]`);
    item?.focus({ preventScroll: true });
  };

  const commit = (change: GanttTaskChange) => onTaskChange?.(change);

  const onTreeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = rows[clampedFocus];
    if (!row) return;
    const leaf = !row.parent;
    const canEdit = editable && leaf;
    const sign = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (canEdit && sign !== 0 && (event.altKey || event.shiftKey)) {
      const step = level.snap * sign;
      if (event.altKey || row.task.milestone) {
        commit({
          id: row.task.id,
          start: new Date(row.start + step),
          end: new Date(row.end + step),
          progress: row.progress,
          source: "move",
        });
      } else {
        const end = Math.max(row.start + level.snap, row.end + step);
        commit({
          id: row.task.id,
          start: new Date(row.start),
          end: new Date(end),
          progress: row.progress,
          source: "resize",
        });
      }
      event.preventDefault();
      return;
    }
    if (canEdit && !row.task.milestone && ["+", "=", "-"].includes(event.key)) {
      const delta = event.key === "-" ? -0.1 : 0.1;
      const progress = Math.round(Math.min(1, Math.max(0, row.progress + delta)) * 100) / 100;
      commit({
        id: row.task.id,
        start: new Date(row.start),
        end: new Date(row.end),
        progress,
        source: "progress",
      });
      event.preventDefault();
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        moveFocus(clampedFocus + 1);
        break;
      case "ArrowUp":
        moveFocus(clampedFocus - 1);
        break;
      case "Home":
        moveFocus(0);
        break;
      case "End":
        moveFocus(rows.length - 1);
        break;
      case "ArrowRight":
        if (row.parent && row.collapsed) onToggle(row.task.id);
        else if (row.parent) moveFocus(clampedFocus + 1);
        break;
      case "ArrowLeft":
        if (row.parent && !row.collapsed) onToggle(row.task.id);
        else if (row.depth > 0) {
          let parent = clampedFocus - 1;
          while (parent >= 0 && (rows[parent] as Row).depth >= row.depth) parent -= 1;
          if (parent >= 0) moveFocus(parent);
        }
        break;
      case "Enter":
      case " ":
        if (row.parent) onToggle(row.task.id);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const rowAt = (clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return -1;
    const index = Math.floor((clientY - svg.getBoundingClientRect().top) / rowHeight);
    return index >= 0 && index < rows.length ? index : -1;
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!editable || event.button !== 0) return;
    const target = event.target as Element;
    const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
    const id = target.closest("[data-task]")?.getAttribute("data-task");
    const index = rows.findIndex((row) => row.task.id === id);
    const row = rows[index];
    if (!handle || !row || row.parent) return;
    const box = barBox(row, scale, rowHeight);
    const svgLeft = event.currentTarget.getBoundingClientRect().left;
    drag.current = {
      id: row.task.id,
      mode: row.task.milestone ? "move" : (handle as DragState["mode"]),
      originX: event.clientX,
      start: row.start,
      end: row.end,
      progress: row.progress,
      barLeft: svgLeft + box.x0,
      barWidth: box.x1 - box.x0,
      milestone: !!row.task.milestone,
    };
    setFocusRow(index);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    if (state) {
      const dt = (event.clientX - state.originX) / scale.k;
      const snap = (time: number) => snapTime(time, level.snap);
      let next: BarDraft;
      if (state.mode === "move") {
        const start = snap(state.start + dt);
        next = {
          id: state.id,
          start,
          end: start + (state.end - state.start),
          progress: state.progress,
        };
      } else if (state.mode === "start") {
        const start = Math.min(state.end - level.snap, snap(state.start + dt));
        next = { id: state.id, start, end: state.end, progress: state.progress };
      } else if (state.mode === "end") {
        const end = Math.max(state.start + level.snap, snap(state.end + dt));
        next = { id: state.id, start: state.start, end, progress: state.progress };
      } else {
        const ratio = (event.clientX - state.barLeft) / Math.max(1, state.barWidth);
        next = {
          id: state.id,
          start: state.start,
          end: state.end,
          progress: Math.round(Math.min(1, Math.max(0, ratio)) * 20) / 20,
        };
      }
      setDraft(next);
      return;
    }
    const wrapper = wrapperRef.current?.getBoundingClientRect();
    const index = rowAt(event.clientY);
    if (!wrapper || index < 0) {
      setHover(null);
      return;
    }
    setHover({
      row: index,
      x: event.clientX - wrapper.left,
      y: event.clientY - wrapper.top,
      onBar: !!(event.target as Element).closest("[data-task]"),
    });
  };

  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!state || !draft || draft.id !== state.id) {
      setDraft(null);
      return;
    }
    const changed =
      draft.start !== state.start || draft.end !== state.end || draft.progress !== state.progress;
    if (changed) {
      commit({
        id: draft.id,
        start: new Date(draft.start),
        end: new Date(draft.end),
        progress: draft.progress,
        source: state.mode === "progress" ? "progress" : state.mode === "move" ? "move" : "resize",
      });
    }
    setDraft(null);
  };

  // Divider between the panes: drag or arrow keys.
  const dividerDrag = useRef<{ x: number; width: number } | null>(null);
  const onDividerKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0;
    if (delta) setSplit(gridW + delta);
    else if (event.key === "Home") setSplit(MIN_PANE);
    else if (event.key === "End") setSplit(width - MIN_PANE);
    else return;
    event.preventDefault();
  };

  const activeIndex = draft
    ? rows.findIndex((row) => row.task.id === draft.id)
    : hover
      ? hover.row
      : focused
        ? clampedFocus
        : -1;
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined;
  const tipRow = hover?.onBar ? rows[hover.row] : !hover && focused ? activeRow : undefined;
  const tipSource =
    tipRow && draft?.id === tipRow.task.id
      ? { ...tipRow, start: draft.start, end: draft.end, progress: draft.progress }
      : tipRow;
  let tipAnchor: { x: number; y: number } | null = null;
  if (tipSource) {
    if (hover?.onBar) tipAnchor = { x: hover.x, y: hover.y };
    else {
      const box = barBox(tipSource, scale, rowHeight);
      const index = rows.indexOf(tipRow as Row);
      tipAnchor = {
        x: Math.min(width - 8, Math.max(gridW, gridW + box.x1 - scroll.left)),
        y:
          TOOLBAR_HEIGHT +
          TOOLBAR_GAP +
          HEADER_HEIGHT +
          index * rowHeight +
          rowHeight / 2 -
          scroll.top,
      };
    }
  }

  const describe = (row: Row) => {
    const parts = [row.task.name];
    if (row.task.milestone && !row.parent) {
      parts.push(`${texts.milestone}, ${shortDate(row.start, withTime)}`);
    } else {
      parts.push(
        `${texts.start} ${shortDate(row.start, withTime)}`,
        `${texts.end} ${shortDate(withTime ? row.end : displayEnd(row.start, row.end), withTime)}`,
        `${texts.progress} ${formatPercent(row.progress)}`,
      );
    }
    const deps = (row.task.dependencies ?? []).map((id) => names.get(id) ?? id);
    if (deps.length) parts.push(`${texts.dependsOn} ${deps.join(", ")}`);
    return parts.join(". ");
  };

  const tipRows = (row: Row): TooltipRow[] => {
    const color = row.task.color ?? (row.parent ? "var(--ink-2)" : "var(--accent-word)");
    const out: TooltipRow[] = [];
    if (row.task.milestone && !row.parent) {
      out.push({
        id: "date",
        name: texts.milestone,
        value: withTime
          ? `${formatDate(row.start)} ${clockText(row.start)}`
          : formatDate(row.start),
        color: row.task.color ?? "var(--ink)",
        shape: "square",
      });
    } else {
      const endShown = withTime ? row.end : displayEnd(row.start, row.end);
      out.push(
        {
          id: "start",
          name: texts.start,
          value: withTime
            ? `${formatDate(row.start)} ${clockText(row.start)}`
            : formatDate(row.start),
          color: "var(--ink-3)",
          shape: "dot",
        },
        {
          id: "end",
          name: texts.end,
          value: withTime ? `${formatDate(endShown)} ${clockText(endShown)}` : formatDate(endShown),
          color: "var(--ink-3)",
          shape: "dot",
        },
        {
          id: "duration",
          name: texts.duration,
          value: durationText(row.end - row.start, texts),
          color: "var(--ink-3)",
          shape: "dot",
        },
        {
          id: "progress",
          name: texts.progress,
          value: formatPercent(row.progress),
          color,
          shape: "square",
        },
      );
    }
    if (row.task.assignee) {
      out.push({
        id: "assignee",
        name: texts.assignee,
        value: row.task.assignee,
        color: "transparent",
      });
    }
    const plan = row.task.baseline;
    if (baselines && plan && !row.parent) {
      const slip = row.end - +plan.end;
      out.push({
        id: "baseline",
        name: texts.baseline,
        value: `${shortDate(+plan.start, false)} - ${shortDate(+plan.end, false)}`,
        color: "var(--ink-3)",
        shape: "dot",
      });
      out.push({
        id: "variance",
        name: texts.variance,
        value: `${slip > 0 ? "+" : slip < 0 ? "-" : ""}${durationText(Math.abs(slip), texts)}`,
        color: slip > 0 ? "var(--danger)" : "var(--chart-up)",
        shape: "dot",
        emphasis: slip !== 0,
      });
    }
    if (critical && !row.parent) {
      const isCritical = critical.tasks.has(row.task.id);
      const slack = critical.slack.get(row.task.id);
      out.push({
        id: "critical",
        name: isCritical ? texts.criticalPath : texts.slack,
        value: isCritical ? texts.critical : slack == null ? "" : durationText(slack, texts),
        color: isCritical ? "var(--danger)" : "var(--ink-3)",
        shape: "dot",
      });
    }
    const deps = (row.task.dependencies ?? []).map((id) => names.get(id) ?? id);
    if (deps.length) {
      out.push({
        id: "deps",
        name: texts.dependsOn,
        value: deps.join(", "),
        color: "transparent",
        emphasis: true,
      });
    }
    return out;
  };

  // Hours zoom: the header already names the day, the columns show the time.
  const columnDate = (time: number) => (withTime ? clockText(time) : shortDate(time, false));
  const hintId = `${uid}-hint`;
  const gridTemplate = `${gridW}px ${scale.width}px`;

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col"
      style={{ width, height, gap: TOOLBAR_GAP }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        <fieldset className="m-0 flex min-w-0 items-center gap-0.5 rounded-button border-0 bg-surface-2 p-0.5">
          <legend className="sr-only">{texts.zoom}</legend>
          {zoomLevels.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={zoom === level}
              aria-label={texts.zoomLevels[level]}
              onClick={() => onZoom(level)}
              className={cn(
                "cursor-pointer rounded-button px-2 py-1 font-semibold text-fs-115 outline-none focus-visible:outline-2 focus-visible:outline-accent-ink @md/chart:px-3",
                zoom === level ? "bg-surface text-ink shadow-xs" : "text-ink-3 hover:text-ink",
              )}
            >
              <span className="@md/chart:hidden" aria-hidden="true">
                {texts.zoomShort[level]}
              </span>
              <span className="hidden @md/chart:inline" aria-hidden="true">
                {texts.zoomLevels[level]}
              </span>
            </button>
          ))}
        </fieldset>
        {critical || baselines ? (
          <ul className="m-0 hidden min-w-0 list-none items-center gap-3 p-0 text-fs-115 text-ink-3 @xl/chart:flex">
            {critical ? (
              <li className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="h-2 w-4 rounded-button"
                  style={{ background: "var(--danger)" }}
                />
                {texts.criticalPath}
              </li>
            ) : null}
            {baselines ? (
              <li className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="h-1 w-4 rounded-button"
                  style={{ background: "var(--ink-3)", opacity: 0.55 }}
                />
                {texts.baseline}
              </li>
            ) : null}
          </ul>
        ) : null}
        <div className="flex shrink-0 items-center gap-2">
          {exportable ? (
            <ExportMenu
              title={title}
              texts={texts.exportTexts}
              getSvgs={() =>
                Array.from(
                  scrollerRef.current?.querySelectorAll<SVGSVGElement>("svg[data-export-part]") ??
                    [],
                )
              }
              getLeading={() => {
                const host = wrapperRef.current;
                if (!host) return null;
                const list = buildTaskListSvg({
                  rows: rows.map((row) => ({
                    name: row.task.name,
                    depth: row.depth,
                    parent: Boolean(row.parent),
                    collapsed: Boolean(row.collapsed),
                    cells: visibleColumns.map((column) =>
                      column === "start"
                        ? columnDate(row.start)
                        : row.task.milestone && !row.parent
                          ? ""
                          : column === "end"
                            ? columnDate(withTime ? row.end : displayEnd(row.start, row.end))
                            : formatPercent(row.progress, { decimals: 0 }),
                    ),
                  })),
                  columns: visibleColumns.map((column) => ({
                    width: COLUMN_WIDTH[column],
                    label:
                      column === "start"
                        ? texts.start
                        : column === "end"
                          ? texts.end
                          : texts.progress,
                  })),
                  tasksLabel: texts.tasks,
                  width: gridW,
                  headerHeight: HEADER_HEIGHT,
                  rowHeight,
                });
                list.setAttribute(
                  "style",
                  "position:absolute;left:-99999px;top:0;pointer-events:none",
                );
                host.appendChild(list);
                return list;
              }}
            />
          ) : null}
          {todayX != null && todayTime != null ? (
            <button
              type="button"
              onClick={() => scrollToTime(todayTime, true)}
              className="shrink-0 cursor-pointer rounded-button border-divider bg-surface-control px-3 py-1 font-semibold text-fs-115 text-ink-2 outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              {texts.today}
            </button>
          ) : null}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          onScroll={(event) =>
            setScroll({
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
            })
          }
          className="absolute inset-0 overflow-auto overscroll-contain rounded-event border-divider bg-surface"
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: gridTemplate,
              gridTemplateRows: `${HEADER_HEIGHT}px ${bodyHeight}px`,
              width: gridW + scale.width,
            }}
          >
            <div
              className="sticky top-0 left-0 z-30 flex items-end border-r-divider border-b-divider bg-surface"
              style={{ height: HEADER_HEIGHT, borderBottomColor: "var(--line-strong)" }}
            >
              <div
                aria-hidden="true"
                className="flex w-full items-center font-semibold text-fs-110 text-ink-3"
                style={{ height: HEADER_HEIGHT / 2 }}
              >
                <span className="min-w-0 flex-1 truncate px-3">{texts.tasks}</span>
                {visibleColumns.map((column) => (
                  <span
                    key={column}
                    className="shrink-0 truncate pr-3 text-right"
                    style={{ width: COLUMN_WIDTH[column] }}
                  >
                    {column === "start"
                      ? texts.start
                      : column === "end"
                        ? texts.end
                        : texts.progress}
                  </span>
                ))}
              </div>
            </div>
            <div className="sticky top-0 z-20 bg-surface">
              <TimelineHeader
                header={header}
                width={scale.width}
                scrollLeft={scroll.left}
                viewport={viewport}
                todayX={todayX}
                todayLabel={texts.today}
              />
            </div>
            <div
              ref={treeRef}
              role="tree"
              aria-label={texts.tasks}
              aria-describedby={hintId}
              onKeyDown={onTreeKey}
              onFocus={() => setFocused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false);
              }}
              onPointerLeave={() => setHover(null)}
              className="sticky left-0 z-10 border-r-divider bg-surface"
            >
              {rows.map((row, i) => (
                <div
                  key={row.task.id}
                  data-row={i}
                  role="treeitem"
                  tabIndex={i === clampedFocus ? 0 : -1}
                  aria-level={row.depth + 1}
                  aria-expanded={row.parent ? !row.collapsed : undefined}
                  aria-selected={i === clampedFocus}
                  aria-label={describe(row)}
                  onFocus={() => setFocusRow(i)}
                  onPointerEnter={(event) => {
                    const wrapper = wrapperRef.current?.getBoundingClientRect();
                    if (wrapper) {
                      setHover({
                        row: i,
                        x: event.clientX - wrapper.left,
                        y: event.clientY - wrapper.top,
                        onBar: false,
                      });
                    }
                  }}
                  className={cn(
                    "flex items-center text-fs-120 outline-none focus-visible:bg-accent-soft focus-visible:shadow-[inset_2px_0_0_var(--accent-word)]",
                    activeIndex === i && "bg-[var(--chart-grid)]",
                  )}
                  style={{ height: rowHeight, boxShadow: "inset 0 -1px 0 var(--chart-grid)" }}
                >
                  <span
                    className="flex min-w-0 flex-1 items-center gap-1 pr-2"
                    style={{ paddingLeft: 8 + row.depth * 14 }}
                  >
                    {row.parent ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggle(row.task.id);
                        }}
                        className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-xs text-ink-3 hover:bg-surface-2 hover:text-ink"
                      >
                        <svg
                          aria-hidden="true"
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          className={cn(
                            "motion-safe:transition-transform",
                            !row.collapsed && "rotate-90",
                          )}
                        >
                          <path
                            d="M3 1.5 6.5 5 3 8.5"
                            fill="none"
                            strokeWidth="1.6"
                            stroke="currentColor"
                          />
                        </svg>
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                    {row.task.milestone && !row.parent ? (
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rotate-45 rounded-xs"
                        style={{ background: row.task.color ?? "var(--ink)" }}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        row.parent ? "font-bold text-ink" : "text-ink-2",
                      )}
                    >
                      {row.task.name}
                    </span>
                  </span>
                  {visibleColumns.map((column) => (
                    <span
                      key={column}
                      aria-hidden="true"
                      className="shrink-0 truncate pr-3 text-right text-fs-115 text-ink-3 tabular-nums"
                      style={{ width: COLUMN_WIDTH[column] }}
                    >
                      {column === "start"
                        ? columnDate(row.start)
                        : column === "end"
                          ? row.task.milestone && !row.parent
                            ? ""
                            : columnDate(withTime ? row.end : displayEnd(row.start, row.end))
                          : row.task.milestone && !row.parent
                            ? ""
                            : formatPercent(row.progress, { decimals: 0 })}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="relative">
              <svg
                ref={svgRef}
                role="img"
                aria-label={title}
                width={scale.width}
                height={bodyHeight}
                data-export-part=""
                className={cn("block touch-pan-y select-none", draft && "cursor-grabbing")}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerLeave={() => {
                  if (!drag.current) setHover(null);
                }}
              >
                <TimelineBackdrop
                  header={header}
                  scale={scale}
                  shading={shading}
                  rows={rows.length}
                  rowHeight={rowHeight}
                  todayX={todayX}
                />
                {activeIndex >= 0 ? (
                  <rect
                    x={0}
                    y={activeIndex * rowHeight}
                    width={scale.width}
                    height={rowHeight}
                    className="pointer-events-none"
                    style={{ fill: "var(--chart-grid)" }}
                  />
                ) : null}
                <AnnotationLayer items={placed} height={bodyHeight} />
                <DependencyLayer
                  critical={critical?.links}
                  links={links}
                  activeId={activeRow?.task.id ?? null}
                  markerId={`${uid}-arrow`}
                />
                <TimelineBars
                  rows={rows}
                  scale={scale}
                  rowHeight={rowHeight}
                  editable={editable}
                  draft={draft}
                  critical={critical?.tasks}
                  baselines={baselines}
                />
              </svg>
            </div>
          </div>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a vertical separator that is draggable and focusable. */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={texts.divider}
          aria-valuemin={MIN_PANE}
          aria-valuemax={width - MIN_PANE}
          aria-valuenow={gridW}
          onKeyDown={onDividerKey}
          onPointerDown={(event) => {
            dividerDrag.current = { x: event.clientX, width: gridW };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const state = dividerDrag.current;
            if (state) setSplit(state.width + event.clientX - state.x);
          }}
          onPointerUp={(event) => {
            dividerDrag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          className="group/divider absolute top-0 bottom-0 z-40 w-2.5 -translate-x-1/2 cursor-col-resize touch-none outline-none"
          style={{ left: gridW + 1 }}
        >
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-button bg-transparent group-hover/divider:bg-accent-word group-focus-visible/divider:bg-accent-word motion-safe:transition-colors" />
        </div>
      </div>
      <p id={hintId} className="sr-only">
        {texts.keyboardHint}
      </p>
      {annotations?.length ? (
        <ul className="sr-only" aria-label={texts.annotations}>
          {annotations.map((a) => (
            <li key={a.id}>
              {a.label}: {formatDate(+a.at)}
              {a.to != null ? ` - ${formatDate(+a.to)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {tooltip && tipSource && tipAnchor ? (
        <ChartTooltip
          x={tipAnchor.x}
          y={Math.min(
            Math.max(tipAnchor.y, Math.min(96, height / 2)),
            Math.max(height - 96, height / 2),
          )}
          containerWidth={width}
          title={tipSource.task.name}
          rows={tipRows(tipSource)}
        />
      ) : null}
    </div>
  );
}

function startOfDay(time: number): number {
  return new Date(time).setHours(0, 0, 0, 0);
}
