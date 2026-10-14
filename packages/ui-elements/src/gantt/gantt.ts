import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { tint } from "@jcsoftdev/ui-core/chart/color-scale";
import { formatPercent } from "@jcsoftdev/ui-core/chart/format";
import { attachPanZoom, type PanZoom, type PanZoomView } from "@jcsoftdev/ui-core/chart/pan-zoom";
import { formatDate, shortMonth } from "@jcsoftdev/ui-core/chart/scale-time";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  emit,
  rootOf,
  uid,
} from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartSnapshot,
  type DrawContext,
  type DrawResult,
  join,
  type NavIntent,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import {
  type CriticalPath,
  criticalPath,
  DAY_MS,
  GANTT_ZOOM_ORDER,
  GANTT_ZOOMS,
  type GanttHeader,
  type GanttScale,
  type GanttZoom,
  ganttDomain,
  ganttHeader,
  ganttRows,
  ganttScale,
  HOUR_MS,
  nonWorkingSpans,
  snapTime,
} from "../internal/e23-gantt.js";
import {
  barBox,
  dependencyLinks,
  type GanttAnnotation,
  type GanttTask,
  HEADER_HEIGHT,
  HEADER_ROW,
  LABEL_LANE,
  type Link,
  outsideLabel,
  type PlacedAnnotation,
  placeAnnotations,
  type Row,
} from "../internal/e23-gantt-layout.js";
import css from "./gantt.css.js";

export type { GanttZoom } from "../internal/e23-gantt.js";
export type { GanttAnnotation, GanttTask } from "../internal/e23-gantt-layout.js";

/** Detail of the `gantt-change` event: a committed edit, to be applied by updating `tasks`. */
export interface GanttTaskChange {
  id: string;
  start: Date;
  end: Date;
  progress: number;
  /** What changed it. */
  source: "move" | "resize" | "progress";
}

export interface GanttTexts {
  tasks: string;
  start: string;
  end: string;
  progress: string;
  duration: string;
  milestone: string;
  assignee: string;
  dependsOn: string;
  day: string;
  days: string;
  hours: string;
  today: string;
  baseline: string;
  variance: string;
  criticalPath: string;
  critical: string;
  slack: string;
  annotations: string;
  /** Read after the chart name: how to move, collapse, zoom and edit with the keyboard. */
  keyboardHint: string;
  /** Quarter label in the header, "Q3" by default. */
  quarter: (quarter: number) => string;
}

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
  baseline: "Baseline",
  variance: "Variance",
  criticalPath: "Critical path",
  critical: "Critical",
  slack: "Slack",
  annotations: "Annotations",
  keyboardHint:
    "Up and down move between tasks, left and right collapse or expand, [ and ] change the zoom, T goes to today, { and } resize the task list. Editable tasks: Alt plus arrows move, Shift plus arrows change the end, plus and minus change the progress.",
  quarter: (quarter) => `Q${quarter}`,
};

type Column = "start" | "end" | "progress";
const COLUMN_WIDTH: Record<Column, number> = { start: 64, end: 64, progress: 52 };
const NAME_MIN = 120;
const MIN_PANE = 96;
const CHROME = HEADER_HEIGHT + 12;
const ZOOM_STEP = 1.45;
const SVG_SELECTOR = "[data-handle]";

