import { getCellValue } from "@jcsoftdev/ui-core/grid/model";
import { emit } from "../internal/base.js";
import type {
  AppliedChange,
  CellChange,
  ChangeResult,
  ChangeSource,
  UiDataGrid,
} from "./data-grid.js";

// The batched write behind `changeCells`, loaded on first use (and statically by the paste, fill
// and history chunks, which write batches). A single cell edited by hand does not need it:
// `changeCell` is self-contained in the grid.

/** Writes `changes` as one batch; see `UiDataGrid.changeCells`. Synchronous once loaded. */
export function changeCells(
  grid: UiDataGrid,
  changes: readonly CellChange[],
  source: ChangeSource = "api",
): ChangeResult {
  const { view } = grid._i();
  const byId = new Map(grid.columns.map((column) => [column.id, column]));
  const write = grid.getAttribute("edit-mode") !== "emit";
  const applied: AppliedChange[] = [];
  const rejected: ChangeResult["rejected"] = [];
  for (const { rowKey, columnId, value } of changes) {
    const column = byId.get(columnId);
    const v = view.indexOfKey(rowKey);
    const row = v < 0 ? undefined : grid.rows[view.sourceAt(v)];
    if (
      column &&
      typeof row === "object" &&
      row &&
      (!write ||
        (!Object.isFrozen(row) &&
          (column.setter || typeof (column.accessor ?? column.id) !== "function")))
    )
      applied.push({
        rowKey,
        columnId,
        row,
        oldValue: getCellValue(row, column),
        value,
        newValue: value,
      });
    else rejected.push({ rowKey, columnId });
  }
  const [only] = applied;
  if (
    (applied.length === 1 && !emit(grid, "beforecellchange", { ...only, source }, true)) ||
    (applied.length && !emit(grid, "beforecellschange", { changes: applied, source }, true))
  )
    return { applied: [], rejected, cancelled: true };
  if (write)
    for (const change of [...applied]) {
      const column = byId.get(change.columnId);
      try {
        if (column?.setter) column.setter(change.row, change.value);
        else change.row[(column?.accessor ?? change.columnId) as string] = change.value;
      } catch {
        rejected.push(applied.splice(applied.indexOf(change), 1)[0] as AppliedChange);
      }
    }
  if (rejected.length)
    console.warn("ui-data-grid: some cells could not be written (frozen or read-only).");
  if (write) {
    grid.refreshRows(applied.map((change) => change.rowKey));
    // Re-run the view when a stage (sort, later filter and group) reads an edited column.
    const sorted = new Set(grid.sort.map((rule) => rule.id));
    if (applied.some((change) => sorted.has(change.columnId))) grid.refresh();
  }
  if (applied.length === 1) emit(grid, "cellchange", { ...applied[0], source });
  if (applied.length) emit(grid, "cellschange", { changes: applied, source, rejected });
  return { applied, rejected, cancelled: false };
}
