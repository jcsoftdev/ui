import {
  buildSheet,
  dirtyCells,
  displayValue,
  type FormulaSheet,
  isErrorText,
  isFormulaError,
  isFormulaText,
  type ParseCache,
  updateCells,
} from "@jcsoftdev/ui-core/grid/formula";
import type { CellValue } from "@jcsoftdev/ui-core/grid/model";
import type { UiDataGrid } from "./data-grid.js";
import css from "./formula.css.js";
import { adoptCss, type Row } from "./shared.js";

// Spreadsheet formulas, loaded by the grid when the `formulas` attribute is set. A cell whose
// stored text starts with `=` shows (and sorts, copies, sums on) its result; editing it shows the
// text. Addresses follow the data: columns count in `columns` order and rows in `rows` order,
// whatever the sort, the pinning, the order or the visibility of columns on screen.
//
// The sheet is built on first use and rebuilt when `rows` or `columns` is replaced or `refresh()`
// runs. A batch the grid wrote (`cellschange`) updates it in place: only the formulas that read a
// changed cell are evaluated again, and only their rows are refilled. In `emit` mode the grid
// writes nothing, so the consumer's new `rows` (or `refresh()`) is what rebuilds it.

interface State {
  sheet: FormulaSheet | null;
  rows: readonly Row[] | null;
  columns: readonly unknown[] | null;
  rowIndex: Map<object, number>;
  colIndex: Map<string, number>;
  cache: ParseCache;
  errors: boolean;
}

const states = new WeakMap<UiDataGrid, State>();

/** The sheet state of a grid, for the formula bar. */
export function stateOf(grid: UiDataGrid): State | undefined {
  return states.get(grid);
}

/** The sheet of a grid, built if it is not. */
export function sheetOf(grid: UiDataGrid): State | null {
  const state = states.get(grid);
  if (!state) return null;
  const rows = grid.rows;
  const columns = grid.columns;
  if (state.sheet && state.rows === rows && state.columns === columns) return state;
  state.rows = rows;
  state.columns = columns;
  state.rowIndex = new Map();
  rows.forEach((row, index) => {
    if (row !== null && typeof row === "object") state.rowIndex.set(row, index);
  });
  state.colIndex = new Map(columns.map((column, index) => [column.id, index]));
  const cols = columns.map((column) => column.accessor ?? column.id);
  state.sheet = buildSheet({
    rows: rows.length,
    cols: columns.length,
    read: (r, c) => {
      const row = rows[r];
      const column = columns[c];
      if (row == null || !column) return null;
      const key = cols[c];
      return (
        typeof key === "function" ? key(row) : (row as Record<string, CellValue>)[key as string]
      ) as CellValue;
    },
    cache: state.cache,
  });
  state.errors = hasErrors(state.sheet);
  return state;
}

const hasErrors = (sheet: FormulaSheet): boolean => {
  for (const value of sheet.values.values()) if (isFormulaError(value)) return true;
  return false;
};

/** Installs formulas on a grid; called once per grid by the grid. */
export function install(grid: UiDataGrid): void {
  if (states.has(grid)) return;
  adoptCss(grid, css);
  const state: State = {
    sheet: null,
    rows: null,
    columns: null,
    rowIndex: new Map(),
    colIndex: new Map(),
    cache: new Map(),
    errors: false,
  };
  states.set(grid, state);

  grid._x = (value?: CellValue, row?: Row, columnId?: string): CellValue => {
    // Called with nothing, the grid says the rows changed in place.
    if (value === undefined && row === undefined) {
      state.sheet = null;
      return null;
    }
    if (!grid.hasAttribute("formulas") || !isFormulaText(value)) return value as CellValue;
    const ready = sheetOf(grid);
    const r =
      ready && row !== null && typeof row === "object" ? ready.rowIndex.get(row) : undefined;
    const c = ready && columnId !== undefined ? ready.colIndex.get(columnId) : undefined;
    if (!ready?.sheet || r === undefined || c === undefined) return value;
    return displayValue(ready.sheet, r, c) ?? value;
  };

  grid.addEventListener("cellschange", (event) => {
    if (!state.sheet || grid.getAttribute("edit-mode") === "emit") return;
    const { changes } = (event as CustomEvent).detail as {
      changes: { row: object; columnId: string }[];
    };
    const changed: [number, number][] = [];
    for (const change of changes) {
      const r = state.rowIndex.get(change.row);
      const c = state.colIndex.get(change.columnId);
      if (r !== undefined && c !== undefined) changed.push([r, c]);
    }
    if (changed.length === 0) return;
    const sheet = updateCells(state.sheet, changed, state.cache);
    state.sheet = sheet;
    state.errors = hasErrors(sheet);
    const dirty = new Set<number>();
    for (const [r, c] of changed)
      for (const key of dirtyCells(sheet, r * sheet.cols + c)) dirty.add(key);
    const sorted = new Set(grid.sort.map((rule) => rule.id));
    if ([...dirty].some((key) => sorted.has(grid.columns[key % sheet.cols]?.id as string))) {
      // A sorted column changed through a formula: the order may have moved.
      grid.refresh();
      return;
    }
    const sources = new Set([...dirty].map((key) => Math.floor(key / sheet.cols)));
    const keys: string[] = [];
    for (let v = 0; v < grid._view.count; v += 1)
      if (sources.has(grid._view.sourceAt(v))) keys.push(grid._view.keyAt(v));
    grid.refreshRows(keys);
  });

  // Marks the cells that show a formula error, so they read as one and say what it is.
  const marked = new Set<HTMLElement>();
  const previous = grid._after;
  grid._after = () => {
    previous?.();
    for (const cell of marked) {
      if (cell.isConnected && isErrorText(cell.textContent as string)) continue;
      cell.removeAttribute("data-formula-error");
      cell.removeAttribute("title");
      marked.delete(cell);
    }
    if (!state.errors) return;
    for (const cell of grid.querySelectorAll<HTMLElement>("[role=gridcell]")) {
      const text = cell.textContent as string;
      if (marked.has(cell) || !isErrorText(text)) continue;
      cell.dataset.formulaError = "";
      cell.title = `${grid.labels.formulaError ?? "Formula error"}: ${text}`;
      marked.add(cell);
    }
  };

  const bar = () => {
    if (grid.hasAttribute("formula-bar"))
      void import("./formula-bar.js").then((m) => m.install(grid));
  };
  bar();
  new MutationObserver(bar).observe(grid, { attributes: true, attributeFilter: ["formula-bar"] });
  grid.refresh();
}
