import {
  copyText,
  formatTSV,
  type PasteMessages,
  parseTSV,
  planPaste,
  planWrites,
} from "@jcsoftdev/ui-core/grid/clipboard";
import { getCellValue } from "@jcsoftdev/ui-core/grid/model";
import { emit } from "../internal/base.js";
import type { UiDataGrid } from "./data-grid.js";
import {
  announce,
  cellAt,
  cellTarget,
  firstColumn,
  isEditable,
  rangeOf,
  refAt,
  SELECT_ID,
  setRange,
  shown,
  targetBounds,
} from "./shared.js";

// Clipboard: Ctrl / Cmd + C copies the range (or the active cell) as TSV; Ctrl / Cmd + V pastes
// TSV from the active cell or over the range. Loaded by the grid when the `clipboard` attribute is
// set. It listens to the clipboard events themselves, which need no permission and also serve the
// context menu and the mobile "paste" bubble.
//
// Paste policy: each pasted text is read the way the column's editor reads typed text (the
// column's `parse`, numbers and dates in the grid's locale, a select's label or value, a boolean's
// true / false / yes / no). Only SYNCHRONOUS `validate` results are enforced: a validator that
// returns a promise is called with an aborted signal, its outcome is ignored and the cell is
// written and reported as `unvalidated`. Cells that are not editable, or whose text does not
// parse or validate, are skipped and reported. A block that runs past the last row or column is
// cut and the cut is reported. The write is one batch (`changeCells`, source `paste`), so in
// `emit` mode a paste is a single `cellschange`.

const installed = new WeakSet<UiDataGrid>();

const messages = (grid: UiDataGrid): PasteMessages => ({
  yes: grid.labels.yes,
  no: grid.labels.no,
  invalidNumber: grid.labels.invalidNumber ?? "Enter a valid number",
  invalidDate: grid.labels.invalidDate ?? "Enter a valid date",
  invalidValue: grid.labels.invalidValue ?? "Invalid value",
});

/** Installs the clipboard on a grid; called once per grid by the grid. */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  const enabled = () => grid.hasAttribute("clipboard");

  grid.addEventListener("copy", (event) => {
    if (!enabled() || event.defaultPrevented || !cellTarget(event) || !event.clipboardData) return;
    const bounds = targetBounds(grid);
    if (!bounds) return;
    const columns = new Map(grid.columns.map((column) => [column.id, column]));
    const text = formatTSV(bounds, (r, c) => {
      const column = columns.get(grid._ids[c] as string);
      if (!column || grid._view.kind(r) !== "data") return null;
      const row = grid.rows[grid._view.sourceAt(r)];
      return copyText(column, shown(grid, row, column), grid.locale);
    });
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
    const cells = (bounds.r1 - bounds.r0 + 1) * (bounds.c1 - bounds.c0 + 1);
    emit(grid, "cellscopy", { text, cells });
    announce(
      grid,
      grid.labels.copied?.(cells) ?? `${cells} ${cells === 1 ? "cell" : "cells"} copied`,
    );
  });

  grid.addEventListener("paste", (event) => {
    if (!enabled() || event.defaultPrevented || !cellTarget(event) || !event.clipboardData) return;
    const text = event.clipboardData.getData("text/plain");
    if (text === "") return;
    event.preventDefault();
    const bounds = targetBounds(grid);
    const origin = bounds && { r: bounds.r0, c: Math.max(bounds.c0, firstColumn(grid)) };
    if (!bounds || !origin) return;
    const table = parseTSV(text);
    const plan = planPaste(
      table,
      origin,
      { maxR: grid._view.count - 1, maxC: grid._ids.length - 1 },
      rangeOf(grid) ?? bounds,
    );
    const writes = planWrites(
      plan.targets,
      (r, c) => {
        const cell = cellAt(grid, r, c);
        return (
          cell && {
            ...cell,
            current: getCellValue(cell.row, cell.column),
            editable: isEditable(grid, cell.column, cell.row),
          }
        );
      },
      { locale: grid.locale, messages: messages(grid), formulas: grid.hasAttribute("formulas") },
    );
    const result = grid.changeCells(writes.changes, { source: "paste" });
    const applied = result.applied.length;
    const skipped = writes.skipped.length + result.rejected.length;
    emit(grid, "cellspaste", {
      applied,
      unchanged: writes.unchanged,
      skipped: [
        ...writes.skipped,
        ...result.rejected.map((cell) => ({ ...cell, reason: "readonly" })),
      ],
      clipped: plan.clipped,
      unvalidated: writes.unvalidated,
      cancelled: result.cancelled,
    });
    if (grid.hasAttribute("range-selection") && table.length * (table[0]?.length ?? 0) > 1) {
      // The pasted block becomes the range, as in spreadsheets.
      const last = refAt(
        grid,
        Math.min(origin.r + table.length - 1, grid._view.count - 1),
        Math.min(
          origin.c + Math.max(...table.map((line) => line.length)) - 1,
          grid._ids.length - 1,
        ),
      );
      const first = refAt(grid, origin.r, origin.c);
      if (first && last && first.columnId !== SELECT_ID)
        setRange(grid, { anchor: first, focus: last });
    }
    announce(
      grid,
      grid.labels.pasted?.(applied, skipped, plan.clipped) ??
        [
          `${applied} ${applied === 1 ? "cell" : "cells"} pasted`,
          skipped ? `${skipped} skipped` : "",
          plan.clipped ? `${plan.clipped} past the edge` : "",
        ]
          .filter(Boolean)
          .join(", "),
    );
  });
}
