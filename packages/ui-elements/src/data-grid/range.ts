import { getCellValue } from "@jcsoftdev/ui-core/grid/model";
import { type CellPos, extendFocus, rangeStats } from "@jcsoftdev/ui-core/grid/range";
import { emit } from "../internal/base.js";
import type { UiDataGrid } from "./data-grid.js";
import css from "./range.css.js";
import {
  activeCell,
  adoptCss,
  announce,
  cellTarget,
  createLayer,
  firstColumn,
  posOf,
  rangeOf,
  refAt,
  refOfElement,
  SELECT_ID,
  setRange,
  shown,
  slotOf,
  trackCells,
} from "./shared.js";

// Range selection: a rectangle of cells, separate from row selection. Loaded by the grid when the
// `range-selection` attribute is set, so other grids never download it. The rectangle is stored by
// cell identity (row key and column id) and drawn by an overlay layer; no cell is rebound.

const installed = new WeakSet<UiDataGrid>();
const NAVIGATION = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
const MODIFIERS = new Set(["Shift", "Control", "Meta", "Alt"]);
/** Keys that keep the range: copy, paste, history and fill belong to other chunks. */
const KEEPS = new Set(["c", "v", "x", "z", "y", "d", "r"]);

const rtlOf = (grid: UiDataGrid) => getComputedStyle(grid).direction === "rtl";

