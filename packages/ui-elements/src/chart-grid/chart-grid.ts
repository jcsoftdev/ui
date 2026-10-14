import { type Extent, gridColumns, panelWidth, sharedDomain } from "@jcsoftdev/ui-core/chart/grid";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
  uid,
} from "../internal/base.js";
import { swatch } from "../internal/chart-dom.js";
import type { MarkShape } from "../internal/chart-protocol.js";
import css from "./chart-grid.css.js";

export type { Extent };

export interface ChartGridPanel {
  id: string;
  /** Heading of the panel, e.g. the barber. */
  title: string;
  /** Short line next to the title, e.g. a total. */
  subtitle?: string;
  /** Range of this panel on the value axis; feeds the shared value domain. */
  extent?: Extent;
  /** Range on the x axis; feeds the shared x domain. */
  xExtent?: Extent;
}

export interface ChartGridContext {
  index: number;
  columns: number;
  /** The panel is narrow: hide secondary decoration (titles, extra ticks). */
  compact: boolean;
  /** Pixel height the chart of the panel should use. */
  height: number;
  /** Ticks the value axis can afford at that height (3 to 6); also what the shared domain was rounded for. */
  tickCount: number;
  /** Shared value-axis domain, or undefined when `shared-value-domain="off"`. */
  valueDomain?: readonly [number, number];
  /** Shared x-axis domain, or undefined unless `shared-x-domain` is set. */
  xDomain?: readonly [number, number];
  /** Legend item id hovered or focused in the shared legend. */
  highlight: string | null;
}

export interface ChartGridLegendItem {
  id: string;
  name: string;
  color: string;
  shape?: MarkShape;
}

/** Fired on the content of a panel (not bubbling) each time its context changes. */
export const CHART_GRID_CONTEXT = "chart-grid-context";
/** Fired on the grid when the shared legend highlights an item (`detail`: `{ id }`, `id` null on leave). */
export const CHART_GRID_HIGHLIGHT = "chart-grid-highlight";

const COMPACT_BELOW = 260;

