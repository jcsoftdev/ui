import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import { swatch } from "../internal/chart-dom.js";
import {
  bindChart,
  CHART_EVENT,
  type ChartHost,
  type LegendItem,
} from "../internal/chart-protocol.js";
import css from "./chart-legend.css.js";

interface Item {
  li: HTMLLIElement;
  control: HTMLElement;
  name: HTMLSpanElement;
  key: string;
}

/**
 * `<ui-chart-legend>`: the series legend of the chart it sits in (or the one `for` names). Each
 * item is a toggle button (`aria-pressed`), so hiding a series works with mouse, touch and
 * keyboard, and the last visible series cannot be hidden. Hovering or focusing an item dims the
 * other series. It imports no chart code: it reads the chart's snapshot, whose `legend` lists the
 * toggles (else one per series, the columns of the data table), and whose `scale`, for a continuous
 * color range, replaces the items with a gradient bar between its two end values.
 * Attributes: `for` (chart id), `align` (`start`, `center`, `end`), `position` (`top` default,
 * `bottom`), `readonly` (plain items, no toggling), `label` (name of the list, default "Series").
 */
export class UiChartLegend extends ElementBase {
  static observedAttributes = ["for", "readonly", "label"];
  #chart: ChartHost | undefined;
  #unbind: (() => void) | undefined;
  readonly #list = document.createElement("ul");
  readonly #items = new Map<string, Item>();
  readonly #scale = document.createElement("div");

  connectedCallback(): void {
    this.dataset.ui = "chart-legend";
    adoptStyles(rootOf(this), css);
    if (!this.#list.isConnected) this.append(this.#list);

    this.#list.setAttribute("aria-label", this.getAttribute("label") ?? "Series");
    this.#unbind = bindChart(this, (chart) => {
      this.#chart = chart;
      const render = () => this.#render();
      chart.addEventListener(CHART_EVENT.data, render);
      chart.addEventListener(CHART_EVENT.series, render);
      render();
      return () => {
        chart.removeEventListener(CHART_EVENT.data, render);
        chart.removeEventListener(CHART_EVENT.series, render);
        this.#chart = undefined;
      };
    });
  }

  disconnectedCallback(): void {
    this.#unbind?.();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "for") {
      this.#unbind?.();
      this.connectedCallback();
    } else if (name === "label")
      this.#list.setAttribute("aria-label", this.getAttribute("label") ?? "Series");
    else {
      this.#items.clear();
      this.#list.replaceChildren();
      this.#render();
    }
  }

  #make(series: LegendItem): Item {
    const li = document.createElement("li");
    const control = document.createElement(this.hasAttribute("readonly") ? "span" : "button");
    if (control instanceof HTMLButtonElement) control.type = "button";
    const name = document.createElement("span");
    name.dataset.uiPart = "name";
    li.append(control);
    const id = series.id;
    if (control instanceof HTMLButtonElement) {
      control.addEventListener("click", () => this.#chart?.toggleSeries(id));
      for (const [enter, leave] of [
        ["pointerenter", "pointerleave"],
        ["focus", "blur"],
      ] as const) {
        control.addEventListener(enter, () => this.#chart?.highlight(id));
        control.addEventListener(leave, () => this.#chart?.highlight(null));
      }
    }
    return { li, control, name, key: "" };
  }

  #render(): void {
    const chart = this.#chart;
    const snapshot = chart?.chartSnapshot;
    const scale = snapshot?.scale;
    this.#list.hidden = !!scale;
    if (scale) {
      // A continuous scale is rare: its drawing and stylesheet are a chunk of their own.
      import("../internal/chart-scale.js").then(({ renderScale }) => {
        if (this.#chart?.chartSnapshot?.scale !== scale) return;
        renderScale(this, this.#scale, scale, this.getAttribute("label"));
        if (!this.#scale.isConnected) this.append(this.#scale);
      });
    } else this.#scale.remove();
    const series: readonly LegendItem[] = scale ? [] : (snapshot?.legend ?? snapshot?.series ?? []);
    const visible = series.filter((s) => !chart?.isHidden(s.id)).length;
    const live = new Set(series.map((s) => s.id));
    for (const [id, item] of this.#items)
      if (!live.has(id)) {
        item.li.remove();
        this.#items.delete(id);
      }
    series.forEach((s, index) => {
      let item = this.#items.get(s.id);
      if (!item) {
        item = this.#make(s);
        this.#items.set(s.id, item);
      }
      const hidden = !!chart?.isHidden(s.id);
      item.name.textContent = s.name;
      const key = `${s.color}|${s.shape}`;
      if (item.key !== key) {
        item.key = key;
        item.control.replaceChildren(swatch(s.color, s.shape), item.name);
      }
      item.li.toggleAttribute("data-hidden", hidden);
      if (item.control instanceof HTMLButtonElement) {
        item.control.setAttribute("aria-pressed", `${!hidden}`);
        item.control.disabled = !hidden && visible <= 1;
      }
      if (this.#list.children[index] !== item.li)
        this.#list.insertBefore(item.li, this.#list.children[index] ?? null);
    });
  }
}

/** Registers `<ui-chart-legend>` (or `<prefix>-chart-legend`) and returns the tag. */
export function defineChartLegend(options?: DefineOptions): string {
  return defineElement("chart-legend", UiChartLegend, options);
}