/** Installs range selection on a grid; called once per grid by the grid. */
export function install(grid: UiDataGrid): void {
  if (installed.has(grid)) return;
  installed.add(grid);
  adoptCss(grid, css);
  const slot = slotOf(grid);
  const layer = createLayer(grid, "range");
  const enabled = () => grid.hasAttribute("range-selection");
  const viewport = () => grid.querySelector<HTMLElement>("[data-ui-part=viewport]");

  const paint = () => {
    const bounds = enabled() ? rangeOf(grid) : null;
    const corner = layer.paint(bounds);
    for (const hook of slot.painted) hook(corner);
  };
  const previous = grid._after;
  grid._after = () => {
    previous?.();
    paint();
  };

  // ---- change reporting: one event and one announcement per frame --------------------------
  let reported = 0;
  let spoken = 0;
  const report = () => {
    reported = 0;
    const bounds = rangeOf(grid);
    const range = slot.range;
    if (!bounds || !range) {
      emit(grid, "rangechange", {
        anchor: null,
        focus: null,
        from: null,
        to: null,
        cells: 0,
        stats: null,
      });
      return;
    }
    const columns = new Map(grid.columns.map((column) => [column.id, column]));
    const stats = rangeStats(bounds, (r, c) => {
      const column = columns.get(grid._ids[c] as string);
      return grid._view.kind(r) === "data" && column
        ? shown(grid, grid.rows[grid._view.sourceAt(r)], column)
        : undefined;
    });
    const cells = (bounds.r1 - bounds.r0 + 1) * (bounds.c1 - bounds.c0 + 1);
    emit(grid, "rangechange", {
      anchor: range.anchor,
      focus: range.focus,
      from: refAt(grid, bounds.r0, bounds.c0),
      to: refAt(grid, bounds.r1, bounds.c1),
      cells,
      stats,
    });
    clearTimeout(spoken);
    spoken = window.setTimeout(() => {
      const format = new Intl.NumberFormat(grid.locale, { maximumFractionDigits: 2 });
      const text = (value: number | null) => (value === null ? "" : format.format(value));
      const info = {
        cells,
        numeric: stats.numeric,
        sum: text(stats.sum),
        average: text(stats.avg),
        min: text(stats.min),
        max: text(stats.max),
      };
      announce(
        grid,
        grid.labels.rangeSelected?.(info) ??
          (stats.numeric > 0
            ? `${cells} cells selected, sum ${info.sum}, average ${info.average}`
            : `${cells} cells selected`),
      );
    }, 300);
  };
  slot.listeners.add(() => {
    paint();
    if (!reported) reported = requestAnimationFrame(report);
  });

  /** A range from the anchor to `focus`; the anchor is the range's, else the active cell. */
  const extendTo = (focus: CellPos): void => {
    const start = slot.range?.anchor ?? activeCell(grid);
    const to = refAt(grid, focus.r, focus.c);
    if (start && to) setRange(grid, { anchor: start, focus: to });
  };

  // ---- keyboard ------------------------------------------------------------------------------
  grid.addEventListener(
    "keydown",
    (event) => {
      if (!enabled() || !cellTarget(event) || event.isComposing) return;
      const mod = event.ctrlKey || event.metaKey;
      const { key } = event;
      const count = grid._view.count;
      // A key another chunk took (the editor opening) still ends the range, below.
      if (!event.defaultPrevented && mod && !event.shiftKey && key.toLowerCase() === "a") {
        const first = firstColumn(grid);
        if (count === 0 || grid._ids.length <= first) return;
        event.preventDefault();
        const anchor = refAt(grid, 0, first);
        const focus = refAt(grid, count - 1, grid._ids.length - 1);
        if (anchor && focus) setRange(grid, { anchor, focus });
        return;
      }
      if (!event.defaultPrevented && event.shiftKey && !event.altKey && NAVIGATION.has(key)) {
        const start = slot.range?.focus ?? activeCell(grid);
        const from = start && posOf(grid, start);
        if (!from) return;
        const next = extendFocus(from, key, mod, {
          rows: count,
          cols: grid._ids.length,
          minC: firstColumn(grid),
          page: Math.max(1, Math.floor((viewport()?.clientHeight ?? 0) / grid._rowH) - 2),
          rtl: rtlOf(grid),
        });
        if (!next) return;
        event.preventDefault();
        event.stopPropagation();
        extendTo(next);
        grid._reveal(next.r + 1, next.c);
        return;
      }
      if (!event.defaultPrevented && slot.range && key === "Escape") {
        event.preventDefault();
        setRange(grid, null);
        return;
      }
      // Moving or editing from the keyboard collapses the range to the active cell.
      if (slot.range && !MODIFIERS.has(key) && !(mod && KEEPS.has(key.toLowerCase())))
        setRange(grid, null);
    },
    { capture: true },
  );

  // ---- pointer: Shift + click, and dragging across cells -------------------------------------
  grid.addEventListener("pointerdown", (event) => {
    if (!enabled() || event.button !== 0 || event.defaultPrevented) return;
    const target = event.target as Element;
    if (
      target.closest(
        "[data-ui-part=handle],[data-ui-part=fill-handle],[data-ui-part=check],[data-no-select]",
      )
    )
      return;
    const ref = refOfElement(target);
    if (!ref || ref.columnId === SELECT_ID) return;
    if (event.shiftKey) {
      // Shift + click extends from the anchor and must not select text.
      const start = slot.range?.anchor ?? activeCell(grid);
      if (start) {
        event.preventDefault();
        setRange(grid, { anchor: start, focus: ref });
      }
      return;
    }
    setRange(grid, null);
    if (event.pointerType === "touch") return;
    let dragging = false;
    const stopSelect = (e: Event) => {
      if (dragging) e.preventDefault();
    };
    document.addEventListener("selectstart", stopSelect);
    trackCells(
      grid,
      event,
      (over) => {
        if (!dragging && over.rowKey === ref.rowKey && over.columnId === ref.columnId) return;
        dragging = true;
        grid.toggleAttribute("data-ranging", true);
        setRange(grid, { anchor: ref, focus: over });
      },
      () => {
        document.removeEventListener("selectstart", stopSelect);
        grid.removeAttribute("data-ranging");
      },
    );
  });

  // Focus that moves on its own (keyboard navigation, `focusCell`) collapses the range.
  for (const name of ["sortchange", "cellfocus"])
    grid.addEventListener(name, () => setRange(grid, null));
  paint();
}
