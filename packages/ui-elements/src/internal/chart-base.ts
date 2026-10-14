import type { resolveFormat, ValueFormat, ValueFormatter } from "@jcsoftdev/ui-core/chart/format";
import { seriesColor } from "@jcsoftdev/ui-core/chart/palette";
import { adoptStyles, ElementBase, emit, rootOf, uid } from "./base.js";
import css from "./chart-base.css.js";
import { SR_ONLY, svg } from "./chart-dom.js";
import type { Interact, InteractApi } from "./chart-interact.js";
import {
  CHART_EVENT,
  CHART_MARKER,
  type ChartHost,
  type ChartSnapshot,
  type HoverContent,
  type HoverInfo,
  type HoverSource,
} from "./chart-protocol.js";

export { join, svg } from "./chart-dom.js";
export * from "./chart-protocol.js";

const DEFAULT_HEIGHT = 240;
const FALLBACK_HEIGHT = 300;
const PRESETS = new Set(["number", "integer", "currency", "percent", "compact"]);
/** Events the chart keeps from the moment it is touched until the interaction chunk is ready. */
const WAKE = ["focusin", "pointerenter", "pointerdown", "pointerup", "click"] as const;

/** Visible strings of the base. English defaults; override with `chart.labels = { ... }`. */
export interface ChartLabels {
  empty: string;
  loading: string;
  /** Accessible name of a chart that has no `label`. */
  chart: string;
  /** `aria-roledescription` of the drawing: how a screen reader names this kind of element. */
  roledescription: string;
  /** Closing row of a table cut at its row limit; `{n}` is the number of rows left out. */
  more: string;
}

/** Defaults of the labels the base itself needs; `empty`, `loading` and `more` live in their chunks. */
const DEFAULT_LABELS = { chart: "Chart", roledescription: "chart" };

/** A focusable mark: the element that takes focus and the accessible name it gets. */
export interface ChartMark {
  el: SVGElement;
  label: string;
}

/**
 * Marks that are not elements (a canvas layer, or thousands of points): the chart has `count` of
 * them, each named by `label(i)`. The base gives them one focus target, a listbox proxy whose
 * `aria-activedescendant` is the current mark, so no per-mark element exists. `element(i)`, when
 * given, returns an SVG element to highlight for mark `i` (it gets `data-active`).
 */
export interface VirtualMarks {
  count: number;
  label(index: number): string;
  element?(index: number): SVGElement | null;
}

/** Where a keyboard move goes from the current mark; see `DrawResult.nav`. */
export type NavIntent = "left" | "right" | "up" | "down" | "home" | "end" | "parent" | "child";

/** Why a draw runs: the first one, new data (or a legend toggle), or a new size. */
export type DrawPhase = "enter" | "update" | "resize";

/** Everything a chart gets to draw with. The SVG is empty on `enter` (and on every draw unless retained). */
export interface DrawContext {
  svg: SVGSVGElement;
  width: number;
  height: number;
  /** `enter` plays the entry animation; `update` and `resize` must not. */
  phase: DrawPhase;
  /** What the previous draw returned (`undefined` on `enter`): reuse its scales to animate between data. */
  previous: DrawResult | undefined;
  locale: string;
  timeZone: string | undefined;
  /** Formats a value with the chart's `value-format`, `locale` and `currency`. */
  format: ValueFormatter;
  /** True when entry animation may play: the phase is `enter` and motion is allowed. */
  animate: boolean;
  /** False when the user prefers reduced motion or the chart has `animate="off"`: tween data-to-data changes only if true. */
  motion: boolean;
  /**
   * 0 until the theme observer is loaded (first `canvas()` call, or `static themeAware`), then bumps every time the page theme changes (`data-theme`, `class` or `style` on the root or the
   * nearest themed ancestor, or `prefers-color-scheme`); the chart redraws as `update`. A painter
   * that caches resolved colors (a canvas) drops its cache when this differs from the last draw.
   */
  themeVersion: number;
  /** True for a frame asked for with `requestDraw("transient")`: nothing about the data changed. */
  transient: boolean;
  /**
   * The mark whose details are shown (hovered, keyboard-focused or pinned), or `null`. A chart that
   * redraws from scratch can draw its crosshair or highlight from this, so it survives the redraw.
   */
  hover: number | null;
  /** Color of series `index`: the `palette` property, else the chart palette tokens. */
  color(index: number, override?: string): string;
  /**
   * Opts this chart into retained rendering: from the next draw on the SVG is no longer cleared, so
   * the chart can `join()` its marks by key and touch only what changed. Same as `static retain`.
   */
  retain(): void;
  /**
   * A 2D canvas the size of the drawing, under the SVG, cleared and scaled to the device pixel ratio
   * on every call. Created on the first call and removed when a draw does not ask for it. For more
   * than a few thousand marks; name them for assistive tech with virtual `marks`.
   */
  canvas(): CanvasRenderingContext2D;
}

