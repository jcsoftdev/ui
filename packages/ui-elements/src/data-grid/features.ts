import type { UiDataGrid } from "./data-grid.js";

// Starts the chunk of each opt-in spreadsheet feature whose attribute is set. The grid loads this
// small module only when one of them is, so a plain grid never fetches it, and the list of chunks
// stays out of the grid's own bytes. Each `install` runs once per grid, however often this does.

/** Installs the features the grid asks for, again whenever one of their attributes changes. */
export function install(grid: UiDataGrid): void {
  if (grid.hasAttribute("history")) void import("./history.js").then((f) => f.install(grid));
  if (grid.hasAttribute("range-selection")) void import("./range.js").then((f) => f.install(grid));
  if (grid.hasAttribute("clipboard")) void import("./clipboard.js").then((f) => f.install(grid));
  if (grid.hasAttribute("fill-handle")) void import("./fill.js").then((f) => f.install(grid));
  if (grid.hasAttribute("formulas")) void import("./formula.js").then((f) => f.install(grid));
  if (grid.hasAttribute("editable-rows")) void import("./rows.js").then((f) => f.install(grid));
}
