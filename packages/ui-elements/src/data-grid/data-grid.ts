import {
  clampWidth,
  columnOffsets,
  defaultWidth,
  fillColumnWidths,
  type GridLayout,
  moveColumnTo,
  parseStoredLayout,
  reconcileLayout,
  serializeLayout,
} from "@jcsoftdev/ui-core/grid/columns";
import type { EditTrigger } from "@jcsoftdev/ui-core/grid/edit";
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
import { buildView, type GridView, uniqueKeys, type ViewRow } from "@jcsoftdev/ui-core/grid/view";
import {
  createGridViewport,
  type GridViewport,
  type GridWindow,
  scrollInlineToReveal,
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
  /** Text for a boolean cell value. */
  yes: string;
  no: string;
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
  /** Announced when a pin is refused because the pinned columns would fill the grid. */
  pinTooWide: (header: string) => string;
  /** Editor messages (loaded with the editor, so they have defaults there): invalid number and date, a failed validator. */
  invalidNumber?: string;
  invalidDate?: string;
  invalidValue?: string;
  /** Shown when the edited value cannot be stored (a frozen row, a refusing setter). */
  unwritable?: string;
  /** Announced after a cell is edited, after the column header. */
  cellUpdated?: string;
  /** Spreadsheet features (each has an English default in its chunk). */
  rangeSelected?: (info: {
    cells: number;
    numeric: number;
    sum: string;
    average: string;
    min: string;
    max: string;
  }) => string;
  copied?: (cells: number) => string;
  pasted?: (applied: number, skipped: number, clipped: number) => string;
  filled?: (cells: number) => string;
  undone?: (cells: number) => string;
  redone?: (cells: number) => string;
  /** Formula bar: its name, the address chip's name and the placeholder with no cell focused. */
  formulaBar?: string;
  formulaCell?: string;
  formulaEmpty?: string;
  /** Prefix of the tooltip on a cell that shows a formula error. */
  formulaError?: string;
  rowsAdded?: (count: number) => string;
  rowsRemoved?: (count: number) => string;
}

const LABELS: GridLabels = {
  selectAll: "Select all rows",
  selectRow: "Select row",
  empty: "No rows",
  yes: "Yes",
  no: "No",
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
  pinTooWide: (header) => `${header} cannot be pinned: the pinned columns would fill the grid`,
};

const DENSITY = { compact: 32, normal: 40, comfortable: 48 } as const;
/** Id of the checkbox column. A consumer column with this id is rejected. */
const SELECT_ID = "__select";
const SELECT_WIDTH = 44;
/** Scrolling columns keep at least this much width (or all they have) next to the pinned zones. */
const MIN_SCROLL_WIDTH = 120;
/** Browsers cap an element's height at roughly 17 to 33 million pixels. */
const MAX_BODY_HEIGHT = 15_000_000;
const ZONES = ["start", "center", "end"] as const;
const TAG = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
/** Valid custom element names that the platform reserves. */
const RESERVED_TAGS = new Set([
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-src",
  "font-face-uri",
  "font-face-format",
  "font-face-name",
  "missing-glyph",
]);
const INTERACTIVE =
  "a[href],button,input:not([data-ui-part=check]),select,textarea,[data-no-select]";
/** Controls inside a cell: out of the tab order until the cell is entered (Enter / F2). */
const FOCUSABLE =
  "a[href],button,input:not([data-ui-part=check]),select,textarea,[contenteditable]:not([contenteditable=false]),[tabindex]";
const CELL = "[role=gridcell],[role=columnheader]";

// What changed decides how much work the next flush does.
/** Rows, row key, sort or locale: rebuild the view. */
const F_VIEW = 1;
/** Cell content: every mounted cell is filled again. */
const F_CONTENT = 2;
/** Widths, pins, order, density, viewport width: layout and cell positions only. */
const F_GEOMETRY = 4;
/** Selected rows: `aria-selected` and the checkboxes, nothing else. */
const F_SELECTION = 8;
/** Re-run the render pass without invalidating any cell. */
const F_PAINT = 16;
const F_ALL = F_VIEW | F_CONTENT | F_GEOMETRY | F_SELECTION | F_PAINT;

/** What an attribute change invalidates; any other attribute (pins, hidden, density...) is geometry. */
const ATTRIBUTE_FLAGS: Record<string, number> = {
  label: 0,
  locale: F_VIEW | F_CONTENT,
  selection: F_CONTENT | F_GEOMETRY | F_SELECTION,
  sort: F_VIEW,
  "sort-manual": F_VIEW,
  "column-menu": F_PAINT,
  reorderable: F_PAINT,
  editable: F_CONTENT,
};

// biome-ignore lint/suspicious/noExplicitAny: rows are whatever the consumer passes.
type Row = any;
type Col = GridColumn<Row>;

/** What produced a cell change. `undo` and `redo` come from the history; `api` from code. */
export type ChangeSource = "edit" | "paste" | "fill" | "undo" | "redo" | "api";

/** One cell to write: the row key, the column id and the value. */
export interface CellChange {
  rowKey: string;
  columnId: string;
  value: CellValue;
}

/** A change as events report it. `newValue` is an alias of `value`. */
export interface AppliedChange extends CellChange {
  row: Row;
  oldValue: CellValue;
  newValue: CellValue;
}

export interface ChangeResult {
  /** Changes that were stored (or, in `emit` mode, emitted). */
  applied: AppliedChange[];
  /** Cells that could not be written: unknown, frozen, or without a way to write. */
  rejected: { rowKey: string; columnId: string }[];
  /** A `beforecellchange` or `beforecellschange` listener cancelled the write. */
  cancelled: boolean;
}

/** The opt-in spreadsheet features; `features.js` loads the chunk of each one that is on. */
const FEATURES = [
  "history",
  "range-selection",
  "clipboard",
  "fill-handle",
  "formulas",
  "editable-rows",
];
type RowKey = string | ((row: Row, index: number) => string);

interface CellEl extends HTMLElement {
  /** Content epoch the cell was filled for. */
  _c?: number;
  /** Geometry epoch the cell was placed for. */
  _g?: number;
  /** View row the cell was placed for (the roving tabindex depends on it). */
  _v?: number;
  _row?: unknown;
  _col?: unknown;
  _tag?: HTMLElement;
}