export interface DrawResult {
  /**
   * The height in px this content needs (rows, a tree depth). The base applies it to the drawing part
   * and redraws once, unless the consumer set `height`, `height="fill"` or `aspect-ratio`. Never write
   * the host: return it here, or set `static defaultHeight`.
   */
  naturalHeight?: number;
  /**
   * Identity of mark `index`, unique per mark and stable across draws. When both the previous and the
   * new draw have it, a redraw that reorders the marks keeps the selection, the keyboard hover, the
   * roving tab stop and focus on the same entity (no `chart-select`). Without it they stay by index.
   */
  markKey?(index: number): string;
  /** Accessible name when the element has no `label` attribute. */
  label?: string;
  /** One sentence for screen readers (first, last, min, max...). Becomes the description. */
  summary?: string;
  /**
   * Data for the legend, data table and export. Pass a function: it runs the first time a part asks
   * for `chart.chartSnapshot` after a data change, once per data revision, never for a resize.
   */
  snapshot?: ChartSnapshot | (() => ChartSnapshot);
  /** One focusable mark per mark, in reading order: real elements, or virtual marks. */
  marks?: readonly ChartMark[] | VirtualMarks;
  /**
   * Pixel position, in drawing units (the box is already scaled for CSS zoom or transforms), to a
   * mark index, or -1. `target` is the element under the pointer; `radius` is how far a pointer may
   * miss (a few px for a mouse, the `--touch-target` token for a finger). Must be gap-free.
   */
  hit?(x: number, y: number, target: Element | null, radius: number): number;
  /** Tooltip content and anchor of mark `index`. */
  hover?(index: number, source: HoverSource): HoverContent | null;
  /**
   * Keyboard navigation for marks that are not a line: the mark to move to from `index` for an
   * `intent`, or `index` / `-1` / `undefined` to stay. Without it the arrows walk the marks in
   * reading order. The arrows send `left`, `right`, `up`, `down` (`left` and `right` are already
   * swapped in a right-to-left page), Home and End send `home` and `end`, Backspace sends `parent`
   * and Shift+Enter sends `child` after it fires `chart-drill`.
   */
  nav?(index: number, intent: NavIntent): number | undefined;
  /** Most rows `hover()` ever returns. The docked tooltip reserves that much height so nothing below it moves. */
  maxHoverRows?: number;
}

export const CHART_ATTRIBUTES = [
  "label",
  "description",
  "height",
  "aspect-ratio",
  "loading",
  "empty",
  "skeleton",
  "locale",
  "time-zone",
  "value-format",
  "currency",
  "palette",
  "animate",
  "table",
];

/**
 * `ui-core/chart/format` is fetched with the first draw instead of being part of the base: a chart
 * that formats its own axes imports it statically anyway, and then this `import()` is already
 * resolved and costs nothing. The first draw waits for it, once per page.
 */
let formatter: typeof resolveFormat | undefined;
const loadFormat = () =>
  import("@jcsoftdev/ui-core/chart/format").then((module) => {
    formatter = module.resolveFormat;
  });

const isVirtual = (marks: DrawResult["marks"]): marks is VirtualMarks =>
  !!marks && "count" in marks;

/**
 * The base every chart element extends. Light DOM: the host is a positioned flex column holding
 * the sized drawing area (an SVG you fill in `draw()`), plus whatever opt-in parts the author
 * places inside it. It owns sizing, the accessible name and description, the hover and selection
 * state, the series toggles and a lazy screen-reader table. Pointer, touch and keyboard input,
 * and the loading and empty screens, are separate chunks fetched when first needed. It imports
 * no legend, tooltip, export or data table: those are separate elements.
 *
 * Attributes: `label`, `description`, `height` (px, default 240, or `fill`), `aspect-ratio`,
 * `loading`, `empty`, `skeleton` (`bars`, `line`, `ring`), `locale`, `time-zone`, `value-format`
 * (`number`, `integer`, `currency`, `percent`, `compact`), `currency` (required for the `currency`
 * format), `palette` (CSS colors, comma separated), `animate="off"`, `table="off"`, `touch-action`
 * (default `pan-y`). Events: `chart-ready`, `chart-data`, `chart-hover`, `chart-select`,
 * `chart-drill`, `chart-series`.
 */
