import { validateSync } from "@jcsoftdev/ui-core/grid/clipboard";
import { editorKind, likeOriginal, sameValue, toDate } from "@jcsoftdev/ui-core/grid/edit";
import {
  copyFill,
  type DateStepMode,
  type FillBounds,
  type FillResult,
  fillLanes,
  type HandleExtent,
  handleExtent,
  isBackward,
  seriesFill,
} from "@jcsoftdev/ui-core/grid/fill";
import { type CellValue, getCellValue } from "@jcsoftdev/ui-core/grid/model";
import type { RangeBounds } from "@jcsoftdev/ui-core/grid/range";
import { emit } from "../internal/base.js";
import { changeCells } from "./batch.js";
import type { UiDataGrid } from "./data-grid.js";
import css from "./range.css.js";
import {
  activeCell,
  adoptCss,
  announce,
  cellAt,
  cellTarget,
  createLayer,
  firstColumn,
  isEditable,
  isFormula,
  posOf,
  rangeOf,
  refAt,
  setRange,
  slotOf,
  trackCells,
} from "./shared.js";

// Fill: a handle at the bottom-right corner of the range (drag it down, up, right or left) and
// Ctrl / Cmd + D / R (fill down / right). Loaded by the grid when `fill-handle` is set; it needs
// `range-selection`, which draws the range the handle sits on. A run of numbers continues
// linearly, dates by days or months (`date-step`: `auto`, `day` or `month`), text ending in a
// number counts up, anything else repeats. Dragging up or left runs the series backwards.
// The result is ONE batch (`changeCells`, source `fill`), so it undoes as one step. Only
// synchronous `validate` results are enforced, as in a paste.

//
// Formula addresses count columns in `columns` order, not the order on screen: a pinned column keeps
// its place in the data, so filling across pinned and unpinned columns shifts references by the
// data distance, not by the number of columns crossed.

const installed = new WeakSet<UiDataGrid>();

/** Position of a column in `columns`, the order formula addresses count in. */
const indexOfColumn = (grid: UiDataGrid, id: string): number =>
  grid.columns.findIndex((column) => column.id === id);

const modeOf = (grid: UiDataGrid): DateStepMode => {
  const mode = grid.getAttribute("date-step");
  return mode === "day" || mode === "month" ? mode : "auto";
};

/** Writes `lane`s of a fill; `series` false copies instead of continuing runs. */
function run(
  grid: UiDataGrid,
  base: FillBounds,
  extent: HandleExtent,
  series: boolean,
  mode: DateStepMode,
): void {
  // Formulas move their relative references as they are copied, which needs the formula module.
  if (grid.hasAttribute("formulas"))
    void import("@jcsoftdev/ui-core/grid/formula").then((f) =>
      write(grid, base, extent, series, mode, f.shiftFormula),
    );
  else write(grid, base, extent, series, mode);
}

