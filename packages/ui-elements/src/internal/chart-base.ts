import {
  resolveFormat,
  type ValueFormat,
  type ValueFormatter,
} from "@jcsoftdev/ui-core/chart/format";
import { seriesColor } from "@jcsoftdev/ui-core/chart/palette";
import { findRovingTarget, getRovingIntent } from "@jcsoftdev/ui-core/roving";
import { adoptStyles, ElementBase, emit, rootOf, uid } from "./base.js";
import css from "./chart-base.css.js";
import { svg } from "./chart-dom.js";
import {
  CHART_EVENT,
  CHART_MARKER,
  type ChartHost,
  type ChartSnapshot,
  type HoverContent,
  type HoverInfo,
} from "./chart-protocol.js";

export { svg } from "./chart-dom.js";
export * from "./chart-protocol.js";

const DEFAULT_HEIGHT = 240;
const FALLBACK_HEIGHT = 300;
const PRESETS = new Set(["number", "integer", "currency", "percent", "compact"]);

/** Visible strings of the base. English defaults; override with `chart.labels = { ... }`. */
export interface ChartLabels {
  empty: string;
  loading: string;
  /** Header of the category column in the data table. */
  category: string;
  /** Header of the value column of a single-series table. */
  value: string;
}

const DEFAULT_LABELS: ChartLabels = {
  empty: "No data to show",
  loading: "Loading chart",
  category: "Category",
  value: "Value",
};

/** A focusable mark: the element that takes focus and the accessible name it gets. */
export interface ChartMark {
  el: SVGElement;
  label: string;
}

/** Everything a chart gets to draw with. The SVG is empty; the size is the drawing area. */
export interface DrawContext {
  svg: SVGSVGElement;
  width: number;
  height: number;
  locale: string;
  timeZone: string | undefined;
  /** Formats a value with the chart's `value-format`, `locale` and `currency`. */
  format: ValueFormatter;
  /** True when entry animation may play: motion is allowed and the data (not the size) changed. */
  animate: boolean;
  /** Color of series `index`: the `palette` property, else the chart palette tokens. */
  color(index: number, override?: string): string;
}

export interface DrawResult {
  /** One sentence for screen readers (first, last, min, max...). Becomes the description. */
  summary?: string;
  /** Data for the legend, data table and export. Pass a function to defer the cost. */
  snapshot?: ChartSnapshot | (() => ChartSnapshot);
  /** One focusable mark per category, in reading order. */
  marks?: readonly ChartMark[];
  /** Pixel position (relative to the SVG) to a mark index, or -1. Must be gap-free. */
  hit?(x: number, y: number): number;
  /** Tooltip content and anchor of mark `index`. */
  hover?(index: number, source: "pointer" | "keyboard"): HoverContent | null;
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

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * The base every chart element extends. Light DOM: the host is a positioned flex column holding
 * the sized drawing area (an SVG you fill in `draw()`), plus whatever opt-in parts the author
 * places inside it. It owns sizing, loading and empty states, the accessible name and description,
 * pointer and keyboard access to marks, the hover protocol and a lazy screen-reader table.
 * It imports no legend, tooltip, export or data table: those are separate elements.
 *
 * Attributes: `label`, `description`, `height` (px, default 240, or `fill`), `aspect-ratio`,
 * `loading`, `empty`, `skeleton` (`bars`, `line`, `ring`), `locale`, `time-zone`, `value-format`
 * (`number`, `integer`, `currency`, `percent`, `compact`), `currency`, `palette` (CSS colors,
 * comma separated), `animate="off"`, `table="off"`. Events: `chart-ready`, `chart-data`,
 * `chart-hover`, `chart-series`.
 */
export abstract class ChartElement extends ElementBase implements ChartHost {
  static observedAttributes: string[] = [...CHART_ATTRIBUTES];

  /** Property forms of the matching attributes. */
  valueFormat: ValueFormat | undefined;
  palette: readonly string[] | undefined;
  labels: Partial<ChartLabels> = {};
  /** A subclass without data of its own (a sparkline) sets this to skip the fallback table. */
  protected tableFallback = true;