export abstract class ChartElement extends ElementBase implements ChartHost {
  static observedAttributes: string[] = [...CHART_ATTRIBUTES];
  /** Retained rendering for every instance: the SVG is cleared only on `enter`. */
  static retain = false;
  /** CSS `touch-action` of the drawing (the attribute of the same name overrides it). */
  static touchAction = "pan-y";
  /** Opt in to `themeVersion` without a canvas (a chart that caches resolved colors). A canvas chart is opted in by `canvas()`. */
  static themeAware = false;
  /**
   * Height in px when the consumer sets no `height` and no `aspect-ratio`: a number, or a function of
   * the element (read its attributes, e.g. `orientation`). Applied to the inner drawing part, never to
   * the host, and re-read on every draw.
   */
  static defaultHeight: number | ((element: never) => number) = DEFAULT_HEIGHT;

  /** Series ids hidden before the first draw (attribute `initial-hidden`, a JSON array). Seeds silently: no `chart-series`. */
  initialHidden: readonly string[] | undefined;
  /** Property forms of the matching attributes. */
  valueFormat: ValueFormat | undefined;
  palette: readonly string[] | undefined;
  labels: Partial<ChartLabels> = {};
  /** A subclass without data of its own (a sparkline) sets this to skip the fallback table. */
  protected tableFallback = true;

  readonly drawing = document.createElement("div");
  #svg: SVGSVGElement | undefined;
  #canvas: HTMLCanvasElement | undefined;
  #canvasUsed = false;
  #description: HTMLElement | undefined;
  #proxy: HTMLElement | undefined;
  #observer: ResizeObserver | undefined;
  #frame = 0;
  #dirty = true;
  #transient = false;
  #dpr: AbortController | undefined;
  #retain = false;
  #stateKind: "loading" | "empty" | undefined;
  #width = 0;
  #measured = 0;
  #natural = 0;
  #themeVersion = 0;
  #themed = false;
  #unwatch: (() => void) | undefined;
  #naturalPasses = 0;
  #result: DrawResult | undefined;
  #revision = 0;
  #snapshot: { revision: number; value: ChartSnapshot | null } | undefined;
  #marks: readonly ChartMark[] = [];
  #virtual: VirtualMarks | undefined;
  #active = 0;
  #claims = 0;
  #tableLoaded = false;
  #busy = false;
  #wake: Event[] = [];
  #interact: Interact | undefined;
  #interactLoad: Promise<Interact | undefined> | undefined;
  #setup: AbortController | undefined;
  readonly #hidden = new Set<string>();

  constructor() {
    super();
    this.drawing.dataset.uiPart = "drawing";
  }

  /** Paint the chart into `context.svg`. Return what the opt-in parts and the keyboard need. */
  protected abstract draw(context: DrawContext): DrawResult | undefined;
  /** True when there is nothing to plot: the base shows the empty state instead of calling `draw`. */
  protected isEmpty(): boolean {
    return false;
  }
  /**
   * Runs once per connection, when the chart's SVG exists for the first time (it survives the
   * loading and empty states). Attach extra listeners to `svg` or `drawing` with `{ signal }`: they
   * are removed on disconnect, so a redraw, a state change or a reconnect never piles them up.
   */
  protected setup(_svg: SVGSVGElement, _signal: AbortSignal): void {}
  /** Runs on disconnect, after the setup signal aborted. */
  protected teardown(): void {}