interface RowRec {
  el: HTMLElement;
  key: string;
  v: number;
  /** Geometry epoch the row was placed for. */
  g: number;
  /** `aria-selected` last written: `null` means none. */
  sel: boolean | null;
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

const validTag = (tag: string | undefined): tag is string =>
  !!tag && TAG.test(tag) && !RESERVED_TAGS.has(tag);

/**
 * `<ui-data-grid>`: a virtualised data grid (WAI-ARIA `grid` pattern) for `rows` x `columns` that
 * stays smooth at 100 000 rows by 200 columns. Only the visible rows and columns are in the DOM and
 * their elements are pooled and reused, so a scroll inside the rendered window touches no DOM.
 *
 * Structure: the host is a plain container. `role=grid` and its ARIA (label, row and column count,
 * multiselectable) live on an inner element that holds only rows; the live region, the column menu
 * and the "No rows" message are siblings of it, so the grid owns nothing but rows.
 *
 * Data (properties; assigning them before the element is defined works):
 * - `columns: GridColumn[]` with `id`, `header`, `accessor` (key or function, default `id`), `cell`
 *   (returns a Node or a string; a string is always rendered as text, never as HTML), `cellTag` (a
 *   custom element created inside the cell and given `value`, `row`, `rowId`, `column` and
 *   `formatted`), `type`, `format`, `width`, `minWidth`, `maxWidth`, `grow`, `align`, `sortable`,
 *   `resizable`, `reorderable`. The id `__select` is reserved for the checkbox column.
 * - `rows: T[]` and `rowKey` (a property name or `(row, index) => string`, default the index). Keys
 *   must be unique; a repeated key is renamed (`key#2`, `key#3`...) and warned about, so no row is
 *   ever dropped.
 * - `sort: SortRule[]`, `selectedKeys: string[]`, `pinned: {left, right}`, `hiddenColumns`,
 *   `layout` (order, widths, hidden, pinned), `labels` and `locale`.
 *
 * Locale: dates, numbers, currencies and the sort collator follow `locale` (property, then
 * attribute, then the nearest `[lang]`, then `navigator.language`). Numbers keep the Peruvian
 * no-break thousands space only for `es-PE`.
 *
 * Rows have a fixed height (`density` or `row-height`), which is what makes scrolling arithmetic.
 * The scroll height is `rows x height`, and browsers cap an element's height at roughly 17 to 33
 * million pixels, so the limit is about 400 000 rows at 40 px; above 15 million pixels the grid
 * warns once.
 *
 * Keyboard: one tab stop, by roving tabindex. The active cell has `tabindex=0` and stays mounted
 * while it is scrolled out of the window, so focus is never lost; `aria-activedescendant` is not
 * used because recycled elements cannot be referenced reliably. Arrows, Home / End, Ctrl+Home /
 * Ctrl+End, PageUp / PageDown. On a header: Enter / Space sort (Shift adds a rule), Shift+Arrow
 * resizes, Ctrl+Shift+Arrow reorders (with `reorderable`), Alt+ArrowDown opens the menu (with
 * `column-menu`). Ctrl+Home lands on the first header cell and never scrolls the body (the header is
 * sticky). In the body: Space toggles the row (Shift extends), Ctrl+A selects all (multi),
 * Enter fires `cellactivate`. `aria-rowcount`, `aria-colcount`, `aria-rowindex` and `aria-colindex`
 * describe the whole grid, not the rendered part. If the focused column gets hidden, focus stays on
 * the same row and moves to the column now at that position (or the last one).
 *
 * Interactive cell content (APG "widgets in a grid"): links, buttons and inputs inside a cell are
 * taken out of the tab order. Enter or F2 on the cell enters it and focuses the first control, which
 * then (like every control in that cell) is tabbable; arrows and typing belong to the content; Escape
 * or F2 returns focus to the cell. The cancelable `beforecelledit` event fires first so an editor
 * can take over.
 *
 * Editing (loaded on demand: a read-only grid never fetches it). The `editable` attribute makes
 * every cell editable; a column's `editable` (`true`, `false` or `(row) => boolean`) overrides it.
 * Enter, F2, double click or a printable key (which seeds the editor) opens the column's editor in
 * the cell, after the cancelable `beforecelledit` (`detail.trigger` is `enter`, `f2`, `dblclick`,
 * `type`, `tab` or `api`); `editCell(rowKey, columnId)` does it from code. Editors: `text`,
 * `number`, `select` (`options`), `boolean` and `date`, chosen by `column.editor`, else by
 * `options` and `type`; or a custom element tag / `(context) => CellEditor` factory. Number and date
 * text is parsed in the grid's locale, or by `column.parse`. Enter commits and moves down
 * (Shift+Enter up), Tab commits and opens the next editable cell (Shift+Tab the previous), Escape
 * cancels, a click outside commits; focus returns to the cell. `column.validate(value, row)` may
 * return a message (or a promise of one): the editor stays open, `aria-invalid` and
 * `aria-describedby` point at the message and the cell is `aria-busy` while it is pending. The
 * value is written with `column.setter`, else the property accessor; with `edit-mode="emit"` the
 * row is never touched and the consumer applies `cellchange` (`{rowKey, columnId, row, oldValue,
 * newValue}`), e.g. for immutable data: until the consumer replaces `rows` the cell shows the old
 * value again. A row that cannot be written (frozen, or a function accessor without `setter`) is not
 * editable in `mutate` mode. `validate` receives an `AbortSignal` that fires when the edit is
 * cancelled or changed. A failed chunk load fires `editerror` and is retried by the next edit.
 * Cells that cannot be edited get `aria-readonly` while the grid has editing.
 *
 * Batched writes: `changeCells(changes, {source})` writes many cells as one batch (`source` is
 * `edit`, `paste`, `fill`, `undo`, `redo` or `api`). The cancelable `beforecellschange`
 * `{changes, source}` fires first, then every row is written and refilled once, the view is
 * invalidated once and ONE `cellschange` `{changes, source, rejected}` reports it, also in `emit`
 * mode, so a paste is a single event the consumer applies in one go. A one-cell batch also fires
 * `beforecellchange` / `cellchange`, which carry the `source` too.
 *
 * Spreadsheet features, each opt-in by attribute and each its own lazy chunk (a grid that uses none
 * downloads none of them):
 * - `history` (+ `history-depth`, default 100): undo / redo of every `cellschange` that is not itself
 *   an undo or redo, so a paste or a fill undoes as one step. Ctrl / Cmd + Z, Shift + Ctrl / Cmd + Z
 *   and Ctrl + Y; `undo()`, `redo()`, `canUndo`, `canRedo` (defined once the chunk has loaded) and
 *   the `historychange` event `{canUndo, canRedo, undoCount, redoCount}`. In `emit` mode the history
 *   records what the grid EMITTED and undo emits the inverse as a normal `cellschange` (source
 *   `undo`), so it only makes sense when the consumer applies the changes it receives.
 * - `range-selection`: a rectangle of cells, kept apart from row selection and drawn by an overlay
 *   (no cell is rebound). Shift + arrows (Ctrl / Cmd to the edge; Home, End, PageUp, PageDown),
 *   Shift + click, pointer drag with edge auto-scroll, Ctrl / Cmd + A (all data cells; with it the
 *   row-selection Ctrl + A is replaced), Escape or any other key clears it. `rangechange`
 *   `{anchor, focus, from, to, cells, stats}` with `stats` `{count, numeric, sum, avg, min, max}`; the
 *   count, sum and average are announced politely.
 * - `clipboard`: Ctrl / Cmd + C copies the range (or the active cell) as TSV in the editor's format
 *   (`cellscopy`); Ctrl / Cmd + V pastes TSV from the active cell or over the range as ONE batch with
 *   source `paste`. Each text is read like typed text (the column's `parse`, numbers and dates in the
 *   grid's `locale`, a select's label, a boolean's true / false / yes / no). Only SYNCHRONOUS
 *   `validate` results are enforced: a validator that returns a promise gets an aborted signal, is
 *   not awaited, and its cell is written and listed as `unvalidated`. Cells that are not editable or
 *   do not parse are skipped, and a block past the last row or column is cut; `cellspaste`
 *   `{applied, unchanged, skipped, clipped, unvalidated}` reports it all.
 * - `fill-handle` (needs `range-selection`): a handle at the range's bottom-right corner; drag it
 *   down, up, right or left. Numbers continue linearly, dates by day or month (`date-step`: `auto`,
 *   `day`, `month`), text ending in a number counts up, anything else repeats; up / left run it
 *   backwards. Ctrl / Cmd + D / R fill down / right by copying. One batch with source `fill`;
 *   `cellsfill` `{direction, applied, skipped, unvalidated}` reports it.
 * - `formulas`: a cell whose stored text starts with `=` shows its result (and sorts, copies and
 *   sums on it) and is edited as text. `+ - * /`, parentheses, `A1` and `A1:B3` references (columns
 *   count in `columns` order, rows in `rows` order, so addresses survive sorting, pinning, moving
 *   and hiding columns) and `SUM AVG MIN MAX COUNT IF` and more; errors show as `#REF!`, `#DIV/0!`,
 *   `#NAME?`, `#VALUE!`, `#CYCLE!` or `#ERROR!` (cells get `data-formula-error` and a title).
 *   No `eval`. A write by the grid recalculates only what reads the changed cells; in `emit` mode
 *   replace `rows` (or call `refresh()`) to recalculate. Filling shifts relative references;
 *   pasted formula text is stored as typed. Add `formula-bar` for the address chip, `fx` and a
 *   field with the focused cell's stored text (Enter stores it, Escape reverts); it sits outside
 *   `role=grid` and shifts the grid down by `--ui-data-grid-bar`. Labels `formulaBar`,
 *   `formulaCell`, `formulaEmpty`, `formulaError`.
 * - `editable-rows`: `addRow()` appends what the `createRow` property returns,
 *   `addRows([{row, index?}])` and `removeRows(keys?)` (default: the selected rows). Each fires a
 *   cancelable `beforerowschange` and then `rowschange` `{type: "add" | "remove", rows: [{row,
 *   rowId, index}], source}`. `mutate` mode replaces `rows` with a new array, `emit` only reports.
 *   With `history`, they undo and redo as one step.
 *
 * Attributes: `label`, `locale`, `editable`, `edit-mode` (`mutate` | `emit`), `selection` (`none` | `single` | `multi`; multi adds a checkbox
 * column), `density` (`compact` | `normal` | `comfortable`) or `row-height` (px), `sort`
 * (`name:asc,price:desc`), `sort-manual` (report sorts without sorting), `pinned-left` /
 * `pinned-right` (column ids; logical, so right-to-left works), `hidden-columns`, `column-menu` (a
 * menu per column, loaded on demand), `reorderable` (column reordering, loaded on demand),
 * `storage-key` (persists the layout; changing it loads that key's layout).
 *
 * Pinned zones are sticky only while they leave room to scroll: `pinColumn` refuses (and announces
 * it) a pin that would leave the scrolling columns less than a minimum width, and pins that arrive
 * from attributes or storage and overflow switch the grid to `data-pin-overflow`, where the pinned
 * columns scroll with the rest and focus still reveals them.
 *
 * Events (bubble, composed): `sortchange` `{sort}`, `selectionchange` `{keys}`, `columnresize`
 * `{id, width}`, `columnmove` `{id, order}`, `pinchange` `{left, right}`, `cellfocus`
 * `{rowKey, columnId, row}`, `cellactivate` `{rowKey, columnId, row}`, `beforecelledit`
 * `{rowKey, columnId, row}` (cancelable), `beforecellchange` `{rowKey, columnId, row, oldValue,
 * value}` (cancelable) and `cellchange` (same detail).
 *
 * Updates are granular: selection touches `aria-selected` and checkboxes only, a resize moves cells
 * without filling them, and `refreshRows(keys)` refills just those rows. `setEditingCell` exempts
 * one cell from being refilled or unmounted while an editor lives in it.
 *
 * Touch: selection is driven by `click`, which a scroll gesture never produces; the resize handle,
 * the grip and the menu honour `--touch-target`, and pinned columns are sticky at any width.
 */
export class UiDataGrid extends ElementBase {
  static observedAttributes = [
    "label",
    "locale",
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
    "editable",
    ...FEATURES,
  ];

