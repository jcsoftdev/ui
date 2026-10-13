// Code shared by the lazy spreadsheet chunks (range, clipboard, fill, history). None of it is
// imported by the grid itself, so a grid that opts into nothing never downloads it.
import { edgeScrollStep } from "@jcsoftdev/ui-core/grid/fill";
import type { GridColumn } from "@jcsoftdev/ui-core/grid/model";
import { type CellPos, type RangeBounds, rangeBounds } from "@jcsoftdev/ui-core/grid/range";
import type { UiDataGrid } from "./data-grid.js";

// biome-ignore lint/suspicious/noExplicitAny: rows are whatever the consumer passes.
export type Row = any;
export type Col = GridColumn<Row>;

/** Id of the grid's checkbox column; it is never part of a range. */
export const SELECT_ID = "__select";

/** A cell by identity, which survives sorting, paging and column moves. */
export interface CellRef {
  rowKey: string;
  columnId: string;
}

/** Announces through the grid's polite status region. */
export function announce(grid: UiDataGrid, message: string): void {
  const region = grid.querySelector<HTMLElement>("[data-ui-part=status]");
  if (!region) return;
  region.textContent = "";
  queueMicrotask(() => {
    region.textContent = message;
  });
}

function writable(grid: UiDataGrid, column: Col, row: Row): boolean {
  if (grid.getAttribute("edit-mode") === "emit" || column.setter) return true;
  return typeof (column.accessor ?? column.id) !== "function" && !Object.isFrozen(row);
}

/** Whether the cell can be edited and, in `mutate` mode, written back. */
export function isEditable(grid: UiDataGrid, column: Col, row: Row): boolean {
  const editable = column.editable;
  return (
    row != null &&
    (typeof editable === "function"
      ? editable(row)
      : (editable ?? grid.hasAttribute("editable"))) &&
    writable(grid, column, row)
  );
}

const sheets = new Map<string, CSSStyleSheet>();
const adopted = new WeakMap<Node, Set<string>>();

/** Adds a chunk's CSS to the root the grid lives in, once. */
export function adoptCss(grid: UiDataGrid, css: string): void {
  const root = grid.getRootNode() as Document | ShadowRoot;
  const done = adopted.get(root) ?? new Set<string>();
  adopted.set(root, done);
  if (done.has(css)) return;
  done.add(css);
  let sheet = sheets.get(css);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    sheets.set(css, sheet);
  }
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

/** The key event target when it is a cell itself (not content or an editor inside one). */
export function cellTarget(event: Event): HTMLElement | null {
  const target = event.target;
  return target instanceof HTMLElement && target.getAttribute("role") === "gridcell"
    ? target
    : null;
}

/** The cell an element belongs to, as an identity. */
export function refOfElement(element: Element | null): CellRef | null {
  const cell = element?.closest<HTMLElement>("[role=gridcell]");
  const rowKey = cell?.closest<HTMLElement>("[role=row]")?.dataset.key;
  const columnId = cell?.dataset.col;
  return rowKey === undefined || !columnId ? null : { rowKey, columnId };
}

/** First rendered column a range may cover. */
export function firstColumn(grid: UiDataGrid): number {
  return grid._i().ids[0] === SELECT_ID ? 1 : 0;
}

export function posOf(grid: UiDataGrid, ref: CellRef): CellPos | null {
  const r = grid._i().view.indexOfKey(ref.rowKey);
  const c = grid._i().ids.indexOf(ref.columnId);
  return r < 0 || c < 0 ? null : { r, c };
}

export function refAt(grid: UiDataGrid, r: number, c: number): CellRef | null {
  const columnId = grid._i().ids[c];
  return r < 0 || r >= grid._i().view.count || columnId === undefined
    ? null
    : { rowKey: grid._i().view.keyAt(r), columnId };
}

