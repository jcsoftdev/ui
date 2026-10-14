import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
} from "../internal/base.js";
import css from "./choropleth-drilldown.css.js";

/** One level of a drilldown: a map and the values of its regions. */
export interface DrilldownLevel {
  id: string;
  /** Name in the breadcrumb, e.g. "Mundo" or "Perú". */
  name: string;
  /** A bundled map id (`world`, `peru`) or a `GeoMap` object. */
  map: unknown;
  data: ReadonlyArray<{ id: string; value: number | null }>;
  /** Overrides the `value-name` of the map for this level. */
  valueName?: string;
}

/** What a region reports: `chart.regions[index]` of the choropleth. */
export interface DrilldownRegion {
  index: number;
  id: string;
  name: string;
  value: number | null;
}

/** The part of `ui-choropleth-map` the drilldown drives, by duck typing (the entries never import each other). */
interface MapLike extends HTMLElement {
  map: unknown;
  data: unknown;
  regions: readonly DrilldownRegion[];
  select(index: number | null): void;
}

/** The part of `ui-chart-breadcrumb` it drives: an `items` property and a `select` event with `detail.id`. */
interface BreadcrumbLike extends HTMLElement {
  items: ReadonlyArray<{ id: string; name: string }>;
}

/**
 * `<ui-choropleth-drilldown>`: a `ui-choropleth-map` that opens a region into a finer map (world to
 * country, country to departments) with a breadcrumb back up, like React's `ChoroplethDrilldown`. It
 * composes children you write, so it adds no bytes to a plain choropleth and each level only loads
 * the map it shows:
 *
 *     <ui-choropleth-drilldown label="Customers">
 *       <ui-chart-breadcrumb></ui-chart-breadcrumb>
 *       <ui-choropleth-map id="m"></ui-choropleth-map>
 *       <ui-chart-legend for="m"></ui-chart-legend>
 *     </ui-choropleth-drilldown>
 *
 * Set `root` (a `DrilldownLevel`) and `resolve(region, path)`, which returns the level to open for a
 * region or nothing. A click, tap or Enter opens it (`drill-on="select"`, the default); with
 * `drill-on="drill"` only a double click, Shift+Enter or `chart.drill(i)` does (`chart-drill`). A
 * region without a level fires `region-click` (`detail`: `{ region, path }`) instead. The path is
 * announced politely, the chart is named "label: level", and the breadcrumb (any element with an
 * `items` property that fires `select` with `detail.id`) takes you back up.
 *
 * Attributes: `label` (accessible name of the chart; the level is appended), `drill-on`,
 * `breadcrumb-label`. Properties: `root`, `resolve`, `path` (read-only, root first). Events:
 * `drilldown-change` (`detail`: `{ path }` of level ids), `region-click`.
 */
export class UiChoroplethDrilldown extends ElementBase {
  static observedAttributes = ["label", "breadcrumb-label"];
  #root: DrilldownLevel | undefined;
  resolve:
    | ((
        region: DrilldownRegion,
        path: readonly DrilldownLevel[],
      ) => DrilldownLevel | null | undefined)
    | undefined;
  #path: readonly DrilldownLevel[] = [];
  #status: HTMLElement | undefined;
  #signal: AbortController | undefined;

  get root(): DrilldownLevel | undefined {
    return this.#root;
  }
  set root(value: DrilldownLevel | undefined) {
    this.#root = value;
    if (this.isConnected && value) this.go([value]);
  }

  get path(): readonly DrilldownLevel[] {
    return this.#path;
  }

  #chart(): MapLike | null {
    return this.querySelector<MapLike>("[data-ui-geo]");
  }
  #crumbs(): BreadcrumbLike | null {
    return this.querySelector<BreadcrumbLike>("[data-ui=chart-breadcrumb]");
  }

  connectedCallback(): void {
    this.dataset.ui = "choropleth-drilldown";
    adoptStyles(rootOf(this), css);
    this.#signal = new AbortController();
    const { signal } = this.#signal;
    this.#status = document.createElement("span");
    this.#status.dataset.uiPart = "drill-status";
    this.#status.setAttribute("role", "status");
    this.append(this.#status);
    const open = (event: Event, via: "select" | "drill") => {
      const detail = (event as CustomEvent<{ index: number } | null>).detail;
      const chart = this.#chart();
      if (!detail || !chart || event.target !== chart) return;
      if ((this.getAttribute("drill-on") ?? "select") !== via && via === "select") return;
      const region = chart.regions[detail.index];
      if (!region) return;
      const next = this.resolve?.(region, this.#path);
      if (next) this.go([...this.#path, next]);
      else emit(this, "region-click", { region, path: this.#path });
    };
    this.addEventListener("chart-select", (event) => open(event, "select"), { signal });
    this.addEventListener("chart-drill", (event) => open(event, "drill"), { signal });
    this.addEventListener(
      "select",
      (event) => {
        if (event.target !== this.#crumbs()) return;
        const id = (event as CustomEvent<{ id: string }>).detail?.id;
        const index = this.#path.findIndex((level) => level.id === id);
        if (index >= 0) this.go(this.#path.slice(0, index + 1));
      },
      { signal },
    );
    queueMicrotask(() => {
      if (this.#path.length === 0 && this.#root) this.go([this.#root]);
    });
  }

  disconnectedCallback(): void {
    this.#signal?.abort();
    this.#status?.remove();
  }

  attributeChangedCallback(): void {
    if (this.isConnected && this.#path.length > 0) this.#apply();
  }

  /** Shows `path` (root first). Called by the drilldown itself; call it to restore a saved path. */
  go(path: readonly DrilldownLevel[]): void {
    this.#path = path;
    this.#apply();
    emit(this, "drilldown-change", { path: path.map((level) => level.id) });
  }

  #apply(): void {
    const level = this.#path[this.#path.length - 1];
    const chart = this.#chart();
    if (!level || !chart) return;
    chart.select(null);
    chart.map = level.map;
    chart.data = level.data;
    if (level.valueName) chart.setAttribute("value-name", level.valueName);
    else chart.removeAttribute("value-name");
    const title = this.getAttribute("label");
    chart.setAttribute("label", title ? `${title}: ${level.name}` : level.name);
    const crumbs = this.#crumbs();
    if (crumbs) {
      crumbs.setAttribute("label", this.getAttribute("breadcrumb-label") ?? "Map level");
      crumbs.items = this.#path.map(({ id, name }) => ({ id, name }));
    }
    if (this.#status) this.#status.textContent = this.#path.map((item) => item.name).join(" > ");
  }
}

/** Registers `<ui-choropleth-drilldown>` (or `<prefix>-choropleth-drilldown`) and returns the tag. */
export function defineChoroplethDrilldown(options?: DefineOptions): string {
  return defineElement("choropleth-drilldown", UiChoroplethDrilldown, options);
}