  // data
  #columns: Col[] = [];
  #rows: Row[] = [];
  #rowKey: RowKey | undefined;
  /** @internal The view of rows the spreadsheet chunks read. */
  _view: GridView = buildView({ keys: [] });
  #sort: SortRule[] = [];
  #selection: SelectionState = EMPTY_SELECTION;
  #labels: GridLabels = LABELS;
  #localeProp: string | undefined;
  #locale = "";
  #level: { sel: SelectionState; view: GridView; value: "all" | "some" | "none" } | undefined;

  // layout
  #layout: GridLayout = { order: [], hidden: [], widths: {}, pinned: { left: [], right: [] } };
  #stored = false;
  #arr: ColumnArrangement = arrangeColumns([], [], {});
  #shown: Record<string, number> = {};
  /** @internal Ids of the rendered columns, in order (the checkbox column included). */
  _ids: string[] = [];
  #colIndex = new Map<string, number>();
  #zonePos = new Map<string, number>();
  #byId = new Map<string, Col>();
  /** @internal Cumulative column offsets of each zone. */
  _off: Record<GridZone, number[]> = { start: [0], center: [0], end: [0] };
  /** @internal Row height in pixels. */
  _rowH = 40;
  #width = 0;
  #pinOverflow = false;

  // dom
  #gridEl!: HTMLElement;
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
  #pending = 0;
  #queued = false;
  #contentEpoch = 1;
  #geoEpoch = 1;
  #rowRecs = new Map<string, RowRec>();
  #rowPool: RowRec[] = [];
  #cellPool: CellEl[] = [];
  #headCells = new Map<string, CellEl>();
  #meta = new WeakMap<HTMLElement, Meta>();
  /** @internal The active cell: `row` 0 is the header. */
  _active = { row: 0, col: 0 };
  #activeKey: string | null = null;
  /** Id of the active column: the index shifts when columns are pinned, hidden or added. */
  #activeId: string | null = null;
  /** The one cell that has `tabindex=0`. */
  #tabbed: HTMLElement | null = null;
  #langWatch: MutationObserver | undefined;
  #revealActive = false;
  #entered: HTMLElement | null = null;
  #editing: { key: string; id: string } | null = null;
  /** @internal Called after every render pass; the range overlay repaints from it. */
  _after: (() => void) | undefined;
  /**
   * Set by the `formulas` chunk: maps a cell's stored value to the one shown and sorted on; called
   * without arguments it drops the computed sheet (the rows changed).
   */
  _x: ((value?: CellValue, row?: Row, columnId?: string) => CellValue) | undefined;
  /**
   * Reverts the last recorded change. Defined, with `redo`, `canUndo` and `canRedo`, by the history
   * chunk once it has loaded (the `history` attribute): a grid without history has none of them.
   */
  declare undo: () => boolean;
  declare redo: () => boolean;
  declare readonly canUndo: boolean;
  declare readonly canRedo: boolean;
  /** Creates the row `addRow()` appends (`editable-rows`). */
  declare createRow: (() => Row) | undefined;
  // Defined on the instance by the `editable-rows` chunk.
  declare addRow: () => boolean;
  declare addRows: (
    entries: readonly { row: Row; index?: number }[],
    options?: { source?: ChangeSource },
  ) => boolean;
  declare removeRows: (keys?: readonly string[], options?: { source?: ChangeSource }) => boolean;
  #editLoad: Promise<typeof import("./edit.js") | undefined> | undefined;
  /** The editor chunk is installed (`true`), failed to load (`false`) or not asked for yet. */
  #edit: boolean | undefined;
  /** The grid has editing: the `editable` attribute or a column with `editable`. */
  #editOn = false;
  #scrolled = { start: false, end: false };
  #dragging = false;
  #resizeFrame = 0;
  #reorder: { destroy(): void } | undefined;
  #reorderLoading = false;
  #warnedHeight = false;

