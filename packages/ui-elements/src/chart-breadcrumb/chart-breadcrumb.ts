import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
} from "../internal/base.js";
import css from "./chart-breadcrumb.css.js";

export interface ChartBreadcrumbItem {
  id: string;
  name: string;
}

const CHEVRON =
  '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

/**
 * `<ui-chart-breadcrumb>`: the drill-down path of a hierarchy chart, a `nav` landmark with an
 * ordered list. Every ancestor is a button that zooms back out to it; the current node (the last)
 * is marked `aria-current="page"`. Set `items` (root first), listen for `select`
 * (`detail: { id }`).
 * Attributes: `label` (name of the landmark, default "Breadcrumb"), `items` (JSON array of
 * `{ id, name }`, for markup-only use). Property: `items`.
 */
export class UiChartBreadcrumb extends ElementBase {
  static observedAttributes = ["label", "items"];
  #items: readonly ChartBreadcrumbItem[] | undefined;
  readonly #nav = document.createElement("nav");
  readonly #list = document.createElement("ol");

  constructor() {
    super();
    this.#nav.append(this.#list);
    this.#list.addEventListener("click", (event) => {
      const id = (event.target as Element).closest<HTMLElement>("button[data-id]")?.dataset.id;
      if (id !== undefined) emit(this, "select", { id });
    });
  }

  get items(): readonly ChartBreadcrumbItem[] {
    if (this.#items) return this.#items;
    try {
      const parsed = JSON.parse(this.getAttribute("items") ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  set items(value: readonly ChartBreadcrumbItem[]) {
    this.#items = value;
    this.#render();
  }

  connectedCallback(): void {
    this.dataset.ui = "chart-breadcrumb";
    adoptStyles(rootOf(this), css);
    if (!this.#nav.isConnected) this.append(this.#nav);
    this.#render();
  }

  attributeChangedCallback(name: string): void {
    if (name === "items") this.#items = undefined;
    if (this.isConnected) this.#render();
  }

  #render(): void {
    this.#nav.setAttribute("aria-label", this.getAttribute("label") ?? "Breadcrumb");
    const items = this.items;
    this.#list.replaceChildren(
      ...items.map((item, index) => {
        const li = document.createElement("li");
        if (index > 0) li.insertAdjacentHTML("beforeend", CHEVRON);
        const current = index === items.length - 1;
        const node = document.createElement(current ? "span" : "button");
        node.textContent = item.name;
        if (current) node.setAttribute("aria-current", "page");
        else {
          (node as HTMLButtonElement).type = "button";
          node.dataset.id = item.id;
        }
        li.append(node);
        return li;
      }),
    );
  }
}

/** Registers `<ui-chart-breadcrumb>` (or `<prefix>-chart-breadcrumb`) and returns the tag. */
export function defineChartBreadcrumb(options?: DefineOptions): string {
  return defineElement("chart-breadcrumb", UiChartBreadcrumb, options);
}