  get locale(): string {
    return (
      this.getAttribute("locale") ||
      this.closest<HTMLElement>("[lang]")?.lang ||
      document.documentElement.lang ||
      navigator.language ||
      "en"
    );
  }
  get timeZone(): string | undefined {
    return this.getAttribute("time-zone") || undefined;
  }
  /** The snapshot of the current data, computed on first read and cached until the data changes. */
  get chartSnapshot(): ChartSnapshot | null {
    const source = this.#result?.snapshot;
    if (!source) return null;
    if (this.#snapshot?.revision !== this.#revision)
      this.#snapshot = {
        revision: this.#revision,
        value: typeof source === "function" ? source() : source,
      };
    return this.#snapshot.value;
  }
  /** What the parts show now: the hovered or focused mark, else the pinned one. */
  get hover(): HoverInfo | null {
    return this.#interact?.info() ?? null;
  }
  get selected(): number | null {
    return this.#interact?.selected() ?? null;
  }
  /** The canvas layer a chart asked for with `canvas()`, drawn under the SVG by PNG export. */
  get canvasLayer(): HTMLCanvasElement | undefined {
    return this.#canvasUsed ? this.#canvas : undefined;
  }
  /** Whether the user asked for less motion. */
  get reduced(): boolean {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  /** Rows the docked tooltip reserves space for. */
  get maxHoverRows(): number | undefined {
    return this.#result?.maxHoverRows;
  }
  get resolvedLabels(): Partial<ChartLabels> & typeof DEFAULT_LABELS {
    return { ...DEFAULT_LABELS, ...this.labels };
  }

  isHidden(id: string): boolean {
    return this.#hidden.has(id);
  }
  /** Hides or shows a series (at least one stays visible) and redraws. */
  toggleSeries(id: string): void {
    this.#withInteract((interact) => interact.toggleSeries(id));
  }
  /** Dims every series but `id` (`null` clears), by the `data-series` attribute of the marks. */
  highlight(id: string | null): void {
    this.#withInteract((interact) => interact.highlight(id));
  }
  claimTable(on: boolean): void {
    this.#claims = Math.max(0, this.#claims + (on ? 1 : -1));
    this.#syncTable();
  }
  exportSvgs(): SVGSVGElement[] {
    return this.#svg ? [this.#svg] : [];
  }

  /**
   * Selects (pins) mark `index`, or clears with `null`: its details stay shown while pointer and
   * keyboard hover elsewhere is idle, it gets `data-selected`, `chart-select` fires and the polite
   * live region announces it. The selection is by mark index and is dropped if the index is gone.
   * The first call loads the interaction chunk, so it takes effect a moment later (listen for
   * `chart-select`); after that it is synchronous.
   */
  select(index: number | null, source: HoverSource = "pointer"): void {
    this.#withInteract((interact) => interact.select(index, source));
  }
  /** Fires `chart-drill` for mark `index`: the chart's own cue to go one level deeper. */
  drill(index: number): void {
    this.#withInteract((interact) => interact.drill(index));
  }

  /**
   * Schedules a redraw. Call it after changing data; attribute changes call it for you. Redraws
   * asked for in the same frame run once. `"transient"` is for frames that change how the chart
   * looks but not what it says (a tween, a pan, a brush in progress): the snapshot is not rebuilt,
   * the revision stays, the table does not sync and no `chart-data` fires. `"size"` re-lays out.
   */
  requestDraw(kind: "data" | "size" | "transient" = "data"): void {
    if (kind !== "size") this.#naturalPasses = 0;
    if (kind === "data") this.#dirty = true;
    else if (kind === "transient") this.#transient = true;
    if (!this.#frame && this.isConnected)
      this.#frame = requestAnimationFrame(() =>
        formatter ? this.#run() : loadFormat().then(() => this.#frame && this.#run()),
      );
  }

  connectedCallback(): void {
    this.setAttribute(CHART_MARKER, "");
    adoptStyles(rootOf(this), css);
    this.prepend(this.drawing);
    this.drawing.style.touchAction =
      this.getAttribute("touch-action") ?? (this.constructor as typeof ChartElement).touchAction;
    for (const type of WAKE) this.drawing.addEventListener(type, this.#onWake);
    this.#syncFill();
    if (!this.#result) {
      try {
        const raw = this.getAttribute("initial-hidden");
        for (const id of this.initialHidden ?? JSON.parse(raw || "[]")) this.#hidden.add(`${id}`);
      } catch {}
    }
    if ((this.constructor as typeof ChartElement).themeAware || this.#themed) this.#watchTheme();
    this.#width = Math.floor(this.drawing.getBoundingClientRect().width);
    this.#observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      const fill = this.hasAttribute("data-fill");
      if (width === this.#width && (!fill || height === this.#measured)) return;
      this.#width = width;
      this.#measured = height;
      this.requestDraw("size");
    });
    this.#observer.observe(this.drawing);
    if (!formatter) loadFormat();
    this.requestDraw();
    emit(this, CHART_EVENT.ready);
  }

  disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#observer?.disconnect();
    this.#unwatch?.();
    this.#unwatch = undefined;
    for (const type of WAKE) this.drawing.removeEventListener(type, this.#onWake);
    this.#interact?.detach();
    this.#interact = undefined;
    this.#interactLoad = undefined;
    this.#wake = [];
    this.#setup?.abort();
    this.#setup = undefined;
    this.#dpr?.abort();
    this.#dpr = undefined;
    this.teardown();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "height") this.#syncFill();
    this.#naturalPasses = 0;
    this.requestDraw(name === "height" || name === "aspect-ratio" ? "size" : "data");
  }

  #syncFill(): void {
    this.toggleAttribute("data-fill", this.getAttribute("height") === "fill");
  }

