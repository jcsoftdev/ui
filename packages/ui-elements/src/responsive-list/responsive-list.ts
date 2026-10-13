import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { part, upgradeProperties } from "../internal/e10.js";
import css from "./responsive-list.css.js";

/** What a cell or an actions renderer may return. */
export type CellContent = Node | string | number | null | undefined;

export interface ResponsiveListColumn<T> {
  key: string;
  header: string;
  /** Renders the cell. It runs once for the table and once for the card, so each gets its own node. */
  cell: (item: T) => CellContent;
  /** Title of the stacked card. Defaults to the first column. */
  primary?: boolean;
  align?: "start" | "end";
}

const fill = (target: Element, content: CellContent): void => {
  if (content === null || content === undefined) return;
  target.append(content instanceof Node ? content : String(content));
};

/**
 * `<ui-responsive-list>`: a table from 48rem of its own width up and a stack of cards below it,
 * from one column definition. The switch follows the width of the element (a container query), not
 * the viewport, and costs no JavaScript at run time. Both views are rendered; the hidden one is
 * `display: none`, so assistive technology reads only the visible one.
 *
 * ARIA: the table has the `caption` as its accessible name (visually hidden) and `scope="col"`
 * headers; the card list is a `<ul>` with the same name; each card's details are a description
 * list.
 *
 * It is driven by properties, like a data grid: `columns` ({@link ResponsiveListColumn}, with a
 * `cell(item)` returning text or a node), `items`, `rowKey(item)` (stable id, also written to
 * `data-row-key`), `renderActions(item)` (a last table column and a footer row on each card) and
 * `rowClass(item)` (extra class name on a row or card). Assigning any of them re-renders on the
 * next microtask; call `render()` to force it after mutating an array in place.
 * Attributes: `caption`; `actions-header` (header of the actions column, default "Actions").
 */
export class UiResponsiveList<T = unknown> extends ElementBase {
  static observedAttributes = ["caption", "actions-header"];

  #columns: readonly ResponsiveListColumn<T>[] = [];
  #items: readonly T[] = [];
  #rowKey: (item: T) => string = (_item) => "";
  #renderActions: ((item: T) => CellContent) | undefined;
  #rowClass: ((item: T) => string | undefined) | undefined;
  #pending = false;

  get columns(): readonly ResponsiveListColumn<T>[] {
    return this.#columns;
  }
  set columns(value: readonly ResponsiveListColumn<T>[]) {
    this.#columns = value;
    this.#queue();
  }

  get items(): readonly T[] {
    return this.#items;
  }
  set items(value: readonly T[]) {
    this.#items = value;
    this.#queue();
  }

  get rowKey(): (item: T) => string {
    return this.#rowKey;
  }
  set rowKey(value: (item: T) => string) {
    this.#rowKey = value;
    this.#queue();
  }

  get renderActions(): ((item: T) => CellContent) | undefined {
    return this.#renderActions;
  }
  set renderActions(value: ((item: T) => CellContent) | undefined) {
    this.#renderActions = value;
    this.#queue();
  }

  get rowClass(): ((item: T) => string | undefined) | undefined {
    return this.#rowClass;
  }
  set rowClass(value: ((item: T) => string | undefined) | undefined) {
    this.#rowClass = value;
    this.#queue();
  }

  connectedCallback(): void {
    connectLight(this, "responsive-list", css);
    upgradeProperties(this, ["columns", "items", "rowKey", "renderActions", "rowClass"]);
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#queue();
  }

  #queue(): void {
    if (this.#pending || !this.isConnected) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      if (this.isConnected) this.render();
    });
  }

  /** Renders the table and the cards from the current properties. */
  render(): void {
    const restore = this.#focusMemo();
    const caption = this.getAttribute("caption") ?? "";
    const columns = this.#columns;
    const primary = columns.find((column) => column.primary) ?? columns[0];
    const details = columns.filter((column) => column !== primary);
    const actions = this.#renderActions;

    const wrapper = part("div", "table-wrapper");
    const table = part("table", "table");
    const captionElement = part("caption", "caption", caption);
    const head = part("thead", "head");
    const headRow = part("tr", "head-row");
    for (const column of columns)
      headRow.append(this.#header(column.header, column.align === "end"));
    if (actions)
      headRow.append(this.#header(this.getAttribute("actions-header") ?? "Actions", true));
    head.append(headRow);
    const body = part("tbody", "body");
    const cards = part("ul", "cards");
    cards.setAttribute("aria-label", caption);

    for (const item of this.#items) {
      const key = this.#rowKey(item);
      const extra = this.#rowClass?.(item);

      const row = part("tr", "row");
      row.dataset.rowKey = key;
      if (extra) row.className = extra;
      for (const column of columns) {
        const cell = part("td", "cell");
        if (column.align === "end") cell.dataset.align = "end";
        fill(cell, column.cell(item));
        row.append(cell);
      }
      if (actions) {
        const cell = part("td", "cell");
        cell.dataset.align = "end";
        const group = part("div", "actions");
        fill(group, actions(item));
        cell.append(group);
        row.append(cell);
      }
      body.append(row);

      const card = part("li", "card");
      card.dataset.rowKey = key;
      if (extra) card.className = extra;
      const title = part("div", "card-title");
      if (primary) fill(title, primary.cell(item));
      card.append(title);
      if (details.length > 0) {
        const list = part("dl", "card-details");
        for (const column of details) {
          const entry = part("div", "card-detail");
          const label = part("dt", "card-label", column.header);
          const value = part("dd", "card-value");
          fill(value, column.cell(item));
          entry.append(label, value);
          list.append(entry);
        }
        card.append(list);
      }
      if (actions) {
        const footer = part("div", "actions");
        fill(footer, actions(item));
        card.append(footer);
      }
      cards.append(card);
    }

    table.append(captionElement, head, body);
    wrapper.append(table);
    this.replaceChildren(wrapper, cards);
    restore();
  }

  /** Remembers the focused control (view, row key, position in the row) and returns a function that focuses its twin after a render. */
  #focusMemo(): () => void {
    const active = (this.getRootNode() as Document | ShadowRoot).activeElement;
    if (!active || !this.contains(active)) return () => {};
    const row = active.closest<HTMLElement>("[data-row-key]");
    const view = active.closest("[data-ui-part=cards]") ? "cards" : "table-wrapper";
    if (!row) return () => {};
    const focusables = (scope: Element) =>
      Array.from(
        scope.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]"),
      );
    const index = focusables(row).indexOf(active as HTMLElement);
    const key = row.dataset.rowKey;
    return () => {
      for (const candidate of this.querySelectorAll<HTMLElement>(
        `[data-ui-part=${view}] [data-row-key], [data-ui-part=${view}][data-row-key]`,
      ))
        if (candidate.dataset.rowKey === key) {
          focusables(candidate)[Math.max(index, 0)]?.focus();
          return;
        }
    };
  }

  #header(text: string, alignEnd: boolean): HTMLElement {
    const th = part("th", "header", text);
    th.scope = "col";
    if (alignEnd) th.dataset.align = "end";
    return th;
  }
}

/** Registers `<ui-responsive-list>` (or the same under another prefix) and returns its tag. */
export function defineResponsiveList(options?: DefineOptions): string {
  return defineElement("responsive-list", UiResponsiveList, options);
}
