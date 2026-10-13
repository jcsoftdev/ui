import {
  clampWidth,
  columnOffsets,
  defaultWidth,
  fillColumnWidths,
  type GridLayout,
  moveColumnTo,
  parseStoredLayout,
  reconcileLayout,
} from "@jcsoftdev/ui-core/grid/columns";
import {
  type HeaderAction,
  headerAction,
  NAVIGATION_KEYS,
  navigate,
} from "@jcsoftdev/ui-core/grid/keyboard";
import {
  type CellContent,
  type CellValue,
  columnAlign,
  formatCellValue,
  type GridColumn,
  getCellValue,
} from "@jcsoftdev/ui-core/grid/model";
import { arrangeColumns, type ColumnArrangement, type GridZone } from "@jcsoftdev/ui-core/grid/pin";
import { widthFromKey, widthFromPointer } from "@jcsoftdev/ui-core/grid/resize";
import {
  EMPTY_SELECTION,
  pressRow,
  type SelectionMode,
  type SelectionRows,
  type SelectionState,
  selectionLevel,
  toggleAll,
  toggleRow,
} from "@jcsoftdev/ui-core/grid/select";
import {
  ariaSort,
  formatSort,
  parseSort,
  type SortRule,
  sortRows,
  toggleSort,
} from "@jcsoftdev/ui-core/grid/sort";
import {
  createGridViewport,
  type GridViewport,
  type GridWindow,
} from "@jcsoftdev/ui-core/grid/virtual";
import { type DefineOptions, defineElement, ElementBase, emit } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { upgradeProperties } from "../internal/e10.js";
import css from "./data-grid.css.js";

export type { GridColumn } from "@jcsoftdev/ui-core/grid/model";
export type { SortRule } from "@jcsoftdev/ui-core/grid/sort";

/** Text the grid shows or announces. Override any of them with the `labels` property. */
export interface GridLabels {
  selectAll: string;
  selectRow: string;
  empty: string;
  columnMenu: (header: string) => string;
  sortAsc: string;
  sortDesc: string;
  clearSort: string;
  pinStart: string;
  pinEnd: string;
  unpin: string;
  sorted: (header: string, direction: "ascending" | "descending" | "none") => string;
  moved: (header: string, position: number, count: number) => string;
  resized: (header: string, width: number) => string;
  selected: (count: number) => string;
}

const LABELS: GridLabels = {
  selectAll: "Select all rows",
  selectRow: "Select row",
  empty: "No rows",
  columnMenu: (header) => `Options for column ${header}`,
  sortAsc: "Sort ascending",
  sortDesc: "Sort descending",
  clearSort: "Clear sort",
  pinStart: "Pin to start",
  pinEnd: "Pin to end",
  unpin: "Unpin",
  sorted: (header, direction) =>
    direction === "none" ? `${header}: not sorted` : `${header}: sorted ${direction}`,
  moved: (header, position, count) => `${header} moved to position ${position} of ${count}`,
  resized: (header, width) => `${header} width ${width} pixels`,
  selected: (count) => `${count} selected`,
};

const DENSITY = { compact: 32, normal: 40, comfortable: 48 } as const;
const SELECT_ID = "__select";
const SELECT_WIDTH = 44;
const ZONES = ["start", "center", "end"] as const;
const TAG = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
const INTERACTIVE =
  "a[href],button,input:not([data-ui-part=check]),select,textarea,[data-no-select]";
const CELL = "[role=gridcell],[role=columnheader]";

// biome-ignore lint/suspicious/noExplicitAny: rows are whatever the consumer passes.
type Row = any;
type Col = GridColumn<Row>;
type RowKey = string | ((row: Row, index: number) => string);

interface CellEl extends HTMLElement {
  _epoch?: number;
  _row?: unknown;
  _col?: unknown;
  _tag?: HTMLElement;
}

interface RowRec {
  el: HTMLElement;
  key: string;
  v: number;
  epoch: number;
  zones: Record<GridZone, HTMLElement>;
  cells: Map<string, CellEl>;
}

interface Meta {
  /** Row record of a body cell, `null` for a header cell. */
  rec: RowRec | null;
  /** Index into the rendered columns. */
  col: number;
}

const create = <K extends keyof HTMLElementTagNameMap>(tag: K, part: string, role?: string) => {
  const node = document.createElement(tag);
  node.dataset.uiPart = part;
  if (role) node.setAttribute("role", role);
  return node;
};

/** Puts `wanted` in order inside `parent`, moving as few nodes as possible, and removes the rest. */
function reconcile(parent: Element, wanted: readonly Element[]): void {
  let expected = parent.firstElementChild;
  for (const el of wanted) {
    if (el === expected) expected = el.nextElementSibling;
    else parent.insertBefore(el, expected);
  }
  while (expected) {
    const next: Element | null = expected.nextElementSibling;
    expected.remove();
    expected = next;
  }
}

const same = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const idsOf = (value: string | null): string[] =>
  (value ?? "").split(/[\s,]+/).filter((id) => id.length > 0);