const num = (value: string | null, fallback: number): number => {
  const parsed = value === null || value.trim() === "" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const pair = (text: string | undefined): Extent | undefined => {
  const parts = text?.split(",").map(Number);
  return parts && parts.length === 2 && parts.every(Number.isFinite)
    ? [parts[0] as number, parts[1] as number]
    : undefined;
};

type Cell = { panel: ChartGridPanel; article: HTMLElement; content: Node | null };

/**
 * `<ui-chart-grid>`: small multiples (a trellis). The same chart repeated per category over shared
 * scales, so panels compare at a glance. Columns follow the width of the grid, never the viewport:
 * as many as keep every panel at least `min-panel-width` wide. It lays panels out and shares the
 * value domain; the charts inside are any elements.
 *
 * Panels come from the `panels` property, drawn by the `render(panel, context)` property (return
 * the element of the panel; it is called once per panel), or from the children: every direct child
 * with `data-title` becomes a panel (`data-subtitle`, `data-id`, `data-extent="0,100"`,
 * `data-x-extent="0,10"` are optional). The grid sets `height` on chart elements
 * (`[data-ui-chart]`) unless the child has `data-keep-height`, and fires `chart-grid-context` on
 * the content of each panel (`detail`: a `ChartGridContext` with the shared domains and the legend
 * highlight) whenever the layout, the data or the highlight changes.
 *
 * Attributes: `label` (accessible name of the grid), `min-panel-width` (220), `max-columns` (6),
 * `gap` (16), `panel-height` (default: about 1.4:1 from the panel width, at least 180),
 * `aspect-ratio` (wins over `panel-height`), `shared-value-domain="off"`, `shared-x-domain`,
 * `include-zero` (keep zero inside the shared domain; for bars), `bordered`, `empty-label`.
 * Properties: `panels`, `render`, `legend` (one shared legend of `{ id, name, color, shape? }`
 * items, which highlight on hover or focus; the charts' own legends should be off), `columns`
 * (read-only).
 */
export class UiChartGrid extends ElementBase {
  static observedAttributes = [
    "label",
    "min-panel-width",
    "max-columns",
    "gap",
    "panel-height",
    "aspect-ratio",
    "shared-value-domain",
    "shared-x-domain",
    "include-zero",
    "bordered",
    "empty-label",
  ];
  #panels: readonly ChartGridPanel[] | undefined;
  #render:
    | ((panel: ChartGridPanel, context: ChartGridContext) => Node | null | undefined)
    | undefined;
  #legend: readonly ChartGridLegendItem[] | undefined;
  #declared = new Map<ChartGridPanel, Element>();
  #cells: Cell[] = [];
  #key = "";
  #width = 0;
  #columns = 1;
  #highlight: string | null = null;
  #frame = 0;
  #observer: ResizeObserver | undefined;
  #mutations: MutationObserver | undefined;
  #list: HTMLElement | undefined;
  #legendEl: HTMLElement | undefined;
  #empty: HTMLElement | undefined;
  readonly #uid = uid("grid");

  get panels(): readonly ChartGridPanel[] {
    return this.#panels ?? [...this.#declared.keys()];
  }
  set panels(value: readonly ChartGridPanel[] | undefined) {
    this.#panels = value;
    this.#schedule();
  }
  get render():
    | ((panel: ChartGridPanel, context: ChartGridContext) => Node | null | undefined)
    | undefined {
    return this.#render;
  }
  set render(value) {
    this.#render = value;
    this.#key = "";
    this.#schedule();
  }
  get legend(): readonly ChartGridLegendItem[] | undefined {
    return this.#legend;
  }
  set legend(value: readonly ChartGridLegendItem[] | undefined) {
    this.#legend = value;
    this.#key = "";
    this.#schedule();
  }
  /** Columns of the current layout. */
  get columns(): number {
    return this.#columns;
  }

  connectedCallback(): void {
    this.dataset.ui = "chart-grid";
    adoptStyles(rootOf(this), css);
    this.setAttribute("role", "group");
    this.#syncLabel();
    this.#collect();
    this.#width = Math.floor(this.getBoundingClientRect().width);
    this.#observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry?.contentRect.width ?? 0);
      if (width === this.#width) return;
      this.#width = width;
      this.#schedule();
    });
    this.#observer.observe(this);
    this.#mutations = new MutationObserver(() => {
      if (this.#collect()) this.#schedule();
    });
    this.#mutations.observe(this, { childList: true });
    this.#schedule();
  }

  disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#observer?.disconnect();
    this.#mutations?.disconnect();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "label") this.#syncLabel();
    this.#schedule();
  }

  #syncLabel(): void {
    const label = this.getAttribute("label");
    if (label) this.setAttribute("aria-label", label);
    else this.removeAttribute("aria-label");
  }

  /** Takes the children with `data-title` out of the flow as panels. Returns whether any was new. */
  #collect(): boolean {
    let found = false;
    for (const child of [...this.children]) {
      if (child.hasAttribute("data-ui-part") || !child.hasAttribute("data-title")) continue;
      const data = (child as HTMLElement).dataset;
      this.#declared.set(
        {
          id: data.id ?? child.id ?? `${this.#declared.size}`,
          title: data.title ?? "",
          subtitle: data.subtitle,
          extent: pair(data.extent),
          xExtent: pair(data.xExtent),
        },
        child,
      );
      child.remove();
      found = true;
    }
    if (found) this.#key = "";
    return found;
  }

  #schedule(): void {
    if (!this.#frame && this.isConnected)
      this.#frame = requestAnimationFrame(() => {
        this.#frame = 0;
        this.#update();
      });
  }

  #update(): void {
    if (!this.isConnected || !this.#width) return;
    const panels = this.panels;
    const gap = Math.max(0, num(this.getAttribute("gap"), 16));
    const columns = gridColumns(this.#width, panels.length, {
      minPanelWidth: num(this.getAttribute("min-panel-width"), 220),
      maxColumns: num(this.getAttribute("max-columns"), 6),
      gap,
    });
    const each = panelWidth(this.#width, columns, gap);
    const ratio = num(this.getAttribute("aspect-ratio"), 0);
    const fixed = num(this.getAttribute("panel-height"), 0);
    const height = Math.max(
      90,
      Math.round(ratio > 0 ? each / ratio : fixed > 0 ? fixed : Math.max(180, each / 1.4)),
    );
    const tickCount = Math.min(6, Math.max(3, Math.round((height - 60) / 42)));
    const shared = this.getAttribute("shared-value-domain") !== "off";
    const valueDomain = shared
      ? (sharedDomain(
          panels.map((panel) => panel.extent),
          { includeZero: this.hasAttribute("include-zero"), tickCount },
        ) ?? undefined)
      : undefined;
    const xDomain = this.hasAttribute("shared-x-domain")
      ? (sharedDomain(
          panels.map((panel) => panel.xExtent),
          { nice: false },
        ) ?? undefined)
      : undefined;
    this.#columns = columns;

    const context = (index: number): ChartGridContext => ({
      index,
      columns,
      compact: each < COMPACT_BELOW,
      height,
      tickCount,
      valueDomain,
      xDomain,
      highlight: this.#highlight,
    });
    const key = `${panels.map((panel) => panel.id).join("\n")}|${this.#bordered()}`;
    if (key !== this.#key || this.#cells.length !== panels.length) {
      this.#key = key;
      this.#build(panels, context);
    }
    if (this.#list) {
      this.#list.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
      this.#list.style.gap = `${gap}px`;
    }
    if (this.#empty) {
      this.#empty.style.height = `${height}px`;
      this.#empty.textContent = this.getAttribute("empty-label") ?? "No data";
    }
    this.#cells.forEach((cell, index) => {
      const ctx = context(index);
      cell.article.toggleAttribute("data-compact", ctx.compact);
      const content = cell.content;
      if (!(content instanceof Element)) return;
      if (content.hasAttribute("data-ui-chart") && !content.hasAttribute("data-keep-height"))
        content.setAttribute("height", `${height}`);
      content.dispatchEvent(new CustomEvent(CHART_GRID_CONTEXT, { detail: ctx }));
    });
  }

  #bordered(): boolean {
    return this.hasAttribute("bordered");
  }

  #build(panels: readonly ChartGridPanel[], context: (index: number) => ChartGridContext): void {
    this.#list?.remove();
    this.#empty?.remove();
    this.#legendEl?.remove();
    this.#list = undefined;
    this.#empty = undefined;
    this.#legendEl = undefined;
    this.#cells = [];
    if (this.#legend?.length) {
      const legend = document.createElement("div");
      legend.dataset.uiPart = "legend";
      for (const item of this.#legend) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.id = item.id;
        const name = document.createElement("span");
        name.textContent = item.name;
        button.append(swatch(item.color, item.shape), name);
        legend.append(button);
      }
      const set = (id: string | null) => {
        if (this.#highlight === id) return;
        this.#highlight = id;
        emit(this, CHART_GRID_HIGHLIGHT, { id });
        this.#schedule();
      };
      legend.addEventListener("pointerover", (event) =>
        set((event.target as Element).closest<HTMLElement>("button")?.dataset.id ?? null),
      );
      legend.addEventListener("pointerleave", () => set(null));
      legend.addEventListener("focusin", (event) =>
        set((event.target as Element).closest<HTMLElement>("button")?.dataset.id ?? null),
      );
      legend.addEventListener("focusout", () => set(null));
      this.#legendEl = legend;
      this.append(legend);
    }
    if (!panels.length) {
      const empty = document.createElement("p");
      empty.dataset.uiPart = "empty";
      empty.setAttribute("role", "status");
      this.#empty = empty;
      this.append(empty);
      return;
    }
    const list = document.createElement("div");
    list.dataset.uiPart = "panels";
    panels.forEach((panel, index) => {
      const article = document.createElement("article");
      const heading = document.createElement("h3");
      heading.id = `${this.#uid}-${index}`;
      heading.textContent = panel.title;
      article.setAttribute("aria-labelledby", heading.id);
      const header = document.createElement("header");
      header.append(heading);
      if (panel.subtitle) {
        const sub = document.createElement("span");
        sub.textContent = panel.subtitle;
        header.append(sub);
      }
      const body = document.createElement("div");
      body.dataset.uiPart = "body";
      const content = this.#declared.get(panel) ?? this.#render?.(panel, context(index)) ?? null;
      if (content) body.append(content);
      article.append(header, body);
      list.append(article);
      this.#cells.push({ panel, article, content });
    });
    this.#list = list;
    this.append(list);
  }
}

/** Registers `<ui-chart-grid>` (or `<prefix>-chart-grid`) and returns the tag. */
export function defineChartGrid(options?: DefineOptions): string {
  return defineElement("chart-grid", UiChartGrid, options);
}