function write(
  grid: UiDataGrid,
  base: FillBounds,
  extent: HandleExtent,
  series: boolean,
  mode: DateStepMode,
  shift?: (text: string, dr: number, dc: number) => string,
): void {
  const changes: { rowKey: string; columnId: string; value: CellValue }[] = [];
  const skipped: { rowKey: string; columnId: string; reason: string; message?: string }[] = [];
  const unvalidated: { rowKey: string; columnId: string }[] = [];
  for (const lane of fillLanes(base, extent)) {
    const sources = lane.source.map((pos) => cellAt(grid, pos.r, pos.c));
    if (sources.some((cell) => !cell)) continue;
    const first = sources[0];
    if (!first) continue;
    const isDate = editorKind(first.column) === "date";
    const raw = sources.map((cell) => (cell ? getCellValue(cell.row, cell.column) : null));
    const values = isDate ? raw.map((value) => toDate(value) ?? value) : raw;
    // A lane with a formula copies (shifted); counting up "=A1" to "=A2" would be a coincidence.
    const formulaLane = shift !== undefined && raw.some(isFormula);
    const results: FillResult[] =
      series && !formulaLane
        ? seriesFill(values, lane.targets.length, {
            backward: isBackward(extent.direction),
            dateStep: mode,
          })
        : copyFill(lane.targets.length, values.length, isBackward(extent.direction));
    const last = raw[isBackward(extent.direction) ? 0 : raw.length - 1];
    lane.targets.forEach((pos, i) => {
      const target = cellAt(grid, pos.r, pos.c);
      const result = results[i];
      if (!target || !result) return;
      const { rowKey, columnId, column, row } = target;
      if (!isEditable(grid, column, row)) {
        skipped.push({ rowKey, columnId, reason: "readonly" });
        return;
      }
      const current = getCellValue(row, column);
      let value =
        "value" in result
          ? likeOriginal(result.value, last as CellValue)
          : (raw[result.from] as CellValue);
      const from = "value" in result ? -1 : result.from;
      const origin = sources[from];
      if (shift && origin && isFormula(value)) {
        const dr =
          grid._i().view.sourceAt(pos.r) - grid._i().view.sourceAt(lane.source[from]?.r ?? 0);
        const dc = indexOfColumn(grid, columnId) - indexOfColumn(grid, origin.columnId);
        value = shift(value, dr, dc);
      }
      const checked =
        shift && isFormula(value)
          ? { message: null, unvalidated: false }
          : validateSync(column, value, row);
      if (checked.message) {
        skipped.push({ rowKey, columnId, reason: "invalid", message: checked.message });
        return;
      }
      if (checked.unvalidated) unvalidated.push({ rowKey, columnId });
      if (!sameValue(value, current)) changes.push({ rowKey, columnId, value });
    });
  }
  const result = changeCells(grid, changes, "fill");
  emit(grid, "cellsfill", {
    direction: extent.direction,
    applied: result.applied.length,
    skipped,
    unvalidated,
    cancelled: result.cancelled,
  });
  const first = refAt(grid, extent.bounds.r0, extent.bounds.c0);
  const last = refAt(grid, extent.bounds.r1, extent.bounds.c1);
  if (first && last) setRange(grid, { anchor: first, focus: last });
  const cells = result.applied.length;
  announce(
    grid,
    grid.labels.filled?.(cells) ?? `${cells} ${cells === 1 ? "cell" : "cells"} filled`,
  );
}

/** Installs the fill handle on a grid; called once per grid by the grid. */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  adoptCss(grid, css);
  const enabled = () => grid.hasAttribute("fill-handle");
  const handle = document.createElement("div");
  handle.dataset.uiPart = "fill-handle";
  handle.setAttribute("aria-hidden", "true");

  slotOf(grid).painted.add((corner) => {
    if (!enabled() || !corner) handle.remove();
    else if (handle.parentElement !== corner) corner.append(handle);
  });

  handle.addEventListener("pointerdown", (event) => {
    const base = rangeOf(grid);
    if (!enabled() || event.button !== 0 || !base) return;
    event.preventDefault();
    event.stopPropagation();
    const preview = createLayer(grid, "fill");
    let extent: HandleExtent | null = null;
    const limits = () => ({
      maxR: grid._i().view.count - 1,
      maxC: grid._i().ids.length - 1,
      minC: firstColumn(grid),
    });
    trackCells(
      grid,
      event,
      (over) => {
        const at = posOf(grid, over);
        extent = at ? handleExtent(base, at, limits()) : null;
        preview.paint(extent ? extent.bounds : null);
      },
      () => {
        preview.destroy();
        if (extent) run(grid, base, extent, true, modeOf(grid));
      },
    );
  });

  grid.addEventListener(
    "keydown",
    (event) => {
      if (!enabled() || event.defaultPrevented || !cellTarget(event) || event.isComposing) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key !== "d" && key !== "r") return;
      const bounds = rangeOf(grid) ?? null;
      const at = bounds ?? singleCell(grid);
      if (!at) return;
      event.preventDefault();
      event.stopPropagation();
      const down = key === "d";
      const span = down ? at.r1 - at.r0 : at.c1 - at.c0;
      // A lone cell copies from its neighbour above (or before); a range copies its first row (or column).
      const lone = span === 0;
      const from: RangeBounds = lone
        ? down
          ? { ...at, r0: at.r0 - 1, r1: at.r0 - 1 }
          : { ...at, c0: at.c0 - 1, c1: at.c0 - 1 }
        : down
          ? { ...at, r1: at.r0 }
          : { ...at, c1: at.c0 };
      if (from.r0 < 0 || from.c0 < firstColumn(grid)) return;
      const extent: HandleExtent = {
        direction: down ? "down" : "right",
        bounds: lone ? { ...from, r1: from.r1 + (down ? 1 : 0), c1: from.c1 + (down ? 0 : 1) } : at,
      };
      run(grid, from, extent, false, modeOf(grid));
    },
    { capture: true },
  );
}

function singleCell(grid: UiDataGrid): RangeBounds | null {
  const at = posOf(grid, activeCell(grid) ?? { rowKey: "", columnId: "" });
  return at && { r0: at.r, r1: at.r, c0: at.c, c1: at.c };
}