/**
 * `<ui-data-grid>`: a virtualised data grid (WAI-ARIA `grid` pattern) for `rows` x `columns` that
 * stays smooth at 100 000 rows by 200 columns. Only the visible rows and columns are in the DOM and
 * their elements are pooled and reused, so a scroll inside the rendered window touches no DOM.
 *
 * Data (properties; assigning them before the element is defined works):
 * - `columns: GridColumn[]` with `id`, `header`, `accessor` (key or function, default `id`), `cell`
 *   (returns a Node or a string; a string is always rendered as text, never as HTML), `cellTag` (a
 *   custom element created inside the cell and given `value`, `row`, `rowId`, `column` and
 *   `formatted`), `type`, `format`, `width`, `minWidth`, `maxWidth`, `grow`, `align`, `sortable`,
 *   `resizable`, `reorderable`.
 * - `rows: T[]` and `rowKey` (a property name or `(row, index) => string`, default the index).
 * - `sort: SortRule[]`, `selectedKeys: string[]`, `pinned: {left, right}`, `hiddenColumns`,
 *   `layout` (order, widths, hidden, pinned) and `labels`.
 *
 * Keyboard: one tab stop, by roving tabindex. The active cell has `tabindex=0` and stays mounted
 * while it is scrolled out of the window, so focus is never lost; `aria-activedescendant` is not
 * used because recycled elements cannot be referenced reliably. Arrows, Home / End, Ctrl+Home /
 * Ctrl+End, PageUp / PageDown. On a header: Enter / Space sort (Shift adds a rule), Shift+Arrow
 * resizes, Ctrl+Shift+Arrow reorders (with `reorderable`), Alt+ArrowDown opens the menu (with
 * `column-menu`). In the body: Space toggles the row (Shift extends), Ctrl+A selects all (multi),
 * Enter fires `cellactivate`. `aria-rowcount`, `aria-colcount`, `aria-rowindex` and `aria-colindex`
 * describe the whole grid, not the rendered part.
 *
 * Attributes: `label`, `selection` (`none` | `single` | `multi`; multi adds a checkbox column),
 * `density` (`compact` | `normal` | `comfortable`) or `row-height` (px), `sort` (`name:asc,price:desc`),
 * `sort-manual` (report sorts without sorting), `pinned-left` / `pinned-right` (column ids; logical,
 * so right-to-left works), `hidden-columns`, `column-menu` (a menu per column, loaded on demand),
 * `reorderable` (column reordering, loaded on demand), `storage-key` (persists the layout).
 *
 * Events (bubble, composed): `sortchange` `{sort}`, `selectionchange` `{keys}`, `columnresize`
 * `{id, width}`, `columnmove` `{id, order}`, `pinchange` `{left, right}`, `cellfocus`
 * `{rowKey, columnId, row}`, `cellactivate` `{rowKey, columnId, row}`.
 *
 * Touch: selection is driven by `click`, which a scroll gesture never produces; the resize handle,
 * the grip and the menu honour `--touch-target`, and pinned columns are sticky at any width.
 */
export class UiDataGrid extends ElementBase {
  static observedAttributes = [
    "label",
    "selection",
    "density",
    "row-height",
    "sort",
    "sort-manual",
    "pinned-left",
    "pinned-right",
    "hidden-columns",
    "column-menu",
    "reorderable",
    "storage-key",
  ];

  // data
  #columns: Col[] = [];
  #rows: Row[] = [];
  #rowKey: RowKey | undefined;
  #order: number[] | null = null;
  #keyIndex: Map<string, number> | null = null;
  #sort: SortRule[] = [];
  #selection: SelectionState = EMPTY_SELECTION;
  #labels: GridLabels = LABELS;

  // layout
  #layout: GridLayout = { order: [], hidden: [], widths: {}, pinned: { left: [], right: [] } };
  #stored = false;
  #arr: ColumnArrangement = arrangeColumns([], [], {});
  #shown: Record<string, number> = {};
  #renderIds: string[] = [];
  #byId = new Map<string, Col>();
  #offsets: Record<GridZone, number[]> = { start: [0], center: [0], end: [0] };
  #rowHeight = 40;
  #width = 0;

  // dom
  #viewport!: HTMLElement;
  #sizer!: HTMLElement;
  #head!: HTMLElement;
  #headRow!: HTMLElement;
  #headZones!: Record<GridZone, HTMLElement>;
  #body!: HTMLElement;
  #empty!: HTMLElement;
  #status!: HTMLElement;
  #grid: GridViewport | undefined;
  #observer: ResizeObserver | undefined;
  #built = false;
  #epoch = 1;
  #dirty = false;
  #rowRecs = new Map<string, RowRec>();
  #rowPool: RowRec[] = [];
  #cellPool: CellEl[] = [];
  #headCells = new Map<string, CellEl>();
  #meta = new WeakMap<HTMLElement, Meta>();
  #active = { row: 0, col: 0 };
  #activeKey: string | null = null;
  #scrolled = { start: false, end: false };
  #dragging = false;
  #resizeFrame = 0;
  #reorder: { destroy(): void } | undefined;
  #reorderLoading = false;

  /** Column definitions. */
  get columns(): Col[] {
    return this.#columns;
  }
  set columns(value: Col[]) {
    this.#columns = Array.isArray(value) ? value : [];
    this.#byId = new Map(this.#columns.map((c) => [c.id, c]));
    this.#resetLayout();
    this.#invalidate();
  }

  /** The data. Replace the array (or call `refresh()`) after changing it. */
  get rows(): Row[] {
    return this.#rows;
  }
  set rows(value: Row[]) {
    this.#rows = Array.isArray(value) ? value : [];
    this.#data();
    this.#invalidate();
  }

  /** A property name or `(row, index) => string`. Defaults to the position in `rows`. */
  get rowKey(): RowKey | undefined {
    return this.#rowKey;
  }
  set rowKey(value: RowKey | undefined) {
    this.#rowKey = value;
    this.#data();
    this.#invalidate();
  }

  get sort(): SortRule[] {
    return this.#sort;
  }
  set sort(value: SortRule[]) {
    this.#sort = Array.isArray(value) ? [...value] : [];
    this.#data();
    this.#invalidate();
  }

  get selectedKeys(): string[] {
    return [...this.#selection.keys];
  }
  set selectedKeys(value: string[]) {
    this.#selection = {
      keys: new Set(Array.isArray(value) ? value : []),
      anchor: this.#selection.anchor,
    };
    this.#invalidate();
  }

  /** Column order, widths, hidden and pinned columns. */
  get layout(): GridLayout {
    const { order, hidden, widths, pinned } = this.#layout;
    return {
      order: [...order],
      hidden: [...hidden],
      widths: { ...widths },
      pinned: { left: [...pinned.left], right: [...pinned.right] },
    };
  }
  set layout(value: Partial<GridLayout>) {
    this.#layout = reconcileLayout(this.#columns, value, this.#baseLayout());
    this.#invalidate();
  }

  get pinned(): { left: string[]; right: string[] } {
    const known = (id: string) => this.#byId.size === 0 || this.#byId.has(id);
    return {
      left: this.#layout.pinned.left.filter(known),
      right: this.#layout.pinned.right.filter(known),
    };
  }
  set pinned(value: { left?: readonly string[]; right?: readonly string[] }) {
    const left = [...new Set(value?.left ?? [])];
    const right = [...new Set(value?.right ?? [])].filter((id) => !left.includes(id));
    this.#layout = { ...this.#layout, pinned: { left, right } };
    this.#invalidate();
  }