  #height(width: number): number {
    const attr = this.getAttribute("height");
    if (attr === "fill") return this.#measured || FALLBACK_HEIGHT;
    const ratio = Number(this.getAttribute("aspect-ratio"));
    if (ratio > 0) return Math.max(1, Math.round(width / ratio));
    if (Number(attr) > 0) return Number(attr);
    const base = (this.constructor as typeof ChartElement).defaultHeight;
    return (
      this.#natural ||
      (typeof base === "function" ? (base as (e: ChartElement) => number)(this) : base) ||
      DEFAULT_HEIGHT
    );
  }

  /** Loading and empty: the previous result is gone, the SVG object is kept for the next `enter`. */
  #toState(kind: "loading" | "empty"): void {
    const drawing = this.drawing;
    // The same state again (a new size, a changed label): redraw the screen, announce nothing.
    if (this.#stateKind !== kind || this.#result) {
      const hadFocus = drawing.contains(document.activeElement);
      this.#result = undefined;
      this.#marks = [];
      this.#virtual = undefined;
      this.#stateKind = kind;
      this.#dirty = false;
      this.#revision++;
      this.#interact?.reset();
      this.#syncTable();
      emit(this, CHART_EVENT.data, null);
      // Focus on a mark that is about to go away stays in the chart: it moves to the frame.
      if (hadFocus) {
        drawing.tabIndex = -1;
        drawing.focus({ preventScroll: true });
      }
    }
    import("./chart-state.js").then(({ stateNode }) => {
      if (this.#stateKind !== kind || !this.isConnected) return;
      drawing.replaceChildren(
        stateNode(this, kind, this.labels[kind], this.getAttribute("skeleton") ?? "bars"),
      );
    });
  }

  /** Loads the shared theme observer on demand: only canvas or color-caching charts pay for it. */
  #watchTheme(): void {
    this.#themed = true;
    import("./chart-theme.js").then(({ watchTheme }) => {
      if (!this.isConnected || this.#unwatch) return;
      this.#unwatch = watchTheme(this, () => {
        this.#themeVersion++;
        this.requestDraw("transient");
      });
    });
  }

  #canvasContext(width: number, height: number): CanvasRenderingContext2D {
    this.#canvasUsed = true;
    if (!this.#themed) this.#watchTheme();
    this.#canvas ??= document.createElement("canvas");
    const canvas = this.#canvas;
    canvas.dataset.uiPart = "canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    const scale = devicePixelRatio || 1;
    // Assigning the size clears the bitmap.
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    if (!canvas.isConnected) this.drawing.prepend(canvas);
    this.#watchDpr();
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    return context;
  }

  /** A window dragged to a screen with another pixel ratio, or a browser zoom, redraws the canvas layer sharp. */
  #watchDpr(): void {
    if (this.#dpr) return;
    const stop = new AbortController();
    this.#dpr = stop;
    const arm = () => {
      matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener(
        "change",
        () => {
          if (stop.signal.aborted) return;
          this.requestDraw("size");
          arm();
        },
        { once: true, signal: stop.signal },
      );
    };
    arm();
  }

  #run(): void {
    this.#frame = 0;
    const fill = this.hasAttribute("data-fill");
    const height = this.#height(this.#width);
    if (!fill) this.drawing.style.height = `${height}px`;
    else this.drawing.style.removeProperty("height");
    const state = this.hasAttribute("loading")
      ? "loading"
      : this.hasAttribute("empty") || this.isEmpty()
        ? "empty"
        : null;
    if (state) {
      this.#toState(state);
      return;
    }
    const width = this.#width;
    if (!width || !height) return;
    const drawing = this.drawing;
    // From here until the new marks are in place, focus and blur events mean nothing.
    this.#busy = true;
    const active = document.activeElement;
    const hadFocus = !!active && drawing.contains(active);
    let focused = hadFocus ? this.#indexOf(active) : -1;
    const transient = this.#transient;
    this.#transient = false;
    const phase: DrawPhase = !this.#result
      ? "enter"
      : this.#dirty || transient
        ? "update"
        : "resize";
    this.#svg ??= svg("svg");
    const root = this.#svg;
    if (phase === "enter" || !(this.#retain || (this.constructor as typeof ChartElement).retain))
      root.replaceChildren();
    root.setAttribute("width", `${width}`);
    root.setAttribute("height", `${height}`);
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const palette = this.palette ?? this.#attrPalette();
    const preset = this.getAttribute("value-format");
    const format = (formatter as typeof resolveFormat)(
      this.valueFormat ?? (preset && PRESETS.has(preset) ? (preset as ValueFormat) : undefined),
      { locale: this.locale, currency: this.getAttribute("currency") || undefined },
    );
    this.#canvasUsed = false;
    this.#stateKind = undefined;
    const motion = this.getAttribute("animate") !== "off" && !this.reduced;
    const result = this.draw({
      svg: root,
      width,
      height,
      phase,
      previous: this.#result,
      locale: this.locale,
      timeZone: this.timeZone,
      format,
      animate: phase === "enter" && motion,
      motion,
      transient,
      themeVersion: this.#themeVersion,
      hover: this.#interact?.info()?.index ?? null,
      color: (index, override) =>
        override ?? palette?.[index % palette.length] ?? seriesColor(index),
      retain: () => {
        this.#retain = true;
      },
      canvas: () => this.#canvasContext(width, height),
    });
    if (!this.#canvasUsed) this.#canvas?.remove();
    const dataChanged = this.#dirty || phase === "enter";
    if (dataChanged) this.#revision++;
    const previous = this.#result;
    this.#result = result;
    const remap = this.#remapper(previous, result);
    if (remap) {
      this.#active = remap(this.#active);
      if (focused >= 0) focused = remap(focused);
    }
    this.#settleNatural(result?.naturalHeight, height);
    this.#mount(root, result);
    if (!this.#setup) {
      this.#setup = new AbortController();
      this.setup(root, this.#setup.signal);
    }
    if (hadFocus && !drawing.contains(document.activeElement))
      this.#interact?.restoreFocus(focused);
    this.#busy = false;
    if (remap) this.#interact?.remap(remap);
    this.#interact?.refresh();
    if (dataChanged) {
      this.#dirty = false;
      this.#syncTable();
      emit(this, CHART_EVENT.data, { revision: this.#revision });
    }
  }

  /** Adopts `DrawResult.naturalHeight` and re-lays out; two passes in a row at most, so it cannot loop. */
  #settleNatural(wanted: number | undefined, height: number): void {
    const fixed = this.hasAttribute("height") || this.hasAttribute("aspect-ratio");
    this.#natural = fixed ? 0 : Math.round(wanted || 0);
    if (this.#natural && this.#natural !== height && this.#naturalPasses++ < 2)
      this.requestDraw("size");
  }

  /** Old mark index to new mark index by `markKey`, or undefined when either draw has no keys. */
  #remapper(a: DrawResult | undefined, b: DrawResult | undefined) {
    if (!a?.markKey || !b?.markKey) return undefined;
    const marks = b.marks;
    const count = !marks ? 0 : isVirtual(marks) ? marks.count : marks.length;
    const at = new Map(Array.from({ length: count }, (_, i) => [b.markKey?.(i), i]));
    return (i: number) => at.get(a.markKey?.(i)) ?? i;
  }

  #attrPalette(): string[] | undefined {
    const list = this.getAttribute("palette")
      ?.split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return list?.length ? list : undefined;
  }

  /** Puts the svg in the drawing, and sets name, description and the roving tab stop over the marks. */
  #mount(root: SVGSVGElement, result: DrawResult | undefined): void {
    const drawing = this.drawing;
    const marks = result?.marks;
    const labels = this.resolvedLabels;
    this.#virtual = isVirtual(marks) ? marks : undefined;
    this.#marks = marks && !isVirtual(marks) ? marks : [];
    const count = this.#count();
    const label = this.getAttribute("label") || result?.label || labels.chart;
    const summary = this.getAttribute("description") || result?.summary;
    if (root.parentNode !== drawing) {
      drawing.replaceChildren(...(this.#canvas?.isConnected ? [this.#canvas] : []), root);
    }
    root.setAttribute("aria-label", label);
    root.setAttribute("role", count ? "group" : "img");
    root.setAttribute("aria-roledescription", labels.roledescription);
    if (summary) {
      this.#description ??= document.createElement("p");
      this.#description.style.cssText = SR_ONLY;
      this.#description.id ||= uid("chart-desc");
      this.#description.textContent = summary;
      drawing.append(this.#description);
      root.setAttribute("aria-describedby", this.#description.id);
    } else {
      this.#description?.remove();
      root.removeAttribute("aria-describedby");
    }
    this.#active = Math.min(this.#active, Math.max(0, count - 1));
    if (this.#virtual) {
      this.#proxy ??= document.createElement("div");
      const proxy = this.#proxy;
      proxy.dataset.uiPart = "proxy";
      proxy.style.cssText = SR_ONLY;
      proxy.setAttribute("role", "listbox");
      proxy.tabIndex = 0;
      proxy.setAttribute("aria-label", label);
      drawing.append(proxy);
    } else {
      this.#proxy?.remove();
      this.#marks.forEach((mark, index) => {
        mark.el.setAttribute("role", "img");
        mark.el.setAttribute("aria-label", mark.label);
        mark.el.setAttribute("tabindex", index === this.#active ? "0" : "-1");
      });
    }
  }

  /** The screen-reader table lives in its own chunk, with the debounce that builds it. */
  #syncTable(): void {
    const on =
      !!this.#result && !this.#claims && this.tableFallback && this.getAttribute("table") !== "off";
    if (!on && !this.#tableLoaded) return;
    this.#tableLoaded = true;
    import("./chart-table.js").then(({ syncFallback }) => syncFallback(this, on, this.labels.more));
  }

  // ---- marks -------------------------------------------------------------------------------------

  #count(): number {
    return this.#virtual ? this.#virtual.count : this.#marks.length;
  }
  #markEl(index: number): Element | null {
    return this.#virtual
      ? (this.#virtual.element?.(index) ?? null)
      : (this.#marks[index]?.el ?? null);
  }
  #indexOf(element: Element | null): number {
    if (element && element === this.#proxy) return this.#active;
    return this.#marks.findIndex((mark) => mark.el === element);
  }

  // ---- the interaction chunk ------------------------------------------------------------------

  readonly #api: InteractApi = ((self) => ({
    host: self,
    drawing: self.drawing,
    svg: () => self.#svg,
    result: () => self.#result,
    size: (): [number, number] => [
      self.#svg?.viewBox.baseVal.width ?? 0,
      self.#svg?.viewBox.baseVal.height ?? 0,
    ],
    count: () => self.#count(),
    hidden: self.#hidden,
    redraw: () => self.requestDraw(),
    markEl: (index: number) => self.#markEl(index),
    indexOf: (element: Element | null) => self.#indexOf(element),
    virtual: () => self.#virtual,
    proxy: () => (self.#virtual ? self.#proxy : undefined),
    get active() {
      return self.#active;
    },
    set active(value: number) {
      self.#active = value;
    },
    busy: () => self.#busy,
  }))(this);

  readonly #onWake = (event: Event) => {
    this.#wake.push(event);
    this.#withInteract();
  };

  /** Loads the interaction chunk once, wires it to this chart and replays what it missed. */
  #withInteract(use?: (interact: Interact) => void): void {
    if (this.#interact) {
      use?.(this.#interact);
      return;
    }
    if (!this.#interactLoad) {
      const load: Promise<Interact | undefined> = import("./chart-interact.js").then(
        ({ attach }) => {
          if (!this.isConnected || this.#interactLoad !== load) return undefined;
          for (const type of WAKE) this.drawing.removeEventListener(type, this.#onWake);
          this.#interact = attach(this.#api);
          for (const event of this.#wake.splice(0)) this.#interact.replay(event);
          return this.#interact;
        },
      );
      this.#interactLoad = load;
    }
    this.#interactLoad.then((interact) => interact && use?.(interact));
  }
}