  readonly drawing = document.createElement("div");
  #svg: SVGSVGElement | undefined;
  #description: HTMLElement | undefined;
  #fallback: HTMLElement | undefined;
  #observer: ResizeObserver | undefined;
  #frame = 0;
  #dirty = true;
  #entered = false;
  #width = 0;
  #measured = 0;
  #result: DrawResult | undefined;
  #snapshot: ChartSnapshot | null = null;
  #marks: SVGElement[] = [];
  #hover: HoverInfo | null = null;
  #active = 0;
  #highlight: string | null = null;
  #claims = 0;
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
  get chartSnapshot(): ChartSnapshot | null {
    return this.#snapshot;
  }
  get hover(): HoverInfo | null {
    return this.#hover;
  }
  /** Whether the user asked for less motion. */
  get reduced(): boolean {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  get resolvedLabels(): ChartLabels {
    return { ...DEFAULT_LABELS, ...this.labels };
  }

  /** `Intl.DateTimeFormat` in the chart's locale and time zone (`timeZone` is never hard-wired). */
  formatDate(value: Date | number, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
    const key = `${this.locale}|${this.timeZone}|${JSON.stringify(options)}`;
    let format = dateFormats.get(key);
    if (!format) {
      format = new Intl.DateTimeFormat(this.locale, { ...options, timeZone: this.timeZone });
      dateFormats.set(key, format);
    }
    return format.format(value);
  }

  isHidden(id: string): boolean {
    return this.#hidden.has(id);
  }
  /** Hides or shows a series (at least one stays visible) and redraws. */
  toggleSeries(id: string): void {
    const series = this.#snapshot?.series ?? [];
    const visible = series.filter((s) => !this.#hidden.has(s.id)).length;
    if (this.#hidden.has(id)) this.#hidden.delete(id);
    else if (visible > 1) this.#hidden.add(id);
    else return;
    this.requestDraw();
    emit(this, CHART_EVENT.series, { id, hidden: this.#hidden.has(id) });
  }
  /** Dims every series but `id` (`null` clears), by the `data-series` attribute of the marks. */
  highlight(id: string | null): void {
    this.#highlight = id;
    this.#dim();
    emit(this, CHART_EVENT.series, { highlight: id });
  }
  #dim(): void {
    const id = this.#highlight;
    for (const node of this.#svg?.querySelectorAll<SVGElement>("[data-series]") ?? [])
      node.toggleAttribute("data-dim", id !== null && node.dataset.series !== id);
  }
  claimTable(on: boolean): void {
    this.#claims = Math.max(0, this.#claims + (on ? 1 : -1));
    this.#syncTable();
  }
  exportSvgs(): SVGSVGElement[] {
    return this.#svg ? [this.#svg] : [];
  }

  /** Schedules a redraw. Call it after changing data; attribute changes call it for you. */
  requestDraw(kind: "data" | "size" = "data"): void {
    if (kind === "data") this.#dirty = true;
    if (!this.#frame && this.isConnected) this.#frame = requestAnimationFrame(() => this.#run());
  }

  connectedCallback(): void {
    this.setAttribute(CHART_MARKER, "");
    adoptStyles(rootOf(this), css);
    this.prepend(this.drawing);
    this.drawing.addEventListener("pointermove", this.#onPointer);
    this.drawing.addEventListener("pointerdown", this.#onPointer);
    this.drawing.addEventListener("pointerleave", this.#onLeave);
    this.drawing.addEventListener("keydown", this.#onKey);
    this.drawing.addEventListener("focusin", this.#onFocusIn);
    this.drawing.addEventListener("focusout", this.#onFocusOut);
    document.addEventListener("pointerdown", this.#onOutside, true);
    this.#syncFill();
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
    this.requestDraw();
    emit(this, CHART_EVENT.ready);
  }

  disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#observer?.disconnect();
    this.drawing.removeEventListener("pointermove", this.#onPointer);
    this.drawing.removeEventListener("pointerdown", this.#onPointer);
    this.drawing.removeEventListener("pointerleave", this.#onLeave);
    this.drawing.removeEventListener("keydown", this.#onKey);
    this.drawing.removeEventListener("focusin", this.#onFocusIn);
    this.drawing.removeEventListener("focusout", this.#onFocusOut);
    document.removeEventListener("pointerdown", this.#onOutside, true);
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "height") this.#syncFill();
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
    return Number(attr) > 0 ? Number(attr) : DEFAULT_HEIGHT;
  }

  #state(kind: "loading" | "empty"): void {
    const node = document.createElement("div");
    node.dataset.uiPart = "state";
    node.dataset.state = kind;
    const labels = this.resolvedLabels;
    if (kind === "loading") {
      node.setAttribute("role", "status");
      node.setAttribute("aria-label", labels.loading);
      const skeleton = this.getAttribute("skeleton") ?? "bars";
      node.dataset.skeleton = skeleton;
      const heights = skeleton === "bars" ? [40, 70, 55, 85, 60, 95, 75] : [100];
      for (const h of heights) {
        const bar = document.createElement("i");
        if (skeleton === "bars") bar.style.height = `${h}%`;
        node.append(bar);
      }
    } else {
      node.setAttribute("role", "status");
      node.textContent = labels.empty;
    }
    this.drawing.replaceChildren(node);
  }

  #run(): void {
    this.#frame = 0;
    this.#setHover(-1);
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
      this.#state(state);
      this.#svg = undefined;
      this.#result = undefined;
      this.#marks = [];
      this.#snapshot = null;
      this.#dirty = false;
      this.#syncTable();
      return;
    }
    const width = this.#width;
    if (!width || !height) return;
    const focused = this.#marks.indexOf(document.activeElement as SVGElement);
    const root = this.#svg ?? svg("svg");
    this.#svg = root;
    root.replaceChildren();
    root.setAttribute("width", `${width}`);
    root.setAttribute("height", `${height}`);
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const entering = this.#dirty || !this.#entered;
    const palette = this.palette ?? this.#attrPalette();
    const preset = this.getAttribute("value-format");
    const format = resolveFormat(
      this.valueFormat ?? (preset && PRESETS.has(preset) ? (preset as ValueFormat) : undefined),
      { locale: this.locale, currency: this.getAttribute("currency") || undefined },
    );
    const result = this.draw({
      svg: root,
      width,
      height,
      locale: this.locale,
      timeZone: this.timeZone,
      format,
      animate: entering && this.getAttribute("animate") !== "off" && !this.reduced,
      color: (index, override) =>
        override ?? palette?.[index % palette.length] ?? seriesColor(index),
    });
    this.#entered = true;
    this.#result = result;
    if (root.parentNode !== this.drawing) this.drawing.replaceChildren(root);
    const snapshot = typeof result?.snapshot === "function" ? result.snapshot() : result?.snapshot;
    this.#access(root, result, snapshot);
    if (this.#highlight) this.#dim();
    if (focused >= 0) this.#marks[Math.min(focused, this.#marks.length - 1)]?.focus();
    if (this.#dirty) {
      this.#dirty = false;
      this.#snapshot = snapshot ?? null;
      this.#syncTable();
      emit(this, CHART_EVENT.data, this.#snapshot);
    }
  }

  #attrPalette(): string[] | undefined {
    const list = this.getAttribute("palette")
      ?.split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return list?.length ? list : undefined;
  }

  /** Accessible name, description, and the roving tab stop over the marks. */
  #access(root: SVGSVGElement, result: DrawResult | undefined, snapshot?: ChartSnapshot): void {
    const marks = result?.marks ?? [];
    const label = this.getAttribute("label") || snapshot?.title || "Chart";
    const summary = this.getAttribute("description") || result?.summary;
    this.#marks = marks.map((mark) => mark.el);
    root.setAttribute("aria-label", label);
    root.setAttribute("role", marks.length ? "group" : "img");
    root.setAttribute("aria-roledescription", "chart");
    if (summary) {
      this.#description ??= document.createElement("p");
      this.#description.dataset.uiPart = "description";
      this.#description.id ||= uid("chart-desc");
      this.#description.textContent = summary;
      this.drawing.append(this.#description);
      root.setAttribute("aria-describedby", this.#description.id);
    } else {
      this.#description?.remove();
      root.removeAttribute("aria-describedby");
    }
    this.#active = Math.min(this.#active, Math.max(0, marks.length - 1));
    marks.forEach((mark, index) => {
      mark.el.setAttribute("role", "img");
      mark.el.setAttribute("aria-label", mark.label);
      mark.el.setAttribute("tabindex", index === this.#active ? "0" : "-1");
    });
  }

  #syncTable(): void {
    const snapshot = this.#snapshot;
    if (!snapshot || this.#claims || !this.tableFallback || this.getAttribute("table") === "off") {
      this.#fallback?.remove();
      this.#fallback = undefined;
      return;
    }
    import("./chart-table.js").then(({ renderTable }) => {
      if (this.#snapshot !== snapshot || this.#claims || !this.isConnected) return;
      if (!this.#fallback) {
        this.#fallback = document.createElement("div");
        this.#fallback.dataset.uiPart = "fallback-table";
        this.#fallback.append(document.createElement("table"));
      }
      this.append(this.#fallback);
      renderTable(this.#fallback.firstChild as HTMLTableElement, snapshot);
    });
  }

  // ---- hover protocol: one listener, stable hit areas, no per-mark enter/leave ---------------

  #setHover(index: number, source: "pointer" | "keyboard" = "pointer"): void {
    const content = index >= 0 ? this.#result?.hover?.(index, source) : null;
    const previous = this.#hover;
    if (!content) {
      if (!previous) return;
      this.#marks[previous.index]?.removeAttribute("data-active");
      this.#hover = null;
      emit(this, CHART_EVENT.hover, null);
      return;
    }
    if (previous?.index === index && previous.source === source) return;
    if (previous) this.#marks[previous.index]?.removeAttribute("data-active");
    this.#marks[index]?.setAttribute("data-active", "");
    this.#hover = { ...content, index, source };
    emit(this, CHART_EVENT.hover, this.#hover);
  }

  readonly #onPointer = (event: PointerEvent) => {
    const hit = this.#result?.hit;
    if (!hit || !this.#svg) return;
    const box = this.#svg.getBoundingClientRect();
    this.#setHover(hit(event.clientX - box.left, event.clientY - box.top));
  };
  readonly #onLeave = (event: PointerEvent) => {
    // A finger lifting is not leaving: touch hover ends with the next press elsewhere.
    if (event.pointerType !== "touch" && this.#hover?.source === "pointer") this.#setHover(-1);
  };
  readonly #onOutside = (event: Event) => {
    if (this.#hover && !this.drawing.contains(event.target as Node)) this.#setHover(-1);
  };
  readonly #onFocusIn = (event: FocusEvent) => {
    const index = this.#marks.indexOf(event.target as SVGElement);
    if (index < 0) return;
    this.#marks[this.#active]?.setAttribute("tabindex", "-1");
    this.#active = index;
    this.#marks[index]?.setAttribute("tabindex", "0");
    if ((event.target as Element).matches(":focus-visible")) this.#setHover(index, "keyboard");
  };
  readonly #onFocusOut = (event: FocusEvent) => {
    if (!this.drawing.contains(event.relatedTarget as Node) && this.#hover?.source === "keyboard")
      this.#setHover(-1);
  };
  readonly #onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.#hover) {
      this.#setHover(-1);
      return;
    }
    const current = this.#marks.indexOf(event.target as SVGElement);
    if (current < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
    const dir = getComputedStyle(this).direction === "rtl" ? "rtl" : "ltr";
    const intent = getRovingIntent(event.key, { dir });
    if (!intent) return;
    event.preventDefault();
    findRovingTarget(this.#marks, this.#marks[current] as SVGElement, intent, false)?.focus();
  };
}