/** The data cell at view row `r` and rendered column `c`; `null` for a group row or the checkbox. */
export function cellAt(
  grid: UiDataGrid,
  r: number,
  c: number,
): { rowKey: string; columnId: string; row: Row; column: Col } | null {
  const columnId = grid._i().ids[c];
  const column = columnId === undefined ? undefined : grid.columns.find((x) => x.id === columnId);
  if (!column || r < 0 || r >= grid._i().view.count || grid._i().view.kind(r) !== "data")
    return null;
  return {
    rowKey: grid._i().view.keyAt(r),
    columnId: column.id,
    row: grid.rows[grid._i().view.sourceAt(r)],
    column,
  };
}

/** The focused cell of the grid, `null` while the header or something else has focus. */
export function activeCell(grid: UiDataGrid): CellRef | null {
  return refOfElement(grid.contains(document.activeElement) ? document.activeElement : null);
}

/** Row height in pixels, as the grid published it for the stylesheet. */
export const rowHeight = (grid: UiDataGrid): number =>
  Number.parseFloat(grid.style.getPropertyValue("--ui-data-grid-row")) || 40;

// ---- range state --------------------------------------------------------------------------
export interface Range {
  anchor: CellRef;
  focus: CellRef;
}

export interface RangeSlot {
  range: Range | null;
  /** Called after every change of `range`. */
  listeners: Set<() => void>;
  /** Called after each paint with the box that holds the bottom-right corner (or `null`). */
  painted: Set<(corner: HTMLElement | null) => void>;
}

const slots = new WeakMap<UiDataGrid, RangeSlot>();

export function slotOf(grid: UiDataGrid): RangeSlot {
  let slot = slots.get(grid);
  if (!slot) {
    slot = { range: null, listeners: new Set(), painted: new Set() };
    slots.set(grid, slot);
  }
  return slot;
}

export function setRange(grid: UiDataGrid, range: Range | null): void {
  const slot = slotOf(grid);
  const same =
    range === slot.range ||
    (!!range &&
      !!slot.range &&
      range.anchor.rowKey === slot.range.anchor.rowKey &&
      range.anchor.columnId === slot.range.anchor.columnId &&
      range.focus.rowKey === slot.range.focus.rowKey &&
      range.focus.columnId === slot.range.focus.columnId);
  if (same) return;
  slot.range = range;
  for (const listener of slot.listeners) listener();
}

/** The range as view rows and rendered columns; `null` when it is empty or its rows are gone. */
export function rangeOf(grid: UiDataGrid): RangeBounds | null {
  const range = slotOf(grid).range;
  const anchor = range && posOf(grid, range.anchor);
  const focus = range && posOf(grid, range.focus);
  return anchor && focus ? rangeBounds(anchor, focus) : null;
}

/** The range, else the active cell as a one-cell range. */
export function targetBounds(grid: UiDataGrid): RangeBounds | null {
  const found = rangeOf(grid);
  if (found) return found;
  const active = activeCell(grid);
  const pos = active && posOf(grid, active);
  return pos ? { r0: pos.r, r1: pos.r, c0: pos.c, c1: pos.c } : null;
}

// ---- overlay ------------------------------------------------------------------------------
const ZONES = ["start", "center", "end"] as const;

export interface Layer {
  /** Draws `bounds` (or nothing for `null`); returns the box that holds the bottom-right corner. */
  paint(bounds: RangeBounds | null): HTMLElement | null;
  destroy(): void;
}

/**
 * A layer over the rows that draws a rectangle of cells without touching any cell. It mirrors the
 * row's three zones (pinned start, scrolling, pinned end), so the rectangle sticks and scrolls
 * exactly as the cells under it do.
 */
