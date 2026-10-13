import type { RowRef } from "@jcsoftdev/ui-core/grid/history";
import { emit } from "../internal/base.js";
import type { ChangeSource, UiDataGrid } from "./data-grid.js";
import { announce, type Row } from "./shared.js";

// Row creation and removal, loaded by the grid when `editable-rows` is set. It defines `addRow()`
// (appends what the `createRow` property returns), `addRows(entries)` and `removeRows(keys?)` on
// the grid. Each fires a cancelable `beforerowschange` and then one `rowschange`
// `{type: "add" | "remove", rows: [{row, rowId, index}], source}`, the same shape as the React
// grid's `onRowsChange`. `edit-mode="mutate"` (the default) replaces `rows` with the new array
// (the array the consumer passed is never mutated); `emit` only reports, and the consumer applies
// it. With `history`, an add or a remove is a step like a cell batch; undo reports the inverse
// with source `undo`.

const installed = new WeakSet<UiDataGrid>();

/** The key a row gets at `index`, as the grid derives it. */
function keyFor(grid: UiDataGrid, row: Row, index: number): string {
  const rowKey = grid.rowKey;
  if (typeof rowKey === "function") return String(rowKey(row, index));
  if (typeof rowKey === "string" && row != null) return String(row[rowKey]);
  return String(index);
}

/**
 * Applies an add or a remove of `refs` (`index` is the position in `rows`). Returns `false` when
 * `beforerowschange` was cancelled or there was nothing to do.
 */
export function applyRows(
  grid: UiDataGrid,
  type: "add" | "remove",
  refs: readonly RowRef<Row>[],
  source: ChangeSource,
): boolean {
  if (refs.length === 0) return false;
  const sorted = [...refs].sort((a, b) => a.index - b.index);
  const rows = [...grid.rows];
  let list = sorted;
  if (type === "add") {
    // Insert in ascending order, so each index is where the row ends up.
    list = sorted.map((ref) => {
      const index = Math.max(0, Math.min(ref.index, rows.length));
      rows.splice(index, 0, ref.row);
      return { row: ref.row, rowId: keyFor(grid, ref.row, index), index };
    });
  }
  if (!emit(grid, "beforerowschange", { type, rows: list, source }, true)) return false;
  if (grid.getAttribute("edit-mode") !== "emit") {
    if (type === "add") grid.rows = rows;
    else {
      const gone = new Set(sorted.map((ref) => ref.row));
      grid.rows = grid.rows.filter((row) => !gone.has(row));
      const keys = new Set(sorted.map((ref) => ref.rowId));
      grid.selectedKeys = grid.selectedKeys.filter((key) => !keys.has(key));
    }
  }
  emit(grid, "rowschange", { type, rows: list, source });
  const count = list.length;
  announce(
    grid,
    (type === "add" ? grid.labels.rowsAdded : grid.labels.rowsRemoved)?.(count) ??
      `${count} ${count === 1 ? "row" : "rows"} ${type === "add" ? "added" : "removed"}`,
  );
  return true;
}

/** Installs row creation on a grid; called once per grid by the grid. */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  const enabled = () => grid.hasAttribute("editable-rows");

  const define = {
    addRows: (
      entries: readonly { row: Row; index?: number }[],
      { source = "api" }: { source?: ChangeSource } = {},
    ) =>
      enabled() &&
      applyRows(
        grid,
        "add",
        entries.map((entry, i) => ({
          row: entry.row,
          rowId: "",
          index: entry.index ?? grid.rows.length + i,
        })),
        source,
      ),
    addRow: () => {
      const make = grid.createRow;
      return typeof make === "function" && enabled()
        ? grid.addRows([{ row: make() }], { source: "edit" })
        : false;
    },
    removeRows: (
      keys: readonly string[] = grid.selectedKeys,
      { source = "api" }: { source?: ChangeSource } = {},
    ) => {
      if (!enabled()) return false;
      const refs: RowRef<Row>[] = [];
      for (const key of new Set(keys)) {
        const v = grid._i().view.indexOfKey(key);
        const index = v < 0 ? -1 : grid._i().view.sourceAt(v);
        if (index >= 0) refs.push({ row: grid.rows[index], rowId: key, index });
      }
      return applyRows(grid, "remove", refs, source);
    },
  };
  Object.defineProperties(
    grid,
    Object.fromEntries(
      Object.entries(define).map(([name, value]) => [name, { value, configurable: true }]),
    ),
  );
}
