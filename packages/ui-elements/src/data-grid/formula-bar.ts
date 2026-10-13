import { type PasteMessages, parsePasted, validateSync } from "@jcsoftdev/ui-core/grid/clipboard";
import { cellAddress } from "@jcsoftdev/ui-core/grid/formula";
import { getCellValue } from "@jcsoftdev/ui-core/grid/model";
import type { UiDataGrid } from "./data-grid.js";
import { sheetOf } from "./formula.js";
import { type Col, isEditable, isFormula, type Row } from "./shared.js";

// The formula bar: the address of the focused cell, `fx` and a field with the cell's stored text
// (the formula, for a formula cell). Enter stores it like the cell editor would, Escape puts the
// stored text back and returns to the cell. Loaded by `formulas` when `formula-bar` is set; it
// sits above the grid, outside `role=grid`, and the grid moves down by `--ui-data-grid-bar`.

const installed = new WeakSet<UiDataGrid>();

/** Installs the bar on a grid; called by the formulas chunk, again when the attribute changes. */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  const labels = grid.labels;
  const bar = document.createElement("div");
  bar.dataset.uiPart = "formula-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", labels.formulaBar ?? "Formula bar");
  const address = document.createElement("span");
  address.dataset.uiPart = "formula-address";
  address.title = labels.formulaCell ?? "Cell";
  const fx = document.createElement("span");
  fx.dataset.uiPart = "formula-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.textContent = "fx";
  const input = document.createElement("input");
  input.dataset.uiPart = "formula-input";
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", labels.formulaBar ?? "Formula bar");
  const error = document.createElement("span");
  error.dataset.uiPart = "formula-error";
  error.setAttribute("role", "alert");
  bar.append(address, fx, input, error);

  let cell: { rowKey: string; columnId: string; row: Row; column: Col } | null = null;

  const show = () => {
    const state = sheetOf(grid);
    error.textContent = "";
    input.removeAttribute("aria-invalid");
    const r = cell && state ? state.rowIndex.get(cell.row) : undefined;
    const c = cell && state ? state.colIndex.get(cell.columnId) : undefined;
    if (!cell || r === undefined || c === undefined) {
      address.textContent = "—";
      input.value = "";
      input.disabled = true;
      input.placeholder = labels.formulaEmpty ?? "Select a cell";
      return;
    }
    address.textContent = cellAddress(r, c);
    const stored = getCellValue(cell.row, cell.column);
    input.value = stored == null ? "" : String(stored);
    input.disabled = false;
    input.placeholder = "";
    input.readOnly = !isEditable(grid, cell.column, cell.row);
  };

  const attach = () => {
    const on = grid.hasAttribute("formula-bar");
    grid.toggleAttribute("data-formula-bar", on);
    if (on && bar.parentElement !== grid) grid.prepend(bar);
    if (!on) bar.remove();
  };

  const focusCell = () => {
    if (cell) grid.getCellElement(cell.rowKey, cell.columnId)?.focus();
  };

  const messages = (): PasteMessages => ({
    yes: labels.yes,
    no: labels.no,
    invalidNumber: labels.invalidNumber ?? "Enter a valid number",
    invalidDate: labels.invalidDate ?? "Enter a valid date",
    invalidValue: labels.invalidValue ?? "Invalid value",
  });

  const fail = (message: string) => {
    error.textContent = message;
    input.setAttribute("aria-invalid", "true");
  };

  const commit = () => {
    if (!cell || input.readOnly) return;
    const { row, column, rowKey, columnId } = cell;
    let value: ReturnType<typeof getCellValue>;
    if (isFormula(input.value)) value = input.value.trim();
    else {
      const parsed = parsePasted(
        column,
        input.value,
        row,
        getCellValue(row, column),
        grid.locale,
        messages(),
      );
      if (!parsed.ok) return fail(parsed.message);
      const checked = validateSync(column, parsed.value, row);
      if (checked.message) return fail(checked.message);
      value = parsed.value;
    }
    if (!grid.changeCell(rowKey, columnId, value))
      return fail(labels.unwritable ?? "This value could not be saved");
    show();
    focusCell();
  };

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      show();
      focusCell();
    }
  });
  grid.addEventListener("cellfocus", (event) => {
    const detail = (event as CustomEvent).detail as { rowKey: string; columnId: string; row: Row };
    const column = grid.columns.find((c) => c.id === detail.columnId);
    cell = column ? { ...detail, column } : null;
    show();
  });
  grid.addEventListener("cellschange", () => {
    // The focused cell (or the formula it reads) may have been written by something else.
    if (document.activeElement !== input) show();
  });
  new MutationObserver(attach).observe(grid, {
    attributes: true,
    attributeFilter: ["formula-bar"],
  });
  attach();
  show();
}