  /** Column definitions. */
  get columns(): Col[] {
    return this.#columns;
  }
  set columns(value: Col[]) {
    const list = Array.isArray(value) ? value : [];
    this.#columns = list.filter((column) => {
      if (column?.id !== SELECT_ID) return true;
      console.warn(`ui-data-grid: the column id "${SELECT_ID}" is reserved and was ignored.`);
      return false;
    });
    this.#byId = new Map(this.#columns.map((c) => [c.id, c]));
    this.#resetLayout();
    this.#invalidate(F_VIEW | F_CONTENT | F_GEOMETRY);
  }

  /** The data. Replace the array (or call `refresh()`) after changing it. */
  get rows(): Row[] {
    return this.#rows;
  }
  set rows(value: Row[]) {
    this.#rows = Array.isArray(value) ? value : [];
    this.#invalidate(F_VIEW | F_CONTENT);
  }

  /** A property name or `(row, index) => string`. Defaults to the position in `rows`. */
  get rowKey(): RowKey | undefined {
    return this.#rowKey;
  }
  set rowKey(value: RowKey | undefined) {
    this.#rowKey = value;
    this.#invalidate(F_VIEW | F_CONTENT);
  }

  get sort(): SortRule[] {
    return this.#sort;
  }
  set sort(value: SortRule[]) {
    this.#sort = Array.isArray(value) ? [...value] : [];
    this.#revealActive = true;
    this.#invalidate(F_VIEW);
  }

  get selectedKeys(): string[] {
    return [...this.#selection.keys];
  }
  set selectedKeys(value: string[]) {
    this.#selection = {
      keys: new Set(Array.isArray(value) ? value : []),
      anchor: this.#selection.anchor,
    };
    this.#invalidate(F_SELECTION);
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
    this.#changed();
  }

  get pinned(): { left: string[]; right: string[] } {
    const known = (id: string) => this.#byId.size === 0 || this.#byId.has(id);
    return {
      left: this.#layout.pinned.left.filter(known),
      right: this.#layout.pinned.right.filter(known),
    };
  }
  set pinned(value: { left?: readonly string[]; right?: readonly string[] }) {
    this.#setPinned(value);
    this.#changed();
  }

  get hiddenColumns(): string[] {
    return [...this.#layout.hidden];
  }
  set hiddenColumns(value: string[]) {
    this.#setHidden(value);
    this.#changed();
  }

  get labels(): GridLabels {
    return this.#labels;
  }
  set labels(value: Partial<GridLabels>) {
    this.#labels = { ...LABELS, ...value };
    this.#invalidate(F_CONTENT);
  }

  /** The locale in use: the property, else the `locale` attribute, else `[lang]`, else the browser's. */
  get locale(): string {
    return this.#resolveLocale();
  }
  set locale(value: string | undefined) {
    this.#localeProp = value || undefined;
    this.#invalidate(F_VIEW | F_CONTENT);
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
      "locale",
      "selection",
    ]);
    this.#build();
    this.#readAttributes();
    this.#readStorage();
    this.#observer = new ResizeObserver(() => {
      if (this.#viewport.clientWidth === this.#width) return;
      this.#invalidate(F_GEOMETRY);
    });
    this.#observer.observe(this.#viewport);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("focusin", this.#onFocusIn);
    this.addEventListener("focusout", this.#onFocusOut);
    this.addEventListener("click", this.#onClick);
    this.addEventListener("dblclick", this.#onDoubleClick);
    this.addEventListener("pointerdown", this.#onPointerDown);
    this.#ensureReorder();
    this.#features();
    this.#watchLang();
    this.#pending |= F_ALL;
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
    this.removeEventListener("focusout", this.#onFocusOut);
    this.#langWatch?.disconnect();
    this.#langWatch = undefined;
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("dblclick", this.#onDoubleClick);
    this.removeEventListener("pointerdown", this.#onPointerDown);
  }

  attributeChangedCallback(name: string): void {
    if (!this.#built) return;
    if (name === "reorderable") this.#ensureReorder();
    this.#features();
    if (name === "storage-key" && this.getAttribute("storage-key")) {
      // A new key brings its own layout; without a valid one the code defaults apply.
      this.#layout = this.#baseLayout();
      this.#readAttributes("pinned-left");
      this.#readAttributes("hidden-columns");
      this.#stored = false;
      this.#readStorage();
    }
    this.#readAttributes(name);
    const flags = ATTRIBUTE_FLAGS[name] ?? F_GEOMETRY;
    if (flags) this.#invalidate(flags);
  }

  // ---- public methods ----------------------------------------------------------------------
  /**
   * Moves keyboard focus to a cell: by position (row 0 is the header, columns count the rendered
   * columns) or by row key and column id (`null` for the header row).
   */
  focusCell(row: number, col: number): void;
  focusCell(rowKey: string | null, columnId: string): void;
  focusCell(row: number | string | null, col: number | string): void {
    if (typeof row === "number" && typeof col === "number") {
      this.#focusCell(row, col, true);
      return;
    }
    const c = this.#colIndex.get(String(col));
    const v = row === null ? -1 : this._view.indexOfKey(String(row));
    if (c !== undefined && (row === null || v >= 0)) this.#focusCell(v + 1, c, true);
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
    const v = typeof row === "number" ? row : this._view.indexOfKey(row);
    if (v >= 0) this.#grid?.scrollToRow(v);
  }

  /** Re-sorts and re-renders every visible cell, for row objects that were changed in place. */
  refresh(): void {
    this._x?.();
    this.#invalidate(F_VIEW | F_CONTENT);
  }

  /**
   * Refills the mounted cells of these rows (by key) and nothing else, for rows changed in place.
   * It does not re-sort: call `refresh()` when the change can move a row.
   */
  refreshRows(keys: Iterable<string>): void {
    let any = false;
    for (const key of keys) {
      const rec = this.#rowRecs.get(key);
      if (!rec) continue;
      any = true;
      for (const cell of rec.cells.values()) cell._c = 0;
    }
    if (any) this.#invalidate(F_PAINT);
  }

  /**
   * Exempts one cell from refills and keeps its row and column mounted while an editor lives in
   * it. Pass `null` to release it. The cell is filled again once released.
   */
  setEditingCell(rowKey: string | null, columnId?: string): void {
    const before = this.#editing;
    this.#editing =
      rowKey === null || columnId === undefined ? null : { key: rowKey, id: columnId };
    if (before) {
      const cell = this.#rowRecs.get(before.key)?.cells.get(before.id);
      if (cell) cell._c = 0;
    }
    this.#invalidate(F_PAINT);
  }

  /**
   * Stores `value` for a cell: `changeCells` with one change and `source: "edit"`. Returns `false`
   * when the write was cancelled or the row cannot be written.
   */
  changeCell(rowKey: string, columnId: string, value: CellValue): boolean {
    return this.changeCells([{ rowKey, columnId, value }], { source: "edit" }).applied.length > 0;
  }

  /**
   * Writes several cells as one batch. The cancelable `beforecellschange` (`{changes, source}`)
   * fires first, then every row is written and refilled once, the view is invalidated once, and
   * a single `cellschange` (`{changes, source, rejected}`) reports it; each change is
   * `{rowKey, columnId, row, oldValue, value, newValue}`. A batch of one cell also fires the
   * per-cell `beforecellchange` (cancelable) and `cellchange`, with the same `source`
   * (`edit`, `paste`, `fill`, `undo`, `redo` or `api`, the default).
   *
   * Rows are written through the column's `setter`, else its property accessor; with
   * `edit-mode="emit"` nothing is written and the consumer applies the one event. A cell that
   * cannot be written (unknown, frozen, no setter) is left out and listed in `rejected`.
   */
  changeCells(
    changes: readonly CellChange[],
    { source = "api" }: { source?: ChangeSource } = {},
  ): ChangeResult {
    const write = this.getAttribute("edit-mode") !== "emit";
    const applied: AppliedChange[] = [];
    const rejected: ChangeResult["rejected"] = [];
    for (const { rowKey, columnId, value } of changes) {
      const column = this.#byId.get(columnId);
      const row = this.#rowAt(this._view.indexOfKey(rowKey));
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
      (applied.length === 1 && !emit(this, "beforecellchange", { ...only, source }, true)) ||
      (applied.length && !emit(this, "beforecellschange", { changes: applied, source }, true))
    )
      return { applied: [], rejected, cancelled: true };
    if (write)
      for (const change of [...applied]) {
        const column = this.#byId.get(change.columnId) as Col;
        try {
          if (column.setter) column.setter(change.row, change.value);
          else change.row[(column.accessor ?? column.id) as string] = change.value;
        } catch {
          rejected.push(applied.splice(applied.indexOf(change), 1)[0] as AppliedChange);
        }
      }
    if (rejected.length)
      console.warn(
        "ui-data-grid: some cells could not be written (frozen row or read-only property).",
      );
    if (write) {
      this.refreshRows(applied.map((change) => change.rowKey));
      // Re-run the view when a stage (sort, later filter and group) reads an edited column.
      const stage = this.#viewColumns();
      if (applied.some((change) => stage.has(change.columnId))) this.#invalidate(F_VIEW);
    }
    if (applied.length === 1) emit(this, "cellchange", { ...applied[0], source });
    if (applied.length) emit(this, "cellschange", { changes: applied, source, rejected });
    return { applied, rejected, cancelled: false };
  }

  /**
   * Starts editing a cell: scrolls to it, fires the cancelable `beforecelledit` (with the
   * `trigger`) and opens the column's editor, loaded on first use. Resolves to `false` when the
   * cell is not editable or the event was cancelled. `seed` replaces the editor's text, as typing
   * does.
   */
  editCell(
    rowKey: string,
    columnId: string,
    options: { trigger?: EditTrigger; seed?: string } = {},
  ): Promise<boolean> {
    return this.#loadEdit().then(
      (edit) => edit?.beginEdit(this, rowKey, columnId, options) ?? false,
    );
  }

  /**
   * The cell `rows` rows and `cols` columns away (columns wrap into the next or previous row), or
   * `null` past the ends. Group rows and the checkbox column are cells too.
   */
  stepCell(
    rowKey: string,
    columnId: string,
    rows: number,
    cols: number,
  ): { rowKey: string; columnId: string } | null {
    const n = this._ids.length;
    const at =
      (this._view.indexOfKey(rowKey) + rows) * n + (this.#colIndex.get(columnId) ?? -1) + cols;
    const v = Math.floor(at / n);
    return at < 0 || v >= this._view.count
      ? null
      : { rowKey: this.#keyAt(v), columnId: this._ids[at % n] as string };
  }

  #editable(column: Col, row: Row): boolean {
    const editable = column.editable;
    return (
      row != null &&
      (typeof editable === "function" ? editable(row) : (editable ?? this.hasAttribute("editable")))
    );
  }

  /** Loads the chunks of the opt-in features whose attribute is set; a grid with none loads nothing. */
  #features(): void {
    if (FEATURES.some((name) => this.hasAttribute(name)))
      void import("./features.js").then((f) => f.install(this));
  }

  /** Loads the editor chunk; a failure fires `editerror`, resolves to `undefined` and can be retried. */
  #loadEdit(): Promise<typeof import("./edit.js") | undefined> {
    this.#editLoad ??= import("./edit.js")
      .then((edit) => {
        edit.install(this, { emit, getCellValue });
        this.#edit = true;
        return edit;
      })
      .catch((error) => {
        this.#edit = false;
        this.#editLoad = undefined;
        emit(this, "editerror", { error });
        return undefined;
      });
    return this.#editLoad;
  }

  /** The rows of the view in order (group rows included), for export. A snapshot, not live. */
  get viewRows(): ReadonlyArray<ViewRow & { row: Row | undefined }> {
    const view = this._view;
    return Array.from({ length: view.count }, (_, v) => {
      const entry = view.row(v);
      return { ...entry, row: entry.source >= 0 ? this.#rows[entry.source] : undefined };
    });
  }

  clearSelection(): void {
    this.#setSelection(EMPTY_SELECTION);
  }

  resizeColumn(id: string, width: number): void {
    const column = this.#byId.get(id);
    if (!column || !Number.isFinite(width)) return;
    const clamped = clampWidth(width, column, this.#shown[id] ?? 0);
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

  /**
   * Pins a column to the inline start or end (`null` unpins). Returns `false`, and announces why,
   * when the pinned columns would leave the scrolling ones less than a minimum width.
   */
  pinColumn(id: string, side: "left" | "right" | null): boolean {
    const column = this.#byId.get(id);
    if (!column) return false;
    const left = this.#layout.pinned.left.filter((x) => x !== id);
    const right = this.#layout.pinned.right.filter((x) => x !== id);
    if (side === "left") left.push(id);
    if (side === "right") right.push(id);
    const rank = (x: string) => this.#layout.order.indexOf(x);
    left.sort((a, b) => rank(a) - rank(b));
    right.sort((a, b) => rank(a) - rank(b));
    if (
      side !== null &&
      this.#overflows(arrangeColumns(this.#layout.order, this.#layout.hidden, { left, right }))
    ) {
      this.#say(this.#labels.pinTooWide(column.header));
      return false;
    }
    this.#layout = { ...this.#layout, pinned: { left, right } };
    this.#changed();
    emit(this, "pinchange", { left, right });
    return true;
  }

  setSort(sort: SortRule[]): void {
    this.#applySort(sort);
  }

  // ---- attributes and storage --------------------------------------------------------------
  /** Layout changes that come from attributes are not written back to storage. */
  #setPinned(value: { left?: readonly string[]; right?: readonly string[] }): void {
    const left = [...new Set(value?.left ?? [])];
    const right = [...new Set(value?.right ?? [])].filter((id) => !left.includes(id));
    this.#layout = { ...this.#layout, pinned: { left, right } };
    this.#invalidate(F_GEOMETRY);
  }

  #setHidden(value: string[]): void {
    this.#layout = { ...this.#layout, hidden: [...new Set(value ?? [])] };
    this.#invalidate(F_GEOMETRY);
  }

  #readAttributes(only?: string): void {
    const all = only === undefined;
    if (all || only === "label") {
      const label = this.getAttribute("label");
      if (label) this.#gridEl.setAttribute("aria-label", label);
      else this.#gridEl.removeAttribute("aria-label");
    }
    if (all || only === "density" || only === "row-height") {
      const explicit = Number(this.getAttribute("row-height"));
      const density = this.getAttribute("density") as keyof typeof DENSITY | null;
      this._rowH =
        explicit >= 20 ? explicit : DENSITY[density && density in DENSITY ? density : "normal"];
      this.style.setProperty("--ui-data-grid-row", `${this._rowH}px`);
    }
    if ((all || only === "sort") && this.hasAttribute("sort"))
      this.#sort = parseSort(this.getAttribute("sort"));
    if (
      (all || only === "pinned-left" || only === "pinned-right") &&
      (this.hasAttribute("pinned-left") || this.hasAttribute("pinned-right"))
    )
      this.#setPinned({
        left: idsOf(this.getAttribute("pinned-left")),
        right: idsOf(this.getAttribute("pinned-right")),
      });
    if ((all || only === "hidden-columns") && this.hasAttribute("hidden-columns"))
      this.#setHidden(idsOf(this.getAttribute("hidden-columns")));
    if (all || only === "selection") {
      if (this.selection === "multi") this.#gridEl.setAttribute("aria-multiselectable", "true");
      else this.#gridEl.removeAttribute("aria-multiselectable");
    }
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
    // Nothing is written before the stored layout was read, or it would be overwritten.
    if (!key || !this.#stored) return;
    try {
      localStorage.setItem(key, serializeLayout(this.#layout, this.#columns));
    } catch {
      // See #readStorage.
    }
  }

  /** A change of any `lang` in the document that changes our locale re-renders in the new one. */
  #watchLang(): void {
    this.#langWatch?.disconnect();
    this.#langWatch = new MutationObserver(() => {
      if (this.#resolveLocale() !== this.#locale) this.#invalidate(F_PAINT);
    });
    this.#langWatch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
      subtree: true,
    });
  }

  #resolveLocale(): string {
    return (
      this.#localeProp ||
      this.getAttribute("locale") ||
      this.closest("[lang]")?.getAttribute("lang") ||
      (typeof navigator !== "undefined" ? navigator.language : "") ||
      "en"
    );
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

  #rawKey(i: number): string {
    const rowKey = this.#rowKey;
    const row = this.#rows[i];
    if (typeof rowKey === "function") return String(rowKey(row, i));
    if (typeof rowKey === "string" && row != null) return String(row[rowKey]);
    return String(i);
  }

  /**
   * Rebuilds the view (filter, then sort, then group; filter and group are identity for now) after
   * the rows, the sort, the key or the locale changed. Repeated row keys are renamed.
   */
  #buildView(): void {
    const rows = this.#rows;
    const { keys, duplicates } = uniqueKeys(rows.length, (i) => this.#rawKey(i));
    if (duplicates.length > 0)
      console.warn(
        `ui-data-grid: ${duplicates.length} repeated row key(s), e.g. "${duplicates[0]}". Repeats were renamed ("key#2") so no row is dropped; make \`rowKey\` unique.`,
      );
    const sorted =
      this.#sort.length > 0 && !this.hasAttribute("sort-manual") && this.#columns.length > 0;
    const proxies: GridColumn<number>[] = sorted
      ? this.#columns.map((c) => ({
          ...c,
          accessor: (i: number) => {
            const raw = getCellValue(rows[i], c);
            return this._x ? this._x(raw, rows[i], c.id) : raw;
          },
        }))
      : [];
    this._view = buildView({
      keys,
      sort: sorted ? (indices) => sortRows(indices, proxies, this.#sort, this.#locale) : undefined,
    });
  }

  /** Columns the view stages (sort; filter and group later) read. */
  #viewColumns(): Set<string> {
    return new Set(this.#sort.map((rule) => rule.id));
  }

  /** The row object of view row `v`; `undefined` for a group row. */
  #rowAt(v: number): Row {
    const source = this._view.sourceAt(v);
    return source >= 0 ? this.#rows[source] : undefined;
  }

  #keyAt(v: number): string {
    return this._view.keyAt(v);
  }

  #selectionRows(): SelectionRows {
    const view = this._view;
    // Selection ranges over data rows only; group rows are never selectable.
    return {
      count: view.dataCount,
      indexOf: (key) => view.dataIndexOf(key),
      keyAt: (i) => view.dataKeyAt(i),
    };
  }

  /** Header checkbox state, recomputed only when the selection or the view changed. */
  #selectionLevel(): "all" | "some" | "none" {
    const cached = this.#level;
    if (cached && cached.sel === this.#selection && cached.view === this._view) return cached.value;
    const value = selectionLevel(this.#selection, this.#selectionRows());
    this.#level = { sel: this.#selection, view: this._view, value };
    return value;
  }

  #setSelection(next: SelectionState): void {
    if (next === this.#selection) return;
    const changed =
      next.keys.size !== this.#selection.keys.size ||
      [...next.keys].some((k) => !this.#selection.keys.has(k));
    this.#selection = next;
    this.#invalidate(F_SELECTION);
    if (!changed) return;
    this.#say(this.#labels.selected(next.keys.size));
    emit(this, "selectionchange", { keys: [...next.keys] });
  }

  #changed(): void {
    this.#writeStorage();
    this.#invalidate(F_GEOMETRY);
  }

  #applySort(sort: SortRule[]): void {
    this.#sort = sort;
    this.#revealActive = true;
    this.#invalidate(F_VIEW);
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
    return this._off[zone].at(-1) ?? 0;
  }

  #selectable(): boolean {
    return this.selection === "multi";
  }

  #zoneList(zone: GridZone): string[] {
    return zone === "start" && this.#selectable()
      ? [SELECT_ID, ...this.#arr.start]
      : this.#arr[zone];
  }

  /** Width a column has before leftover space is shared out. */
  #baseWidth(id: string): number {
    if (id === SELECT_ID) return SELECT_WIDTH;
    const column = this.#byId.get(id);
    return this.#layout.widths[id] ?? (column ? defaultWidth(column) : 160);
  }

  /** Whether the pinned zones of `arr` would leave the scrolling columns hidden behind them. */
  #overflows(arr: ColumnArrangement): boolean {
    if (this.#width <= 0) return false;
    const sum = (ids: readonly string[]) =>
      ids.reduce((total, id) => total + this.#baseWidth(id), 0);
    const pinned = sum(arr.start) + sum(arr.end) + (this.#selectable() ? SELECT_WIDTH : 0);
    if (pinned === 0) return false;
    return pinned + Math.min(MIN_SCROLL_WIDTH, sum(arr.center)) > this.#width;
  }

  #computeLayout(): void {
    const { order, hidden, pinned } = this.#layout;
    this.#arr = arrangeColumns(order, hidden, pinned);
    this.#pinOverflow = this.#overflows(this.#arr);
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
    this._off = {
      start: columnOffsets(this.#zoneList("start").map(widthOf)),
      center: columnOffsets(this.#arr.center.map(widthOf)),
      end: columnOffsets(this.#arr.end.map(widthOf)),
    };
    this._ids = ZONES.flatMap((zone) => this.#zoneList(zone));
    this.#colIndex = new Map(this._ids.map((id, i) => [id, i]));
    this.#zonePos = new Map();
    for (const zone of ZONES) {
      const list = this.#zoneList(zone);
      for (let i = 0; i < list.length; i += 1) this.#zonePos.set(list[i] as string, i);
    }
  }

  // ---- scheduling --------------------------------------------------------------------------
  #invalidate(flags: number): void {
    this.#pending |= flags;
    if (this.#queued || !this.#built) return;
    this.#queued = true;
    queueMicrotask(() => this.#flush());
  }

  /** Applies what changed, and only that: see the `F_*` flags. */
  #flush(): void {
    this.#queued = false;
    if (!this.isConnected || !this.#built) return;
    let flags = this.#pending;
    this.#pending = 0;
    const locale = this.#resolveLocale();
    if (locale !== this.#locale) {
      this.#locale = locale;
      flags |= F_VIEW | F_CONTENT;
    }
    const width = this.#viewport.clientWidth;
    if (width !== this.#width) {
      this.#width = width;
      flags |= F_GEOMETRY;
    }
    if (flags & F_VIEW) this.#buildView();
    const wasOverflow = this.#pinOverflow;
    if (flags & F_GEOMETRY) {
      this.#computeLayout();
      this.#geoEpoch += 1;
    }
    if (flags & F_CONTENT) {
      this.#contentEpoch += 1;
      this.#editOn = this.hasAttribute("editable") || this.#columns.some((c) => c.editable);
    }
    if (flags & (F_VIEW | F_GEOMETRY)) this.#clampActive();
    if (flags & (F_VIEW | F_GEOMETRY | F_CONTENT)) this.#applyMetrics();
    if (flags & (F_VIEW | F_CONTENT | F_GEOMETRY | F_PAINT)) {
      if (this.#grid) this.#grid.update(true);
      else
        this.#grid = createGridViewport(this.#viewport, {
          rowCount: () => this._view.count,
          rowHeight: () => this._rowH,
          headerHeight: () => this._rowH,
          centerOffsets: () => this._off.center,
          insetStart: () => this.#extent("start"),
          stickyStart: () => (this.#pinOverflow ? 0 : this.#extent("start")),
          rtl: () => this.#rtl(),
          onChange: (win) => this.#render(win),
        });
      if (this.#revealActive || (this.#pinOverflow !== wasOverflow && this.#hasFocus())) {
        this.#revealActive = false;
        this._reveal(this._active.row, this._active.col);
      }
      this.#syncTabStop();
    }
    this.#applySelection();
    this._after?.();
    if (this.#editOn && this.#edit === undefined && !this.#editLoad) void this.#loadEdit();
  }

  #hasFocus(): boolean {
    return this.contains(document.activeElement);
  }

  /** Sizes of the scroll area and the attributes that describe the whole grid. */
  #applyMetrics(): void {
    const total = this.#extent("start") + this.#extent("center") + this.#extent("end");
    const rows = this._view.count;
    this.#sizer.style.inlineSize = `${total}px`;
    this.#body.style.blockSize = `${rows * this._rowH}px`;
    this.#head.style.blockSize = `${this._rowH}px`;
    this.#gridEl.setAttribute("aria-rowcount", String(rows + 1));
    this.#gridEl.setAttribute("aria-colcount", String(this._ids.length));
    this.toggleAttribute("data-pin-start", this.#zoneList("start").length > 0);
    this.toggleAttribute("data-pin-end", this.#arr.end.length > 0);
    this.toggleAttribute("data-pin-overflow", this.#pinOverflow);
    this.#empty.hidden = rows > 0;
    this.#empty.textContent = rows === 0 ? this.#labels.empty : "";
    if (rows * this._rowH > MAX_BODY_HEIGHT && !this.#warnedHeight) {
      this.#warnedHeight = true;
      console.warn(
        `ui-data-grid: ${rows} rows of ${this._rowH}px are taller than browsers can scroll reliably; rows past the limit will not be reachable.`,
      );
    }
  }

  // ---- construction ------------------------------------------------------------------------
  #build(): void {
    if (this.#built) return;
    this.#gridEl = create("div", "grid", "grid");
    this.#viewport = create("div", "viewport");
    this.#sizer = create("div", "sizer");
    this.#head = create("div", "head", "rowgroup");
    this.#headRow = create("div", "row", "row");
    this.#headRow.setAttribute("aria-rowindex", "1");
    this.#headRow.dataset.sortableList = "columns";
    this.#headZones = this.#zones(this.#headRow);
    this.#head.append(this.#headRow);
    this.#body = create("div", "body", "rowgroup");
    this.#sizer.append(this.#head, this.#body);
    this.#viewport.append(this.#sizer);
    this.#gridEl.append(this.#viewport);
    this.#empty = create("div", "empty");
    this.#empty.hidden = true;
    this.#status = create("div", "status", "status");
    this.#status.setAttribute("aria-live", "polite");
    this.replaceChildren(this.#gridEl, this.#empty, this.#status);
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
  /** Ids to render in a zone: every pinned column, the windowed scrolling ones, the kept ones. */
  #zoneIds(zone: GridZone, win: GridWindow, keep: readonly string[]): string[] {
    if (zone !== "center") return this.#zoneList(zone);
    const all = this.#arr.center;
    const ids = all.slice(win.columns.start, win.columns.end);
    for (const id of keep)
      if (this.#arr.zoneOf.get(id) === "center" && !ids.includes(id))
        ids.splice(all.indexOf(id) < win.columns.start ? 0 : ids.length, 0, id);
    return ids;
  }

  /** Columns that stay mounted in a row even outside the window: the active and the edited cell. */
  #keepIds(row: number, key: string | null): string[] {
    const keep: string[] = [];
    if (this._active.row === row) {
      const id = this._ids[this._active.col];
      if (id !== undefined) keep.push(id);
    }
    if (key !== null && this.#editing?.key === key) keep.push(this.#editing.id);
    return keep;
  }

  #render(win: GridWindow): void {
    const hadFocus = this.#hasFocus();
    this.#renderHead(win);
    this.#renderBody(win);
    this.#applyEdges();
    if (hadFocus && !this.#hasFocus()) this.#focusActive();
  }

  #renderHead(win: GridWindow): void {
    const wanted = new Set<string>();
    for (const zone of ZONES) {
      const cells: CellEl[] = [];
      for (const id of this.#zoneIds(zone, win, this.#keepIds(0, null))) {
        let cell = this.#headCells.get(id);
        if (!cell) {
          cell = this.#makeHead(id);
          this.#headCells.set(id, cell);
        }
        const offset = this._off[zone][this.#zonePos.get(id) ?? 0] ?? 0;
        this.#bindHead(cell, id, zone, offset);
        cells.push(cell);
        wanted.add(id);
      }
      reconcile(this.#headZones[zone], cells);
      this.#headZones[zone].style.inlineSize = `${this.#extent(zone)}px`;
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
    const col = this.#colIndex.get(id) ?? 0;
    this.#meta.set(cell, { rec: null, col });
    cell.dataset.col = id;
    cell.setAttribute("aria-colindex", String(col + 1));
    cell.style.insetInlineStart = `${offset}px`;
    cell.style.inlineSize = `${id === SELECT_ID ? SELECT_WIDTH : (this.#shown[id] ?? 160)}px`;
    cell.tabIndex = this._active.row === 0 && this._active.col === col ? 0 : -1;
    if (id === SELECT_ID) {
      const box = cell.firstElementChild as HTMLInputElement;
      box.setAttribute("aria-label", this.#labels.selectAll);
      this.#syncHeaderCheck(box);
      return;
    }
    const column = this.#byId.get(id);
    if (!column) return;
    cell.dataset.sortableItem = id;
    // Only the primary sorted column carries aria-sort; every sorted one shows its arrow.
    const direction = ariaSort(this.#sort, id);
    if (direction && this.#sort[0]?.id === id) cell.setAttribute("aria-sort", direction);
    else cell.removeAttribute("aria-sort");
    if (direction) cell.dataset.sort = direction;
    else delete cell.dataset.sort;
    cell.toggleAttribute("data-sortable", column.sortable !== false);
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
    const count = this._view.count;
    const wanted: number[] = [];
    for (let v = start; v < end; v += 1) wanted.push(v);
    const extra = (v: number) => {
      if (v >= 0 && v < count && (v < start || v >= end) && !wanted.includes(v))
        wanted.splice(v < start ? 0 : wanted.length, 0, v);
    };
    extra(this._active.row - 1);
    if (this.#editing) extra(this._view.indexOfKey(this.#editing.key));

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
        rec.el.dataset.key = key;
        rec.g = 0;
        rec.sel = null;
        this.#rowRecs.set(key, rec);
      }
      this.#bindRow(rec, v, win);
      els.push(rec.el);
    }
    reconcile(this.#body, els);
  }

  #makeRow(): RowRec {
    const el = create("div", "row", "row");
    return { el, key: "", v: -1, g: 0, sel: null, zones: this.#zones(el), cells: new Map() };
  }

  #releaseRow(rec: RowRec): void {
    for (const cell of rec.cells.values()) this.#releaseCell(cell);
    rec.cells.clear();
    rec.el.remove();
    rec.v = -1;
    this.#rowPool.push(rec);
  }

  #releaseCell(cell: CellEl): void {
    if (cell === this.#entered) this.#entered = null;
    cell.remove();
    cell._row = undefined;
    cell._col = undefined;
    cell._c = 0;
    cell._g = 0;
    cell._v = -1;
    this.#cellPool.push(cell);
  }

  #bindRow(rec: RowRec, v: number, win: GridWindow): void {
    const row = this.#rowAt(v);
    const geo = this.#geoEpoch;
    if (rec.v !== v || rec.g !== geo) {
      rec.v = v;
      rec.g = geo;
      rec.el.setAttribute("aria-rowindex", String(v + 2));
      rec.el.style.insetBlockStart = `${v * this._rowH}px`;
      for (const zone of ZONES) rec.zones[zone].style.inlineSize = `${this.#extent(zone)}px`;
    }
    this.#syncRowSelection(rec);
    // Group rows (D3) have no cells yet: they mount as an empty, labelled row.
    const group = this._view.kind(v) === "group";
    rec.el.toggleAttribute("data-group", group);
    if (group) rec.el.setAttribute("aria-level", String(this._view.row(v).depth + 1));
    else rec.el.removeAttribute("aria-level");
    const keep = this.#keepIds(v + 1, rec.key);
    for (const zone of ZONES) {
      const ids = group ? [] : this.#zoneIds(zone, win, keep);
      const cells: CellEl[] = [];
      for (const id of ids) {
        let cell = rec.cells.get(id);
        if (!cell) {
          cell = this.#cellPool.pop() ?? this.#makeCell();
          rec.cells.set(id, cell);
        }
        if (cell._g !== geo || cell._v !== v)
          this.#placeCell(cell, rec, id, this._off[zone][this.#zonePos.get(id) ?? 0] ?? 0);
        const editing = this.#editing?.key === rec.key && this.#editing.id === id;
        if (!editing && (cell._c !== this.#contentEpoch || cell._row !== row || cell._col !== id))
          this.#fillCell(cell, rec, row, id);
        cells.push(cell);
      }
      for (const [id, cell] of rec.cells)
        if (!ids.includes(id) && cell.parentElement === rec.zones[zone]) {
          this.#releaseCell(cell);
          rec.cells.delete(id);
        }
      reconcile(rec.zones[zone], cells);
    }
  }

  #makeCell(): CellEl {
    const cell = create("div", "cell", "gridcell") as CellEl;
    cell.tabIndex = -1;
    return cell;
  }

  /** Position, size and roving tabindex: everything that does not depend on the data. */
  #placeCell(cell: CellEl, rec: RowRec, id: string, offset: number): void {
    const col = this.#colIndex.get(id) ?? 0;
    this.#meta.set(cell, { rec, col });
    cell._g = this.#geoEpoch;
    cell._v = rec.v;
    cell.setAttribute("aria-colindex", String(col + 1));
    cell.style.insetInlineStart = `${offset}px`;
    cell.style.inlineSize = `${id === SELECT_ID ? SELECT_WIDTH : (this.#shown[id] ?? 160)}px`;
    cell.tabIndex = this._active.row === rec.v + 1 && this._active.col === col ? 0 : -1;
  }

  /** The cell's content: the only place the column renderer runs. */
  #fillCell(cell: CellEl, rec: RowRec, row: Row, id: string): void {
    cell._c = this.#contentEpoch;
    cell._row = row;
    cell._col = id;
    cell.dataset.col = id;
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
    // In an editing grid, the cells that cannot be edited say so.
    cell.ariaReadOnly = this.#editOn && !this.#editable(column, row) ? "true" : null;
    const stored: CellValue = getCellValue(row, column);
    const value: CellValue = this._x ? this._x(stored, row, id) : stored;
    const formatted = formatCellValue(value, column, {
      locale: this.#locale,
      labels: { yes: this.#labels.yes, no: this.#labels.no },
    });
    const context = { row, rowId: rec.key, value, formatted };
    if (validTag(column.cellTag)) {
      let host = cell._tag;
      if (host?.localName !== column.cellTag || host.parentElement !== cell) {
        host = document.createElement(column.cellTag);
        // Upgrade first so the properties below reach the element's accessors, not shadow them.
        customElements.upgrade(host);
        cell._tag = host;
        cell.replaceChildren(host);
      }
      Object.assign(host, { ...context, column });
      this.#tame(cell);
      return;
    }
    cell._tag = undefined;
    const content: CellContent = column.cell ? column.cell(context) : formatted;
    if (content instanceof Node) {
      if (cell.childNodes.length !== 1 || cell.firstChild !== content)
        cell.replaceChildren(content);
      this.#tame(cell);
      return;
    }
    const text = content == null ? formatted : String(content);
    const node = cell.firstChild;
    if (cell.childNodes.length === 1 && node?.nodeType === 3) {
      if (node.nodeValue !== text) node.nodeValue = text;
    } else cell.textContent = text;
  }

  /** Takes the controls in a cell out of the tab order (the cell is the tab stop). */
  #tame(cell: HTMLElement): void {
    if (cell === this.#entered) return;
    for (const control of this.#controls(cell)) if (control.tabIndex !== -1) control.tabIndex = -1;
  }

  #controls(cell: HTMLElement): HTMLElement[] {
    return [...cell.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !(el as HTMLInputElement).disabled,
    );
  }

  #syncRowSelection(rec: RowRec): void {
    const selected =
      this.selection === "none" || this._view.kind(rec.v) === "group"
        ? null
        : this.#selection.keys.has(rec.key);
    if (rec.sel === selected) return;
    rec.sel = selected;
    if (selected === null) rec.el.removeAttribute("aria-selected");
    else rec.el.setAttribute("aria-selected", String(selected));
    const box = rec.cells.get(SELECT_ID)?.firstElementChild as HTMLInputElement | undefined;
    if (box) box.checked = selected === true;
  }

  #syncHeaderCheck(box: HTMLInputElement): void {
    const level = this.#selectionLevel();
    box.checked = level === "all";
    box.indeterminate = level === "some";
  }

  /** Selection changed: `aria-selected` and the checkboxes of what is mounted, nothing else. */
  #applySelection(): void {
    for (const rec of this.#rowRecs.values()) this.#syncRowSelection(rec);
    const box = this.#headCells.get(SELECT_ID)?.firstElementChild as HTMLInputElement | undefined;
    if (box) this.#syncHeaderCheck(box);
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
    if (this._active.row > 0 && this.#activeKey !== null) {
      const v = this._view.indexOfKey(this.#activeKey);
      if (v >= 0) this._active.row = v + 1;
    }
    this._active.row = Math.min(this._active.row, this._view.count);
    // Follow the column by id: pinning, hiding or adding columns moves its index.
    const moved = this.#activeId === null ? undefined : this.#colIndex.get(this.#activeId);
    if (moved !== undefined) this._active.col = moved;
    this._active.col = Math.min(this._active.col, Math.max(0, this._ids.length - 1));
    this.#activeId = this._ids[this._active.col] ?? null;
    this.#activeKey = this._active.row > 0 ? this.#keyAt(this._active.row - 1) : null;
  }

  /** Exactly one cell is the tab stop: the active one, wherever the data moved it. */
  #syncTabStop(): void {
    const next = this.#cellAt(this._active.row, this._active.col) ?? null;
    if (this.#tabbed && this.#tabbed !== next) this.#tabbed.tabIndex = -1;
    if (next) next.tabIndex = 0;
    this.#tabbed = next;
  }

  #cellAt(row: number, col: number): CellEl | undefined {
    const id = this._ids[col];
    if (id === undefined) return undefined;
    if (row === 0) return this.#headCells.get(id);
    if (row > this._view.count) return undefined;
    return this.#rowRecs.get(this.#keyAt(row - 1))?.cells.get(id);
  }

  #focusActive(): void {
    this.#cellAt(this._active.row, this._active.col)?.focus({ preventScroll: true });
  }

  #setActive(row: number, col: number): void {
    this._active = { row, col };
    this.#activeKey = row > 0 ? this.#keyAt(row - 1) : null;
    this.#activeId = this._ids[col] ?? null;
    this.#syncTabStop();
  }

  /**
   * Scrolls a cell into view without it hiding under a pinned zone. The header row never scrolls
   * the body: it is sticky, so focusing it leaves `scrollTop` alone.
   */
  /** @internal */
  _reveal(row: number, col: number): void {
    const grid = this.#grid;
    const id = this._ids[col];
    if (!grid || id === undefined) return;
    if (row > 0) grid.scrollToRow(row - 1);
    const zone = this.#arr.zoneOf.get(id) ?? "start";
    if (zone === "center")
      grid.scrollToColumn(
        this.#arr.center.indexOf(id),
        this.#pinOverflow ? 0 : this.#extent("end"),
      );
    else if (this.#pinOverflow) this.#revealPinned(id, zone);
    // A scroll that moved the window re-renders now, so the target cell exists before it is focused.
    grid.update();
  }

  /** In overflow mode the pinned zones scroll with the grid, so a pinned cell can be off-screen. */
  #revealPinned(id: string, zone: GridZone): void {
    const offsets = this._off[zone];
    const at = this.#zonePos.get(id) ?? 0;
    const base = zone === "start" ? 0 : this.#extent("start") + this.#extent("center");
    const left = base + (offsets[at] ?? 0);
    const width = (offsets[at + 1] ?? 0) - (offsets[at] ?? 0);
    const next = scrollInlineToReveal(
      left,
      width,
      this.#viewport.clientWidth,
      Math.abs(this.#viewport.scrollLeft),
      0,
      0,
    );
    this.#viewport.scrollLeft = (this.#rtl() ? -1 : 1) * next;
  }

  #focusCell(row: number, col: number, focus: boolean): void {
    const count = this._ids.length;
    if (!this.#built || count === 0 || !this.#grid) return;
    const r = Math.min(Math.max(0, row), this._view.count);
    const c = Math.min(Math.max(0, col), count - 1);
    this.#setActive(r, c);
    const id = this._ids[c] as string;
    this._reveal(r, c);
    const cell = this.#cellAt(r, c);
    if (cell) cell.tabIndex = 0;
    if (focus) this.#focusActive();
    emit(this, "cellfocus", {
      rowKey: r > 0 ? this.#keyAt(r - 1) : null,
      columnId: id,
      row: r > 0 ? this.#rowAt(r - 1) : null,
    });
  }

  /** Focus left the grid: a cell that was entered goes back to being one tab stop. */
  readonly #onFocusOut = (event: FocusEvent): void => {
    if (!this.#entered) return;
    const to = event.relatedTarget as Node | null;
    if (!to || !this.contains(to)) this.#exitCell(false);
  };

  readonly #onFocusIn = (event: FocusEvent): void => {
    const target = event.target as Element;
    const cell = target.closest<HTMLElement>(CELL);
    if (this.#entered && cell !== this.#entered) this.#exitCell(false);
    const meta = cell ? this.#meta.get(cell) : undefined;
    if (!meta) return;
    const row = meta.rec ? meta.rec.v + 1 : 0;
    if (row !== this._active.row || meta.col !== this._active.col) this.#setActive(row, meta.col);
  };

  // ---- interactive cell content ------------------------------------------------------------
  /** Enter / F2 on a cell with controls: they become tabbable and the first one takes focus. */
  #enterCell(cell: HTMLElement): boolean {
    const controls = this.#controls(cell);
    if (controls.length === 0) return false;
    this.#entered = cell;
    for (const control of controls) control.tabIndex = 0;
    controls[0]?.focus();
    return true;
  }

  /** Back to the cell: its controls leave the tab order again. */
  #exitCell(refocus: boolean, cell: HTMLElement | null = this.#entered): void {
    if (!cell) return;
    if (cell === this.#entered) this.#entered = null;
    for (const control of this.#controls(cell)) control.tabIndex = -1;
    if (refocus) cell.focus({ preventScroll: true });
  }

  // ---- keyboard ----------------------------------------------------------------------------
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>(CELL);
    const meta = cell ? this.#meta.get(cell) : undefined;
    if (!cell || !meta || !this.contains(cell)) return;
    if (target !== cell && !target.matches("[data-ui-part=check]")) {
      // Inside the content of a cell the keys belong to the content, except the way back.
      if (event.key === "Escape" || event.key === "F2") {
        event.preventDefault();
        this.#exitCell(true, cell);
      }
      return;
    }
    // Content a custom element rendered after the cell was filled must not become a tab stop.
    if (event.key === "Tab" && cell !== this.#entered) this.#tame(cell);
    const row = meta.rec ? meta.rec.v + 1 : 0;
    const mod = event.ctrlKey || event.metaKey;
    const rtl = this.#rtl();
    const id = this._ids[meta.col] as string;

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
      const typed = event.key.length === 1 && event.key !== " " && !mod && !event.altKey;
      const column = this.#byId.get(id);
      // The editor chunk is still on its way: its first keys must not be lost or mean something else.
      if (
        this.#editOn &&
        !this.#edit &&
        column &&
        (typed || event.key === "Enter" || event.key === "F2") &&
        this.#editable(column, this.#rowAt(row - 1))
      ) {
        event.preventDefault();
        void this.editCell(key, id, {
          trigger: typed ? "type" : (event.key.toLowerCase() as "enter" | "f2"),
          seed: typed ? event.key : undefined,
        });
        return;
      }
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        const detail = {
          rowKey: key,
          columnId: id,
          row: this.#rowAt(row - 1),
          trigger: event.key.toLowerCase(),
        };
        // An editor takes over by cancelling this; otherwise Enter / F2 enters the cell's controls.
        if (!emit(this, "beforecelledit", detail, true)) return;
        if (event.key === "Enter") emit(this, "cellactivate", detail);
        this.#enterCell(cell);
        return;
      }
    }
    if (!NAVIGATION_KEYS.includes(event.key) || event.altKey) return;
    const next = navigate({
      key: event.key,
      mod,
      pos: { row, col: meta.col },
      rowCount: this._view.count,
      colCount: this._ids.length,
      pageSize: Math.max(
        1,
        Math.floor((this.#viewport.clientHeight - this._rowH) / this._rowH) - 1,
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
    const id = this._ids[meta.col] as string;
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
    const detail = {
      rowKey: meta.rec.key,
      columnId: this._ids[meta.col],
      row: this.#rowAt(meta.rec.v),
    };
    if (emit(this, "beforecelledit", { ...detail, trigger: "dblclick" }, true))
      emit(this, "cellactivate", detail);
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
        // Geometry only: cells move and resize, none is filled again.
        this.#layout = { ...this.#layout, widths: { ...this.#layout.widths, [id]: width } };
        this.#invalidate(F_GEOMETRY);
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
