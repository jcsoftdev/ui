import { adjustRows as adjust } from "@jcsoftdev/ui-core/grid/formula";
import type { RowRef } from "@jcsoftdev/ui-core/grid/history";
import { getCellValue } from "@jcsoftdev/ui-core/grid/model";
import { emit } from "../internal/base.js";
import type { ChangeSource, UiDataGrid } from "./data-grid.js";
import { announce, isFormula, type Row } from "./shared.js";

// Row creation and removal, loaded by the grid when `editable-rows` is set. It defines `addRow()`
// (appends what the `createRow` property returns), `addRows(entries)` and `removeRows(keys?)` on
// the grid. Each fires a cancelable `beforerowschange` and then one `rowschange`
// `{type: "add" | "remove", rows: [{row, rowId, index}], source}`, the same shape as the React
// grid's `onRowsChange`. `edit-mode="mutate"` (the default) replaces `rows` with the new array
// (the array the consumer passed is never mutated); `emit` only reports, and the consumer applies
// it. With `history`, an add or a remove is a step like a cell batch; undo reports the inverse
// with source `undo`.
//
// With `formulas`, the formulas keep pointing at the same cells: rows inserted before a reference
// shift it down, a reference to a removed row becomes `#REF!` and a range shrinks. In `mutate`
// mode the formula text of the affected cells is rewritten in the row objects (undoing a removal
// puts the old text back); `rowschange` lists them in `detail.rewrites` as `{row, columnId,
// before, value}`, which in `emit` mode is for the consumer to apply.

const installed = new WeakSet<UiDataGrid>();

/** The key a row gets at `index`, as the grid derives it. */
function keyFor(grid: UiDataGrid, row: Row, index: number): string {
  const rowKey = grid.rowKey;
  if (typeof rowKey === "function") return String(rowKey(row, index));
  if (typeof rowKey === "string" && row != null) return String(row[rowKey]);
  return String(index);
}

interface Rewrite {
  row: Row;
  columnId: string;
  before: string;
  value: string;
}

/** What a removal rewrote, by the first row it removed, so that undoing it can put it back. */
const rewritten = new WeakMap<UiDataGrid, WeakMap<object, Rewrite[]>>();

/** The formula edits that follow from the rows added or removed (ascending `sorted`). */
function editsFor(type: "add" | "remove", sorted: readonly RowRef<Row>[], length: number) {
  if (type === "add") {
    // Appending after the last row moves nothing.
    if (sorted.every((ref) => ref.index >= length)) return [];
    return sorted.map((ref) => ({ kind: "insert" as const, at: ref.index, count: 1 }));
  }
  // Runs of neighbours, last first, so each index is still where it was.
  const runs: { kind: "remove"; at: number; count: number }[] = [];
  for (const ref of sorted) {
    const last = runs[runs.length - 1];
    if (last && ref.index === last.at + last.count) last.count += 1;
    else runs.push({ kind: "remove", at: ref.index, count: 1 });
  }
  return runs.reverse();
}

/** Writes a formula text back into a row; `false` when the row or column cannot take it. */
function writeText(grid: UiDataGrid, row: Row, columnId: string, text: string): boolean {
  const column = grid.columns.find((c) => c.id === columnId);
  if (!column || Object.isFrozen(row)) return false;
  try {
    if (column.setter) column.setter(row, text);
    else if (typeof (column.accessor ?? column.id) !== "function")
      row[(column.accessor ?? column.id) as string] = text;
    else return false;
    return true;
  } catch {
    return false;
  }
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
  const before = grid.rows;
  const rows = [...before];
  let list = sorted;
  if (type === "add") {
    // Insert in ascending order, so each index is where the row ends up.
    const clamped = sorted.map((ref) => {
      const index = Math.max(0, Math.min(ref.index, rows.length));
      rows.splice(index, 0, ref.row);
      return { ref, index };
    });
    // The key is read once the rows are in place, so it is the one the grid derives.
    list = clamped.map(({ ref, index }) => {
      const at = rows[index] === ref.row ? index : rows.indexOf(ref.row);
      return { row: ref.row, rowId: keyFor(grid, ref.row, at), index: at };
    });
  }
  const emitMode = grid.getAttribute("edit-mode") === "emit";
  // Formulas that read rows that moved or went away.
  const rewrites: Rewrite[] = [];
  if (grid.hasAttribute("formulas")) {
    const touched = new Set(refs.map((ref) => ref.row));
    const edits = editsFor(type, sorted, before.length);
    const store = rewritten.get(grid)?.get(sorted[0]?.row as object);
    if (edits.length > 0 || store) {
      for (const row of before) {
        if (row == null || typeof row !== "object" || (type === "remove" && touched.has(row)))
          continue;
        for (const column of grid.columns) {
          const text = getCellValue(row, column);
          if (!isFormula(text)) continue;
          let next = text;
          for (const edit of edits) next = adjust(next, edit);
          if (next !== text) rewrites.push({ row, columnId: column.id, before: text, value: next });
        }
      }
      if (type === "add" && source === "undo" && store)
        for (const old of store) {
          const at = rewrites.findIndex((x) => x.row === old.row && x.columnId === old.columnId);
          const now = at >= 0 ? (rewrites[at] as Rewrite).before : old.value;
          if (at >= 0) rewrites.splice(at, 1);
          if (now !== old.before)
            rewrites.push({ row: old.row, columnId: old.columnId, before: now, value: old.before });
        }
    }
  }
  if (!emit(grid, "beforerowschange", { type, rows: list, source, rewrites }, true)) return false;
  if (!emitMode) {
    const done = rewrites.filter((x) => writeText(grid, x.row, x.columnId, x.value));
    if (type === "remove" && done.length > 0) {
      const memo = rewritten.get(grid) ?? new WeakMap();
      rewritten.set(grid, memo);
      memo.set(sorted[0]?.row as object, done);
    }
    if (type === "add") grid.rows = rows;
    else {
      const gone = new Set(sorted.map((ref) => ref.row));
      grid.rows = grid.rows.filter((row) => !gone.has(row));
    }
  }
  if (type === "remove") {
    // The removed rows leave the selection, whoever applies the removal.
    const keys = new Set(sorted.map((ref) => ref.rowId));
    grid.selectedKeys = grid.selectedKeys.filter((key) => !keys.has(key));
  }
  emit(grid, "rowschange", { type, rows: list, source, rewrites });
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