export function createLayer(grid: UiDataGrid, name: string): Layer {
  const layer = document.createElement("div");
  layer.dataset.uiPart = "layer";
  layer.dataset.layer = name;
  layer.setAttribute("aria-hidden", "true");
  const zones = {} as Record<(typeof ZONES)[number], { zone: HTMLElement; box: HTMLElement }>;
  for (const zone of ZONES) {
    const el = document.createElement("div");
    el.dataset.uiPart = "zone";
    el.dataset.zone = zone;
    const box = document.createElement("div");
    box.dataset.uiPart = "box";
    box.hidden = true;
    el.append(box);
    layer.append(el);
    zones[zone] = { zone: el, box };
  }
  let mounted = false;
  const mount = () => {
    if (mounted && layer.isConnected) return true;
    const sizer = grid.querySelector("[data-ui-part=sizer]");
    if (!sizer) return false;
    sizer.append(layer);
    mounted = true;
    return true;
  };
  let last = "";
  return {
    paint(bounds) {
      if (!bounds) {
        if (last !== "") {
          last = "";
          layer.hidden = true;
        }
        return null;
      }
      if (!mount()) return null;
      const lengths = ZONES.map((zone) => grid._i().off[zone].length - 1);
      let corner: HTMLElement | null = null;
      let from = 0;
      ZONES.forEach((zone, i) => {
        const { zone: el, box } = zones[zone];
        const offsets = grid._i().off[zone];
        const to = from + (lengths[i] as number);
        const lo = Math.max(bounds.c0, from);
        const hi = Math.min(bounds.c1, to - 1);
        const fits = lo <= hi;
        el.style.inlineSize = `${offsets.at(-1) ?? 0}px`;
        box.hidden = !fits;
        if (fits) {
          const left = offsets[lo - from] ?? 0;
          box.style.insetInlineStart = `${left}px`;
          box.style.inlineSize = `${(offsets[hi - from + 1] ?? left) - left}px`;
          box.style.insetBlockStart = `${bounds.r0 * rowHeight(grid)}px`;
          box.style.blockSize = `${(bounds.r1 - bounds.r0 + 1) * rowHeight(grid)}px`;
          box.toggleAttribute("data-start", lo === bounds.c0);
          box.toggleAttribute("data-end", hi === bounds.c1);
          if (hi === bounds.c1) corner = box;
        }
        from = to;
      });
      last = "on";
      layer.hidden = false;
      return corner;
    },
    destroy() {
      layer.remove();
      mounted = false;
    },
  };
}

// ---- pointer tracking ----------------------------------------------------------------------
/**
 * Follows a pointer that is down, reporting each new cell it is over (the cell the drag started in
 * included). Moves are coalesced to one per frame, and a pointer resting outside the scrolling
 * area scrolls it, faster the further out it is. Returns a function that stops the tracking; it
 * also stops on its own at the next `pointerup` / `pointercancel`, and then calls `onEnd`.
 */
export function trackCells(
  grid: UiDataGrid,
  start: PointerEvent,
  onOver: (over: CellRef) => void,
  onEnd?: () => void,
): () => void {
  const wrap = grid.querySelector<HTMLElement>("[data-ui-part=viewport]");
  if (!wrap) return () => {};
  let x = start.clientX;
  let y = start.clientY;
  let frame = 0;
  let last = "";
  const step = () => {
    frame = 0;
    const box = wrap.getBoundingClientRect();
    const header = rowHeight(grid);
    const dy = edgeScrollStep(y, box.top + header, box.bottom);
    const dx = edgeScrollStep(x, box.left, box.right);
    if (dx || dy) {
      wrap.scrollTop += dy;
      wrap.scrollLeft += dx;
    }
    const px = Math.min(Math.max(x, box.left + 2), box.right - 14);
    const py = Math.min(Math.max(y, box.top + header + 2), box.bottom - 14);
    const over = refOfElement(document.elementFromPoint(px, py));
    const id = over && `${over.rowKey}\0${over.columnId}`;
    if (over && id !== last && over.columnId !== SELECT_ID) {
      last = id as string;
      onOver(over);
    }
    // Keep scrolling while the pointer rests outside, even if it does not move.
    if (dx || dy) frame = requestAnimationFrame(step);
  };
  const move = (event: PointerEvent) => {
    x = event.clientX;
    y = event.clientY;
    if (!frame) frame = requestAnimationFrame(step);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
  };
  const end = () => {
    stop();
    onEnd?.();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  frame = requestAnimationFrame(step);
  return stop;
}