interface DragState {
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

interface Draft {
  id: string;
  start: number;
  end: number;
  progress: number;
}

/** Everything the pointer and keyboard need of the last draw. */
interface Layout {
  rows: readonly Row[];
  scale: GanttScale;
  gridW: number;
  viewport: number;
  rowHeight: number;
  bodyHeight: number;
  contentHeight: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0);
const IDENTITY: PanZoomView = { k: 1, x: 0, y: 0 };

/** Cuts `text` with an ellipsis so it fits `room` pixels. */
function fit(text: string, room: number, size: number): string {
  if (room <= 0) return "";
  if (estimateTextWidth(text, size) <= room) return text;
  let cut = text;
  while (cut.length > 1 && estimateTextWidth(`${cut}…`, size) > room) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** A task ending at midnight is shown ending the day before (inclusive end). */
function displayEnd(start: number, end: number): number {
  const midnight = new Date(end).setHours(0, 0, 0, 0) === end;
  return midnight && end - start >= DAY_MS ? end - 1 : end;
}

function clockText(time: number): string {
  const d = new Date(time);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * `<ui-gantt>`: a project plan. A task list (name, start, end, progress; collapsible parents with
 * summary bars) sits beside a timeline with six zoom levels (hours to year), progress bars,
 * milestones, finish-to-start dependency arrows, a today line, shaded non-working days, baselines,
 * a critical path and dated annotations. Everything is one SVG on the chart base, virtualized by
 * row and by column: drag pans, Ctrl+wheel or a pinch changes the zoom level, the wheel scrolls
 * the rows, and the divider between the panes drags and takes arrow keys.
 * Rows are the chart's marks. The arrow keys move between rows (2D `nav`): left collapses a
 * parent, or goes to it; right expands a parent, or goes in. Enter on a parent toggles it. `[` and
 * `]` change the zoom, `T` goes to today. With `editable`, dragging a bar moves it, its edges
 * resize it and the triangle changes the progress; from the keyboard Alt plus arrows move, Shift
 * plus arrows resize and `+`/`-` change the progress. Edits are reported, not applied: update
 * `tasks` from the `gantt-change` event.
 * Attributes: `zoom` (`hour`, `day`, `week`, `month`, `quarter`, `year`), `today` (`auto`, `off` or
 * a date), `row-height` (36), `grid-width` (px), `columns` (`start end progress`), `editable`,
 * `working-days` (`1,2,3,4,5`, Sunday is 0), `dependencies="off"`, `critical-path`, `baselines`,
 * plus the chart attributes. Properties: `tasks`, `holidays`, `annotations`, `collapsed` (ids),
 * `texts`. Events: `gantt-change`, `gantt-zoom` (`{ zoom }`), `gantt-toggle` (`{ id, collapsed }`).
 */
export class UiGantt extends ChartElement {
  static override retain = true;
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "zoom",
    "today",
    "row-height",
    "grid-width",
    "columns",
    "editable",
    "working-days",
    "dependencies",
    "critical-path",
    "baselines",
  ];

  #tasks: readonly GanttTask[] = [];
  #holidays: ReadonlyArray<Date | number> | undefined;
  #annotations: readonly GanttAnnotation[] = [];
  #texts: Partial<GanttTexts> = {};
  #collapsed: ReadonlySet<string> = new Set();
  #zoom: GanttZoom | undefined;
  #scroll = { x: 0, y: 0 };
  #split: number | null = null;
  #home = true;
  #anchor: { time: number; px: number } | undefined;
  #zoomAcc = 1;
  #draft: Draft | null = null;
  #drag: DragState | null = null;
  #divider: { x: number; width: number } | null = null;
  #layout: Layout | undefined;
  #panZoom: PanZoom | undefined;
  #resetting = false;
  #autoHeight: string | null = null;
  #rev = 0;
  #model: { key: string; value: Model } | undefined;
  #parts: Parts | undefined;
  #bands: SVGRectElement[] = [];
  #bandsFrom = 0;
  readonly #clip = uid("gantt");

  constructor() {
    super();
    // The links of the hovered row stand out: that is a look, not data, so a transient frame.
    this.addEventListener(CHART_EVENT.hover, () => {
      if (this.#model?.value.links.length) this.requestDraw("transient");
    });
  }

  get tasks(): readonly GanttTask[] {
    return this.#tasks;
  }
  set tasks(value: readonly GanttTask[]) {
    this.#tasks = value;
    this.#changed();
  }
  get holidays(): ReadonlyArray<Date | number> | undefined {
    return this.#holidays;
  }
  set holidays(value: ReadonlyArray<Date | number> | undefined) {
    this.#holidays = value;
    this.#changed();
  }
  get annotations(): readonly GanttAnnotation[] {
    return this.#annotations;
  }
  set annotations(value: readonly GanttAnnotation[]) {
    this.#annotations = value;
    this.#changed();
  }
  /** Ids of the collapsed parent tasks. */
  get collapsed(): readonly string[] {
    return [...this.#collapsed];
  }
  set collapsed(value: readonly string[]) {
    this.#collapsed = new Set(value);
    this.#changed();
  }
  get texts(): Partial<GanttTexts> {
    return this.#texts;
  }
  set texts(value: Partial<GanttTexts>) {
    this.#texts = value;
    this.#changed();
  }
  get zoom(): GanttZoom {
    const own = this.#zoom ?? this.getAttribute("zoom");
    return own && own in GANTT_ZOOMS ? (own as GanttZoom) : "day";
  }
  set zoom(value: GanttZoom) {
    this.#setZoom(value);
  }

  override connectedCallback(): void {
    this.dataset.ui = "gantt";
    adoptStyles(rootOf(this), css);
    this.#syncHeight();
    super.connectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "height" && this.getAttribute("height") !== this.#autoHeight)
      this.#autoHeight = null;
    if (name === "zoom") this.#zoom = undefined;
    if (name === "zoom" || name === "today") this.#home = true;
    this.#rev++;
    if (name === "row-height") this.#syncHeight();
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return this.#tasks.length === 0;
  }

  // ---- state ---------------------------------------------------------------------------------

  #changed(): void {
    this.#rev++;
    this.#syncHeight();
    this.requestDraw();
  }

  get #rowHeight(): number {
    const value = Number(this.getAttribute("row-height"));
    return value >= 20 ? value : 36;
  }

  get #editable(): boolean {
    return this.hasAttribute("editable");
  }

  #t(): GanttTexts {
    return { ...DEFAULT_TEXTS, ...this.#texts };
  }

  /** Without an authored `height`, the chart is as tall as its rows, between 220 and 560. */
  #syncHeight(): void {
    if (this.hasAttribute("height") && this.#autoHeight === null) return;
    const rows = ganttRows(this.#tasks, this.#collapsed).length;
    const next = `${clamp(CHROME + rows * this.#rowHeight, 220, 560)}`;
    if (this.getAttribute("height") === next) return;
    this.#autoHeight = next;
    this.setAttribute("height", next);
  }

  #setZoom(zoom: GanttZoom, anchor?: { time: number; px: number }): void {
    if (zoom === this.zoom) return;
    this.#zoom = zoom;
    this.#rev++;
    this.#anchor = anchor;
    this.#home = !anchor;
    this.#zoomAcc = 1;
    emit(this, "gantt-zoom", { zoom });
    this.requestDraw("size");
  }

  #stepZoom(direction: 1 | -1, anchor?: { time: number; px: number }): void {
    const at = GANTT_ZOOM_ORDER.indexOf(this.zoom);
    const next = GANTT_ZOOM_ORDER[clamp(at + direction, 0, GANTT_ZOOM_ORDER.length - 1)];
    if (next) this.#setZoom(next, anchor);
  }

  #toggle(id: string): void {
    const next = new Set(this.#collapsed);
    const collapsed = !next.has(id);
    if (collapsed) next.add(id);
    else next.delete(id);
    this.#collapsed = next;
    emit(this, "gantt-toggle", { id, collapsed });
    this.#changed();
  }

