import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import type { IndexBrush } from "@jcsoftdev/ui-core/chart/brush";
import { calendarFor } from "@jcsoftdev/ui-core/chart/calendar";
import { lttbIndices } from "@jcsoftdev/ui-core/chart/downsample";
import { DIRECTION_COLORS } from "@jcsoftdev/ui-core/chart/palette";
import { attachPanZoom, type PanZoom, type PanZoomView } from "@jcsoftdev/ui-core/chart/pan-zoom";
import { linearScale } from "@jcsoftdev/ui-core/chart/scale";
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
  type HoverContent,
  type HoverInfo,
  join,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import { upgradeProperties } from "../internal/e10.js";
import {
  appendBars,
  type IndicatorSeries,
  indexAtTime,
  isCandleLike,
  type OscillatorModel,
  type OverlayLine,
  rebaseFrom,
  type StockAnchor,
  type StockBar,
  type StockComparison,
  type StockDrawing,
  type StockFlag,
  type StockOscillator,
  type StockOverlay,
  type StockSeriesType,
  type StockTool,
  sameDay,
} from "../internal/e23-stock.js";
import type { BarPaint, Column } from "../internal/e23-stock-canvas.js";
import type { DrawingGeometry } from "../internal/e23-stock-drawings.js";
import { isMidnight, toWallDate } from "../internal/e23-wall.js";
import css from "./stock.css.js";
import type * as SnapshotModule from "./stock-snapshot.js";
import type { SnapshotInput } from "./stock-snapshot.js";

export type {
  StockBar,
  StockComparison,
  StockDrawing,
  StockFlag,
  StockOscillator,
  StockOverlay,
  StockSeriesType,
  StockTool,
} from "../internal/e23-stock.js";
/** A bar as authors give it: the date may be a `Date`, a timestamp or an ISO string. */
export interface StockInputBar extends Omit<StockBar, "date"> {
  date: Date | number | string;
}

export interface StockTexts {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  price: string;
  date: string;
  bars: string;
  days: string;
  navigator: string;
  /** Read after the chart name: how to move, zoom and draw with the keyboard. */
  keyboardHint: string;
  /** Toolbar (optional; the defaults are English): group names and button labels. */
  ranges?: string;
  seriesTypes?: string;
  seriesTypeNames?: Partial<Record<StockSeriesType, string>>;
  tools?: string;
  toolNames?: Partial<Record<StockTool, string>>;
  deleteDrawing?: string;
  /** Names of the range presets by id (`1w`, `1m`, ... `all`). */
  rangeNames?: Record<string, string>;
}

const DEFAULT_TEXTS: StockTexts = {
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
  price: "Price",
  date: "Date",
  bars: "bars",
  days: "days",
  navigator: "Visible range",
  keyboardHint:
    "Left and right move between bars, plus and minus zoom, Page up and Page down pan, Delete removes the selected drawing.",
};

const TOP = 10;
const AXIS_HEIGHT = 22;
const NAV_HEIGHT = 36;
const NAV_GAP = 12;
const MIN_BARS = 8;
const SVG_BARS_MAX = 700;
const DAY = 86_400_000;
const ZOOM_STEP = 1.25;
const percentFormats = new Map<string, Intl.NumberFormat>();
/** A fraction as a percent in `locale` (the full number formatter would be a chunk of its own). */
function formatPercent(
  value: number,
  { locale, decimals }: { locale: string; decimals: number },
): string {
  const key = `${locale}|${decimals}`;
  let format = percentFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: decimals });
    percentFormats.set(key, format);
  }
  return format.format(value);
}

const IDENTITY: PanZoomView = { k: 1, x: 0, y: 0 };
const TYPES = new Set<StockSeriesType>([
  "candle",
  "ohlc",
  "line",
  "area",
  "column",
  "heikin-ashi",
  "renko",
]);
const TOOLS = new Set<StockTool>(["cursor", "trend", "horizontal", "range", "fib", "measure"]);

type ExtrasModule = typeof import("./stock-extras.js");
type CanvasModule = typeof import("../internal/e23-stock-canvas.js");
type DrawingsModule = typeof import("../internal/e23-stock-drawings.js");

