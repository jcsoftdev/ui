import type { ChartSnapshot } from "./chart-protocol.js";

const cell = (tag: "th" | "td", text: string, scope?: "col" | "row") => {
  const node = document.createElement(tag);
  if (scope) node.scope = scope;
  node.textContent = text;
  return node;
};

/**
 * Fills `table` with the snapshot: a caption, a column header per series and one row per category.
 * Shared by `<ui-chart-data-table>` and the chart's lazy screen-reader fallback.
 */
export function renderTable(table: HTMLTableElement, snapshot: ChartSnapshot): void {
  const caption = document.createElement("caption");
  caption.textContent = snapshot.title;
  const head = document.createElement("tr");
  head.append(cell("th", snapshot.categoryHeader, "col"));
  for (const series of snapshot.series) head.append(cell("th", series.name, "col"));
  const thead = document.createElement("thead");
  thead.append(head);
  const tbody = document.createElement("tbody");
  snapshot.categories.forEach((category, row) => {
    const tr = document.createElement("tr");
    tr.append(cell("th", category, "row"));
    for (const series of snapshot.series) tr.append(cell("td", series.text[row] ?? ""));
    tbody.append(tr);
  });
  table.replaceChildren(caption, thead, tbody);
}