  #commit(change: GanttTaskChange): void {
    emit(this, "gantt-change", change);
  }

  #goToday(): void {
    const layout = this.#layout;
    if (!layout || !this.#today()) return;
    this.#scroll.x = clamp(
      layout.scale.x(this.#today() as number) - layout.viewport * 0.2,
      0,
      Math.max(0, layout.scale.width - layout.viewport),
    );
    this.requestDraw("transient");
  }

  #today(): number | null {
    const attr = this.getAttribute("today");
    if (attr === "off" || attr === "false") return null;
    if (attr && attr !== "auto") {
      const time = Date.parse(attr);
      return Number.isNaN(time) ? null : time;
    }
    return Date.now();
  }

  /** Keeps row `index` inside the viewport (called by the keyboard). */
  #reveal(index: number): void {
    const layout = this.#layout;
    if (!layout) return;
    const top = index * layout.rowHeight;
    const maxY = Math.max(0, layout.contentHeight - layout.bodyHeight);
    if (top < this.#scroll.y) this.#scroll.y = top;
    else if (top + layout.rowHeight > this.#scroll.y + layout.bodyHeight)
      this.#scroll.y = top + layout.rowHeight - layout.bodyHeight;
    this.#scroll.y = clamp(this.#scroll.y, 0, maxY);
    const row = layout.rows[index];
    if (row) {
      const box = barBox(row, layout.scale, layout.rowHeight);
      if (box.x0 < this.#scroll.x || box.x0 > this.#scroll.x + layout.viewport - 40)
        this.#scroll.x = clamp(box.x0 - 24, 0, Math.max(0, layout.scale.width - layout.viewport));
    }
    this.requestDraw("transient");
  }

  // ---- interaction ---------------------------------------------------------------------------

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    const drawing = this.drawing;
    const opts = { signal };
    this.#panZoom = attachPanZoom(drawing, {
      minZoom: 0.01,
      maxZoom: 100,
      keyboard: false,
      wheel: "modifier",
      onChange: (view) => this.#onPanZoom(view),
    });
    signal.addEventListener("abort", () => this.#panZoom?.destroy());

    root.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;
        const target = event.target as Element;
        if (target.closest("[data-divider]")) {
          const layout = this.#layout;
          if (!layout) return;
          this.#divider = { x: event.clientX, width: layout.gridW };
          event.preventDefault();
          return;
        }
        if (!this.#editable) return;
        const handle = target.closest(SVG_SELECTOR)?.getAttribute("data-handle");
        const id = target.closest("[data-task]")?.getAttribute("data-task");
        const layout = this.#layout;
        const row = layout?.rows.find((item) => item.task.id === id);
        if (!handle || !row || row.parent || !layout) return;
        const box = barBox(row, layout.scale, layout.rowHeight);
        const left = root.getBoundingClientRect().left + layout.gridW + box.x0 - this.#scroll.x;
        this.#drag = {
          id: row.task.id,
          mode: row.task.milestone ? "move" : (handle as DragState["mode"]),
          originX: event.clientX,
          start: row.start,
          end: row.end,
          progress: row.progress,
          barLeft: left,
          barWidth: box.x1 - box.x0,
          moved: false,
        };
      },
      opts,
    );
    root.addEventListener(
      "click",
      (event) => {
        const id = (event.target as Element).closest("[data-toggle]")?.getAttribute("data-toggle");
        if (!id) return;
        event.preventDefault();
        this.#toggle(id);
      },
      opts,
    );
    // Registered after the pan-zoom's listeners, so `wasDrag()` is current when pointerup runs.
    drawing.addEventListener("pointermove", (event) => this.#onMove(event), opts);
    const end = (event: PointerEvent) => this.#onEnd(event);
    drawing.addEventListener("pointerup", end, opts);
    drawing.addEventListener("pointercancel", end, opts);
    drawing.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey || event.metaKey) return;
        const layout = this.#layout;
        if (!layout) return;
        const maxY = Math.max(0, layout.contentHeight - layout.bodyHeight);
        const maxX = Math.max(0, layout.scale.width - layout.viewport);
        const dx = event.shiftKey ? event.deltaY : event.deltaX;
        const dy = event.shiftKey ? 0 : event.deltaY;
        const y = clamp(this.#scroll.y + dy, 0, maxY);
        const x = clamp(this.#scroll.x + dx, 0, maxX);
        if (y === this.#scroll.y && x === this.#scroll.x) return;
        event.preventDefault();
        this.#scroll = { x, y };
        this.requestDraw("transient");
      },
      { signal, passive: false },
    );
    drawing.addEventListener("keydown", (event) => this.#onKey(event), opts);
  }

  protected override teardown(): void {
    this.#panZoom = undefined;
    this.#parts = undefined;
  }

  #onPanZoom(view: PanZoomView): void {
    if (this.#resetting) return;
    this.#resetting = true;
    this.#panZoom?.setView(IDENTITY, { user: false });
    this.#resetting = false;
    const layout = this.#layout;
    if (!layout || this.#drag || this.#divider) return;
    if (view.k !== 1) {
      // A pure zoom around a point: view.x = px * (1 - k).
      const px = view.k === 1 ? 0 : view.x / (1 - view.k) - layout.gridW;
      this.#zoomAcc *= view.k;
      if (this.#zoomAcc >= ZOOM_STEP || this.#zoomAcc <= 1 / ZOOM_STEP) {
        const direction = this.#zoomAcc >= ZOOM_STEP ? -1 : 1;
        const time = layout.scale.invert(this.#scroll.x + clamp(px, 0, layout.viewport));
        this.#stepZoom(direction, { time, px: clamp(px, 0, layout.viewport) });
      }
      return;
    }
    this.#scroll = {
      x: clamp(this.#scroll.x - view.x, 0, Math.max(0, layout.scale.width - layout.viewport)),
      y: clamp(this.#scroll.y - view.y, 0, Math.max(0, layout.contentHeight - layout.bodyHeight)),
    };
    this.requestDraw("transient");
  }

  #onMove(event: PointerEvent): void {
    const layout = this.#layout;
    if (!layout) return;
    if (this.#divider) {
      this.#split = this.#divider.width + event.clientX - this.#divider.x;
      this.requestDraw("size");
      return;
    }
    const drag = this.#drag;
    if (!drag) return;
    if (!drag.moved && Math.abs(event.clientX - drag.originX) < 4) return;
    drag.moved = true;
    const level = GANTT_ZOOMS[this.zoom];
    const snap = (time: number) => snapTime(time, level.snap);
    const dt = (event.clientX - drag.originX) / layout.scale.k;
    if (drag.mode === "move") {
      const start = snap(drag.start + dt);
      this.#draft = {
        id: drag.id,
        start,
        end: start + (drag.end - drag.start),
        progress: drag.progress,
      };
    } else if (drag.mode === "start") {
      const start = Math.min(drag.end - level.snap, snap(drag.start + dt));
      this.#draft = { id: drag.id, start, end: drag.end, progress: drag.progress };
    } else if (drag.mode === "end") {
      const end = Math.max(drag.start + level.snap, snap(drag.end + dt));
      this.#draft = { id: drag.id, start: drag.start, end, progress: drag.progress };
    } else {
      const ratio = (event.clientX - drag.barLeft) / Math.max(1, drag.barWidth);
      this.#draft = {
        id: drag.id,
        start: drag.start,
        end: drag.end,
        progress: Math.round(clamp(ratio, 0, 1) * 20) / 20,
      };
    }
    this.requestDraw("transient");
  }

  #onEnd(event: PointerEvent): void {
    const drag = this.#drag;
    const draft = this.#draft;
    const dividing = this.#divider;
    this.#drag = null;
    this.#draft = null;
    this.#divider = null;
    // A drag, a pan or a divider move is the gesture's own: it must not select or drill.
    if (drag?.moved || dividing || this.#panZoom?.wasDrag()) event.preventDefault();
    if (!drag || !draft || draft.id !== drag.id || event.type === "pointercancel") {
      if (drag) this.requestDraw("transient");
      return;
    }
    if (draft.start !== drag.start || draft.end !== drag.end || draft.progress !== drag.progress)
      this.#commit({
        id: draft.id,
        start: new Date(draft.start),
        end: new Date(draft.end),
        progress: draft.progress,
        source: drag.mode === "progress" ? "progress" : drag.mode === "move" ? "move" : "resize",
      });
    this.requestDraw("transient");
  }

  /** Zoom keys, collapsing and editing, on the focused row. The base handles moving between rows. */
  #onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) return;
    if (!(event.target as Element).matches('[data-ui-part="proxy"]')) return;
    const layout = this.#layout;
    if (!layout) return;
    const key = event.key;
    if (key === "[" || key === "]") {
      event.preventDefault();
      this.#stepZoom(key === "]" ? -1 : 1);
      return;
    }
    if (key === "{" || key === "}") {
      event.preventDefault();
      this.#split = layout.gridW + (key === "}" ? 16 : -16);
      this.requestDraw("size");
      return;
    }
    if (key === "t" || key === "T") {
      event.preventDefault();
      this.#goToday();
      return;
    }
    const index = clamp(this.hover?.index ?? 0, 0, Math.max(0, layout.rows.length - 1));
    const row = layout.rows[index];
    if (!row) return;
    if ((key === "Enter" || key === " ") && row.parent && !event.shiftKey) {
      event.preventDefault();
      this.#toggle(row.task.id);
      return;
    }
    if (!this.#editable || row.parent) return;
    const level = GANTT_ZOOMS[this.zoom];
    const sign = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
    if (sign !== 0 && (event.altKey || event.shiftKey)) {
      event.preventDefault();
      const step = level.snap * sign;
      if (event.altKey || row.task.milestone)
        this.#commit({
          id: row.task.id,
          start: new Date(row.start + step),
          end: new Date(row.end + step),
          progress: row.progress,
          source: "move",
        });
      else
        this.#commit({
          id: row.task.id,
          start: new Date(row.start),
          end: new Date(Math.max(row.start + level.snap, row.end + step)),
          progress: row.progress,
          source: "resize",
        });
      return;
    }
    if (!row.task.milestone && (key === "+" || key === "=" || key === "-")) {
      event.preventDefault();
      const delta = key === "-" ? -0.1 : 0.1;
      this.#commit({
        id: row.task.id,
        start: new Date(row.start),
        end: new Date(row.end),
        progress: Math.round(clamp(row.progress + delta, 0, 1) * 100) / 100,
        source: "progress",
      });
    }
  }

  // ---- model ---------------------------------------------------------------------------------

  #columns(gridW: number): Column[] {
    const wanted = (this.getAttribute("columns") ?? "start end progress").split(/[\s,]+/);
    let room = gridW - NAME_MIN;
    const out: Column[] = [];
    for (const column of ["progress", "start", "end"] as const) {
      if (!wanted.includes(column) || room < COLUMN_WIDTH[column]) continue;
      out.push(column);
      room -= COLUMN_WIDTH[column];
    }
    return (["start", "end", "progress"] as const).filter((column) => out.includes(column));
  }

  /** Rows, domain, scale, header, shading and links: recomputed only when an input changes. */
  #modelFor(viewport: number, locale: string, texts: GanttTexts): Model {
    const today = this.#today();
    const zoom = this.zoom;
    const key = [
      this.#rev,
      viewport,
      locale,
      this.#rowHeight,
      today == null ? "" : startOfDay(today),
      this.#hidden("critical"),
      this.#hidden("baseline"),
    ].join("|");
    if (this.#model?.key === key) return this.#model.value;
    const rows = ganttRows(this.#tasks, this.#collapsed);
    const baselines = this.hasAttribute("baselines") && !this.#hidden("baseline");
    const hasBaselines = baselines && this.#tasks.some((task) => task.baseline);
    const times = rows.flatMap((row) => [row.start, row.end]);
    if (hasBaselines)
      for (const row of rows)
        if (row.task.baseline) times.push(+row.task.baseline.start, +row.task.baseline.end);
    for (const a of this.#annotations) times.push(+a.at, +(a.to ?? a.at));
    if (today != null) times.push(today);
    const domain = ganttDomain(times.length ? times : [Date.now()], zoom);
    const scale = ganttScale(domain, zoom, viewport);
    const level = GANTT_ZOOMS[zoom];
    const workingDays = (this.getAttribute("working-days") ?? "1,2,3,4,5")
      .split(/[\s,]+/)
      .map(Number)
      .filter((day) => day >= 0 && day <= 6);
    const critical = this.hasAttribute("critical-path") && !this.#hidden("critical");
    const value: Model = {
      rows,
      domain,
      scale,
      header: ganttHeader(scale, zoom, { locale, quarter: texts.quarter }),
      shading: level.shadeNonWorking ? nonWorkingSpans(domain, workingDays, this.#holidays) : [],
      links:
        this.getAttribute("dependencies") === "off"
          ? []
          : dependencyLinks(rows, scale, this.#rowHeight),
      placed: placeAnnotations(this.#annotations, scale),
      critical: critical ? criticalPath(this.#tasks) : null,
      baselines: hasBaselines,
      todayX: today != null && today >= domain[0] && today <= domain[1] ? scale.x(today) : null,
      today,
    };
    this.#model = { key, value };
    return value;
  }

  #hidden(id: string): boolean {
    return this.isHidden(id);
  }

  // ---- draw ----------------------------------------------------------------------------------

  protected override draw(context: DrawContext): DrawResult {
    const { svg: root, width, height, locale, timeZone, animate, motion } = context;
    const texts = this.#t();
    const rowHeight = this.#rowHeight;
    const zoom = this.zoom;
    const withTime = zoom === "hour";
    const narrow = width < 440;
    const defaultGrid = Math.round(clamp(width * (narrow ? 0.38 : 0.4), 120, 380));
    const gridW = Math.round(
      clamp(
        this.#split ?? (Number(this.getAttribute("grid-width")) || defaultGrid),
        MIN_PANE,
        Math.max(MIN_PANE, width - MIN_PANE),
      ),
    );
    const viewport = Math.max(MIN_PANE, width - gridW);
    const model = this.#modelFor(viewport, locale, texts);
    const { rows, scale, header, links } = model;
    const bodyHeight = Math.max(0, height - HEADER_HEIGHT);
    const contentHeight = rows.length * rowHeight;
    const maxX = Math.max(0, scale.width - viewport);
    const maxY = Math.max(0, contentHeight - bodyHeight);

    if (this.#anchor) {
      this.#scroll.x = scale.x(this.#anchor.time) - this.#anchor.px;
      this.#anchor = undefined;
      this.#home = false;
    } else if (this.#home) {
      const first = rows[0]?.start;
      const target =
        model.todayX != null && model.today != null ? model.today : (first ?? model.domain[0]);
      this.#scroll.x = scale.x(target) - viewport * 0.2;
      this.#home = false;
    }
    this.#scroll.x = clamp(this.#scroll.x, 0, maxX);
    this.#scroll.y = clamp(this.#scroll.y, 0, maxY);
    const { x: scrollX, y: scrollY } = this.#scroll;
    const layout: Layout = { rows, scale, gridW, viewport, rowHeight, bodyHeight, contentHeight };
    this.#layout = layout;

    const format = (time: number) => formatDate(time, { locale, timeZone });
    const percent = (value: number) => formatPercent(value, { locale, decimals: 0 });
    const shortDate = (time: number, clock: boolean) => {
      const d = new Date(time);
      const day = `${d.getDate()} ${shortMonth(d, { locale, timeZone })}`;
      return clock ? `${day} ${clockText(time)}` : day;
    };
    const duration = (ms: number) => {
      if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)} ${texts.hours}`;
      const days = Math.round(ms / DAY_MS);
      return `${days} ${days === 1 ? texts.day : texts.days}`;
    };
    const names = new Map(this.#tasks.map((task) => [task.id, task.name]));
    const deps = (row: Row) => (row.task.dependencies ?? []).map((id) => names.get(id) ?? id);
    const draftOf = (row: Row): Row =>
      this.#draft && this.#draft.id === row.task.id
        ? { ...row, start: this.#draft.start, end: this.#draft.end, progress: this.#draft.progress }
        : row;

    const parts = this.#ensureParts(root);
    const first = clamp(Math.floor(scrollY / rowHeight), 0, Math.max(0, rows.length - 1));
    const last = Math.min(rows.length, Math.ceil((scrollY + bodyHeight) / rowHeight) + 1);
    const visible = rows.slice(first, last);

    // Clips.
    parts.clipTimeline.setAttribute("x", `${gridW}`);
    parts.clipTimeline.setAttribute("y", `${HEADER_HEIGHT}`);
    parts.clipTimeline.setAttribute("width", `${viewport}`);
    parts.clipTimeline.setAttribute("height", `${bodyHeight}`);
    parts.clipHead.setAttribute("x", `${gridW}`);
    parts.clipHead.setAttribute("width", `${viewport}`);
    parts.clipHead.setAttribute("height", `${HEADER_HEIGHT}`);
    parts.clipList.setAttribute("y", `${HEADER_HEIGHT}`);
    parts.clipList.setAttribute("width", `${gridW}`);
    parts.clipList.setAttribute("height", `${bodyHeight}`);
    parts.clipBody.setAttribute("y", `${HEADER_HEIGHT}`);
    parts.clipBody.setAttribute("width", `${width}`);
    parts.clipBody.setAttribute("height", `${bodyHeight}`);
    parts.timeline.setAttribute(
      "transform",
      `translate(${gridW - scrollX},${HEADER_HEIGHT - scrollY})`,
    );
    parts.head.setAttribute("transform", `translate(${gridW - scrollX},0)`);
    parts.list.setAttribute("transform", `translate(0,${HEADER_HEIGHT - scrollY})`);
    parts.bands.setAttribute("transform", `translate(0,${HEADER_HEIGHT - scrollY})`);

    // Timeline background: shading, column lines, row separators and the today line.
    const inView = (x0: number, x1: number) => x1 >= scrollX - 40 && x0 <= scrollX + viewport + 40;
    const backdrop: SVGElement[] = [];
    for (const [from, to] of model.shading) {
      const x0 = scale.x(from);
      const x1 = scale.x(to);
      if (inView(x0, x1))
        backdrop.push(
          svg("rect", { class: "shade", x: x0, y: scrollY, width: x1 - x0, height: bodyHeight }),
        );
    }
    for (const cell of header.bottom)
      if (inView(cell.x, cell.x))
        backdrop.push(
          svg("line", {
            class: "vline",
            x1: cell.x,
            x2: cell.x,
            y1: scrollY,
            y2: scrollY + bodyHeight,
          }),
        );
    for (let i = first; i < last; i += 1)
      backdrop.push(
        svg("line", {
          class: "hline",
          x1: scrollX,
          x2: scrollX + viewport,
          y1: (i + 1) * rowHeight - 0.5,
          y2: (i + 1) * rowHeight - 0.5,
        }),
      );
    if (model.todayX != null)
      backdrop.push(
        svg("line", {
          class: "today",
          x1: model.todayX,
          x2: model.todayX,
          y1: scrollY,
          y2: scrollY + bodyHeight,
        }),
      );
    parts.backdrop.replaceChildren(...backdrop);

    // Row bands: the highlight of the active row, across both panes.
    this.#bands = join(
      parts.bands,
      visible,
      (row) => row.task.id,
      () => svg("rect", { class: "band" }),
      (el, _row, i) => {
        el.setAttribute("x", "0");
        el.setAttribute("y", `${(first + i) * rowHeight}`);
        el.setAttribute("width", `${width}`);
        el.setAttribute("height", `${rowHeight}`);
      },
    );
    this.#bandsFrom = first;

    // Annotations, dependency links and bars.
    const notes: SVGElement[] = [];
    for (const item of model.placed)
      notes.push(...this.#annotation(item, scrollY, bodyHeight, scrollX, viewport));
    parts.notes.replaceChildren(...notes);
    const activeId = this.#activeId(rows, context.hover);
    parts.links.replaceChildren(...this.#links(links, activeId, model.critical, parts.marker));
    const bars = join(
      parts.bars,
      visible,
      (row) => row.task.id,
      () => svg("g", { "data-bar": "" }),
      (el, source, i) => {
        const row = draftOf(source);
        el.setAttribute("data-task", row.task.id);
        el.replaceChildren(...this.#bar(row, first + i, scale, rowHeight, model, texts, viewport));
      },
    );
    if (animate && motion) {
      const per = Math.min(40, 500 / Math.max(1, bars.length));
      bars.forEach((bar, i) => {
        bar.style.transformBox = "fill-box";
        bar.style.transformOrigin = "left center";
        bar.animate(
          [
            { transform: "scaleX(0)", opacity: 0 },
            { transform: "scaleX(1)", opacity: 1 },
          ],
          { duration: 520, delay: i * per, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" },
        );
      });
    }

    // Header (timeline) and list.
    parts.head.replaceChildren(...this.#header(header, scrollX, viewport, model, texts));
    const columns = this.#columns(gridW);
    const columnDate = (time: number) => (withTime ? clockText(time) : shortDate(time, false));
    const listRows: SVGElement[] = [];
    visible.forEach((source, i) => {
      const row = draftOf(source);
      listRows.push(
        ...this.#listRow(row, first + i, gridW, columns, rowHeight, columnDate, percent, withTime),
      );
    });
    parts.list.replaceChildren(...listRows);
    parts.listHead.replaceChildren(...this.#listHead(gridW, columns, texts));
    parts.divider.setAttribute("x", `${gridW - 5}`);
    parts.divider.setAttribute("y", "0");
    parts.divider.setAttribute("height", `${height}`);
    parts.dividerLine.setAttribute("x1", `${gridW}`);
    parts.dividerLine.setAttribute("x2", `${gridW}`);
    parts.dividerLine.setAttribute("y2", `${height}`);

    const describe = (row: Row) => {
      const out = [row.task.name];
      if (row.task.milestone && !row.parent)
        out.push(`${texts.milestone}, ${shortDate(row.start, withTime)}`);
      else
        out.push(
          `${texts.start} ${shortDate(row.start, withTime)}`,
          `${texts.end} ${shortDate(withTime ? row.end : displayEnd(row.start, row.end), withTime)}`,
          `${texts.progress} ${percent(row.progress)}`,
        );
      const d = deps(row);
      if (d.length) out.push(`${texts.dependsOn} ${d.join(", ")}`);
      return out.join(". ");
    };

    const tipRows = (row: Row): TooltipRow[] => {
      const color = row.task.color ?? (row.parent ? "var(--ink-2)" : "var(--accent-word)");
      const out: TooltipRow[] = [];
      const stamp = (time: number) =>
        withTime ? `${format(time)} ${clockText(time)}` : format(time);
      if (row.task.milestone && !row.parent)
        out.push({
          id: "date",
          name: texts.milestone,
          value: stamp(row.start),
          color: row.task.color ?? "var(--ink)",
          shape: "square",
        });
      else {
        out.push(
          {
            id: "start",
            name: texts.start,
            value: stamp(row.start),
            color: "var(--ink-3)",
            shape: "dot",
          },
          {
            id: "end",
            name: texts.end,
            value: stamp(withTime ? row.end : displayEnd(row.start, row.end)),
            color: "var(--ink-3)",
            shape: "dot",
          },
          {
            id: "duration",
            name: texts.duration,
            value: duration(row.end - row.start),
            color: "var(--ink-3)",
            shape: "dot",
          },
          {
            id: "progress",
            name: texts.progress,
            value: percent(row.progress),
            color,
            shape: "square",
          },
        );
      }
      if (row.task.assignee)
        out.push({
          id: "assignee",
          name: texts.assignee,
          value: row.task.assignee,
          color: "transparent",
        });
      const plan = row.task.baseline;
      if (model.baselines && plan && !row.parent) {
        const slip = row.end - +plan.end;
        out.push(
          {
            id: "baseline",
            name: texts.baseline,
            value: `${shortDate(+plan.start, false)} - ${shortDate(+plan.end, false)}`,
            color: "var(--ink-3)",
            shape: "dot",
          },
          {
            id: "variance",
            name: texts.variance,
            value: `${slip > 0 ? "+" : slip < 0 ? "-" : ""}${duration(Math.abs(slip))}`,
            color: slip > 0 ? "var(--danger)" : "var(--chart-up)",
            shape: "dot",
            emphasis: slip !== 0,
          },
        );
      }
      if (model.critical && !row.parent) {
        const isCritical = model.critical.tasks.has(row.task.id);
        const slack = model.critical.slack.get(row.task.id);
        out.push({
          id: "critical",
          name: isCritical ? texts.criticalPath : texts.slack,
          value: isCritical ? texts.critical : slack == null ? "" : duration(slack),
          color: isCritical ? "var(--danger)" : "var(--ink-3)",
          shape: "dot",
        });
      }
      const d = deps(row);
      if (d.length)
        out.push({
          id: "deps",
          name: texts.dependsOn,
          value: d.join(", "),
          color: "transparent",
          emphasis: true,
        });
      return out;
    };

    const maxRows = 9;
    return {
      summary: rows.length
        ? `${rows.length} ${texts.tasks.toLowerCase()}, ${format(Math.min(...rows.map((row) => row.start)))} - ${format(displayEnd(0, Math.max(...rows.map((row) => row.end))))}`
        : undefined,
      marks: {
        count: rows.length,
        label: (i) => {
          const row = rows[i];
          return row ? describe(draftOf(row)) : "";
        },
        element: (i) => (i >= this.#bandsFrom ? (this.#bands[i - this.#bandsFrom] ?? null) : null),
      },
      maxHoverRows: maxRows,
      hit: (x, y, _target, radius) => {
        const live = this.#layout;
        if (!live || this.#divider) return -1;
        if (y < HEADER_HEIGHT || y > HEADER_HEIGHT + live.bodyHeight) return -1;
        const index = Math.floor((y - HEADER_HEIGHT + this.#scroll.y) / live.rowHeight);
        const row = live.rows[index];
        if (!row) return -1;
        if (x < live.gridW) return index;
        const box = barBox(row, live.scale, live.rowHeight);
        const px = x - live.gridW + this.#scroll.x;
        const slop = Math.min(radius, 12);
        return px >= box.x0 - slop && px <= box.x1 + slop ? index : -1;
      },
      hover: (i) => {
        const source = rows[i];
        if (!source) return null;
        const row = draftOf(source);
        const box = barBox(row, scale, rowHeight);
        return {
          title: row.task.name,
          rows: tipRows(row),
          x: clamp(gridW + box.x1 - this.#scroll.x, gridW, width - 8),
          y: HEADER_HEIGHT + i * rowHeight + rowHeight / 2 - this.#scroll.y,
          side: "right",
        };
      },
      nav: (index, intent) => this.#nav(index, intent),
      snapshot: () =>
        this.#snapshot(locale, timeZone, texts, model, format, duration, percent, context.color),
    };
  }

  #activeId(rows: readonly Row[], hover: number | null): string | null {
    return hover != null ? (rows[hover]?.task.id ?? null) : null;
  }

  #nav(index: number, intent: NavIntent): number | undefined {
    const layout = this.#layout;
    if (!layout) return undefined;
    const { rows } = layout;
    const row = rows[index];
    if (!row) return undefined;
    let to = index;
    switch (intent) {
      case "up":
        to = index - 1;
        break;
      case "down":
        to = index + 1;
        break;
      case "home":
        to = 0;
        break;
      case "end":
        to = rows.length - 1;
        break;
      case "right":
      case "child":
        if (row.parent && row.collapsed) {
          this.#toggle(row.task.id);
          return index;
        }
        to = row.parent ? index + 1 : index;
        break;
      case "left":
      case "parent": {
        if (intent === "left" && row.parent && !row.collapsed) {
          this.#toggle(row.task.id);
          return index;
        }
        if (row.depth > 0) {
          let parent = index - 1;
          while (parent >= 0 && (rows[parent] as Row).depth >= row.depth) parent -= 1;
          if (parent >= 0) to = parent;
        }
        break;
      }
    }
    to = clamp(to, 0, rows.length - 1);
    if (to !== index) this.#reveal(to);
    return to;
  }

  // ---- parts ---------------------------------------------------------------------------------

  #ensureParts(root: SVGSVGElement): Parts {
    if (this.#parts && this.#parts.root === root && this.#parts.timeline.isConnected)
      return this.#parts;
    const id = this.#clip;
    const rect = (name: string) => svg("rect", { x: 0, y: 0, "data-clip": name });
    const clipTimeline = rect("t");
    const clipHead = rect("h");
    const clipList = rect("l");
    const clipBody = rect("b");
    const marker = `${id}-arrow`;
    const arrow = (tone: string) =>
      svg(
        "marker",
        {
          id: `${marker}-${tone}`,
          viewBox: "0 0 8 8",
          refX: 7,
          refY: 4,
          markerWidth: 7,
          markerHeight: 7,
          orient: "auto-start-reverse",
        },
        svg("path", { d: "M0,0L8,4L0,8Z", class: `arrow-${tone}` }),
      );
    const defs = svg(
      "defs",
      {},
      svg("clipPath", { id: `${id}-t` }, clipTimeline),
      svg("clipPath", { id: `${id}-h` }, clipHead),
      svg("clipPath", { id: `${id}-l` }, clipList),
      svg("clipPath", { id: `${id}-b` }, clipBody),
      arrow("base"),
      arrow("active"),
      arrow("late"),
    );
    const g = (cls: string, attrs: Record<string, string | number> = {}) =>
      svg("g", { class: cls, ...attrs });
    const backdrop = g("backdrop");
    const notes = g("notes");
    const links = g("links");
    const bars = g("bars");
    const bands = g("bands");
    const timeline = svg("g", { "clip-path": `url(#${id}-t)` }, svg("g", { class: "pane" }));
    const pane = timeline.firstChild as SVGGElement;
    // The pane carries the scroll translate; the layers inside are in timeline pixels.
    pane.append(backdrop, notes, links, bars);
    const bandLayer = svg("g", { "clip-path": `url(#${id}-b)` }, bands);
    const list = g("list");
    const listClip = svg("g", { "clip-path": `url(#${id}-l)` }, list);
    const head = g("head");
    const headClip = svg("g", { "clip-path": `url(#${id}-h)` }, head);
    const listHead = g("list-head");
    const dividerLine = svg("line", { class: "divider-line", y1: 0 });
    const divider = svg("rect", {
      class: "divider",
      "data-divider": "",
      "aria-hidden": "true",
      width: 10,
    });
    root.append(defs, bandLayer, timeline, listClip, headClip, listHead, divider, dividerLine);
    this.#parts = {
      root,
      clipTimeline,
      clipHead,
      clipList,
      clipBody,
      marker,
      // The groups that move are the panes themselves.
      timeline: pane,
      head,
      list,
      bandLayer,
      bands,
      backdrop,
      notes,
      links,
      bars,
      listHead,
      divider,
      dividerLine,
    };
    return this.#parts;
  }

  // ---- drawing pieces ---------------------------------------------------------------------

  #header(
    header: GanttHeader,
    scrollX: number,
    viewport: number,
    model: Model,
    texts: GanttTexts,
  ): SVGElement[] {
    const out: SVGElement[] = [];
    for (const cell of header.top) {
      const room = cell.width - 16;
      const textWidth = estimateTextWidth(cell.label, 11.5);
      const x = Math.min(Math.max(cell.x, scrollX) + 8, cell.x + Math.max(8, room - textWidth));
      out.push(svg("line", { class: "line", x1: cell.x, x2: cell.x, y1: 0, y2: HEADER_ROW }));
      if (room > 10)
        out.push(
          svg("text", { class: "head-top", x, y: HEADER_ROW / 2, dy: "0.34em" }, cell.label),
        );
    }
    const right = scrollX + viewport;
    out.push(
      svg("line", {
        class: "line",
        x1: scrollX,
        x2: right,
        y1: HEADER_ROW + 0.5,
        y2: HEADER_ROW + 0.5,
      }),
    );
    for (const cell of header.bottom) {
      if (cell.x + cell.width < scrollX - 40 || cell.x > right + 40) continue;
      out.push(
        svg("line", { class: "vline", x1: cell.x, x2: cell.x, y1: HEADER_ROW, y2: HEADER_HEIGHT }),
      );
      if (estimateTextWidth(cell.label, 10.5) <= cell.width - 4)
        out.push(
          svg(
            "text",
            {
              class: "head-bottom",
              x: cell.x + cell.width / 2,
              y: HEADER_ROW + HEADER_ROW / 2,
              dy: "0.34em",
              "text-anchor": "middle",
            },
            cell.label,
          ),
        );
    }
    if (model.todayX != null) {
      const label = texts.today;
      const w = estimateTextWidth(label, 10) + 12;
      out.push(
        svg("rect", {
          class: "today-pill",
          x: model.todayX - w / 2,
          y: 4,
          width: w,
          height: 16,
          rx: 8,
        }),
        svg(
          "text",
          { class: "today-label", x: model.todayX, y: 12, dy: "0.34em", "text-anchor": "middle" },
          label,
        ),
      );
    }
    out.push(
      svg("line", {
        class: "line-strong",
        x1: scrollX,
        x2: right,
        y1: HEADER_HEIGHT - 0.5,
        y2: HEADER_HEIGHT - 0.5,
      }),
    );
    return out;
  }

  #listHead(gridW: number, columns: readonly Column[], texts: GanttTexts): SVGElement[] {
    const out: SVGElement[] = [
      svg("rect", { class: "list-bg", x: 0, y: 0, width: gridW, height: HEADER_HEIGHT }),
      svg("line", {
        class: "line-strong",
        x1: 0,
        x2: gridW,
        y1: HEADER_HEIGHT - 0.5,
        y2: HEADER_HEIGHT - 0.5,
      }),
      svg(
        "text",
        { class: "list-head", x: 12, y: HEADER_HEIGHT - HEADER_ROW / 2, dy: "0.34em" },
        fit(texts.tasks, gridW - 24, 11),
      ),
    ];
    let right = gridW;
    for (const column of [...columns].reverse()) {
      out.push(
        svg(
          "text",
          {
            class: "list-head",
            x: right - 12,
            y: HEADER_HEIGHT - HEADER_ROW / 2,
            dy: "0.34em",
            "text-anchor": "end",
          },
          texts[column],
        ),
      );
      right -= COLUMN_WIDTH[column];
    }
    return out;
  }

  #listRow(
    row: Row,
    i: number,
    gridW: number,
    columns: readonly Column[],
    rowHeight: number,
    columnDate: (time: number) => string,
    percent: (value: number) => string,
    withTime: boolean,
  ): SVGElement[] {
    const cy = i * rowHeight + rowHeight / 2;
    const out: SVGElement[] = [
      svg("line", {
        class: "hline",
        x1: 0,
        x2: gridW,
        y1: (i + 1) * rowHeight - 0.5,
        y2: (i + 1) * rowHeight - 0.5,
      }),
    ];
    const isMilestone = !!row.task.milestone && !row.parent;
    let x = 8 + row.depth * 14;
    if (row.parent) {
      const open = !row.collapsed;
      out.push(
        svg(
          "g",
          { "data-toggle": row.task.id, class: "toggle", transform: `translate(${x + 10},${cy})` },
          svg("rect", { x: -10, y: -10, width: 20, height: 20, fill: "transparent" }),
          svg("path", {
            d: "M-1.5,-3.5 2,0 -1.5,3.5",
            class: "chevron",
            transform: open ? "rotate(90)" : undefined,
          }),
        ),
      );
    }
    x += 24;
    if (isMilestone) {
      out.push(
        svg("rect", {
          class: "diamond",
          x: x - 4,
          y: cy - 4,
          width: 8,
          height: 8,
          rx: 1,
          transform: `rotate(45 ${x} ${cy})`,
          style: `fill:${row.task.color ?? "var(--ink)"}`,
        }),
      );
      x += 10;
    }
    let reserve = 0;
    for (const column of columns) reserve += COLUMN_WIDTH[column];
    out.push(
      svg(
        "text",
        { class: row.parent ? "list-name strong" : "list-name", x, y: cy, dy: "0.34em" },
        fit(row.task.name, gridW - reserve - x - 8, 12),
      ),
    );
    let right = gridW;
    for (const column of [...columns].reverse()) {
      const cell =
        column === "start"
          ? columnDate(row.start)
          : isMilestone
            ? ""
            : column === "end"
              ? columnDate(withTime ? row.end : displayEnd(row.start, row.end))
              : percent(row.progress);
      out.push(
        svg(
          "text",
          { class: "list-cell", x: right - 12, y: cy, dy: "0.34em", "text-anchor": "end" },
          cell,
        ),
      );
      right -= COLUMN_WIDTH[column];
    }
    return out;
  }

  #annotation(
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

  #links(
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

  #bar(
    row: Row,
    i: number,
    scale: GanttScale,
    rowHeight: number,
    model: Model,
    texts: GanttTexts,
    _viewport: number,
  ): SVGElement[] {
    void texts;
    const box = barBox(row, scale, rowHeight);
    const cy = i * rowHeight + rowHeight / 2;
    const editable = this.#editable;
    const isCritical = !!model.critical?.tasks.has(row.task.id);
    const color = isCritical
      ? "var(--danger)"
      : (row.task.color ?? (box.milestone ? "var(--ink)" : "var(--accent-word)"));
    const out: SVGElement[] = [];
    const label = (
      x: number,
      text: string,
      extra: Record<string, string | number | boolean> = {},
      cls = "bar-label",
    ) => svg("text", { class: cls, x, y: cy, dy: "0.34em", "aria-hidden": "true", ...extra }, text);
    if (box.milestone) {
      const half = box.size / 2;
      const x = box.x0 + half;
      out.push(
        svg("path", {
          class: "milestone",
          "data-handle": "move",
          d: `M${x},${cy - half - 1}L${x + half + 1},${cy}L${x},${cy + half + 1}L${x - half - 1},${cy}Z`,
          style: `fill:${color};stroke:${color}`,
        }),
      );
      const spot = outsideLabel(box, row.task.name, scale.width);
      out.push(
        label(spot.x, spot.text, spot.end ? { "text-anchor": "end" } : {}, "bar-label outside"),
      );
      return out;
    }
    const width = box.x1 - box.x0;
    if (row.parent) {
      const h = 8;
      const top = cy - h / 2;
      out.push(
        svg("rect", {
          x: box.x0,
          y: top,
          width,
          height: h,
          rx: 2,
          style: `fill:${tint("var(--ink-2)", 30)}`,
        }),
        svg("rect", {
          x: box.x0,
          y: top,
          width: width * row.progress,
          height: h,
          rx: 2,
          style: "fill:var(--ink-2)",
        }),
        svg("path", {
          d: `M${box.x0},${top}h7l-7,9Z M${box.x1},${top}h-7l7,9Z`,
          style: "fill:var(--ink-2)",
        }),
      );
      const spot = outsideLabel(box, row.task.name, scale.width, true);
      out.push(
        label(
          spot.x,
          spot.text,
          spot.end ? { "text-anchor": "end" } : {},
          "bar-label outside strong",
        ),
      );
      return out;
    }
    const h = Math.round(rowHeight * 0.58);
    const top = cy - h / 2;
    out.push(
      svg("rect", {
        class: editable ? "grab" : undefined,
        "data-handle": "move",
        x: box.x0,
        y: top,
        width,
        height: h,
        rx: 6,
        style: `fill:${tint(color, 30)}`,
      }),
    );
    if (row.progress > 0)
      out.push(
        svg("rect", {
          class: editable ? "grab" : undefined,
          "data-handle": "move",
          x: box.x0,
          y: top,
          width: Math.max(Math.min(width, 6), width * row.progress),
          height: h,
          rx: 6,
          style: `fill:${color}`,
        }),
      );
    if (model.baselines && row.task.baseline) {
      const a = scale.x(+row.task.baseline.start);
      const b = scale.x(+row.task.baseline.end);
      out.push(
        svg("rect", {
          class: "baseline",
          x: a,
          y: top + h + 2,
          width: Math.max(2, b - a),
          height: 4,
          rx: 2,
        }),
      );
    }
    if (estimateTextWidth(row.task.name, 11) + 16 <= width)
      out.push(
        label(box.x0 + 8, row.task.name, {
          style: `fill:${row.progress > 0.35 ? "var(--surface)" : "var(--ink)"}`,
        }),
      );
    else {
      const spot = outsideLabel(box, row.task.name, scale.width);
      out.push(
        label(spot.x, spot.text, spot.end ? { "text-anchor": "end" } : {}, "bar-label outside"),
      );
    }
    if (editable)
      out.push(
        svg(
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
            d: `M${box.x0 + width * row.progress},${top + h - 2}l6,9h-12Z`,
          }),
        ),
      );
    return out;
  }

  #snapshot(
    locale: string,
    timeZone: string | undefined,
    texts: GanttTexts,
    model: Model,
    format: (time: number) => string,
    duration: (ms: number) => string,
    percent: (value: number) => string,
    color: DrawContext["color"],
  ): ChartSnapshot {
    const all = ganttRows(this.#tasks);
    const names = new Map(this.#tasks.map((task) => [task.id, task.name]));
    const column = (id: string, name: string, text: string[]) => ({
      id,
      name,
      color: color(0),
      values: text,
      text,
    });
    void locale;
    void timeZone;
    const series = [
      column(
        "start",
        texts.start,
        all.map((row) => format(row.start)),
      ),
      column(
        "end",
        texts.end,
        all.map((row) => format(displayEnd(row.start, row.end))),
      ),
      column(
        "duration",
        texts.duration,
        all.map((row) => duration(row.end - row.start)),
      ),
      column(
        "progress",
        texts.progress,
        all.map((row) =>
          row.task.milestone && !row.parent ? texts.milestone : percent(row.progress),
        ),
      ),
      column(
        "dependsOn",
        texts.dependsOn,
        all.map((row) => (row.task.dependencies ?? []).map((id) => names.get(id) ?? id).join(", ")),
      ),
    ];
    if (model.baselines)
      series.push(
        column(
          "baseline",
          texts.baseline,
          all.map((row) =>
            row.task.baseline
              ? `${format(+row.task.baseline.start)} - ${format(+row.task.baseline.end)}`
              : "",
          ),
        ),
      );
    const critical = this.hasAttribute("critical-path") ? criticalPath(this.#tasks) : null;
    if (critical)
      series.push(
        column(
          "critical",
          texts.criticalPath,
          all.map((row) => (critical.tasks.has(row.task.id) ? texts.critical : "")),
        ),
      );
    return {
      title: this.getAttribute("label") ?? texts.tasks,
      categoryHeader: texts.tasks,
      categories: all.map((row) => `${"· ".repeat(row.depth)}${row.task.name}`),
      series,
      legend: [
        ...(critical
          ? [
              {
                id: "critical",
                name: texts.criticalPath,
                color: "var(--danger)",
                shape: "square" as const,
              },
            ]
          : []),
        ...(this.hasAttribute("baselines")
          ? [
              {
                id: "baseline",
                name: texts.baseline,
                color: "var(--ink-3)",
                shape: "square" as const,
              },
            ]
          : []),
      ],
    };
  }
}

interface Model {
  rows: Row[];
  domain: [number, number];
  scale: GanttScale;
  header: GanttHeader;
  shading: Array<[number, number]>;
  links: Link[];
  placed: PlacedAnnotation[];
  critical: CriticalPath | null;
  baselines: boolean;
  todayX: number | null;
  today: number | null;
}

interface Parts {
  root: SVGSVGElement;
  clipTimeline: SVGRectElement;
  clipHead: SVGRectElement;
  clipList: SVGRectElement;
  clipBody: SVGRectElement;
  marker: string;
  timeline: SVGGElement;
  head: SVGGElement;
  list: SVGGElement;
  bandLayer: SVGGElement;
  bands: SVGGElement;
  backdrop: SVGGElement;
  notes: SVGGElement;
  links: SVGGElement;
  bars: SVGGElement;
  listHead: SVGGElement;
  divider: SVGRectElement;
  dividerLine: SVGLineElement;
}

/** Registers `<ui-gantt>` (or `<prefix>-gantt`) and returns the tag. */
export function defineGantt(options?: DefineOptions): string {
  return defineElement("gantt", UiGantt, options);
}
