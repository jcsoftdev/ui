import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import { bindChart, CHART_EVENT } from "../internal/chart-protocol.js";
import { renderTable } from "../internal/chart-table.js";
import css from "./chart-data-table.css.js";

/**
 * `<ui-chart-data-table>`: the numbers of the chart it sits in (or the one `for` names) as a real
 * `<table>`: a caption, a column header per series and one row header per category, so the data is
 * reachable by screen readers and copy/paste without relying on color. Visually hidden by default;
 * add `visible` to show it. Using it replaces the chart's own lazy fallback table.
 * Attributes: `for` (chart id), `visible`.
 */
export class UiChartDataTable extends ElementBase {
  static observedAttributes = ["for"];
  #unbind: (() => void) | undefined;
  readonly #table = document.createElement("table");

  connectedCallback(): void {
    this.dataset.ui = "chart-data-table";
    adoptStyles(rootOf(this), css);
    if (!this.#table.isConnected) this.append(this.#table);
    this.#unbind = bindChart(this, (chart) => {
      chart.claimTable(true);
      const render = () => {
        const snapshot = chart.chartSnapshot;
        if (snapshot) renderTable(this.#table, snapshot);
        else this.#table.replaceChildren();
      };
      chart.addEventListener(CHART_EVENT.data, render);
      render();
      return () => {
        chart.removeEventListener(CHART_EVENT.data, render);
        chart.claimTable(false);
      };
    });
  }

  disconnectedCallback(): void {
    this.#unbind?.();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#unbind?.();
    this.connectedCallback();
  }

  get visible(): boolean {
    return this.hasAttribute("visible");
  }
  set visible(value: boolean) {
    this.toggleAttribute("visible", value);
  }
}

/** Registers `<ui-chart-data-table>` (or `<prefix>-chart-data-table`) and returns the tag. */
export function defineChartDataTable(options?: DefineOptions): string {
  return defineElement("chart-data-table", UiChartDataTable, options);
}
