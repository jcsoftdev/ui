import { SR_ONLY } from "./chart-dom.js";
import type { ChartHost, ChartSnapshot } from "./chart-protocol.js";

/** Rows a screen-reader table renders before it stops and points to the export. */
export const TABLE_ROW_LIMIT = 500;

export interface TableOptions {
  /** Most rows to render (default 500); `0` renders them all. */
  limit?: number;
  /** Text of the closing row when rows were left out; `{n}` is the number left out. */
  more?: string;
}

const cell = (tag: "th" | "td", text: string, scope?: "col" | "row") => {
  const node = document.createElement(tag);
  if (scope) node.scope = scope;
  node.textContent = text;
  return node;
};

const rendered = new WeakMap<HTMLTableElement, string>();
const versions = new WeakMap<object, number>();
let versionCount = 0;
const versionOf = (snapshot: ChartSnapshot) => {
  const known = versions.get(snapshot);
  if (known !== undefined) return known;
  versionCount += 1;
  versions.set(snapshot, versionCount);
  return versionCount;
};

/**
 * Fills `table` with the snapshot: a caption, a column header per series and one row per category,
 * up to `limit` rows followed by an "N more rows" note. Shared by `<ui-chart-data-table>` and the
 * chart's lazy screen-reader fallback. The table is rebuilt only when the snapshot (or the options)
 * changed, so calling it again with the same snapshot costs nothing.
 */
export function renderTable(
  table: HTMLTableElement,
  snapshot: ChartSnapshot,
  {
    limit = TABLE_ROW_LIMIT,
    more = "{n} more rows; use export to get them all",
  }: TableOptions = {},
): void {
  const key = `${versionOf(snapshot)}|${limit}|${more}`;
  if (rendered.get(table) === key) return;
  rendered.set(table, key);
  const caption = document.createElement("caption");
  caption.textContent = snapshot.title;
  const head = document.createElement("tr");
  head.append(cell("th", snapshot.categoryHeader, "col"));
  for (const series of snapshot.series) head.append(cell("th", series.name, "col"));
  const thead = document.createElement("thead");
  thead.append(head);
  const tbody = document.createElement("tbody");
  const total = snapshot.categories.length;
  const shown = limit > 0 ? Math.min(total, limit) : total;
  for (let row = 0; row < shown; row += 1) {
    const tr = document.createElement("tr");
    tr.append(cell("th", snapshot.categories[row] as string, "row"));
    for (const series of snapshot.series) tr.append(cell("td", series.text[row] ?? ""));
    tbody.append(tr);
  }
  if (shown < total) {
    const tr = document.createElement("tr");
    const note = cell("td", more.replace("{n}", `${total - shown}`));
    note.colSpan = snapshot.series.length + 1;
    tr.append(note);
    tbody.append(tr);
  }
  table.replaceChildren(caption, thead, tbody);
}

const fallbacks = new WeakMap<HTMLElement, { el?: HTMLElement; timer?: number }>();

/**
 * Keeps the chart's own screen-reader table in step: with `on`, builds it after the data stopped
 * changing for a moment (a burst of updates builds it once, and a 10k-point chart never pays for
 * it on the redraw); without, removes it.
 */
export function syncFallback(chart: ChartHost, on: boolean, more: string): void {
  const state = fallbacks.get(chart) ?? {};
  fallbacks.set(chart, state);
  clearTimeout(state.timer);
  if (!on) {
    state.el?.remove();
    state.el = undefined;
    return;
  }
  state.timer = window.setTimeout(() => {
    const snapshot = chart.chartSnapshot;
    if (!snapshot || !chart.isConnected) return;
    if (!state.el) {
      state.el = document.createElement("div");
      state.el.dataset.uiPart = "fallback-table";
      state.el.style.cssText = SR_ONLY;
      state.el.append(document.createElement("table"));
    }
    chart.append(state.el);
    renderTable(state.el.firstChild as HTMLTableElement, snapshot, { more });
  }, 250);
}
