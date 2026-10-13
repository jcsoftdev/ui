import { validateSync } from "@jcsoftdev/ui-core/grid/clipboard";
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
import type { CellValue, GridColumn } from "@jcsoftdev/ui-core/grid/model";
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
      try {
        return (
          typeof key === "function" ? key(row) : (row as Record<string, CellValue>)[key as string]
        ) as CellValue;
      } catch {
        // An accessor that throws is an empty cell here, not a broken sheet.
        return null;
      }
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

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A formula result as its column takes it: numbers for number columns, booleans for boolean
 * ones, dates for date ones, then the column's own `validate`. What does not fit shows `#VALUE!`.
 */
function fits(column: GridColumn<Row>, row: Row, value: CellValue): CellValue {
  if (value === null || isErrorText(value)) return value;
  let next: CellValue = value;
  switch (column.type) {
    case "number":
      if (typeof value !== "number") return "#VALUE!";
      break;
    case "boolean":
      if (typeof value !== "boolean") return "#VALUE!";
      break;
    case "date": {
      const date =
        typeof value === "string" && ISO_DAY.test(value) ? new Date(`${value}T00:00:00`) : null;
      if (!date || Number.isNaN(date.getTime())) return "#VALUE!";
      next = date;
      break;
    }
    default:
  }
  return validateSync(column, next, row).message ? "#VALUE!" : next;
}

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
    const result = displayValue(ready.sheet, r, c);
    const column = grid.columns[c];
    return result === undefined ? value : column ? fits(column, row as Row, result) : result;
  };

  grid.addEventListener("cellschange", (event) => {
    if (event.target !== grid || !state.sheet || grid.getAttribute("edit-mode") === "emit") return;
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
    let sheet: FormulaSheet;
    try {
      sheet = updateCells(state.sheet, changed, state.cache);
    } catch {
      // Something no formula can explain: start from the data again.
      state.sheet = null;
      grid.refresh();
      return;
    }
    state.sheet = sheet;
    state.errors = hasErrors(sheet);
    const dirty = dirtyCells(
      sheet,
      changed.map(([r, c]) => r * sheet.cols + c),
    );
    const sorted = new Set(grid.sort.map((rule) => rule.id));
    if ([...dirty].some((key) => sorted.has(grid.columns[key % sheet.cols]?.id as string))) {
      // A sorted column changed through a formula: the order may have moved.
      grid.refresh();
      return;
    }
    const sources = new Set([...dirty].map((key) => Math.floor(key / sheet.cols)));
    const keys: string[] = [];
    for (let v = 0; v < grid._i().view.count; v += 1)
      if (sources.has(grid._i().view.sourceAt(v))) keys.push(grid._i().view.keyAt(v));
    grid.refreshRows(keys);
  });

  // Marks the cells that show an error their own formula produced, so they read as one and say
  // what it is. Only cells that are formulas are marked, and a `title` the consumer set stays.
  const marked = new Map<HTMLElement, string>();
  const previous = grid._after;
  grid._after = () => {
    previous?.();
    for (const [cell, title] of marked) {
      if (cell.isConnected && isErrorText(cell.textContent as string)) continue;
      cell.removeAttribute("data-formula-error");
      if (cell.title === title) cell.removeAttribute("title");
      marked.delete(cell);
    }
    const { sheet } = state;
    if (!state.errors || !sheet) return;
    const { view } = grid._i();
    for (const cell of grid.querySelectorAll<HTMLElement>("[role=gridcell][data-col]")) {
      const text = cell.textContent as string;
      if (marked.has(cell) || !isErrorText(text)) continue;
      const v = view.indexOfKey(cell.closest<HTMLElement>("[role=row]")?.dataset.key ?? "");
      const c = state.colIndex.get(cell.dataset.col as string);
      if (v < 0 || c === undefined || !sheet.formulas.has(view.sourceAt(v) * sheet.cols + c))
        continue;
      cell.dataset.formulaError = "";
      const title = `${grid.labels.formulaError ?? "Formula error"}: ${text}`;
      if (cell.title === "") cell.title = title;
      marked.set(cell, title);
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