  get hiddenColumns(): string[] {
    return [...this.#layout.hidden];
  }
  set hiddenColumns(value: string[]) {
    this.#layout = { ...this.#layout, hidden: [...new Set(value ?? [])] };
    this.#invalidate();
  }

  get labels(): GridLabels {
    return this.#labels;
  }
  set labels(value: Partial<GridLabels>) {
    this.#labels = { ...LABELS, ...value };
    this.#invalidate();
  }

  get selection(): SelectionMode {
    const value = this.getAttribute("selection");
    return value === "single" || value === "multi" ? value : "none";
  }
  set selection(value: SelectionMode) {
    this.setAttribute("selection", value);
  }

  connectedCallback(): void {
    connectLight(this, "data-grid", css);
    upgradeProperties(this, [
      "columns",
      "rows",
      "rowKey",
      "sort",
      "selectedKeys",
      "layout",
      "pinned",
      "hiddenColumns",
      "labels",
      "selection",
    ]);
    this.#build();
    this.#readAttributes();
    this.#readStorage();
    this.#observer = new ResizeObserver(() => {
      if (this.#viewport.clientWidth === this.#width) return;
      this.#width = this.#viewport.clientWidth;
      this.#invalidate();
    });
    this.#observer.observe(this.#viewport);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("focusin", this.#onFocusIn);
    this.addEventListener("click", this.#onClick);
    this.addEventListener("dblclick", this.#onDoubleClick);
    this.addEventListener("pointerdown", this.#onPointerDown);
    this.#ensureReorder();
    this.#flush();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#grid?.destroy();
    this.#grid = undefined;
    this.#reorder?.destroy();
    this.#reorder = undefined;
    cancelAnimationFrame(this.#resizeFrame);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("focusin", this.#onFocusIn);
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("dblclick", this.#onDoubleClick);
    this.removeEventListener("pointerdown", this.#onPointerDown);
  }

  attributeChangedCallback(name: string): void {
    if (!this.#built) return;
    if (name === "reorderable") this.#ensureReorder();
    this.#readAttributes(name);
    this.#invalidate();
  }

  // ---- public methods ----------------------------------------------------------------------
  /** Moves keyboard focus to a cell. Row 0 is the header; columns count the rendered columns. */
  focusCell(row: number, col: number): void {
    this.#focusCell(row, col, true);
  }

  /** A rendered cell, `null` when that row or column is not in the DOM right now. */
  getCellElement(rowKey: string, columnId: string): HTMLElement | null {
    return this.#rowRecs.get(rowKey)?.cells.get(columnId) ?? null;
  }

  /** The header cell of a rendered column. */
  getHeaderElement(columnId: string): HTMLElement | null {
    return this.#headCells.get(columnId) ?? null;
  }

  /** Scrolls a row (by key or index) into view. */
  scrollToRow(row: string | number): void {
    const v = typeof row === "number" ? row : this.#indexOfKey(row);
    if (v >= 0) this.#grid?.scrollToRow(v);
  }

  /** Re-renders every visible cell, for row objects that were changed in place. */
  refresh(): void {
    this.#data();
    this.#invalidate();
  }

  clearSelection(): void {
    this.#setSelection(EMPTY_SELECTION);
  }

  resizeColumn(id: string, width: number): void {
    const column = this.#byId.get(id);
    if (!column) return;
    const clamped = clampWidth(width, column);
    this.#layout = { ...this.#layout, widths: { ...this.#layout.widths, [id]: clamped } };
    this.#changed();
    emit(this, "columnresize", { id, width: clamped });
  }

  /** Moves a column `delta` places inside its zone (pinned columns stay pinned). */
  moveColumn(id: string, delta: number): boolean {
    const zone = this.#arr.zoneOf.get(id);
    const list = zone ? this.#arr[zone] : [];
    const target = list[list.indexOf(id) + delta];
    if (!target) return false;
    return this.#setOrder(
      moveColumnTo(this.#layout.order, id, target, delta < 0 ? "before" : "after"),
      id,
    );
  }

  pinColumn(id: string, side: "left" | "right" | null): void {
    if (!this.#byId.has(id)) return;
    const left = this.#layout.pinned.left.filter((x) => x !== id);
    const right = this.#layout.pinned.right.filter((x) => x !== id);
    if (side === "left") left.push(id);
    if (side === "right") right.push(id);
    const rank = (x: string) => this.#layout.order.indexOf(x);
    left.sort((a, b) => rank(a) - rank(b));
    right.sort((a, b) => rank(a) - rank(b));
    this.#layout = { ...this.#layout, pinned: { left, right } };
    this.#changed();
    emit(this, "pinchange", { left, right });
  }

  setSort(sort: SortRule[]): void {
    this.#applySort(sort);
  }

  // ---- attributes and storage --------------------------------------------------------------
  #readAttributes(only?: string): void {
    const all = only === undefined;
    if (all || only === "label") {
      const label = this.getAttribute("label");
      if (label) this.setAttribute("aria-label", label);
    }
    if (all || only === "density" || only === "row-height") {
      const explicit = Number(this.getAttribute("row-height"));
      const density = this.getAttribute("density") as keyof typeof DENSITY | null;
      this.#rowHeight =
        explicit >= 20 ? explicit : DENSITY[density && density in DENSITY ? density : "normal"];
      this.style.setProperty("--ui-data-grid-row", `${this.#rowHeight}px`);
    }
    if ((all || only === "sort") && this.hasAttribute("sort")) {
      this.#sort = parseSort(this.getAttribute("sort"));
      this.#data();
    }
    if (only === "sort-manual") this.#data();
    if (
      (all || only === "pinned-left" || only === "pinned-right") &&
      (this.hasAttribute("pinned-left") || this.hasAttribute("pinned-right"))
    )
      this.pinned = {
        left: idsOf(this.getAttribute("pinned-left")),
        right: idsOf(this.getAttribute("pinned-right")),
      };
    if ((all || only === "hidden-columns") && this.hasAttribute("hidden-columns"))
      this.hiddenColumns = idsOf(this.getAttribute("hidden-columns"));
    if (this.selection === "multi") this.setAttribute("aria-multiselectable", "true");
    else this.removeAttribute("aria-multiselectable");
  }

  #readStorage(): void {
    const key = this.getAttribute("storage-key");
    if (!key || this.#stored) return;
    try {
      const stored = parseStoredLayout(localStorage.getItem(key));
      if (stored) this.#layout = reconcileLayout(this.#columns, stored, this.#layout);
      this.#stored = true;
    } catch {
      // Storage can be blocked; the layout just stops persisting.
    }
  }

  #writeStorage(): void {
    const key = this.getAttribute("storage-key");
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(this.#layout));
    } catch {
      // See #readStorage.
    }
  }

  // ---- model -------------------------------------------------------------------------------
  #baseLayout(): GridLayout {
    return {
      order: this.#columns.map((c) => c.id),
      hidden: [],
      widths: Object.fromEntries(this.#columns.map((c) => [c.id, defaultWidth(c)])),
      pinned: { left: [], right: [] },
    };
  }

  #resetLayout(): void {
    const { hidden, pinned } = this.#layout;
    this.#layout = reconcileLayout(this.#columns, this.#layout, {
      ...this.#baseLayout(),
      hidden,
      pinned,
    });
    this.#stored = false;
    this.#readStorage();
  }

  #keyAtSource(i: number): string {
    const rowKey = this.#rowKey;
    const row = this.#rows[i];
    if (typeof rowKey === "function") return String(rowKey(row, i));
    if (typeof rowKey === "string" && row != null) return String(row[rowKey]);
    return String(i);
  }

  /** Rebuilds the sort order and drops the key index after the rows, the sort or the key changed. */
  #data(): void {
    this.#keyIndex = null;
    this.#order = null;
    if (this.#sort.length > 0 && !this.hasAttribute("sort-manual") && this.#columns.length > 0) {
      const rows = this.#rows;
      const proxies: GridColumn<number>[] = this.#columns.map((c) => ({
        ...c,
        accessor: (i: number) => getCellValue(rows[i], c),
      }));
      this.#order = sortRows(
        Array.from({ length: rows.length }, (_, i) => i),
        proxies,
        this.#sort,
      );
    }
  }

  #source(v: number): number {
    return this.#order ? (this.#order[v] as number) : v;
  }

  #rowAt(v: number): Row {
    return this.#rows[this.#source(v)];
  }

  #keyAt(v: number): string {
    return this.#keyAtSource(this.#source(v));
  }

  #indexOfKey(key: string): number {
    if (!this.#keyIndex) {
      this.#keyIndex = new Map();
      for (let v = 0; v < this.#rows.length; v += 1) this.#keyIndex.set(this.#keyAt(v), v);
    }
    return this.#keyIndex.get(key) ?? -1;
  }

  #selectionRows(): SelectionRows {
    return {
      count: this.#rows.length,
      indexOf: (key) => this.#indexOfKey(key),
      keyAt: (i) => this.#keyAt(i),
    };
  }

  #setSelection(next: SelectionState): void {
    if (next === this.#selection) return;
    const changed =
      next.keys.size !== this.#selection.keys.size ||
      [...next.keys].some((k) => !this.#selection.keys.has(k));
    this.#selection = next;
    this.#invalidate();
    if (!changed) return;
    this.#say(this.#labels.selected(next.keys.size));
    emit(this, "selectionchange", { keys: [...next.keys] });
  }

  #changed(): void {
    this.#writeStorage();
    this.#invalidate();
  }

  #applySort(sort: SortRule[]): void {
    this.#sort = sort;
    this.#data();
    this.#invalidate();
    emit(this, "sortchange", { sort: [...sort] });
    if (this.hasAttribute("sort")) this.setAttribute("sort", formatSort(sort));
  }

  #setOrder(order: string[], id: string): boolean {
    if (same(order, this.#layout.order)) return false;
    this.#layout = { ...this.#layout, order };
    this.#changed();
    this.#computeLayout();
    const column = this.#byId.get(id);
    const zone = this.#arr.zoneOf.get(id);
    if (column && zone) {
      const list = this.#arr[zone];
      this.#say(this.#labels.moved(column.header, list.indexOf(id) + 1, list.length));
    }
    emit(this, "columnmove", { id, order });
    return true;
  }

  // ---- geometry ----------------------------------------------------------------------------
  #rtl(): boolean {
    try {
      return this.matches(":dir(rtl)");
    } catch {
      return getComputedStyle(this).direction === "rtl";
    }
  }

  /** Width of a zone. */
  #extent(zone: GridZone): number {
    return this.#offsets[zone].at(-1) ?? 0;
  }

  #selectable(): boolean {
    return this.selection === "multi";
  }

  #zoneList(zone: GridZone): string[] {
    return zone === "start" && this.#selectable()
      ? [SELECT_ID, ...this.#arr.start]
      : this.#arr[zone];
  }

  #computeLayout(): void {
    const { order, hidden, pinned } = this.#layout;
    this.#arr = arrangeColumns(order, hidden, pinned);
    const dataCols = this.#arr.ids.map((id) => this.#byId.get(id)).filter((c): c is Col => !!c);
    this.#shown = this.#width
      ? fillColumnWidths(
          dataCols,
          this.#layout.widths,
          this.#width,
          this.#selectable() ? SELECT_WIDTH : 0,
        )
      : { ...this.#layout.widths };
    const widthOf = (id: string) => (id === SELECT_ID ? SELECT_WIDTH : (this.#shown[id] ?? 160));
    this.#offsets = {
      start: columnOffsets(this.#zoneList("start").map(widthOf)),
      center: columnOffsets(this.#arr.center.map(widthOf)),
      end: columnOffsets(this.#arr.end.map(widthOf)),
    };
    this.#renderIds = ZONES.flatMap((zone) => this.#zoneList(zone));
  }

  // ---- scheduling --------------------------------------------------------------------------
  #invalidate(): void {
    if (this.#dirty || !this.#built) return;
    this.#dirty = true;
    queueMicrotask(() => this.#flush());
  }

  #flush(): void {
    this.#dirty = false;
    if (!this.isConnected || !this.#built) return;
    this.#width = this.#viewport.clientWidth;
    this.#epoch += 1;
    this.#computeLayout();
    this.#clampActive();
    const total = this.#extent("start") + this.#extent("center") + this.#extent("end");
    const rows = this.#rows.length;
    this.#sizer.style.inlineSize = `${total}px`;
    this.#body.style.blockSize = `${rows * this.#rowHeight}px`;
    this.#head.style.blockSize = `${this.#rowHeight}px`;
    this.setAttribute("aria-rowcount", String(rows + 1));
    this.setAttribute("aria-colcount", String(this.#renderIds.length));
    this.toggleAttribute("data-pin-start", this.#zoneList("start").length > 0);
    this.toggleAttribute("data-pin-end", this.#arr.end.length > 0);
    this.#empty.hidden = rows > 0;
    this.#empty.textContent = rows === 0 ? this.#labels.empty : "";
    if (this.#grid) {
      this.#grid.update(true);
      return;
    }
    this.#grid = createGridViewport(this.#viewport, {
      rowCount: () => this.#rows.length,
      rowHeight: () => this.#rowHeight,
      headerHeight: () => this.#rowHeight,
      centerOffsets: () => this.#offsets.center,
      insetStart: () => this.#extent("start"),
      rtl: () => this.#rtl(),
      onChange: (win) => this.#render(win),
    });
  }

  // ---- construction ------------------------------------------------------------------------
  #build(): void {
    if (this.#built) return;
    this.setAttribute("role", "grid");
    this.#viewport = create("div", "viewport");
    this.#sizer = create("div", "sizer");
    this.#head = create("div", "head", "rowgroup");
    this.#headRow = create("div", "row", "row");
    this.#headRow.setAttribute("aria-rowindex", "1");
    this.#headRow.dataset.sortableList = "columns";
    this.#headZones = this.#zones(this.#headRow);
    this.#head.append(this.#headRow);
    this.#body = create("div", "body", "rowgroup");
    this.#empty = create("div", "empty");
    this.#empty.hidden = true;
    this.#sizer.append(this.#head, this.#body, this.#empty);
    this.#viewport.append(this.#sizer);
    this.#status = create("div", "status", "status");
    this.#status.setAttribute("aria-live", "polite");
    this.replaceChildren(this.#viewport, this.#status);
    this.#viewport.addEventListener("scroll", () => this.#applyEdges(), { passive: true });
    this.#built = true;
  }

  #zones(row: HTMLElement): Record<GridZone, HTMLElement> {
    const zones = {} as Record<GridZone, HTMLElement>;
    for (const zone of ZONES) {
      const el = create("div", "zone", "presentation");
      el.dataset.zone = zone;
      zones[zone] = el;
      row.append(el);
    }
    return zones;
  }

  #say(message: string): void {
    this.#status.textContent = "";
    queueMicrotask(() => {
      this.#status.textContent = message;
    });
  }

  // ---- rendering ---------------------------------------------------------------------------
  /** Ids to render in a zone: every pinned column, the windowed scrolling ones, the active one. */
  #zoneIds(zone: GridZone, win: GridWindow, keepActive: boolean): string[] {
    if (zone !== "center") return this.#zoneList(zone);
    const all = this.#arr.center;
    const ids = all.slice(win.columns.start, win.columns.end);
    const active = keepActive ? this.#renderIds[this.#active.col] : undefined;
    if (active && this.#arr.zoneOf.get(active) === "center" && !ids.includes(active))
      ids.splice(all.indexOf(active) < win.columns.start ? 0 : ids.length, 0, active);
    return ids;
  }

  #render(win: GridWindow): void {
    const hadFocus = this.contains(document.activeElement);
    this.#renderHead(win);
    this.#renderBody(win);
    this.#applyEdges();
    if (hadFocus && !this.contains(document.activeElement)) this.#focusActive();
  }

  #renderHead(win: GridWindow): void {
    const wanted = new Set<string>();
    for (const zone of ZONES) {
      const cells: CellEl[] = [];
      let offset = 0;
      for (const id of this.#zoneIds(zone, win, this.#active.row === 0)) {
        let cell = this.#headCells.get(id);
        if (!cell) {
          cell = this.#makeHead(id);
          this.#headCells.set(id, cell);
        }
        offset = this.#offsets[zone][this.#zoneList(zone).indexOf(id)] ?? offset;
        this.#bindHead(cell, id, zone, offset);
        cells.push(cell);
        wanted.add(id);
      }
      reconcile(this.#headZones[zone], cells);
      this.#headZones[zone].style.inlineSize = `${this.#offsets[zone].at(-1)}px`;
    }
    for (const id of this.#headCells.keys()) if (!wanted.has(id)) this.#headCells.delete(id);
  }

  #makeHead(id: string): CellEl {
    const cell = create("div", "hcell", "columnheader") as CellEl;
    cell.tabIndex = -1;
    if (id === SELECT_ID) {
      cell.append(this.#checkbox());
      return cell;
    }
    const grip = create("span", "grip");
    grip.setAttribute("aria-hidden", "true");
    const sort = create("span", "sort");
    sort.setAttribute("aria-hidden", "true");
    cell.append(grip, create("span", "label"), sort);
    return cell;
  }

  #checkbox(): HTMLInputElement {
    const box = create("input", "check");
    box.type = "checkbox";
    box.tabIndex = -1;
    return box;
  }

  #bindHead(cell: CellEl, id: string, zone: GridZone, offset: number): void {
    const col = this.#renderIds.indexOf(id);
    this.#meta.set(cell, { rec: null, col });
    cell.dataset.col = id;
    cell.setAttribute("aria-colindex", String(col + 1));
    cell.style.insetInlineStart = `${offset}px`;
    cell.style.inlineSize = `${id === SELECT_ID ? SELECT_WIDTH : (this.#shown[id] ?? 160)}px`;
    cell.tabIndex = this.#active.row === 0 && this.#active.col === col ? 0 : -1;
    if (id === SELECT_ID) {
      const box = cell.firstElementChild as HTMLInputElement;
      const level = selectionLevel(this.#selection, this.#selectionRows());
      box.checked = level === "all";
      box.indeterminate = level === "some";
      box.setAttribute("aria-label", this.#labels.selectAll);
      return;
    }
    const column = this.#byId.get(id);
    if (!column) return;
    cell.dataset.sortableItem = id;
    const sorted = ariaSort(this.#sort, id);
    if (sorted) cell.setAttribute("aria-sort", sorted);
    else if (column.sortable !== false) cell.setAttribute("aria-sort", "none");
    else cell.removeAttribute("aria-sort");
    cell.dataset.align = columnAlign(column);
    const label = cell.querySelector<HTMLElement>(":scope > [data-ui-part=label]");
    if (label && label.textContent !== column.header) label.textContent = column.header;
    this.#decorateHead(cell, column, zone);
  }

  /** Resize handle, grip and menu button: they depend on the column and on the grid's attributes. */
  #decorateHead(cell: CellEl, column: Col, zone: GridZone): void {
    const part = (name: string) =>
      cell.querySelector<HTMLElement>(`:scope > [data-ui-part=${name}]`);
    const ensure = (name: string, on: boolean, make: () => HTMLElement) => {
      const current = part(name);
      if (on && !current) {
        const el = make();
        cell.append(el);
        return el;
      }
      if (!on) current?.remove();
      return current;
    };
    ensure("handle", column.resizable !== false, () => {
      const handle = create("span", "handle");
      handle.setAttribute("aria-hidden", "true");
      return handle;
    })?.setAttribute("data-edge", zone === "end" ? "start" : "end");
    cell.toggleAttribute(
      "data-reorderable",
      this.hasAttribute("reorderable") && column.reorderable !== false,
    );
    ensure("menu-button", this.hasAttribute("column-menu"), () => {
      const button = create("button", "menu-button");
      button.type = "button";
      button.tabIndex = -1;
      button.setAttribute("aria-haspopup", "menu");
      button.textContent = "⋮";
      return button;
    })?.setAttribute("aria-label", this.#labels.columnMenu(column.header));
  }

  #renderBody(win: GridWindow): void {
    const { start, end } = win.rows;
    const wanted: number[] = [];
    for (let v = start; v < end; v += 1) wanted.push(v);
    const activeV = this.#active.row - 1;
    if (activeV >= 0 && activeV < this.#rows.length && (activeV < start || activeV >= end))
      wanted.splice(activeV < start ? 0 : wanted.length, 0, activeV);

    const keep = new Map<string, number>();
    for (const v of wanted) keep.set(this.#keyAt(v), v);
    for (const [key, rec] of this.#rowRecs)
      if (!keep.has(key)) {
        this.#releaseRow(rec);
        this.#rowRecs.delete(key);
      }
    const els: HTMLElement[] = [];
    for (const [key, v] of keep) {
      let rec = this.#rowRecs.get(key);
      if (!rec) {
        rec = this.#rowPool.pop() ?? this.#makeRow();
        rec.key = key;
        rec.epoch = 0;
        this.#rowRecs.set(key, rec);
      }
      this.#bindRow(rec, v, win);
      els.push(rec.el);
    }
    reconcile(this.#body, els);
  }

  #makeRow(): RowRec {
    const el = create("div", "row", "row");
    return { el, key: "", v: -1, epoch: 0, zones: this.#zones(el), cells: new Map() };
  }

  #releaseRow(rec: RowRec): void {
    for (const cell of rec.cells.values()) this.#releaseCell(cell);
    rec.cells.clear();
    rec.el.remove();
    rec.v = -1;
    this.#rowPool.push(rec);
  }

  #releaseCell(cell: CellEl): void {
    cell.remove();
    cell._row = undefined;
    cell._col = undefined;
    cell._epoch = 0;
    this.#cellPool.push(cell);
  }

  #bindRow(rec: RowRec, v: number, win: GridWindow): void {
    const row = this.#rowAt(v);
    if (rec.epoch !== this.#epoch || rec.v !== v) {
      rec.v = v;
      rec.el.setAttribute("aria-rowindex", String(v + 2));
      rec.el.style.insetBlockStart = `${v * this.#rowHeight}px`;
      if (this.selection === "none") rec.el.removeAttribute("aria-selected");
      else rec.el.setAttribute("aria-selected", String(this.#selection.keys.has(rec.key)));
    }
    for (const zone of ZONES) {
      const ids = this.#zoneIds(zone, win, this.#active.row === v + 1);
      const list = this.#zoneList(zone);
      const cells: CellEl[] = [];
      for (const id of ids) {
        let cell = rec.cells.get(id);
        if (!cell) {
          cell = this.#cellPool.pop() ?? this.#makeCell();
          rec.cells.set(id, cell);
        }
        if (cell._epoch !== this.#epoch || cell._row !== row || cell._col !== id)
          this.#bindCell(cell, rec, row, id, this.#offsets[zone][list.indexOf(id)] ?? 0);
        cells.push(cell);
      }
      for (const [id, cell] of rec.cells)
        if (!ids.includes(id) && cell.parentElement === rec.zones[zone]) {
          this.#releaseCell(cell);
          rec.cells.delete(id);
        }
      reconcile(rec.zones[zone], cells);
      rec.zones[zone].style.inlineSize = `${this.#offsets[zone].at(-1)}px`;
    }
    rec.epoch = this.#epoch;
  }

  #makeCell(): CellEl {
    const cell = create("div", "cell", "gridcell") as CellEl;
    cell.tabIndex = -1;
    return cell;
  }

  #bindCell(cell: CellEl, rec: RowRec, row: Row, id: string, offset: number): void {
    const col = this.#renderIds.indexOf(id);
    this.#meta.set(cell, { rec, col });
    cell._epoch = this.#epoch;
    cell._row = row;
    cell._col = id;
    cell.dataset.col = id;
    cell.setAttribute("aria-colindex", String(col + 1));
    cell.style.insetInlineStart = `${offset}px`;
    cell.style.inlineSize = `${id === SELECT_ID ? SELECT_WIDTH : (this.#shown[id] ?? 160)}px`;
    cell.tabIndex = this.#active.row === rec.v + 1 && this.#active.col === col ? 0 : -1;
    if (id === SELECT_ID) {
      let box = cell.firstElementChild as HTMLInputElement | null;
      if (box?.dataset.uiPart !== "check") {
        box = this.#checkbox();
        cell.replaceChildren(box);
      }
      box.checked = this.#selection.keys.has(rec.key);
      box.setAttribute("aria-label", this.#labels.selectRow);
      return;
    }
    const column = this.#byId.get(id);
    if (!column) return;
    const align = columnAlign(column);
    if (cell.dataset.align !== align) cell.dataset.align = align;
    const value: CellValue = getCellValue(row, column);
    const formatted = formatCellValue(value, column);
    const context = { row, rowId: rec.key, value, formatted };
    if (column.cellTag && TAG.test(column.cellTag)) {
      let host = cell._tag;
      if (host?.localName !== column.cellTag || host.parentElement !== cell) {
        host = document.createElement(column.cellTag);
        cell._tag = host;
        cell.replaceChildren(host);
      }
      Object.assign(host, { ...context, column });
      return;
    }
    cell._tag = undefined;
    const content: CellContent = column.cell ? column.cell(context) : formatted;
    if (content instanceof Node) {
      if (cell.childNodes.length !== 1 || cell.firstChild !== content)
        cell.replaceChildren(content);
      return;
    }
    const text = content == null ? formatted : String(content);
    const node = cell.firstChild;
    if (cell.childNodes.length === 1 && node?.nodeType === 3) {
      if (node.nodeValue !== text) node.nodeValue = text;
    } else cell.textContent = text;
  }

  #applyEdges(): void {
    const left = Math.abs(this.#viewport.scrollLeft);
    const start = left > 0;
    const end = left < this.#viewport.scrollWidth - this.#viewport.clientWidth - 1;
    if (start !== this.#scrolled.start) {
      this.#scrolled.start = start;
      this.toggleAttribute("data-scrolled-start", start);
    }
    if (end !== this.#scrolled.end) {
      this.#scrolled.end = end;
      this.toggleAttribute("data-scrolled-end", end);
    }
  }

  // ---- focus -------------------------------------------------------------------------------
  /** Keeps the active cell on the same row after the data changed, and inside the grid. */
  #clampActive(): void {
    if (this.#active.row > 0 && this.#activeKey !== null) {
      const v = this.#indexOfKey(this.#activeKey);
      if (v >= 0) this.#active.row = v + 1;
    }
    this.#active.row = Math.min(this.#active.row, this.#rows.length);
    this.#active.col = Math.min(this.#active.col, Math.max(0, this.#renderIds.length - 1));
    this.#activeKey = this.#active.row > 0 ? this.#keyAt(this.#active.row - 1) : null;
  }

  #cellAt(row: number, col: number): CellEl | undefined {
    const id = this.#renderIds[col];
    if (id === undefined) return undefined;
    if (row === 0) return this.#headCells.get(id);
    if (row > this.#rows.length) return undefined;
    return this.#rowRecs.get(this.#keyAt(row - 1))?.cells.get(id);
  }

  #focusActive(): void {
    this.#cellAt(this.#active.row, this.#active.col)?.focus({ preventScroll: true });
  }

  #setActive(row: number, col: number): void {
    const prev = this.#cellAt(this.#active.row, this.#active.col);
    this.#active = { row, col };
    this.#activeKey = row > 0 ? this.#keyAt(row - 1) : null;
    if (prev) prev.tabIndex = -1;
    const next = this.#cellAt(row, col);
    if (next) next.tabIndex = 0;
  }

  #focusCell(row: number, col: number, focus: boolean): void {
    const count = this.#renderIds.length;
    if (!this.#built || count === 0 || !this.#grid) return;
    const r = Math.min(Math.max(0, row), this.#rows.length);
    const c = Math.min(Math.max(0, col), count - 1);
    this.#setActive(r, c);
    const id = this.#renderIds[c] as string;
    if (r > 0) this.#grid.scrollToRow(r - 1);
    else this.#viewport.scrollTop = 0;
    if (this.#arr.zoneOf.get(id) === "center")
      this.#grid.scrollToColumn(this.#arr.center.indexOf(id), this.#extent("end"));
    // A scroll that moved the window re-renders now, so the target cell exists before it is focused.
    this.#grid.update();
    const cell = this.#cellAt(r, c);
    if (cell) cell.tabIndex = 0;
    if (focus) this.#focusActive();
    emit(this, "cellfocus", {
      rowKey: r > 0 ? this.#keyAt(r - 1) : null,
      columnId: id,
      row: r > 0 ? this.#rowAt(r - 1) : null,
    });
  }

  readonly #onFocusIn = (event: FocusEvent): void => {
    const cell = (event.target as Element).closest<HTMLElement>(CELL);
    const meta = cell ? this.#meta.get(cell) : undefined;
    if (!meta) return;
    const row = meta.rec ? meta.rec.v + 1 : 0;
    if (row !== this.#active.row || meta.col !== this.#active.col) this.#setActive(row, meta.col);
  };

  // ---- keyboard ----------------------------------------------------------------------------
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>(CELL);
    const meta = cell ? this.#meta.get(cell) : undefined;
    if (!cell || !meta || !this.contains(cell)) return;
    if (target !== cell && !target.matches("[data-ui-part=check]")) return;
    const row = meta.rec ? meta.rec.v + 1 : 0;
    const mod = event.ctrlKey || event.metaKey;
    const rtl = this.#rtl();
    const id = this.#renderIds[meta.col] as string;

    if (row === 0) {
      if (id === SELECT_ID) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          this.#setSelection(toggleAll(this.#selection, this.selection, this.#selectionRows()));
          return;
        }
      } else {
        const action = headerAction(
          { key: event.key, shift: event.shiftKey, alt: event.altKey, mod },
          rtl,
        );
        if (action) {
          event.preventDefault();
          this.#headerAction(action, id, cell);
          return;
        }
      }
    } else if (meta.rec) {
      const key = meta.rec.key;
      if (event.key === " ") {
        event.preventDefault();
        if (this.selection !== "none")
          this.#setSelection(
            toggleRow(this.#selection, key, this.selection, this.#selectionRows(), event.shiftKey),
          );
        return;
      }
      if (mod && event.key.toLowerCase() === "a" && this.selection === "multi") {
        event.preventDefault();
        this.#setSelection(toggleAll(EMPTY_SELECTION, "multi", this.#selectionRows()));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        emit(this, "cellactivate", { rowKey: key, columnId: id, row: this.#rowAt(row - 1) });
        return;
      }
    }
    if (!NAVIGATION_KEYS.includes(event.key) || event.altKey) return;
    const next = navigate({
      key: event.key,
      mod,
      pos: { row, col: meta.col },
      rowCount: this.#rows.length,
      colCount: this.#renderIds.length,
      pageSize: Math.max(
        1,
        Math.floor((this.#viewport.clientHeight - this.#rowHeight) / this.#rowHeight) - 1,
      ),
      rtl,
    });
    if (!next) return;
    event.preventDefault();
    this.#focusCell(next.row, next.col, true);
  };

  #headerAction(action: HeaderAction, id: string, cell: HTMLElement): void {
    const column = this.#byId.get(id);
    if (!column) return;
    if (action.type === "sort") {
      if (column.sortable !== false) this.#toggleSort(id, action.additive);
    } else if (action.type === "resize") {
      if (column.resizable === false) return;
      const zone = this.#arr.zoneOf.get(id) ?? "center";
      const width = widthFromKey(this.#shown[id] ?? 160, action.direction, zone, column);
      this.resizeColumn(id, width);
      this.#say(this.#labels.resized(column.header, width));
    } else if (action.type === "move") {
      if (this.hasAttribute("reorderable") && column.reorderable !== false) {
        this.moveColumn(id, action.direction);
        queueMicrotask(() => this.#headCells.get(id)?.focus({ preventScroll: true }));
      }
    } else this.#openMenu(id, cell);
  }

  #toggleSort(id: string, additive: boolean): void {
    this.#applySort(toggleSort(this.#sort, id, additive));
    const column = this.#byId.get(id);
    if (column) this.#say(this.#labels.sorted(column.header, ariaSort(this.#sort, id) ?? "none"));
  }

  // ---- pointer -----------------------------------------------------------------------------
  readonly #onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>(CELL);
    const meta = cell ? this.#meta.get(cell) : undefined;
    if (!cell || !meta || !this.contains(cell)) return;
    const id = this.#renderIds[meta.col] as string;
    const isCheck = target.matches("[data-ui-part=check]");
    if (!meta.rec) {
      if (id === SELECT_ID) {
        if (isCheck)
          this.#setSelection(toggleAll(this.#selection, this.selection, this.#selectionRows()));
        this.#focusCell(0, meta.col, true);
        return;
      }
      if (target.closest("[data-ui-part=handle],[data-ui-part=grip]") || this.#dragging) return;
      this.#focusCell(0, meta.col, true);
      if (target.closest("[data-ui-part=menu-button]")) this.#openMenu(id, cell);
      else if (this.#byId.get(id)?.sortable !== false) this.#toggleSort(id, event.shiftKey);
      return;
    }
    this.#setActive(meta.rec.v + 1, meta.col);
    if (!isCheck && target.closest(INTERACTIVE)) return;
    this.#focusActive();
    if (this.selection === "none") return;
    const key = meta.rec.key;
    const rows = this.#selectionRows();
    this.#setSelection(
      isCheck
        ? toggleRow(this.#selection, key, this.selection, rows, event.shiftKey)
        : pressRow(this.#selection, key, this.selection, rows, {
            range: event.shiftKey,
            additive: event.ctrlKey || event.metaKey,
          }),
    );
  };

  readonly #onDoubleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-ui-part=handle]")) {
      const column = this.#byId.get(target.closest<HTMLElement>(CELL)?.dataset.col ?? "");
      if (column) this.resizeColumn(column.id, defaultWidth(column));
      return;
    }
    const meta = this.#meta.get(target.closest<HTMLElement>("[role=gridcell]") as HTMLElement);
    if (!meta?.rec || target.closest(INTERACTIVE)) return;
    emit(this, "cellactivate", {
      rowKey: meta.rec.key,
      columnId: this.#renderIds[meta.col],
      row: this.#rowAt(meta.rec.v),
    });
  };

  readonly #onPointerDown = (event: PointerEvent): void => {
    const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-ui-part=handle]");
    const id = handle?.parentElement?.dataset.col;
    const column = id ? this.#byId.get(id) : undefined;
    if (!handle || !id || !column || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const zone = this.#arr.zoneOf.get(id) ?? "center";
    const rtl = this.#rtl();
    const startX = event.clientX;
    const startWidth = this.#shown[id] ?? 160;
    let width = startWidth;
    handle.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      width = widthFromPointer(startWidth, e.clientX - startX, { rtl, zone }, column);
      if (this.#resizeFrame) return;
      this.#resizeFrame = requestAnimationFrame(() => {
        this.#resizeFrame = 0;
        this.#layout = { ...this.#layout, widths: { ...this.#layout.widths, [id]: width } };
        this.#flush();
      });
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      cancelAnimationFrame(this.#resizeFrame);
      this.#resizeFrame = 0;
      this.resizeColumn(id, width);
      this.#say(this.#labels.resized(column.header, width));
      this.#swallowClick();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  /** A drag or a resize ends with a click on the header, which must not sort. */
  #swallowClick(): void {
    this.#dragging = true;
    setTimeout(() => {
      this.#dragging = false;
    }, 0);
  }

  // ---- features loaded on demand -----------------------------------------------------------
  #openMenu(id: string, anchor: HTMLElement): void {
    const column = this.#byId.get(id);
    if (!column || !this.hasAttribute("column-menu")) return;
    void import("./menu.js").then((menu) =>
      menu.openColumnMenu(this, {
        anchor,
        column,
        labels: this.#labels,
        sort: ariaSort(this.#sort, id),
        zone: this.#arr.zoneOf.get(id) ?? "center",
        rtl: this.#rtl(),
        sortBy: (direction) => this.#applySort(direction ? [{ id, direction }] : []),
        pin: (side) => this.pinColumn(id, side),
        restoreFocus: () => this.#headCells.get(id)?.focus({ preventScroll: true }),
      }),
    );
  }

  #ensureReorder(): void {
    if (!this.hasAttribute("reorderable") || this.#reorder || this.#reorderLoading) return;
    this.#reorderLoading = true;
    void import("@jcsoftdev/ui-core/grid/reorder").then((lib) => {
      this.#reorderLoading = false;
      if (!this.isConnected || this.#reorder) return;
      this.#reorder = lib.attachColumnReorder(this.#headRow, {
        rendered: () =>
          [...this.#headRow.querySelectorAll<HTMLElement>("[data-sortable-item]")].map(
            (el) => el.dataset.sortableItem as string,
          ),
        zoneOf: (id) => this.#arr.zoneOf.get(id),
        rtl: () => this.#rtl(),
        label: (id) => this.#byId.get(id)?.header ?? id,
        announce: (message) => this.#say(message),
        canStartPointer: (event, item) => {
          const target = event.target as HTMLElement;
          if (target.closest("[data-ui-part=handle],[data-ui-part=menu-button]")) return false;
          if (
            !this.hasAttribute("reorderable") ||
            this.#byId.get(item.dataset.sortableItem ?? "")?.reorderable === false
          )
            return false;
          // Touch scrolls the grid; only the grip starts a drag there.
          return event.pointerType !== "touch" || !!target.closest("[data-ui-part=grip]");
        },
        onReorder: (id, targetId, place) =>
          this.#setOrder(moveColumnTo(this.#layout.order, id, targetId, place), id),
        onDragOver: (target, id) => this.#dropIndicator(target?.index ?? null, id),
        onDragEnd: () => this.#swallowClick(),
      });
    });
  }

  #dropIndicator(index: number | null, dragged: string): void {
    const items = [...this.#headRow.querySelectorAll<HTMLElement>("[data-sortable-item]")];
    for (const el of items) el.removeAttribute("data-drop");
    if (index === null) return;
    const others = items.filter((el) => el.dataset.sortableItem !== dragged);
    const at = others[index];
    if (at) at.dataset.drop = "before";
    else others.at(-1)?.setAttribute("data-drop", "after");
  }
}

/** Registers `<ui-data-grid>` (or `<prefix-data-grid>`) and returns the tag. */
export function defineDataGrid(options?: DefineOptions): string {
  return defineElement("data-grid", UiDataGrid, options);
}
