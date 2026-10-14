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
import { changeCells } from "./batch.js";
import type { UiDataGrid } from "./data-grid.js";
import {
  announce,
  cellAt,
  cellTarget,
  firstColumn,
  isEditable,
  isFormula,
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

const MARK = "data-ui-grid";

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * The html flavour of a copy that holds formulas: a table with the same cells as the text, each
 * formula cell carrying its formula and where it came from in the data.
 */
function formulaTable(
  bounds: { r0: number; r1: number; c0: number; c1: number },
  text: string,
  sources: Map<string, { f: string; r: number; c: number }>,
  present: Set<string>,
): string {
  const table = parseTSV(text);
  // The lines and fields of the text are the cells that were data, in order.
  const rows: number[] = [];
  const cols: number[] = [];
  for (let c = bounds.c0; c <= bounds.c1; c += 1)
    for (let r = bounds.r0; r <= bounds.r1; r += 1)
      if (present.has(`${r},${c}`)) {
        cols.push(c);
        break;
      }
  for (let r = bounds.r0; r <= bounds.r1; r += 1)
    if (cols.some((c) => present.has(`${r},${c}`))) rows.push(r);
  const lines = table.map((line, i) => {
    const cells = line.map((field, j) => {
      const source = sources.get(`${rows[i]},${cols[j]}`);
      const attrs = source
        ? ` data-f="${escapeHtml(source.f)}" data-r="${source.r}" data-c="${source.c}"`
        : "";
      return `<td${attrs}>${escapeHtml(field)}</td>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<table ${MARK}><tbody>${lines.join("")}</tbody></table>`;
}

/** The formula cells of a copied table, by line and field, when it matches the pasted text. */
function formulasOf(
  html: string,
  table: readonly (readonly string[])[],
): Map<string, { f: string; r: number; c: number }> | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines = [...doc.querySelectorAll(`table[${MARK}] tr`)];
  if (lines.length !== table.length) return null;
  const found = new Map<string, { f: string; r: number; c: number }>();
  for (let i = 0; i < lines.length; i += 1) {
    const cells = [...(lines[i] as Element).children] as HTMLElement[];
    const want = table[i] as readonly string[];
    if (cells.length !== want.length) return null;
    for (let j = 0; j < cells.length; j += 1) {
      const cell = cells[j] as HTMLElement;
      if (cell.textContent !== want[j]) return null;
      const { f, r, c } = cell.dataset;
      if (f !== undefined && Number.isInteger(Number(r)) && Number.isInteger(Number(c)))
        found.set(`${i},${j}`, { f, r: Number(r), c: Number(c) });
    }
  }
  return found;
}

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
    const { ids, view } = grid._i();
    const formulas = grid.hasAttribute("formulas");
    // Formula cells of the copy, by position, for the html flavour.
    const sources = new Map<string, { f: string; r: number; c: number }>();
    const present = new Set<string>();
    const text = formatTSV(bounds, (r, c) => {
      const column = columns.get(ids[c] as string);
      if (!column || view.kind(r) !== "data") return null;
      present.add(`${r},${c}`);
      const row = grid.rows[view.sourceAt(r)];
      const stored = formulas && getCellValue(row, column);
      if (isFormula(stored))
        sources.set(`${r},${c}`, {
          f: stored,
          r: view.sourceAt(r),
          c: grid.columns.indexOf(column),
        });
      return copyText(column, shown(grid, row, column), grid.locale);
    });
    // A listener may rewrite `detail.text` (to escape cells that start with = + - @ before they
    // reach a spreadsheet, say) or cancel the event to leave the clipboard alone.
    const cells = (bounds.r1 - bounds.r0 + 1) * (bounds.c1 - bounds.c0 + 1);
    const detail = { text, cells };
    if (!emit(grid, "cellscopy", detail, true)) return;
    event.clipboardData.setData("text/plain", detail.text);
    // Results go out as text; the formulas travel beside them for a paste into this grid.
    if (sources.size > 0 && detail.text === text)
      event.clipboardData.setData("text/html", formulaTable(bounds, text, sources, present));
    event.preventDefault();
    announce(
      grid,
      grid.labels.copied?.(cells) ?? `${cells} ${cells === 1 ? "cell" : "cells"} copied`,
    );
  });

  grid.addEventListener("paste", async (event) => {
    if (!enabled() || event.defaultPrevented || !cellTarget(event) || !event.clipboardData) return;
    const text = event.clipboardData.getData("text/plain");
    if (text === "") return;
    const html = grid.hasAttribute("formulas") ? event.clipboardData.getData("text/html") : "";
    event.preventDefault();
    const bounds = targetBounds(grid);
    const origin = bounds && { r: bounds.r0, c: Math.max(bounds.c0, firstColumn(grid)) };
    if (!bounds || !origin) return;
    const table = parseTSV(text);
    const plan = planPaste(
      table,
      origin,
      { maxR: grid._i().view.count - 1, maxC: grid._i().ids.length - 1 },
      rangeOf(grid) ?? bounds,
    );
    // Formulas copied from a grid come back as formulas, their relative references moved.
    const copied = html.includes(MARK) ? formulasOf(html, table) : null;
    if (copied) {
      const { shiftFormula } = await import("@jcsoftdev/ui-core/grid/formula");
      const { ids, view } = grid._i();
      for (const target of plan.targets) {
        const source = copied.get(`${target.i},${target.j}`);
        const column = grid.columns.findIndex((x) => x.id === ids[target.c]);
        if (source && column >= 0 && view.kind(target.r) === "data")
          target.text = shiftFormula(
            source.f,
            view.sourceAt(target.r) - source.r,
            column - source.c,
          );
      }
    }
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
    const result = changeCells(grid, writes.changes, "paste");
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
      let width = 0;
      for (const line of table) if (line.length > width) width = line.length;
      const last = refAt(
        grid,
        Math.min(origin.r + table.length - 1, grid._i().view.count - 1),
        Math.min(origin.c + width - 1, grid._i().ids.length - 1),
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