let counter = 0;
const newDrawingId = () => `d${Date.now().toString(36)}${++counter}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** `"1m"`, `"6m"`, `"1y"`, `"2w"`, `"30d"` to days; `"ytd"` and `"all"` are handled by the caller. */
function rangeDays(range: string): number | null {
  const match = /^(\d+)([dwmy])$/.exec(range);
  if (!match) return null;
  const n = Number(match[1]);
  return n * ({ d: 1, w: 7, m: 30.4, y: 365 }[match[2] as "d"] as number);
}

function normalize(data: readonly StockInputBar[], timeZone: string | undefined): StockBar[] {
  return data.map((bar) => ({ ...bar, date: toWallDate(bar.date, timeZone) }));
}

interface Model {
  key: string;
  bars: StockBar[];
  times: number[];
}

interface Layout {
  n: number;
  lo: number;
  hi: number;
  step: number;
  innerW: number;
  start: number;
  span: number;
  plotBottom: number;
  priceBottom: number;
  navTop: number;
  navW: number;
  y: (price: number) => number;
  invert: (pixel: number) => number;
  percent: boolean;
  closeAt: (index: number) => number;
  /** Formats a price (a fraction in percent mode) in the chart's locale and currency. */
  price: (value: number) => string;
}

interface Parts {
  clip: SVGRectElement;
  plot: SVGGElement;
  grid: SVGGElement;
  volume: SVGGElement;
  bars: SVGGElement;
  shape: SVGGElement;
  overlays: SVGGElement;
  osc: SVGGElement;
  flags: SVGGElement;
  last: SVGGElement;
  drawings: SVGGElement;
  axis: SVGGElement;
  nav: SVGGElement;
  track: SVGRectElement;
  cross: SVGGElement;
  vline: SVGLineElement;
  hline: SVGLineElement;
  dot: SVGCircleElement;
  priceTag: SVGGElement;
  dateTag: SVGGElement;
}

interface Draft {
  tool: StockTool;
  a: StockAnchor;
  b: StockAnchor;
  moved: boolean;
}

/**
 * `<ui-stock>`: a price chart. Candles, OHLC, line, area, column, Heikin-Ashi and Renko, a volume
 * strip, SMA/EMA/Bollinger/VWAP overlays, an RSI or MACD pane, comparison lines in percent mode,
 * event flags, a last-price tag, a crosshair and a navigator that shows the visible range. Drag
 * pans, Ctrl+wheel or a pinch zooms, `+`/`-` zoom from the keyboard. Series longer than 700 visible
 * bars paint on the canvas layer, merged per pixel, and line series are downsampled (LTTB), so a
 * hundred thousand bars stay smooth. Drawing tools (trend line, horizontal line, range, Fibonacci,
 * ruler) are armed with the `tool` attribute.
 * Attributes: `series-type`, `renko-brick-size`, `range` (`1w`, `1m`, `3m`, `6m`, `1y`, `ytd`,
 * `all`), `tool`, `volume="off"`, `navigator="off"`, `last-price="off"`, `grid="off"`, `name`,
 * `max-bars`, `oscillator` (`rsi`, `macd`), plus the chart attributes. Properties: `data`,
 * `overlays`, `oscillator`, `comparisons`, `flags`, `drawings`, `texts`, `window`, and the
 * `pushBars(bars)` method for live data. Events: `stock-window`, `stock-drawings`, `stock-tool`,
 * `stock-select`.
 * Toolbar (a lazy part, on unless `toolbar="off"`): range presets (`ranges`), series types
 * (`series-types`) and drawing tools (`tools`, none unless set; `all` offers every one).
 * Indicators, the oscillator pane, Heikin-Ashi/Renko and flags are lazy chunks too. The maths is
 * in `@jcsoftdev/ui-core/chart/indicators`.
 * Tab order: the navigator slider lives inside the SVG and the base appends the bars' listbox
 * after the SVG, so the slider is the first tab stop and the bars the second; `navigator="off"`
 * leaves only the bars.
 */
export class UiStock extends ChartElement {
  static override retain = true;
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "series-type",
    "renko-brick-size",
    "range",
    "tool",
    "volume",
    "navigator",
    "last-price",
    "grid",
    "name",
    "max-bars",
    "oscillator",
    "toolbar",
    "ranges",
    "series-types",
    "tools",
  ];

  #data: StockBar[] = [];
  #overlays: readonly StockOverlay[] = [];
  #oscillator: StockOscillator | null | undefined;
  #comparisons: readonly StockComparison[] = [];
  #flags: readonly StockFlag[] = [];
  #drawings: readonly StockDrawing[] = [];
  #texts: Partial<StockTexts> = {};
  #rev = 0;
  #model: Model | undefined;
  #lines: { key: string; overlays: readonly StockOverlay[]; value: OverlayLine[] } | undefined;
  #oscModel: { key: string; value: OscillatorModel } | undefined;
  #start = 0;
  #span = 0;
  #lastN = 0;
  #reset = true;
  #layout: Layout | undefined;
  #parts: Parts | undefined;
  #signal: AbortSignal | undefined;
  #panZoom: PanZoom | undefined;
  #brush: IndexBrush | undefined;
  #brushLoading = false;
  #navTrack: Element | undefined;
  #navOptions:
    | Parameters<typeof import("@jcsoftdev/ui-core/chart/brush").attachIndexBrush>[1]
    | undefined;
  #snapshotModule: typeof SnapshotModule | undefined;
  #snapshotLoading = false;
  #snapshotStale = false;
  #resetting = false;
  #navDrag = false;
  #gesture: "none" | "tool" | "drawing" = "none";
  #draft: Draft | null = null;
  #measure: { a: StockAnchor; b: StockAnchor } | null = null;
  #selectedDrawing: string | null = null;
  #canvasMod: CanvasModule | undefined;
  #drawingsMod: DrawingsModule | undefined;
  #extras: ExtrasModule | undefined;
  #extrasLoading = false;
  #toolbar: { element: HTMLElement; update(): void } | undefined;
  #toolbarLoading = false;
  #emitted = "";
  /** The series colours of the last draw: one source for the plot, the tooltip and the table. */
  #color: DrawContext["color"] = (_index, override) => override ?? "var(--chart-cat-1)";
  #autoHeight = false;
  #fmtTick: Intl.DateTimeFormat | undefined;
  #fmtKey = "";
  readonly #clip = uid("stock");

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      const layout = this.#layout;
      this.#placeCrosshair(info && layout ? layout.lo + info.index : null);
    });
  }

  get data(): readonly StockBar[] {
    return this.#data;
  }
  set data(value: readonly StockInputBar[] | null | undefined) {
    const next = normalize(value ?? [], this.timeZone);
    const old = this.#data;
    const same =
      old.length > 0 &&
      next.length >= old.length &&
      +(old[0] as StockBar).date === +(next[0] as StockBar).date;
    if (!same) this.#reset = true;
    this.#data = next;
    this.#changed();
  }
  get overlays(): readonly StockOverlay[] {
    return this.#overlays;
  }
  set overlays(value: readonly StockOverlay[]) {
    this.#overlays = value ?? [];
    this.#changed();
  }
  get oscillator(): StockOscillator | null {
    if (this.#oscillator !== undefined) return this.#oscillator;
    const own = this.getAttribute("oscillator");
    return own === "rsi" || own === "macd" ? { type: own } : null;
  }
  set oscillator(value: StockOscillator | null) {
    this.#oscillator = value;
    this.#changed();
  }
  get comparisons(): readonly StockComparison[] {
    return this.#comparisons;
  }
  set comparisons(value: readonly StockComparison[]) {
    this.#comparisons = value ?? [];
    this.#changed();
  }
  get flags(): readonly StockFlag[] {
    return this.#flags;
  }
  set flags(value: readonly StockFlag[]) {
    this.#flags = value ?? [];
    this.requestDraw();
  }
  /** Drawings the reader made (or the author gave); `stock-drawings` fires on every user change. */
  get drawings(): readonly StockDrawing[] {
    return this.#drawings;
  }
  set drawings(value: readonly StockDrawing[]) {
    this.#drawings = value ?? [];
    if (this.#drawings.length) this.#loadDrawings();
    this.requestDraw("transient");
  }
  get texts(): Partial<StockTexts> {
    return this.#texts;
  }
  set texts(value: Partial<StockTexts>) {
    this.#texts = value ?? {};
    this.requestDraw();
  }
  /** The visible bars as inclusive indices of `data` (the transformed series for Renko). */
  get window(): { start: number; end: number } {
    return {
      start: Math.round(this.#start),
      end: Math.max(0, Math.round(this.#start + this.#span) - 1),
    };
  }
  set window(value: { start: number; end: number }) {
    this.#start = value.start;
    this.#span = value.end - value.start + 1;
    this.#reset = false;
    this.requestDraw("transient");
  }
  get tool(): StockTool {
    const own = this.getAttribute("tool") as StockTool | null;
    return own && TOOLS.has(own) ? own : "cursor";
  }
  set tool(value: StockTool) {
    this.setAttribute("tool", value);
  }
  get seriesType(): StockSeriesType {
    const own = this.getAttribute("series-type") as StockSeriesType | null;
    return own && TYPES.has(own) ? own : "candle";
  }
  set seriesType(value: StockSeriesType) {
    this.setAttribute("series-type", value);
  }

  /** Adds live bars: a bar with the last date replaces it, a newer one is appended. */
  pushBars(incoming: StockInputBar | readonly StockInputBar[]): void {
    const list = ("date" in incoming ? [incoming] : incoming) as readonly StockInputBar[];
    const max = Number(this.getAttribute("max-bars")) || Number.POSITIVE_INFINITY;
    this.#data = appendBars(this.#data, normalize(list, this.timeZone), max);
    this.#changed();
  }

  override connectedCallback(): void {
    this.dataset.ui = "stock";
    adoptStyles(rootOf(this), css);
    upgradeProperties(this, [
      "data",
      "overlays",
      "oscillator",
      "comparisons",
      "flags",
      "drawings",
      "texts",
      "window",
    ]);
    if (!this.hasAttribute("height")) {
      this.#autoHeight = true;
      this.setAttribute("height", this.getAttribute("navigator") === "off" ? "420" : "476");
    }
    super.connectedCallback();
    this.#syncToolbar();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "series-type" || name === "renko-brick-size") {
      this.#rev++;
      this.#reset = true;
    }
    if (name === "range") this.#reset = true;
    if (name === "tool") {
      this.#cancelDraft();
      if (this.tool !== "cursor") this.#loadDrawings();
    }
    if (name === "navigator" && this.#autoHeight)
      this.setAttribute("height", this.getAttribute("navigator") === "off" ? "420" : "476");
    super.attributeChangedCallback(name);
    if (
      this.isConnected &&
      ["toolbar", "ranges", "series-types", "tools", "range", "series-type", "tool"].includes(name)
    )
      this.#syncToolbar();
  }

  protected override isEmpty(): boolean {
    return this.#data.length === 0;
  }

  /** The canvas painter and the drawing tools are chunks: fetched the first time a chart needs them. */
  get #toolbarOn(): boolean {
    return !["off", "false"].includes(this.getAttribute("toolbar") ?? "");
  }

  /** The toolbar (ranges, series types, tools) is on unless `toolbar="off"`; its code loads on demand. */
  #syncToolbar(): void {
    const toolbar = this.#toolbar;
    if (!this.#toolbarOn) {
      toolbar?.element.remove();
      return;
    }
    if (toolbar) {
      if (this.firstChild !== toolbar.element) this.prepend(toolbar.element);
      toolbar.update();
      return;
    }
    if (this.#toolbarLoading) return;
    this.#toolbarLoading = true;
    import("./stock-toolbar.js").then(({ mountStockToolbar }) => {
      this.#toolbarLoading = false;
      if (this.#toolbar || !this.#toolbarOn) return;
      this.#toolbar = mountStockToolbar(this);
      if (this.isConnected) this.prepend(this.#toolbar.element);
    });
  }

  /** Indicators, the oscillator pane, Heikin-Ashi/Renko and flags load on demand. */
  #loadExtras(): void {
    if (this.#extras || this.#extrasLoading) return;
    const type = this.seriesType;
    const wanted =
      this.#overlays.length > 0 ||
      this.oscillator != null ||
      this.#flags.length > 0 ||
      type === "heikin-ashi" ||
      type === "renko";
    if (!wanted) return;
    this.#extrasLoading = true;
    import("./stock-extras.js").then((module) => {
      this.#extras = module;
      adoptStyles(rootOf(this), module.styles);
      this.#rev++;
      this.#reset = true;
      this.requestDraw("data");
    });
  }

  #loadCanvas(): void {
    if (this.#canvasMod) return;
    import("../internal/e23-stock-canvas.js").then((module) => {
      this.#canvasMod = module;
      this.requestDraw("transient");
    });
  }

  #loadDrawings(): void {
    if (this.#drawingsMod) return;
    import("../internal/e23-stock-drawings.js").then((module) => {
      this.#drawingsMod = module;
      adoptStyles(rootOf(this), module.styles);
      this.requestDraw("transient");
    });
  }

  #t(): StockTexts {
    return { ...DEFAULT_TEXTS, ...this.#texts };
  }

  #changed(): void {
    this.#rev++;
    this.requestDraw();
  }

  // ---- model -----------------------------------------------------------------------------------

  #series(): Model {
    const type = this.seriesType;
    const brick = Number(this.getAttribute("renko-brick-size")) || undefined;
    const key = `${this.#rev}|${type}|${brick}|${this.#extras ? 1 : 0}`;
    if (this.#model?.key === key) return this.#model;
    const extras = this.#extras;
    // Until the transforms load, the raw bars are drawn (the chunk is fetched on first need).
    const bars =
      extras && type === "heikin-ashi"
        ? extras.heikinAshi(this.#data)
        : extras && type === "renko"
          ? extras.renko(this.#data, brick)
          : this.#data;
    this.#model = { key, bars, times: bars.map((bar) => +bar.date) };
    return this.#model;
  }

  #applyRange(model: Model): void {
    const n = model.bars.length;
    const range = this.getAttribute("range") ?? "all";
    let from = 0;
    const last = model.times[n - 1] ?? 0;
    if (range === "ytd") {
      const zone = this.timeZone;
      const calendar = calendarFor(zone);
      const year = String(calendar.year(calendar.wall(last))).padStart(4, "0");
      from = indexAtTime(model.times, +toWallDate(`${year}-01-01`, zone));
    } else {
      const days = rangeDays(range);
      if (days != null) from = indexAtTime(model.times, last - days * DAY);
    }
    from = clamp(Math.floor(from), 0, Math.max(0, n - MIN_BARS));
    this.#start = from;
    this.#span = n - from;
  }

  /** Keeps the window across appends (following the tail) and resets it on new data or a new view. */
  #reconcile(model: Model): void {
    const n = model.bars.length;
    if (this.#reset || this.#span <= 0) {
      this.#applyRange(model);
      this.#reset = false;
    } else if (
      n !== this.#lastN &&
      this.#lastN > 0 &&
      this.#start + this.#span >= this.#lastN - 0.5
    ) {
      this.#start += n - this.#lastN;
    }
    this.#lastN = n;
    this.#span = clamp(this.#span, Math.min(MIN_BARS, n), Math.max(1, n));
    this.#start = clamp(this.#start, 0, Math.max(0, n - this.#span));
  }

  #overlayLines(model: Model, vwapFrom: number): OverlayLine[] {
    const hasVwap = this.#overlays.some((overlay) => overlay.type === "vwap");
    const key = `${model.key}|${hasVwap ? vwapFrom : 0}`;
    if (this.#lines?.key !== key || this.#lines.overlays !== this.#overlays)
      this.#lines = {
        key,
        overlays: this.#overlays,
        value: this.#extras?.overlayLines(model.bars, this.#overlays, vwapFrom) ?? [],
      };
    return this.#lines.value;
  }

  #oscillatorOf(model: Model): OscillatorModel | null {
    const config = this.oscillator;
    if (!config || !this.#extras) return null;
    const key = `${model.key}|${JSON.stringify(config)}`;
    if (this.#oscModel?.key !== key)
      this.#oscModel = { key, value: this.#extras.oscillatorModel(model.bars, config) };
    return this.#oscModel.value;
  }

  // ---- interaction -----------------------------------------------------------------------------

  /**
   * The data table is built by a lazy module, fetched when the table is first read or just after
   * the first paint. Until it lands the table holds the title only; arrival refreshes it.
   */
  #snapshotFor(input: SnapshotInput): ChartSnapshot {
    if (this.#snapshotModule) return this.#snapshotModule.snapshotOf(input);
    this.#loadSnapshot();
    this.#snapshotStale = true;
    return { title: input.name, categoryHeader: "", categories: [], series: [] };
  }

  #loadSnapshot(): void {
    if (this.#snapshotModule || this.#snapshotLoading) return;
    this.#snapshotLoading = true;
    import("./stock-snapshot.js").then((module) => {
      this.#snapshotModule = module;
      if (!this.#snapshotStale) return;
      this.#snapshotStale = false;
      this.requestDraw("data");
    });
  }

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    // Fetch the data-table module once the first frame is out, off the paint path.
    (globalThis.requestIdleCallback ?? setTimeout)(() => this.#loadSnapshot());
    this.#signal = signal;
    const drawing = this.drawing;
    const opts = { signal };
    this.#panZoom = attachPanZoom(drawing, {
      minZoom: 0.01,
      maxZoom: 100,
      keyboard: false,
      wheel: "modifier",
      onChange: (view) => this.#onPanZoom(view),
    });
    signal.addEventListener("abort", () => {
      this.#panZoom?.destroy();
      this.#brush?.destroy();
    });
    root.addEventListener("pointerdown", (event) => this.#onDown(event, root), opts);
    // Registered after the pan-zoom's listeners, so `wasDrag()` is current when pointerup runs.
    drawing.addEventListener("pointermove", (event) => this.#onMove(event, root), opts);
    const end = (event: PointerEvent) => this.#onUp(event);
    drawing.addEventListener("pointerup", end, opts);
    drawing.addEventListener("pointercancel", end, opts);
    drawing.addEventListener("keydown", (event) => this.#onKey(event), opts);
  }

  protected override teardown(): void {
    this.#panZoom = undefined;
    this.#brush = undefined;
    this.#parts = undefined;
    this.#signal = undefined;
  }

  #local(event: PointerEvent, root: SVGSVGElement): { x: number; y: number } {
    const box = root.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  #geometry(): DrawingGeometry | null {
    const layout = this.#layout;
    const model = this.#model;
    if (!layout || !model || layout.percent) return null;
    return {
      times: model.times,
      from: layout.start,
      x0: 0.5 * layout.step,
      step: layout.step,
      innerWidth: layout.innerW,
      priceHeight: layout.priceBottom,
      y: layout.y,
      invert: layout.invert,
    };
  }

  #onPanZoom(view: PanZoomView): void {
    if (this.#resetting) return;
    this.#resetting = true;
    this.#panZoom?.setView(IDENTITY, { user: false });
    this.#resetting = false;
    const layout = this.#layout;
    if (!layout || this.#navDrag || this.#gesture !== "none") return;
    const n = layout.n;
    if (view.k !== 1) {
      const px = clamp(view.x / (1 - view.k), 0, layout.innerW);
      const span = clamp(this.#span / view.k, Math.min(MIN_BARS, n), n);
      const anchor = this.#start + px / layout.step;
      this.#setWindow(anchor - (px / layout.innerW) * span, span);
      return;
    }
    if (view.x !== 0) this.#setWindow(this.#start - view.x / layout.step, this.#span);
  }

  #setWindow(start: number, span: number): void {
    const n = this.#layout?.n ?? this.#data.length;
    this.#span = clamp(span, Math.min(MIN_BARS, n), Math.max(1, n));
    this.#start = clamp(start, 0, Math.max(0, n - this.#span));
    this.requestDraw("transient");
  }

  #onDown(event: PointerEvent, root: SVGSVGElement): void {
    if (event.button !== 0) return;
    const layout = this.#layout;
    if (!layout) return;
    const target = event.target as Element;
    if (target.closest("[data-track]")) {
      this.#navDrag = true;
      return;
    }
    const point = this.#local(event, root);
    if (point.y > layout.priceBottom) return;
    const geometry = this.#geometry();
    const mod = this.#drawingsMod;
    if (!geometry || !mod) return;
    const tool = this.tool;
    if (tool !== "cursor") {
      event.preventDefault();
      this.#gesture = "tool";
      const a = mod.anchorAt(geometry, point.x, point.y);
      if (tool === "horizontal") {
        this.#commitDrawing({ id: newDrawingId(), type: "horizontal", price: a.price });
        return;
      }
      this.#measure = null;
      this.#draft = { tool, a, b: a, moved: false };
      return;
    }
    const hit = mod.hitDrawing(this.#drawings, geometry, point);
    if (hit) {
      event.preventDefault();
      this.#gesture = "drawing";
      this.#select(hit);
      this.requestDraw("transient");
    } else if (this.#selectedDrawing) {
      this.#select(null);
      this.requestDraw("transient");
    }
  }

  #onMove(event: PointerEvent, root: SVGSVGElement): void {
    const draft = this.#draft;
    const geometry = this.#geometry();
    const mod = this.#drawingsMod;
    if (!draft || !geometry || !mod) return;
    const point = this.#local(event, root);
    draft.b = mod.anchorAt(geometry, point.x, point.y);
    const a = { x: point.x, y: point.y };
    draft.moved ||=
      Math.hypot(a.x - this.#xOf(draft.a, geometry), a.y - geometry.y(draft.a.price)) >= 4;
    this.requestDraw("transient");
  }

  #xOf(anchor: StockAnchor, geometry: DrawingGeometry): number {
    return geometry.x0 + (indexAtTime(geometry.times, anchor.time) - geometry.from) * geometry.step;
  }

  #onUp(event: PointerEvent): void {
    const draft = this.#draft;
    const gesture = this.#gesture;
    this.#navDrag = false;
    this.#gesture = "none";
    // A pan, a drawing or a navigator drag is the gesture's own: it must not select a bar.
    if (gesture !== "none" || this.#panZoom?.wasDrag()) event.preventDefault();
    if (!draft) return;
    this.#draft = null;
    if (event.type === "pointercancel" || !draft.moved) {
      this.requestDraw("transient");
      return;
    }
    if (draft.tool === "measure") {
      this.#measure = { a: draft.a, b: draft.b };
      this.#toolDone();
      this.requestDraw("transient");
      return;
    }
    if (draft.tool === "trend" || draft.tool === "range" || draft.tool === "fib")
      this.#commitDrawing({ id: newDrawingId(), type: draft.tool, a: draft.a, b: draft.b });
  }

  #commitDrawing(drawing: StockDrawing): void {
    this.#drawings = [...this.#drawings, drawing];
    this.#select(drawing.id);
    emit(this, "stock-drawings", { drawings: this.#drawings });
    this.#toolDone();
    this.requestDraw("transient");
  }

  #toolDone(): void {
    this.setAttribute("tool", "cursor");
    emit(this, "stock-tool", { tool: "cursor" });
  }

  #select(id: string | null): void {
    if (this.#selectedDrawing === id) return;
    this.#selectedDrawing = id;
    emit(this, "stock-select", { id });
  }

  /** Id of the selected drawing, or `null`. */
  get selectedDrawing(): string | null {
    return this.#selectedDrawing;
  }

  /** Removes the selected drawing (the Delete key does the same). */
  removeSelectedDrawing(): void {
    const id = this.#selectedDrawing;
    if (id == null) return;
    this.#drawings = this.#drawings.filter((drawing) => drawing.id !== id);
    this.#select(null);
    emit(this, "stock-drawings", { drawings: this.#drawings });
    this.requestDraw("transient");
  }

  /** The texts in use: the defaults with the `texts` property on top. */
  get resolvedTexts(): StockTexts {
    return this.#t();
  }

  #cancelDraft(): void {
    this.#draft = null;
    this.#gesture = "none";
  }

  #onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!(event.target as Element).matches('[data-ui-part="proxy"]')) return;
    const layout = this.#layout;
    if (!layout) return;
    const key = event.key;
    if (key === "+" || key === "=" || key === "-" || key === "_") {
      event.preventDefault();
      const factor = key === "+" || key === "=" ? 1 / ZOOM_STEP : ZOOM_STEP;
      const span = clamp(this.#span * factor, Math.min(MIN_BARS, layout.n), layout.n);
      this.#setWindow(this.#start + (this.#span - span) / 2, span);
    } else if (key === "PageUp" || key === "PageDown") {
      event.preventDefault();
      this.#setWindow(this.#start + (key === "PageUp" ? -1 : 1) * this.#span * 0.8, this.#span);
    } else if (key === "Delete" && this.#selectedDrawing) {
      event.preventDefault();
      this.removeSelectedDrawing();
    } else if (key === "Escape" && (this.#draft || this.#measure || this.#selectedDrawing)) {
      this.#cancelDraft();
      this.#measure = null;
      this.#select(null);
      this.requestDraw("transient");
    }
  }

  // ---- drawing ---------------------------------------------------------------------------------

  #ensureParts(root: SVGSVGElement): Parts {
    if (this.#parts?.plot.isConnected) return this.#parts;
    const g = (name: string) => svg("g", { class: name });
    const clip = svg("rect", {});
    const plot = svg("g", { "clip-path": `url(#${this.#clip})` });
    const parts: Parts = {
      clip,
      plot,
      grid: g("grid"),
      volume: g("volume"),
      bars: g("bars"),
      shape: g("shape"),
      overlays: g("overlays"),
      osc: g("osc"),
      flags: g("flags"),
      last: g("last"),
      drawings: g("drawings"),
      axis: g("axis"),
      nav: g("nav"),
      track: svg("rect", {
        class: "track",
        "data-track": "",
        role: "slider",
        tabindex: 0,
        fill: "transparent",
      }),
      cross: g("cross"),
      vline: svg("line", { class: "vline" }),
      hline: svg("line", { class: "hline" }),
      dot: svg("circle", { class: "dot", r: 4 }),
      priceTag: g("tag"),
      dateTag: g("tag"),
    };
    parts.cross.setAttribute("aria-hidden", "true");
    parts.cross.style.display = "none";
    parts.cross.append(parts.vline, parts.hline, parts.dot, parts.priceTag, parts.dateTag);
    plot.append(
      parts.grid,
      parts.volume,
      parts.bars,
      parts.shape,
      parts.overlays,
      parts.osc,
      parts.flags,
      parts.last,
      parts.drawings,
    );
    root.append(
      svg("defs", {}, svg("clipPath", { id: this.#clip }, clip)),
      plot,
      parts.axis,
      parts.nav,
      parts.cross,
    );
    this.#parts = parts;
    this.#brush = undefined;
    return parts;
  }

  #dateFormatter(locale: string, timeZone: string | undefined, spanMs: number, intraday: boolean) {
    const mode = spanMs > 600 * DAY ? "year" : intraday && spanMs < 5 * DAY ? "time" : "day";
    const key = `${locale}|${timeZone}|${mode}`;
    if (this.#fmtKey !== key || !this.#fmtTick) {
      const options: Intl.DateTimeFormatOptions =
        mode === "year"
          ? { month: "short", year: "2-digit", timeZone }
          : mode === "time"
            ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }
            : { day: "numeric", month: "short", timeZone };
      this.#fmtTick = new Intl.DateTimeFormat(locale, options);
      this.#fmtKey = key;
    }
    return this.#fmtTick;
  }

  protected override draw(context: DrawContext): DrawResult {
    const { svg: root, width, height, locale, timeZone } = context;
    const texts = this.#t();
    this.#color = context.color;
    this.#loadExtras();
    const model = this.#series();
    const bars = model.bars;
    const n = bars.length;
    this.#reconcile(model);
    const type = this.seriesType;
    const parts = this.#ensureParts(root);
    const comparisons = this.#comparisons;
    const percent = comparisons.length > 0;

    const start = this.#start;
    const span = this.#span;
    const lo = clamp(Math.floor(start + 1e-9), 0, n - 1);
    const hi = clamp(Math.ceil(start + span - 1e-9) - 1, lo, n - 1);
    const count = hi - lo + 1;

    // ---- vertical layout
    const navOn = this.getAttribute("navigator") !== "off";
    const navH = navOn ? NAV_HEIGHT : 0;
    const navTop = height - navH;
    const plotBottom = height - navH - (navOn ? NAV_GAP : 0) - AXIS_HEIGHT;
    const oscModel = this.#oscillatorOf(model);
    const oscH = oscModel ? Math.round((plotBottom - TOP) * 0.27) : 0;
    const oscGap = oscModel ? 14 : 0;
    const priceBottom = plotBottom - oscH - oscGap;
    const hasVolume =
      this.getAttribute("volume") !== "off" && bars.some((bar) => bar.volume != null);

    // ---- data in view
    const lines = percent ? [] : this.#overlayLines(model, lo);
    const visibleLines = lines.filter((line) => !this.isHidden(line.id));
    const base = bars[lo]?.close || 1;
    const closeAt = (i: number) => {
      const close = (bars[i] as StockBar).close;
      return percent ? close / base - 1 : close;
    };
    const rebased = percent
      ? comparisons.map((c) => ({ c, values: rebaseFrom(c.values, lo) }))
      : [];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const candle = !percent && (isCandleLike(type) || type === "ohlc");
    for (let i = lo; i <= hi; i += 1) {
      const bar = bars[i] as StockBar;
      const a = candle ? bar.low : closeAt(i);
      const b = candle ? bar.high : closeAt(i);
      if (a < min) min = a;
      if (b > max) max = b;
    }
    for (const line of visibleLines) {
      for (const series of [line.values, line.lower]) {
        if (!series) continue;
        for (let i = lo; i <= hi; i += 1) {
          const v = series[i];
          if (v == null) continue;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    for (const { c, values } of rebased) {
      if (this.isHidden(c.id)) continue;
      for (let i = lo; i <= hi; i += 1) {
        const v = values[i];
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min)) {
      min = 0;
      max = 1;
    }
    const pad = (max - min || Math.abs(max) || 1) * 0.06;
    const yScale = linearScale({
      domain: [min - pad, max + pad],
      range: [priceBottom, TOP],
      tickCount: Math.max(3, Math.round((priceBottom - TOP) / 48)),
    });
    const priceFormat = percent
      ? (value: number) => formatPercent(value, { locale, decimals: 1 })
      : (value: number) => context.format(value);
    const ticks = yScale.ticks();
    const widest = Math.max(
      ...ticks.map((t) => estimateTextWidth(priceFormat(t))),
      percent ? 0 : estimateTextWidth(priceFormat((bars[hi] as StockBar).close)),
      24,
    );
    const axisRoom = Math.ceil(widest) + 14;
    const innerW = Math.max(40, width - axisRoom);
    const step = innerW / span;
    const xOf = (i: number) => (i + 0.5 - start) * step;
    const y = (value: number) => yScale.map(value);
    const layout: Layout = {
      n,
      lo,
      hi,
      step,
      innerW,
      start,
      span,
      plotBottom,
      priceBottom,
      navTop,
      navW: innerW,
      y,
      invert: (pixel) => yScale.invert(pixel),
      percent,
      closeAt,
      price: priceFormat,
    };
    this.#layout = layout;

    const up = DIRECTION_COLORS.up;
    const down = DIRECTION_COLORS.down;
    const first = bars[lo] as StockBar;
    const lastBar = bars[hi] as StockBar;
    const spanMs = +lastBar.date - +first.date;
    const intraday = bars.some((bar) => !isMidnight(+bar.date, timeZone));
    const dateFormat = this.#dateFormatter(locale, timeZone, spanMs, intraday);
    const longDate = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      ...(intraday ? { timeStyle: "short" } : {}),
      timeZone,
    });
    const fmt = (value: number) => context.format(value);

    // ---- clip
    parts.clip.setAttribute("x", "0");
    parts.clip.setAttribute("y", "0");
    parts.clip.setAttribute("width", `${innerW}`);
    parts.clip.setAttribute("height", `${plotBottom + 1}`);

    // ---- grid and axes
    const gridOn = this.getAttribute("grid") !== "off";
    const grid: SVGElement[] = [];
    const axis: SVGElement[] = [];
    for (const tick of ticks) {
      const py = y(tick);
      if (py < TOP - 1 || py > priceBottom + 1) continue;
      if (gridOn) grid.push(svg("line", { class: "gl", x1: 0, x2: innerW, y1: py, y2: py }));
      axis.push(
        svg("text", { class: "yt", x: innerW + 8, y: py, dy: "0.32em" }, priceFormat(tick)),
      );
    }
    const minGap = 78;
    const every = Math.max(1, Math.ceil(minGap / step));
    for (let i = Math.ceil(lo / every) * every; i <= hi; i += every) {
      const px = xOf(i);
      if (px < 20 || px > innerW - 20) continue;
      if (gridOn)
        grid.push(svg("line", { class: "gl v", x1: px, x2: px, y1: TOP, y2: plotBottom }));
      axis.push(
        svg(
          "text",
          { class: "xt", x: px, y: plotBottom + 15, "text-anchor": "middle" },
          dateFormat.format((bars[i] as StockBar).date),
        ),
      );
    }
    parts.grid.replaceChildren(...grid);

    // ---- main series
    const canvasWanted = !percent && count > SVG_BARS_MAX && (candle || type === "column");
    const volH = Math.round((priceBottom - TOP) * 0.18);
    let maxVolume = 0;
    if (hasVolume)
      for (let k = 0; k < count; k += 1) {
        const volume = (bars[lo + k] as StockBar).volume ?? 0;
        if (volume > maxVolume) maxVolume = volume;
      }
    const canvasMode = canvasWanted && !!this.#canvasMod;
    if (canvasWanted && !this.#canvasMod) this.#loadCanvas();
    const paintSvg = !canvasWanted;
    let canvasUsed = false;
    if (canvasMode && this.#canvasMod) {
      const { colorResolver, columns, paintCandles, paintColumns, paintVolume } = this.#canvasMod;
      const g = context.canvas();
      canvasUsed = true;
      const resolver = colorResolver(this);
      const view = bars.slice(lo, hi + 1);
      const positions = view.map((_, k) => xOf(lo + k));
      const merge = count > innerW;
      const list: Column[] = columns(view, positions, merge);
      const bw = merge ? 1 : Math.max(1, step * 0.7);
      const paint: BarPaint = {
        g,
        up: resolver.color(up),
        down: resolver.color(down),
        y,
        width: bw,
      };
      g.save();
      g.beginPath();
      g.rect(0, 0, innerW, plotBottom + 1);
      g.clip();
      if (hasVolume) paintVolume(paint, list, maxVolume, priceBottom, volH);
      if (type === "column")
        paintColumns(
          paint,
          list,
          priceBottom,
          lo > 0 ? (bars[lo - 1] as StockBar).close : undefined,
        );
      else paintCandles(paint, list, type === "ohlc");
      g.restore();
      resolver.done();
    }
    if (paintSvg)
      this.#paintBars(
        parts,
        bars,
        lo,
        hi,
        xOf,
        y,
        step,
        type,
        percent,
        hasVolume,
        maxVolume,
        volH,
        priceBottom,
      );
    else {
      parts.bars.replaceChildren();
      parts.volume.replaceChildren();
    }

    // line / area / percent shape
    const shape: SVGElement[] = [];
    if (percent || type === "line" || type === "area") {
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = lo; i <= hi; i += 1) pts.push({ x: xOf(i), y: y(closeAt(i)) });
      const picked = this.#reduce(pts, innerW);
      const d = picked
        .map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join("");
      if (type === "area" && !percent && picked.length) {
        const a = picked[0] as { x: number };
        const b = picked[picked.length - 1] as { x: number };
        shape.push(
          svg("path", {
            class: "area",
            d: `${d}L${b.x.toFixed(1)} ${priceBottom}L${a.x.toFixed(1)} ${priceBottom}Z`,
          }),
        );
      }
      shape.push(svg("path", { class: "price-line", d }));
      rebased.forEach(({ c, values }, index) => {
        if (this.isHidden(c.id)) return;
        const series: Array<{ x: number; y: number } | null> = [];
        for (let i = lo; i <= hi; i += 1) {
          const v = values[i];
          series.push(v == null ? null : { x: xOf(i), y: y(v) });
        }
        shape.push(
          svg("path", {
            class: "cmp",
            d: this.#linePath(series, innerW),
            style: `stroke:${this.#color(index + 1, c.color)}`,
          }),
        );
      });
    }
    parts.shape.replaceChildren(...shape);

    // overlays
    const overlay: SVGElement[] = [];
    for (const line of visibleLines) {
      const series = (values: IndicatorSeries) => {
        const out: Array<{ x: number; y: number } | null> = [];
        for (let i = lo; i <= hi; i += 1) {
          const v = values[i];
          out.push(v == null ? null : { x: xOf(i), y: y(v) });
        }
        return out;
      };
      const upper = series(line.values);
      if (line.lower) {
        const lower = series(line.lower);
        const band = this.#bandPath(upper, lower);
        if (band)
          overlay.push(svg("path", { class: "band", d: band, style: `fill:${line.color}` }));
        const index = this.#overlays.findIndex(
          (_, k) => `${this.#overlays[k]?.type}-${k}` === line.id,
        );
        const middle = series(
          this.#extras?.bollingerMiddle(bars, this.#overlays[index] as StockOverlay) ?? [],
        );
        overlay.push(
          svg("path", {
            class: "ov dashed",
            d: this.#linePath(middle, innerW),
            style: `stroke:${line.color}`,
          }),
        );
        overlay.push(
          svg("path", {
            class: "ov",
            d: this.#linePath(lower, innerW),
            style: `stroke:${line.color}`,
          }),
        );
      }
      overlay.push(
        svg("path", {
          class: "ov",
          d: this.#linePath(upper, innerW),
          style: `stroke:${line.color}`,
        }),
      );
    }
    parts.overlays.replaceChildren(...overlay);

    // oscillator pane
    parts.osc.replaceChildren(
      ...(oscModel && this.#extras
        ? this.#extras.paintOscillator(
            oscModel,
            lo,
            hi,
            xOf,
            plotBottom - oscH,
            plotBottom,
            innerW,
            step,
            axis,
            (points) => this.#linePath(points, innerW),
          )
        : []),
    );

    // flags
    const flags =
      this.#extras && this.#flags.length
        ? this.#extras.flagNodes(this.#flags, bars, lo, hi, xOf, y, candle, closeAt, TOP)
        : [];
    parts.flags.replaceChildren(...flags);

    // last price tag
    const last: SVGElement[] = [];
    if (this.getAttribute("last-price") !== "off" && hi === n - 1 && !percent) {
      const close = lastBar.close;
      const py = clamp(y(close), TOP, priceBottom);
      const color = close >= lastBar.open ? up : down;
      const label = priceFormat(close);
      last.push(
        svg("line", {
          class: "last-line",
          x1: 0,
          x2: innerW,
          y1: py,
          y2: py,
          style: `stroke:${color}`,
        }),
      );
      axis.push(
        svg(
          "g",
          { class: "last-tag" },
          svg("rect", {
            x: innerW + 2,
            y: py - 9,
            width: axisRoom - 2,
            height: 18,
            rx: 3,
            style: `fill:${color}`,
          }),
          svg("text", { x: innerW + 8, y: py, dy: "0.32em" }, label),
        ),
      );
    }
    parts.last.replaceChildren(...last);

    // drawings
    const geometry = this.#geometry();
    const drawn: SVGElement[] = [];
    const drawingsMod = this.#drawingsMod;
    if (geometry && (this.#drawings.length || this.#draft || this.#measure) && !drawingsMod)
      this.#loadDrawings();
    if (geometry && drawingsMod) {
      const { drawingNode, measureNode } = drawingsMod;
      const pct = (value: number) => formatPercent(value, { locale, decimals: 2 });
      for (const drawing of this.#drawings)
        drawn.push(drawingNode(drawing, geometry, drawing.id === this.#selectedDrawing, fmt, pct));
      const draft = this.#draft;
      if (draft?.moved && draft.tool !== "measure" && draft.tool !== "horizontal")
        drawn.push(
          drawingNode(
            { id: "draft", type: draft.tool as "trend", a: draft.a, b: draft.b },
            geometry,
            false,
            fmt,
            pct,
            true,
          ),
        );
      const measure = draft?.tool === "measure" && draft.moved ? draft : this.#measure;
      if (measure)
        drawn.push(
          measureNode(measure.a, measure.b, geometry, { bars: texts.bars, days: texts.days }, pct),
        );
    }
    parts.drawings.replaceChildren(...drawn);
    parts.axis.replaceChildren(...axis);

    // navigator
    this.#paintNavigator(parts, bars, n, lo, hi, innerW, navTop, navH, navOn, longDate, texts);

    if (!canvasUsed && context.animate)
      parts.plot.animate({ opacity: [0, 1] }, { duration: 320, easing: "ease-out" });

    // crosshair, redrawn from the surviving hover so a redraw never drops it
    this.#placeCrosshair(context.hover != null ? lo + context.hover : null);
    this.#emitWindow(lo, hi, n, bars);

    const change = first.close ? (lastBar.close - first.close) / first.close : 0;
    const name = this.getAttribute("name") || this.getAttribute("label") || "Price";
    const label = (i: number) => {
      const bar = bars[lo + i] as StockBar;
      return `${longDate.format(bar.date)}: ${texts.open} ${fmt(bar.open)}, ${texts.high} ${fmt(bar.high)}, ${texts.low} ${fmt(bar.low)}, ${texts.close} ${fmt(bar.close)}`;
    };
    return {
      label: name,
      summary: `${name}: ${n} ${texts.bars}, ${longDate.format(first.date)} to ${longDate.format(lastBar.date)}, ${texts.close} ${fmt(first.close)} to ${fmt(lastBar.close)} (${formatPercent(change, { locale, decimals: 1 })}). ${texts.keyboardHint}`,
      snapshot: () =>
        this.#snapshotFor({
          bars,
          lines,
          comparisons,
          name,
          texts,
          longDate,
          fmt,
          color: (index, override) => this.#color(index, override),
        }),
      marks: { count, label, element: () => parts.vline },
      maxHoverRows: 5 + visibleLines.length + comparisons.length + (oscModel ? 1 : 0) + 1,
      hit: (px, py) => {
        if (px < 0 || px > innerW || py < 0 || py > plotBottom + AXIS_HEIGHT) return -1;
        return clamp(Math.floor(px / step + start) - lo, 0, count - 1);
      },
      hover: (i, source) =>
        this.#hover(
          i,
          source,
          layout,
          bars,
          lines,
          rebased,
          oscModel,
          texts,
          longDate,
          fmt,
          priceFormat,
          locale,
        ),
      nav: (i, intent) => {
        if (intent === "left") {
          if (i > 0) return i - 1;
          if (this.#start > 0) this.#setWindow(this.#start - 1, this.#span);
          return 0;
        }
        if (intent === "right") {
          if (i < count - 1) return i + 1;
          if (hi < n - 1) this.#setWindow(this.#start + 1, this.#span);
          return count - 1;
        }
        if (intent === "home") return 0;
        if (intent === "end") return count - 1;
        return undefined;
      },
    };
  }

  /** At most two points per pixel: LTTB keeps the shape of a long series. */
  #reduce(
    points: Array<{ x: number; y: number }>,
    innerW: number,
  ): Array<{ x: number; y: number }> {
    if (points.length <= innerW * 2) return points;
    return lttbIndices(points, Math.floor(innerW * 2)).map(
      (i) => points[i] as { x: number; y: number },
    );
  }

  /** A path through points, a gap (`null`) starts a new run; downsampled when long. */
  #linePath(points: ReadonlyArray<{ x: number; y: number } | null>, innerW: number): string {
    let d = "";
    let run: Array<{ x: number; y: number }> = [];
    const flush = () => {
      if (!run.length) return;
      d += this.#reduce(run, innerW)
        .map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join("");
      run = [];
    };
    for (const point of points) {
      if (point) run.push(point);
      else flush();
    }
    flush();
    return d;
  }

  #bandPath(
    upper: ReadonlyArray<{ x: number; y: number } | null>,
    lower: ReadonlyArray<{ x: number; y: number } | null>,
  ): string {
    const top: Array<{ x: number; y: number }> = [];
    const bottom: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < upper.length; i += 1) {
      const a = upper[i];
      const b = lower[i];
      if (a && b) {
        top.push(a);
        bottom.push(b);
      }
    }
    if (top.length < 2) return "";
    const a = this.#reduce(top, 2000);
    const b = this.#reduce(bottom, 2000).reverse();
    return `${a.map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")}${b.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")}Z`;
  }

  #paintBars(
    parts: Parts,
    bars: readonly StockBar[],
    lo: number,
    hi: number,
    xOf: (i: number) => number,
    y: (value: number) => number,
    step: number,
    type: StockSeriesType,
    percent: boolean,
    hasVolume: boolean,
    maxVolume: number,
    volH: number,
    priceBottom: number,
  ): void {
    const items: number[] = [];
    for (let i = lo; i <= hi; i += 1) items.push(i);
    const bw = Math.max(1, Math.min(step * 0.7, 16));
    if (hasVolume && maxVolume > 0) {
      join(
        parts.volume,
        items,
        (i) => +(bars[i] as StockBar).date,
        () => svg("rect", { class: "vol" }),
        (el, i) => {
          const bar = bars[i] as StockBar;
          const h = Math.max(1, ((bar.volume ?? 0) / maxVolume) * volH);
          el.setAttribute("x", `${(xOf(i) - bw / 2).toFixed(1)}`);
          el.setAttribute("width", `${bw.toFixed(1)}`);
          el.setAttribute("y", `${(priceBottom - h).toFixed(1)}`);
          el.setAttribute("height", `${h.toFixed(1)}`);
          el.setAttribute("data-dir", bar.close >= bar.open ? "up" : "down");
        },
      );
    } else parts.volume.replaceChildren();
    if (percent || type === "line" || type === "area") {
      parts.bars.replaceChildren();
      return;
    }
    if (type === "column") {
      join(
        parts.bars,
        items,
        (i) => `c${+(bars[i] as StockBar).date}`,
        () => svg("rect", { class: "col" }),
        (el, i) => {
          const bar = bars[i] as StockBar;
          const prev = i > 0 ? (bars[i - 1] as StockBar).close : bar.open;
          const top = y(bar.close);
          el.setAttribute("x", `${(xOf(i) - bw / 2).toFixed(1)}`);
          el.setAttribute("width", `${bw.toFixed(1)}`);
          el.setAttribute("y", `${top.toFixed(1)}`);
          el.setAttribute("height", `${Math.max(1, priceBottom - top).toFixed(1)}`);
          el.setAttribute("data-dir", bar.close >= prev ? "up" : "down");
        },
      );
      return;
    }
    const ohlc = type === "ohlc";
    join(
      parts.bars,
      items,
      (i) => `${type}${+(bars[i] as StockBar).date}`,
      () => svg("path", { class: "bar" }),
      (el, i) => {
        const bar = bars[i] as StockBar;
        const x = xOf(i);
        const yh = y(bar.high);
        const yl = y(bar.low);
        const yo = y(bar.open);
        const yc = y(bar.close);
        let d = `M${x.toFixed(1)} ${yh.toFixed(1)}V${yl.toFixed(1)}`;
        if (ohlc) {
          const t = Math.max(2, bw / 2);
          d += `M${(x - t).toFixed(1)} ${yo.toFixed(1)}H${x.toFixed(1)}M${x.toFixed(1)} ${yc.toFixed(1)}H${(x + t).toFixed(1)}`;
        } else {
          const top = Math.min(yo, yc);
          const h = Math.max(1.25, Math.abs(yo - yc));
          d += `M${(x - bw / 2).toFixed(1)} ${top.toFixed(1)}h${bw.toFixed(1)}v${h.toFixed(1)}h${(-bw).toFixed(1)}Z`;
        }
        el.setAttribute("d", d);
        el.setAttribute("data-dir", bar.close >= bar.open ? "up" : "down");
        el.setAttribute("data-fill", ohlc ? "none" : "solid");
      },
    );
  }

  #paintNavigator(
    parts: Parts,
    bars: readonly StockBar[],
    n: number,
    lo: number,
    hi: number,
    innerW: number,
    navTop: number,
    navH: number,
    navOn: boolean,
    longDate: Intl.DateTimeFormat,
    texts: StockTexts,
  ): void {
    if (!navOn) {
      parts.nav.replaceChildren();
      this.#brush?.destroy();
      this.#brush = undefined;
      return;
    }
    const pos = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const closes: Array<{ x: number; y: number }> = [];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const stride = Math.max(1, Math.floor(n / (innerW * 2)));
    for (let i = 0; i < n; i += stride) {
      const close = (bars[i] as StockBar).close;
      if (close < min) min = close;
      if (close > max) max = close;
    }
    const ny = (value: number) => navTop + 3 + (1 - (value - min) / (max - min || 1)) * (navH - 6);
    for (let i = 0; i < n; i += stride)
      closes.push({ x: pos(i), y: ny((bars[i] as StockBar).close) });
    const d = this.#reduce(closes, innerW)
      .map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join("");
    const x0 = pos(lo);
    const x1 = pos(hi);
    const { track } = parts;
    track.setAttribute("x", "0");
    track.setAttribute("y", `${navTop}`);
    track.setAttribute("width", `${innerW}`);
    track.setAttribute("height", `${navH}`);
    track.setAttribute("aria-label", texts.navigator);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", `${Math.max(0, n - 1)}`);
    track.setAttribute("aria-valuenow", `${lo}`);
    track.setAttribute(
      "aria-valuetext",
      `${longDate.format((bars[lo] as StockBar).date)} - ${longDate.format((bars[hi] as StockBar).date)}`,
    );
    parts.nav.replaceChildren(
      svg("rect", { class: "nav-bg", x: 0, y: navTop, width: innerW, height: navH, rx: 4 }),
      svg("path", { class: "nav-line", d }),
      svg("rect", { class: "nav-shade", x: 0, y: navTop, width: Math.max(0, x0), height: navH }),
      svg("rect", {
        class: "nav-shade",
        x: x1,
        y: navTop,
        width: Math.max(0, innerW - x1),
        height: navH,
      }),
      svg("rect", {
        class: "nav-window",
        x: x0,
        y: navTop,
        width: Math.max(2, x1 - x0),
        height: navH,
        rx: 4,
      }),
      svg("rect", {
        class: "nav-grip",
        x: x0 - 2,
        y: navTop + navH / 2 - 8,
        width: 4,
        height: 16,
        rx: 2,
      }),
      svg("rect", {
        class: "nav-grip",
        x: x1 - 2,
        y: navTop + navH / 2 - 8,
        width: 4,
        height: 16,
        rx: 2,
      }),
      track,
    );
    const options = {
      count: n,
      range: [lo, hi] as const,
      indexAt: (pixel: number) =>
        clamp(Math.round((pixel / Math.max(1, innerW)) * (n - 1)), 0, n - 1),
      position: pos,
      onChange: (range: readonly [number, number]) => {
        this.#setWindow(range[0], range[1] - range[0] + 1);
      },
    };
    if (this.#brush) this.#brush.update(options);
    else if (this.#signal && !this.#signal.aborted && !this.#brushLoading) {
      // The strip is already drawn; only its drag and keyboard behavior is fetched, right after.
      this.#brushLoading = true;
      const signal = this.#signal;
      import("@jcsoftdev/ui-core/chart/brush").then(({ attachIndexBrush }) => {
        this.#brushLoading = false;
        const target = this.#navTrack;
        if (signal.aborted || this.#brush || !target?.isConnected) return;
        this.#brush = attachIndexBrush(
          target as unknown as HTMLElement,
          this.#navOptions ?? options,
        );
      });
    }
    this.#navTrack = track;
    this.#navOptions = options;
  }

  #emitWindow(lo: number, hi: number, n: number, bars: readonly StockBar[]): void {
    const key = `${lo}:${hi}:${n}`;
    if (key === this.#emitted) return;
    const first = this.#emitted === "";
    this.#emitted = key;
    if (first) return;
    emit(this, "stock-window", {
      start: lo,
      end: hi,
      from: (bars[lo] as StockBar).date,
      to: (bars[hi] as StockBar).date,
    });
  }

  /** Moves the crosshair to bar `index` (an index of `data`), or hides it. */
  #placeCrosshair(index: number | null): void {
    const parts = this.#parts;
    const layout = this.#layout;
    const model = this.#model;
    if (!parts || !layout || !model) return;
    if (index == null || index < layout.lo || index > layout.hi) {
      parts.cross.style.display = "none";
      return;
    }
    const bar = model.bars[index] as StockBar;
    const px = (index + 0.5 - layout.start) * layout.step;
    const py = layout.y(layout.closeAt(index));
    parts.cross.style.display = "";
    parts.vline.setAttribute("x1", `${px}`);
    parts.vline.setAttribute("x2", `${px}`);
    parts.vline.setAttribute("y1", `${TOP}`);
    parts.vline.setAttribute("y2", `${layout.plotBottom}`);
    parts.hline.setAttribute("x1", "0");
    parts.hline.setAttribute("x2", `${layout.innerW}`);
    parts.hline.setAttribute("y1", `${py}`);
    parts.hline.setAttribute("y2", `${py}`);
    parts.dot.setAttribute("cx", `${px}`);
    parts.dot.setAttribute("cy", `${py}`);
    const label = layout.price(layout.percent ? layout.closeAt(index) : bar.close);
    const tag = (
      group: SVGGElement,
      x: number,
      y: number,
      text: string,
      anchor: "start" | "middle",
    ) => {
      const w = estimateTextWidth(text) + 12;
      group.replaceChildren(
        svg("rect", {
          x: anchor === "middle" ? x - w / 2 : x,
          y: y - 9,
          width: w,
          height: 18,
          rx: 3,
        }),
        svg(
          "text",
          { x: anchor === "middle" ? x : x + 6, y, dy: "0.32em", "text-anchor": anchor },
          text,
        ),
      );
    };
    tag(parts.priceTag, layout.innerW + 2, py, label, "start");
    tag(
      parts.dateTag,
      clamp(px, 30, layout.innerW - 30),
      layout.plotBottom + 11,
      this.#fmtTick?.format(bar.date) ?? "",
      "middle",
    );
  }

  #hover(
    i: number,
    _source: HoverInfo["source"],
    layout: Layout,
    bars: readonly StockBar[],
    lines: readonly OverlayLine[],
    rebased: ReadonlyArray<{ c: StockComparison; values: IndicatorSeries }>,
    oscModel: OscillatorModel | null,
    texts: StockTexts,
    longDate: Intl.DateTimeFormat,
    fmt: (value: number) => string,
    priceFormat: (value: number) => string,
    locale: string,
  ): HoverContent | null {
    const index = layout.lo + i;
    const bar = bars[index];
    if (!bar) return null;
    const rows: TooltipRow[] = [];
    const dir = bar.close >= bar.open ? DIRECTION_COLORS.up : DIRECTION_COLORS.down;
    if (layout.percent) {
      rows.push({
        id: "price",
        name: texts.price,
        value: formatPercent(layout.closeAt(index), { locale, decimals: 2 }),
        color: "var(--ink-2)",
      });
      rebased.forEach(({ c, values }, k) => {
        const v = values[index];
        if (v != null && !this.isHidden(c.id))
          rows.push({
            id: c.id,
            name: c.name,
            value: formatPercent(v, { locale, decimals: 2 }),
            color: this.#color(k + 1, c.color),
          });
      });
    } else {
      rows.push(
        { id: "open", name: texts.open, value: fmt(bar.open), color: dir, shape: "line" },
        { id: "high", name: texts.high, value: fmt(bar.high), color: dir, shape: "line" },
        { id: "low", name: texts.low, value: fmt(bar.low), color: dir, shape: "line" },
        {
          id: "close",
          name: texts.close,
          value: fmt(bar.close),
          color: dir,
          shape: "line",
          emphasis: true,
        },
      );
      for (const line of lines) {
        const v = line.values[index];
        if (v != null && !this.isHidden(line.id))
          rows.push({
            id: line.id,
            name: line.name,
            value: priceFormat(v),
            color: line.color,
            shape: "line",
          });
      }
    }
    if (bar.volume != null)
      rows.push({
        id: "volume",
        name: texts.volume,
        value: fmt(bar.volume),
        color: "var(--ink-3)",
        shape: "square",
      });
    if (oscModel) {
      const v = oscModel.main[index];
      if (v != null)
        rows.push({
          id: "osc",
          name: oscModel.name,
          value: v.toFixed(2),
          color: "var(--ink-2)",
          shape: "line",
        });
    }
    const flag = this.#flags.find((f) => sameDay(bar.date, f.date));
    return {
      title: longDate.format(bar.date),
      rows,
      body: flag?.text,
      x: (index + 0.5 - layout.start) * layout.step,
      y: layout.y(layout.closeAt(index)),
      side: "right",
    };
  }
}

/** Registers `<ui-stock>` (or `<prefix>-stock`) and returns the tag. */
export function defineStock(options?: DefineOptions): string {
  return defineElement("stock", UiStock, options);
}
