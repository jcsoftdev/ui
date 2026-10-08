// biome-ignore-all lint/a11y/noNoninteractiveElementToInteractiveRole: an ARIA grid is a table with role="grid"; its cells are gridcells.
// biome-ignore-all lint/a11y/noInteractiveElementToNoninteractiveRole: spacer and filler cells of the grid are presentational.
// biome-ignore-all lint/a11y/noAriaHiddenOnFocusable: spacer and skeleton rows are never focusable (no tabindex).
// biome-ignore-all lint/a11y/useFocusableInteractive: footer and empty-state cells are read, not navigated.
"use client";

import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Copy,
  GripVertical,
  PinOff,
} from "lucide-react";
import {
  type ClipboardEvent,
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Chip } from "../../atoms/chip/chip.js";
import { formatCurrency, formatNumber } from "../../charts/core/format.js";
import { cn } from "../../utils/cn.js";
import { computePinOffsets, type PinPosition, sanitizePinned } from "../table/pin.js";
import { buildHeaderGroups, groupPathOf } from "./column-groups.js";
import { ColumnMenu } from "./column-menu.js";
import type { DataSource } from "./data-source.js";
import {
  applyAdvancedFilter,
  countConditions,
  emptyGroup,
  type FilterGroup,
} from "./filter-builder.js";
import { FilterBuilder } from "./filter-builder-editor.js";
import { cellAddress, columnLabel, isFormulaText, shiftFormula } from "./formula.js";
import { FormulaBar } from "./formula-bar.js";
import { buildSheet, displayValue, isErrorText, type ParseCache } from "./formula-sheet.js";
import {
  type FillDirection,
  parseLooseNumber,
  parseTSV,
  planFill,
  planPaste,
  sameCellValue,
} from "./grid-edit.js";
import { GridToolbar } from "./grid-toolbar.js";
import {
  type CellDelta,
  type ChangeSource,
  commandSize,
  createHistory,
  DEFAULT_HISTORY_DEPTH,
  type HistoryCommand,
  type HistorySummary,
  pushCommand,
  type RowRef,
  redoCommand,
  setHistoryDepth,
  summarizeHistory,
  undoCommand,
} from "./history.js";
import { type DataGridLabels, DEFAULT_DATA_GRID_LABELS } from "./labels.js";
import {
  aggregateValues,
  buildDisplayRows,
  columnAlign,
  computeAggregates,
  countActiveFilters,
  distinctValues,
  fillColumnWidths,
  filterRows,
  formatAggregate,
  formatCellValue,
  getCellValue,
  rangeBetween,
  sortRows,
  toCSV,
  toggleSort,
} from "./model.js";
import {
  buildPivot,
  isPivotValid,
  type PivotConfig,
  type PivotRow,
  pivotColumns,
  pivotFooter,
} from "./pivot.js";
import {
  type CellRange,
  extendRange,
  inRange,
  rangeBounds,
  rangeStats,
  rangeToTSV,
} from "./range.js";
import {
  insertDetailRows,
  moveRowBy,
  moveRowTo,
  NO_PINNED_ROWS,
  type PinnedRows,
  pinnedSideOf,
  type RowPinSide,
  splitPinnedRows,
  togglePinnedRow,
  toggleSetMember,
} from "./rows.js";
import { EMPTY_PIVOT, GridToolPanel } from "./tool-panel.js";
import { buildTreeRows, withAncestors } from "./tree.js";
import type {
  CellValue,
  DataGridColumn,
  Density,
  DisplayRow,
  EditorKind,
  Filters,
  FilterValue,
  PinSide,
  SortRule,
} from "./types.js";
import { useDataSource } from "./use-data-source.js";
import { useGridLayout } from "./use-grid-layout.js";
import {
  computeVariableWindow,
  computeVirtualWindow,
  pageCount,
  pageStep,
  scrollLeftToReveal,
  scrollTopToRevealSpan,
} from "./virtual.js";
import { gridToSheet, xlsxFilename } from "./xlsx-export.js";

export interface CellChange<T> {
  row: T;
  rowId: string;
  columnId: string;
  value: CellValue;
  previous: CellValue;
  /** Where the change comes from; `undo` and `redo` replay an earlier change in reverse or again. */
  source?: ChangeSource;
}

/** Rows added or removed by the toolbar buttons, or by an undo / redo of them. */
export interface RowsChange<T> {
  type: "add" | "remove";
  /** Ascending by `index` (the position in the `data` the grid was given). */
  rows: ReadonlyArray<{ row: T; rowId: string; index: number }>;
  source: "edit" | "undo" | "redo";
}

export interface RowReorderEvent {
  rowId: string;
  fromIndex: number;
  toIndex: number;
  /** Ids of all rows in the new order. */
  order: string[];
}

export interface ExportPayload {
  csv: string;
  filename: string;
  rowCount: number;
}

export interface XlsxExportPayload {
  /** The .xlsx file. */
  bytes: Uint8Array;
  filename: string;
  rowCount: number;
}

export interface DataGridProps<T> {
  /** Rows to show. Optional with `dataSource`, which loads them. */
  data?: readonly T[];
  columns: readonly DataGridColumn<T>[];
  /** Accessible name of the grid. */
  "aria-label": string;
  /** Stable row id (selection, editing, keys). The data index by default. */
  getRowId?: (row: T, index: number) => string;
  /** Maximum height of the scrolling body in px (virtualized mode). */
  height?: number;
  /** Switches from virtualized scrolling to pagination with this page size. */
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  /** localStorage key that remembers column order, widths, visibility, pins and density. */
  storageKey?: string;

  sort?: readonly SortRule[];
  defaultSort?: readonly SortRule[];
  onSortChange?: (sort: SortRule[]) => void;
  filters?: Filters;
  defaultFilters?: Filters;
  onFiltersChange?: (filters: Filters) => void;
  groupBy?: readonly string[];
  defaultGroupBy?: readonly string[];
  onGroupByChange?: (groupBy: string[]) => void;
  defaultPinned?: { left?: readonly string[]; right?: readonly string[] };
  defaultHidden?: readonly string[];
  density?: Density;
  defaultDensity?: Density;
  onDensityChange?: (density: Density) => void;

  /** Adds a checkbox column; Shift selects a range. */
  selectable?: boolean;
  selectedRowIds?: readonly string[];
  defaultSelectedRowIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;

  /** Called when an inline edit is committed with a different value. The grid does not mutate `data`. */
  onCellChange?: (change: CellChange<T>) => void;
  /**
   * Called once with every cell a paste, fill, undo or redo changes. Without it those changes go to
   * `onCellChange` one by one, which loses updates if the parent sets state from stale data.
   */
  onCellsChange?: (changes: CellChange<T>[]) => void;
  /** Undo / redo of cell edits, paste, fill and row changes: buttons plus Ctrl / Cmd + Z, Shift + Ctrl / Cmd + Z, Ctrl + Y. */
  history?: boolean;
  /** Commands kept for undo (and for redo). 100 by default. */
  historyDepth?: number;
  onHistoryChange?: (history: HistorySummary) => void;
  /**
   * Spreadsheet formulas: a cell whose text starts with `=` is evaluated (`=B2*C2`, `=SUM(D2:D9)`,
   * `=IF(E2>100,"alto","bajo")`). Columns are lettered in the order of `columns` and rows are
   * numbered in the order of `data`; a formula bar shows the raw content of the focused cell.
   * Off with `dataSource` and `pivot`.
   */
  formulas?: boolean;
  /** Adds the "add row" button: the new row is appended through `onRowsChange`. */
  createRow?: () => T;
  /** Rows added (`createRow`), removed (the toolbar button removes the selected rows) or restored by undo. */
  onRowsChange?: (change: RowsChange<T>) => void;

  /**
   * Server-side rows. Sort, filters and quick search are sent to `getRows` instead of being
   * applied here; with `pageSize` the grid pages through blocks of that size, without it rows are
   * loaded as you scroll. Grouping, tree data, row pinning, pivot and detail rows are off.
   */
  dataSource?: DataSource<T>;
  /** Blocks kept in memory in infinite mode before the least recently used are dropped. */
  maxBlocks?: number;

  /** Shows `data` as a tree: `getParentId` links a row to its parent (nullish for roots). */
  tree?: { getParentId: (row: T) => string | null | undefined };
  /** Expanded row ids: tree nodes and rows with a detail panel. */
  expandedRowIds?: readonly string[];
  defaultExpandedRowIds?: readonly string[];
  onExpandedRowsChange?: (ids: string[]) => void;
  /** Detail panel (master / detail) rendered under an expanded row. */
  renderDetail?: (row: T, rowId: string) => ReactNode;
  /** Height of a detail panel in px (fixed so rows stay virtualizable). 240 by default. */
  detailHeight?: number | ((row: T) => number);

  /** Adds pin-to-top / pin-to-bottom buttons to rows; pinned rows stay in view while scrolling. */
  rowPinning?: boolean;
  pinnedRows?: PinnedRows;
  defaultPinnedRows?: PinnedRows;
  onPinnedRowsChange?: (pinned: PinnedRows) => void;
  /** Drag handle and Alt + arrows to reorder rows; works without sort, filters or grouping. */
  rowReorder?: boolean;
  /** Called with the new order; the grid does not mutate `data`. */
  onRowReorder?: (event: RowReorderEvent) => void;

  /** Rectangular cell selection by drag, Shift + click or Shift + arrows, with Ctrl + C as TSV. */
  rangeSelection?: boolean;

  /** Advanced filter (AND / OR groups of conditions) applied after the column filters. */
  advancedFilter?: FilterGroup;
  defaultAdvancedFilter?: FilterGroup;
  onAdvancedFilterChange?: (filter: FilterGroup) => void;
  /** Adds the advanced filter button to the toolbar. */
  showAdvancedFilter?: boolean;

  /** Side panel to show, hide and reorder columns, group rows and set up a pivot. */
  toolPanel?: boolean;
  defaultToolPanelOpen?: boolean;
  /** Pivot: row fields x pivot column x aggregated value. */
  pivot?: PivotConfig;
  defaultPivot?: PivotConfig;
  onPivotChange?: (pivot: PivotConfig) => void;

  loading?: boolean;
  /** Shown when there are no rows (a filtered-out message is used when filters are active). */
  emptyMessage?: ReactNode;
  /** Footer with the column aggregates. On when some column has `aggregate`. */
  showFooter?: boolean;
  /** Hides search, chips, density, columns and export. */
  hideToolbar?: boolean;
  /** CSV file name for the export button; `false` hides the button. */
  exportFilename?: string | false;
  /** Called with the CSV right before it is downloaded. */
  onExport?: (payload: ExportPayload) => void;
  /**
   * Adds an "Exportar XLSX" button: a file name (`"ventas.xlsx"`) or `true` for `datos.xlsx`. Same
   * rows and columns as the CSV export, with numbers as numbers and dates as dates. The writer
   * (`@jcsoftdev/ui/xlsx`) is loaded when the button is used, so it costs nothing until then.
   */
  exportXlsx?: string | boolean;
  /** Called with the file right before it is downloaded. */
  onExportXlsx?: (payload: XlsxExportPayload) => void;
  toolbarActions?: ReactNode;
  labels?: Partial<DataGridLabels>;
  className?: string;
}

const ROW_HEIGHT: Record<Density, number> = { compact: 32, normal: 40, comfortable: 48 };
const SELECT_ID = "__select";
const SELECT_WIDTH = 44;
const TOOLS_ID = "__tools";
const TOOL_SLOT = 26;
const GROUP_HEADER_HEIGHT = 32;
const DEFAULT_DETAIL_HEIGHT = 240;
const DEFAULT_BLOCK_SIZE = 50;
const EMPTY_DATA: readonly never[] = [];
const SKELETON_ROWS = 8;
const EMPTY_SORT: readonly SortRule[] = [];
const EMPTY_FILTERS: Filters = {};
const EMPTY_LIST: readonly string[] = [];
const EMPTY_ADVANCED: FilterGroup = emptyGroup("and", "root");

interface CellEdit<T> {
  row: T;
  rowId: string;
  column: DataGridColumn<T>;
  value: CellValue;
  previous: CellValue;
}

type RenderColumn<T> =
  | { kind: "select" }
  | { kind: "tools" }
  | { kind: "data"; column: DataGridColumn<T> };
type Zone = PinSide | "center";

function idOfColumn<T>(entry: RenderColumn<T>): string {
  if (entry.kind === "select") return SELECT_ID;
  return entry.kind === "tools" ? TOOLS_ID : entry.column.id;
}

function useControllable<V>(
  value: V | undefined,
  initial: V,
  onChange?: (value: V) => void,
): [V, (next: V) => void] {
  const [internal, setInternal] = useState(initial);
  const controlled = value !== undefined;
  const set = useCallback(
    (next: V) => {
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [controlled ? value : internal, set];
}

/** Starts a CSV download in the browser (no-op on the server). */
export function downloadCSV(filename: string, csv: string): void {
  downloadFile(filename, csv, "text/csv;charset=utf-8");
}

/** Starts a file download in the browser (no-op on the server). */
export function downloadFile(filename: string, data: BlobPart, type: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ARROW_STEPS: Record<string, { dr: number; dc: number } | undefined> = {
  ArrowUp: { dr: -1, dc: 0 },
  ArrowDown: { dr: 1, dc: 0 },
  ArrowLeft: { dr: 0, dc: -1 },
  ArrowRight: { dr: 0, dc: 1 },
};

/** Copies text to the clipboard, with a textarea fallback for contexts without the async API. */
function writeClipboard(text: string): void {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => undefined);
    return;
  }
  if (typeof document === "undefined") return;
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    area.remove();
  }
}

function editorOf<T>(column: DataGridColumn<T>): EditorKind {
  if (column.editor) return column.editor;
  if (column.options?.length) return "select";
  return column.type === "number" || column.type === "currency" ? "number" : "text";
}

function canEdit<T>(column: DataGridColumn<T>, row: T): boolean {
  return typeof column.editable === "function" ? column.editable(row) : column.editable === true;
}

const alignClass = { start: "text-left", center: "text-center", end: "text-right" } as const;
const justifyClass = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
} as const;

/**
 * Data grid with sorting, filters, quick search, column pinning, resizing, reordering and
 * visibility, row selection, grouping with aggregates, inline editing, virtualized rows or
 * pagination, CSV export, and full keyboard navigation (ARIA grid pattern, roving tabindex).
 * It adapts to its container width: the toolbar wraps and the grid scrolls horizontally with
 * its pinned columns kept in place.
 */
export function DataGrid<T>({
  data: dataProp = EMPTY_DATA as readonly T[],
  columns: columnsProp,
  "aria-label": ariaLabel,
  getRowId: getRowIdProp,
  height = 480,
  pageSize: pageSizeProp,
  pageSizeOptions = [25, 50, 100],
  storageKey,
  sort: sortProp,
  defaultSort = EMPTY_SORT,
  onSortChange,
  filters: filtersProp,
  defaultFilters = EMPTY_FILTERS,
  onFiltersChange,
  groupBy: groupByProp,
  defaultGroupBy = EMPTY_LIST,
  onGroupByChange,
  defaultPinned,
  defaultHidden,
  density: densityProp,
  defaultDensity = "normal",
  onDensityChange,
  selectable = false,
  selectedRowIds,
  defaultSelectedRowIds = EMPTY_LIST,
  onSelectionChange,
  onCellChange,
  onCellsChange,
  formulas = false,
  history: historyEnabled = false,
  historyDepth = DEFAULT_HISTORY_DEPTH,
  onHistoryChange,
  createRow,
  onRowsChange,
  dataSource,
  maxBlocks,
  tree,
  expandedRowIds,
  defaultExpandedRowIds = EMPTY_LIST,
  onExpandedRowsChange,
  renderDetail,
  detailHeight = DEFAULT_DETAIL_HEIGHT,
  rowPinning = false,
  pinnedRows,
  defaultPinnedRows = NO_PINNED_ROWS,
  onPinnedRowsChange,
  rowReorder = false,
  onRowReorder,
  rangeSelection = false,
  advancedFilter: advancedFilterProp,
  defaultAdvancedFilter = EMPTY_ADVANCED,
  onAdvancedFilterChange,
  showAdvancedFilter = false,
  toolPanel = false,
  defaultToolPanelOpen = false,
  pivot: pivotProp,
  defaultPivot = EMPTY_PIVOT,
  onPivotChange,
  loading = false,
  emptyMessage,
  showFooter,
  hideToolbar = false,
  exportFilename = "datos.csv",
  onExport,
  exportXlsx = false,
  onExportXlsx,
  toolbarActions,
  labels: labelsProp,
  className,
}: DataGridProps<T>) {
  const labels = useMemo(() => ({ ...DEFAULT_DATA_GRID_LABELS, ...labelsProp }), [labelsProp]);
  const helpId = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);

  // ---- state -------------------------------------------------------------------------------
  const [sort, setSortState] = useControllable<readonly SortRule[]>(
    sortProp,
    defaultSort,
    onSortChange && ((next) => onSortChange([...next])),
  );
  const [filters, setFiltersState] = useControllable<Filters>(
    filtersProp,
    defaultFilters,
    onFiltersChange,
  );
  const [groupBy, setGroupByState] = useControllable<readonly string[]>(
    groupByProp,
    defaultGroupBy,
    onGroupByChange && ((next) => onGroupByChange([...next])),
  );
  const [selection, setSelection] = useControllable<readonly string[]>(
    selectedRowIds,
    defaultSelectedRowIds,
    onSelectionChange && ((next) => onSelectionChange([...next])),
  );
  const [expanded, setExpanded] = useControllable<readonly string[]>(
    expandedRowIds,
    defaultExpandedRowIds,
    onExpandedRowsChange && ((next) => onExpandedRowsChange([...next])),
  );
  const [pinnedRowIds, setPinnedRowIds] = useControllable<PinnedRows>(
    pinnedRows,
    defaultPinnedRows,
    onPinnedRowsChange,
  );
  const [advanced, setAdvanced] = useControllable<FilterGroup>(
    advancedFilterProp,
    defaultAdvancedFilter,
    onAdvancedFilterChange,
  );
  const [pivotConfig, setPivotConfig] = useControllable<PivotConfig>(
    pivotProp,
    defaultPivot,
    onPivotChange,
  );
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeProp ?? 25);
  const [active, setActive] = useState({ r: 0, c: 0 });
  const [menuColumn, setMenuColumn] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    key: string;
    columnId: string;
    draft: string;
    error?: string;
    /** Place the caret at the end instead of selecting the text (typing `=` to start a formula). */
    caretEnd?: boolean;
  } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrolled, setScrolled] = useState({ start: false, end: false });
  const [dropTarget, setDropTarget] = useState<{ id: string; place: "before" | "after" } | null>(
    null,
  );
  const [dropRow, setDropRow] = useState<{ key: string; place: "before" | "after" } | null>(null);
  const [cellRange, setCellRange] = useState<CellRange | null>(null);
  const [panelOpen, setPanelOpen] = useState(defaultToolPanelOpen);
  const [announcement, setAnnouncement] = useState("");
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const pendingFocus = useRef(false);
  const anchor = useRef<string | null>(null);
  const resizing = useRef(false);
  const dragId = useRef<string | null>(null);
  const rowDrag = useRef<string | null>(null);

  const paged = pageSizeProp !== undefined;
  const sourceActive = dataSource !== undefined;

  // ---- pivot: the grid shows a derived table of rows and columns ---------------------------
  const pivotResult = useMemo(
    () =>
      !sourceActive && isPivotValid(pivotConfig, columnsProp)
        ? buildPivot(dataProp, columnsProp, pivotConfig)
        : null,
    [sourceActive, pivotConfig, columnsProp, dataProp],
  );
  const pivotActive = pivotResult !== null;
  const structured = !sourceActive && !pivotActive;
  const formulasOn = formulas && structured;
  const formulaCache = useRef<ParseCache>(new Map());
  const sheet = useMemo(
    () =>
      formulasOn && columnsProp.length > 0
        ? buildSheet({
            rows: dataProp.length,
            cols: columnsProp.length,
            read: (r, c) => getCellValue(dataProp[r] as T, columnsProp[c] as DataGridColumn<T>),
            cache: formulaCache.current,
          })
        : null,
    [formulasOn, dataProp, columnsProp],
  );
  const sourceIndex = useMemo(() => {
    if (!sheet) return null;
    const rows = new Map<T, number>();
    dataProp.forEach((row, index) => {
      rows.set(row, index);
    });
    const cols = new Map(columnsProp.map((column, index) => [column.id, index]));
    return { rows, cols };
  }, [sheet, dataProp, columnsProp]);
  const columns = useMemo(() => {
    if (pivotResult) {
      return pivotColumns(
        columnsProp,
        pivotConfig,
        pivotResult,
        labels.total,
      ) as readonly DataGridColumn<T>[];
    }
    if (!sheet || !sourceIndex) return columnsProp;
    // Formula cells read as their result everywhere (sort, filter, totals, CSV); editing reads the raw text.
    return columnsProp.map((column, c) => ({
      ...column,
      accessor: (row: T): CellValue => {
        const r = sourceIndex.rows.get(row);
        const shown = r === undefined ? undefined : displayValue(sheet, r, c);
        return shown === undefined ? getCellValue(row, column) : shown;
      },
    })) as readonly DataGridColumn<T>[];
  }, [pivotResult, columnsProp, pivotConfig, labels.total, sheet, sourceIndex]);
  const data = useMemo(
    () => (pivotResult ? pivotResult.rows : dataProp) as readonly T[],
    [pivotResult, dataProp],
  );
  const getRowId = useMemo(
    () => (pivotResult ? (row: T) => (row as unknown as PivotRow).id : getRowIdProp),
    [pivotResult, getRowIdProp],
  );

  const layoutDefaults = useMemo(
    () => ({ pinned: defaultPinned, hidden: defaultHidden, density: defaultDensity }),
    [defaultPinned, defaultHidden, defaultDensity],
  );
  const grid = useGridLayout(columns, layoutDefaults, pivotActive ? undefined : storageKey);
  const { layout } = grid;
  const density = densityProp ?? layout.density ?? defaultDensity;
  const rowHeight = ROW_HEIGHT[density];
  const headerHeight = Math.max(rowHeight, 36);
  const firstRow = Math.floor(scrollTop / rowHeight);

  // ---- columns -----------------------------------------------------------------------------
  const byId = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);
  const { dataColumns, zoneOf, pinned } = useMemo(() => {
    const visible = layout.order.filter((id) => byId.has(id) && !layout.hidden.includes(id));
    const pins = sanitizePinned(layout.pinned, visible);
    const left = visible.filter((id) => pins.left.includes(id));
    const right = visible.filter((id) => pins.right.includes(id));
    const center = visible.filter((id) => !left.includes(id) && !right.includes(id));
    const zones = new Map<string, Zone>();
    for (const id of left) zones.set(id, "left");
    for (const id of right) zones.set(id, "right");
    for (const id of center) zones.set(id, "center");
    return {
      dataColumns: [...left, ...center, ...right].map((id) => byId.get(id) as DataGridColumn<T>),
      zoneOf: zones,
      pinned: { left, right },
    };
  }, [layout.order, layout.hidden, layout.pinned, byId]);

  const detailEnabled = !!renderDetail && structured && !tree;
  const reorderEnabled = rowReorder && structured;
  const pinningEnabled = rowPinning && structured;
  const toolSlots = (detailEnabled ? 1 : 0) + (reorderEnabled ? 1 : 0) + (pinningEnabled ? 2 : 0);
  const toolsWidth = toolSlots * TOOL_SLOT + 12;
  const renderColumns = useMemo<RenderColumn<T>[]>(
    () => [
      ...(selectable ? [{ kind: "select" } as const] : []),
      ...(toolSlots > 0 ? [{ kind: "tools" } as const] : []),
      ...dataColumns.map((column) => ({ kind: "data", column }) as const),
    ],
    [selectable, toolSlots, dataColumns],
  );
  const leadingCount = renderColumns.length - dataColumns.length;
  const fillerIndex = renderColumns.length - pinned.right.length;
  const [containerWidth, setContainerWidth] = useState(0);
  const reservedWidth = (selectable ? SELECT_WIDTH : 0) + (toolSlots > 0 ? toolsWidth : 0);
  // Columns narrower than their container grow to fill it; user-resized ones keep their width.
  const shownWidths = useMemo(
    () =>
      containerWidth > 0
        ? fillColumnWidths(dataColumns, layout.widths, containerWidth, reservedWidth)
        : layout.widths,
    [containerWidth, dataColumns, layout.widths, reservedWidth],
  );
  const widthOf = useCallback(
    (entry: RenderColumn<T>) =>
      entry.kind === "select"
        ? SELECT_WIDTH
        : entry.kind === "tools"
          ? toolsWidth
          : (shownWidths[entry.column.id] ?? 160),
    [shownWidths, toolsWidth],
  );
  const positions = useMemo(() => {
    const widths: Record<string, number> = {
      [SELECT_ID]: SELECT_WIDTH,
      [TOOLS_ID]: toolsWidth,
      ...shownWidths,
    };
    const left = [
      ...(selectable ? [SELECT_ID] : []),
      ...(toolSlots > 0 ? [TOOLS_ID] : []),
      ...pinned.left,
    ];
    return computePinOffsets(widths, { left, right: pinned.right });
  }, [shownWidths, pinned, selectable, toolSlots, toolsWidth]);
  const totalWidth = renderColumns.reduce((sum, entry) => sum + widthOf(entry), 0);

  // Multi-level headers: the levels come from the `group` path of the visible columns.
  const headerLevels = useMemo(() => {
    const paths = dataColumns.map((column) => groupPathOf(column));
    const breaks = dataColumns
      .map((column, index) =>
        index > 0 && zoneOf.get(column.id) !== zoneOf.get(dataColumns[index - 1]?.id ?? "")
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    return buildHeaderGroups(paths, breaks);
  }, [dataColumns, zoneOf]);
  const groupLevels = headerLevels.length;
  const headerTop = groupLevels * GROUP_HEADER_HEIGHT;

  // ---- rows --------------------------------------------------------------------------------
  const blockSize = paged ? pageSize : (dataSource?.blockSize ?? DEFAULT_BLOCK_SIZE);
  const remoteRange = paged
    ? { start: page * pageSize, end: (page + 1) * pageSize }
    : { start: Math.max(0, firstRow - 8), end: firstRow + Math.ceil(height / rowHeight) + 12 };
  const remote = useDataSource(dataSource, {
    sort,
    filters,
    search,
    blockSize,
    maxBlocks,
    range: remoteRange,
  });

  // The first response of a remote source is still pending: show the skeleton.
  const busy = loading || (sourceActive && remote.total === null && !remote.failed);

  const localKeys = useMemo(() => {
    const keys = new Map<T, string>();
    data.forEach((row, index) => {
      keys.set(row, getRowId ? getRowId(row, index) : String(index));
    });
    return keys;
  }, [data, getRowId]);
  const rowAt = remote.rowAt;
  const remoteModel = useMemo(() => {
    if (!sourceActive) return null;
    const keys = new Map<T, string>();
    const byKey = new Map<string, T>();
    const rows: DisplayRow<T>[] = [];
    const loaded: T[] = [];
    const total = remote.total ?? 0;
    for (let index = 0; index < total; index += 1) {
      const row = rowAt(index);
      if (row === undefined) {
        rows.push({ kind: "placeholder", key: `~${index}`, index });
        continue;
      }
      const key = getRowId ? getRowId(row, index) : String(index);
      keys.set(row, key);
      byKey.set(key, row);
      loaded.push(row);
      rows.push({ kind: "data", key, depth: 0, row });
    }
    return { keys, byKey, rows, loaded };
  }, [sourceActive, remote.total, rowAt, getRowId]);
  const keyOf = useCallback(
    (row: T) => (remoteModel ? remoteModel.keys : localKeys).get(row) ?? "",
    [remoteModel, localKeys],
  );
  const rowByKey = useMemo(
    () => remoteModel?.byKey ?? new Map(data.map((row) => [keyOf(row), row])),
    [remoteModel, data, keyOf],
  );

  const advancedCount = countConditions(advanced);
  const filterActive = countActiveFilters(filters) > 0 || search.trim() !== "" || advancedCount > 0;
  const filtered = useMemo(() => {
    if (sourceActive) return [] as T[];
    const base = filterRows(data, columns, filters, search);
    return advancedCount > 0 ? applyAdvancedFilter(base, columns, advanced) : base;
  }, [sourceActive, data, columns, filters, search, advanced, advancedCount]);
  const treeOptions = useMemo(
    () => (tree && structured ? { getKey: keyOf, getParentId: tree.getParentId } : null),
    [tree, structured, keyOf],
  );
  const sorted = useMemo(() => {
    if (remoteModel) return remoteModel.loaded;
    const rows = treeOptions ? withAncestors(data, filtered, treeOptions) : filtered;
    return sortRows(rows, columns, sort);
  }, [remoteModel, treeOptions, data, filtered, columns, sort]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const treeResult = useMemo(
    () =>
      treeOptions
        ? buildTreeRows(sorted, columns, {
            ...treeOptions,
            expanded: expandedSet,
            forceExpand: filterActive,
          })
        : null,
    [treeOptions, sorted, columns, expandedSet, filterActive],
  );
  const flat = useMemo<DisplayRow<T>[]>(() => {
    if (remoteModel) return remoteModel.rows;
    if (treeResult) return treeResult.rows;
    return buildDisplayRows(
      sorted,
      columns,
      structured ? groupBy : EMPTY_LIST,
      collapsed,
      keyOf,
      sort,
    );
  }, [remoteModel, treeResult, sorted, columns, structured, groupBy, collapsed, keyOf, sort]);

  const hasAggregates = columns.some((column) => column.aggregate);
  const footer = !sourceActive && (showFooter ?? hasAggregates) && !busy && flat.length > 0;
  const totals = useMemo(() => {
    if (!footer) return {};
    if (pivotResult) return pivotFooter(pivotResult);
    if (treeResult) return computeAggregates(treeResult.leaves, columns);
    const result: Record<string, number | null> = {};
    for (const column of columns) {
      if (!column.aggregate) continue;
      const values = filtered.map((row) => getCellValue(row, column));
      result[column.id] = aggregateValues(values, column.aggregate);
    }
    return result;
  }, [footer, pivotResult, treeResult, columns, filtered]);

  // Pinned rows leave the scrolling list; detail rows are added under their expanded row.
  const split = useMemo(
    () =>
      pinningEnabled ? splitPinnedRows(flat, pinnedRowIds) : { top: [], middle: flat, bottom: [] },
    [pinningEnabled, flat, pinnedRowIds],
  );
  const pages = pageCount(split.middle.length, pageSize);
  const currentPage = Math.min(page, pages - 1);
  const pageOffset = paged ? currentPage * pageSize : 0;
  const pageRows = paged ? split.middle.slice(pageOffset, pageOffset + pageSize) : split.middle;
  const heightOfDetail = useCallback(
    (row: T) => (typeof detailHeight === "function" ? detailHeight(row) : detailHeight),
    [detailHeight],
  );
  const middle = useMemo(
    () => (detailEnabled ? insertDetailRows(pageRows, expandedSet, heightOfDetail) : pageRows),
    [detailEnabled, pageRows, expandedSet, heightOfDetail],
  );
  const bodyRows = useMemo(
    () =>
      split.top.length > 0 || split.bottom.length > 0
        ? [...split.top, ...middle, ...split.bottom]
        : middle,
    [split, middle],
  );
  const topCount = split.top.length;
  const bottomCount = split.bottom.length;
  const variableHeights = detailEnabled && middle.some((row) => row.kind === "detail");
  const bodyViewport = Math.max(
    rowHeight,
    height - headerHeight - headerTop - (footer ? rowHeight : 0),
  );
  const win = useMemo(() => {
    if (paged) return { start: 0, end: bodyRows.length, offsets: null as number[] | null };
    if (variableHeights) {
      return computeVariableWindow({
        heights: bodyRows.map((row) => (row.kind === "detail" ? row.height : rowHeight)),
        viewportHeight: bodyViewport,
        scrollTop,
        overscan: 8,
      });
    }
    const uniform = computeVirtualWindow({
      count: bodyRows.length,
      rowHeight,
      viewportHeight: bodyViewport,
      scrollTop: firstRow * rowHeight,
      overscan: 8,
    });
    return { start: uniform.start, end: uniform.end, offsets: null as number[] | null };
  }, [paged, variableHeights, bodyRows, rowHeight, bodyViewport, scrollTop, firstRow]);
  const bodyLength = bodyRows.length;
  const midStart = Math.max(win.start, topCount);
  const midEnd = Math.max(midStart, Math.min(win.end, bodyLength - bottomCount));
  const offsetOf = (index: number) => (win.offsets ? (win.offsets[index] ?? 0) : index * rowHeight);
  const gapTop = offsetOf(midStart) - offsetOf(topCount);
  const gapBottom = offsetOf(bodyLength - bottomCount) - offsetOf(midEnd);
  const isRendered = (index: number) =>
    index < topCount ||
    index >= bodyLength - bottomCount ||
    (index >= win.start && index < win.end);

  const selected = useMemo(() => new Set(selection), [selection]);
  const visibleKeys = useMemo(
    () => flat.filter((row) => row.kind === "data").map((row) => row.key),
    [flat],
  );
  const allKeys = useMemo(() => sorted.map(keyOf), [sorted, keyOf]);
  const selectedInView = allKeys.filter((key) => selected.has(key)).length;
  const pivotValid = isPivotValid(pivotConfig, columnsProp);

  // Row reordering only makes sense when the list is in its natural order.
  const reorderAllowed =
    reorderEnabled && sort.length === 0 && groupBy.length === 0 && !tree && !filterActive;

  // ---- navigation geometry -----------------------------------------------------------------
  const maxR = busy ? 0 : bodyRows.length;
  const maxC = renderColumns.length - 1;
  const activeR = Math.min(active.r, maxR);
  const activeC = Math.min(active.c, Math.max(0, maxC));
  const activeRendered = activeR === 0 || isRendered(activeR - 1);
  const tabbable = activeRendered ? { r: activeR, c: activeC } : { r: 0, c: activeC };

  const syncScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setScrollTop(Math.floor(scroller.scrollTop / rowHeight) * rowHeight);
    const start = scroller.scrollLeft > 0;
    const end = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
    setScrolled((previous) =>
      previous.start === start && previous.end === end ? previous : { start, end },
    );
  }, [rowHeight]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const measure = () => {
      syncScroll();
      if (scroller) setContainerWidth(scroller.clientWidth);
    };
    measure();
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [syncScroll]);

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const cell = [
      ...(gridRef.current?.querySelectorAll<HTMLElement>(`[data-r="${tabbable.r}"]`) ?? []),
    ].find((node) => {
      const start = Number(node.dataset.c);
      const end = Number(node.dataset.cEnd ?? start);
      return tabbable.c >= start && tabbable.c <= end;
    });
    cell?.focus({ preventScroll: !paged });
  });

  const reveal = useCallback(
    (r: number, c: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const index = r - 1;
      if (!paged && r > 0 && index >= topCount && index < bodyLength - bottomCount) {
        const item = bodyRows[index];
        const top = scrollTopToRevealSpan(
          win.offsets ? (win.offsets[index] ?? 0) : index * rowHeight,
          item?.kind === "detail" ? item.height : rowHeight,
          bodyViewport,
          scroller.scrollTop,
          topCount * rowHeight,
          bottomCount * rowHeight,
        );
        if (top !== scroller.scrollTop) {
          scroller.scrollTop = top;
          setScrollTop(Math.floor(top / rowHeight) * rowHeight);
        }
      }
      const entry = renderColumns[c];
      if (!entry || positions[idOfColumn(entry)]) return;
      let left = 0;
      for (let i = 0; i < c; i += 1) left += widthOf(renderColumns[i] as RenderColumn<T>);
      const pinnedLeft = renderColumns
        .filter((x) => positions[idOfColumn(x)]?.side === "left")
        .reduce((sum, x) => sum + widthOf(x), 0);
      const pinnedRight = renderColumns
        .filter((x) => positions[idOfColumn(x)]?.side === "right")
        .reduce((sum, x) => sum + widthOf(x), 0);
      scroller.scrollLeft = scrollLeftToReveal(
        left,
        widthOf(entry),
        scroller.clientWidth,
        scroller.scrollLeft,
        pinnedLeft,
        pinnedRight,
      );
    },
    [
      paged,
      rowHeight,
      bodyViewport,
      renderColumns,
      positions,
      widthOf,
      bodyRows,
      topCount,
      bottomCount,
      bodyLength,
      win.offsets,
    ],
  );

  const focusCell = useCallback(
    (r: number, c: number, focus = true) => {
      const next = { r: Math.max(0, Math.min(maxR, r)), c: Math.max(0, Math.min(maxC, c)) };
      reveal(next.r, next.c);
      pendingFocus.current = focus;
      setActive(next);
    },
    [maxR, maxC, reveal],
  );

  // ---- actions -----------------------------------------------------------------------------
  const resetPage = () => setPage(0);
  const applySort = (next: SortRule[]) => {
    setSortState(next);
    resetPage();
  };
  const setFilter = (id: string, filter: FilterValue | undefined) => {
    const next: Record<string, FilterValue> = { ...filters };
    if (filter) next[id] = filter;
    else delete next[id];
    setFiltersState(next);
    resetPage();
  };
  const setGroup = (id: string, on: boolean) => {
    setGroupByState(
      on ? [...groupBy.filter((x) => x !== id), id] : groupBy.filter((x) => x !== id),
    );
    resetPage();
  };
  const setDensity = (next: Density) => {
    grid.setDensity(next);
    onDensityChange?.(next);
  };
  const toggleGroupRow = (key: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleRow = (key: string, range: boolean) => {
    const willSelect = !selected.has(key);
    const keys = range ? rangeBetween(visibleKeys, anchor.current, key) : [key];
    const next = new Set(selected);
    for (const k of keys) {
      if (willSelect) next.add(k);
      else next.delete(k);
    }
    anchor.current = key;
    setSelection([...next]);
  };
  const toggleAll = () => {
    const next = new Set(selected);
    const everything = allKeys.length > 0 && selectedInView === allKeys.length;
    for (const key of allKeys) {
      if (everything) next.delete(key);
      else next.add(key);
    }
    setSelection([...next]);
  };
  const neighbourOf = (id: string, delta: number): string | null => {
    const index = dataColumns.findIndex((column) => column.id === id);
    const neighbour = dataColumns[index + delta];
    return neighbour && zoneOf.get(neighbour.id) === zoneOf.get(id) ? neighbour.id : null;
  };
  const moveColumn = (id: string, delta: number) => {
    const neighbour = neighbourOf(id, delta);
    if (!neighbour) return false;
    grid.moveTo(id, neighbour, delta < 0 ? "before" : "after");
    return true;
  };
  const exportCsv = () => {
    if (exportFilename === false) return;
    const rows =
      selectable && selection.length > 0
        ? sorted.filter((row) => selected.has(keyOf(row)))
        : sorted;
    const csv = toCSV(rows, dataColumns, { bom: true });
    onExport?.({ csv, filename: exportFilename, rowCount: rows.length });
    downloadCSV(exportFilename, csv);
  };
  const xlsxName = exportXlsx === true ? "datos.xlsx" : exportXlsx || null;
  const exportToXlsx = async () => {
    if (!xlsxName) return;
    const rows =
      selectable && selection.length > 0
        ? sorted.filter((row) => selected.has(keyOf(row)))
        : sorted;
    const filename = xlsxFilename(xlsxName);
    const { buildXlsx, XLSX_MIME } = await import("../../xlsx/index.js");
    const bytes = buildXlsx({
      sheets: [gridToSheet(rows, dataColumns, filename.replace(/\.xlsx$/i, ""))],
      creator: "@jcsoftdev/ui",
    });
    onExportXlsx?.({ bytes, filename, rowCount: rows.length });
    downloadFile(filename, bytes as BlobPart, XLSX_MIME);
  };
  const labelOfRow = (key: string) => {
    const row = rowByKey.get(key);
    const first = dataColumns[0];
    return row && first ? formatCellValue(getCellValue(row, first), first) || key : key;
  };

  // ---- expansion, pinned rows and reordering -----------------------------------------------
  const setExpandedRow = (key: string, open?: boolean) => {
    const isOpen = expandedSet.has(key);
    if ((open ?? !isOpen) === isOpen) return;
    setExpanded([...toggleSetMember(expandedSet, key)]);
  };
  const pinRow = (key: string, side: RowPinSide) => {
    setPinnedRowIds(togglePinnedRow(pinnedRowIds, key, side));
  };
  const reorderRow = (
    key: string,
    target: { delta: number } | { id: string; place: "before" | "after" },
  ) => {
    if (!reorderAllowed) return false;
    const order = data.map(keyOf);
    const next =
      "delta" in target
        ? moveRowBy(order, key, target.delta)
        : moveRowTo(order, key, target.id, target.place);
    const fromIndex = order.indexOf(key);
    const toIndex = next.indexOf(key);
    if (fromIndex === -1 || fromIndex === toIndex) return false;
    onRowReorder?.({ rowId: key, fromIndex, toIndex, order: next });
    setAnnouncement(labels.rowMoved(labelOfRow(key), toIndex + 1, order.length));
    return true;
  };

  // ---- cell ranges -------------------------------------------------------------------------
  const cellAt = (r: number, c: number) => {
    const row = bodyRows[r - 1];
    const entry = renderColumns[c];
    return row?.kind === "data" && entry?.kind === "data"
      ? { row: row.row, column: entry.column }
      : null;
  };
  const copyRange = () => {
    if (!cellRange) return;
    const bounds = rangeBounds(cellRange);
    const text = rangeToTSV(bounds, (r, c) => {
      const cell = cellAt(r, c);
      return cell ? formatCellValue(getCellValue(cell.row, cell.column), cell.column) : null;
    });
    writeClipboard(text);
    const cells = (bounds.r1 - bounds.r0 + 1) * (bounds.c1 - bounds.c0 + 1);
    setAnnouncement(labels.rangeCopied(cells));
  };
  const onCellPointerDown = (event: ReactPointerEvent<HTMLElement>, r: number, c: number) => {
    if (
      !rangeSelection ||
      event.button !== 0 ||
      editingRef.current ||
      event.pointerType === "touch"
    )
      return;
    if (
      (event.target as HTMLElement).closest("button,input,select,a,textarea,[data-detail-content]")
    )
      return;
    if (event.shiftKey && cellRange) {
      setCellRange({ anchor: cellRange.anchor, focus: { r, c } });
      return;
    }
    setCellRange({ anchor: { r, c }, focus: { r, c } });
    const move = (moveEvent: PointerEvent) => {
      const cell = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>("td[data-r]");
      if (!cell || !gridRef.current?.contains(cell)) return;
      const nextR = Number(cell.dataset.r);
      const nextC = Number(cell.dataset.c);
      setCellRange((previous) =>
        previous && (previous.focus.r !== nextR || previous.focus.c !== nextC)
          ? { anchor: previous.anchor, focus: { r: nextR, c: nextC } }
          : previous,
      );
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // ---- editing -----------------------------------------------------------------------------
  const rawValue = (row: T, column: DataGridColumn<T>): CellValue =>
    getCellValue(row, columnsProp.find((x) => x.id === column.id) ?? column);
  /** Text typed (or pasted) into a cell to the value to store, or the reason it is refused. */
  const coerceDraft = (
    column: DataGridColumn<T>,
    row: T,
    draft: string,
    loose = false,
  ): { value: CellValue } | { error: string } => {
    let value: CellValue = draft;
    if (formulasOn && isFormulaText(draft)) return { value: draft.trim() };
    if (editorOf(column) === "number") {
      const number = loose ? parseLooseNumber(draft) : Number.parseFloat(draft.replace(",", "."));
      if (number !== null && Number.isFinite(number)) value = number;
      else return { error: labels.invalidCell };
    }
    const error = column.validate?.(value, row);
    return error ? { error } : { value };
  };

  // ---- history -----------------------------------------------------------------------------
  const historyRef = useRef(createHistory<T>(historyDepth));
  const [historySummary, setHistorySummary] = useState<HistorySummary>(() =>
    summarizeHistory(historyRef.current),
  );
  const syncHistory = (next: typeof historyRef.current) => {
    historyRef.current = next;
    const summary = summarizeHistory(next);
    setHistorySummary(summary);
    onHistoryChange?.(summary);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new depth trims the stack.
  useEffect(() => {
    if (historyRef.current.depth !== Math.max(1, Math.floor(historyDepth))) {
      syncHistory(setHistoryDepth(historyRef.current, historyDepth));
    }
  }, [historyDepth]);
  const record = (command: HistoryCommand<T>) => {
    if (historyEnabled) syncHistory(pushCommand(historyRef.current, command));
  };
  const canWrite = !!(onCellChange || onCellsChange);
  /** A single change goes to `onCellChange`; several go to `onCellsChange` when it exists. */
  const emitChanges = (changes: CellChange<T>[]) => {
    if (changes.length === 0) return;
    if (changes.length === 1 && onCellChange) onCellChange(changes[0] as CellChange<T>);
    else if (onCellsChange) onCellsChange(changes);
    else for (const change of changes) onCellChange?.(change);
  };
  const commitChanges = (items: readonly CellEdit<T>[], source: "edit" | "paste" | "fill") => {
    if (items.length === 0) return;
    emitChanges(
      items.map((item) => ({
        row: item.row,
        rowId: item.rowId,
        columnId: item.column.id,
        value: item.value,
        previous: item.previous,
        source,
      })),
    );
    const deltas: CellDelta[] = items.map((item) => ({
      rowId: item.rowId,
      columnId: item.column.id,
      before: item.previous,
      after: item.value,
    }));
    record({ kind: "cells", source, changes: deltas });
  };
  const replay = (command: HistoryCommand<T>, source: "undo" | "redo") => {
    if (command.kind === "cells") {
      const changes: CellChange<T>[] = [];
      for (const delta of command.changes) {
        const row = rowByKey.get(delta.rowId);
        const column = byId.get(delta.columnId);
        if (!row || !column) continue;
        changes.push({
          row,
          rowId: delta.rowId,
          columnId: delta.columnId,
          value: delta.after,
          previous: rawValue(row, column),
          source,
        });
      }
      emitChanges(changes);
      return;
    }
    const rows = [...command.rows].sort((a, b) => a.index - b.index);
    onRowsChange?.({ type: command.kind === "rows-add" ? "add" : "remove", rows, source });
  };
  const undo = () => {
    const step = undoCommand(historyRef.current);
    if (!step) return;
    syncHistory(step.state);
    replay(step.apply, "undo");
    setAnnouncement(labels.undone(commandSize(step.apply)));
  };
  const redo = () => {
    const step = redoCommand(historyRef.current);
    if (!step) return;
    syncHistory(step.state);
    replay(step.apply, "redo");
    setAnnouncement(labels.redone(commandSize(step.apply)));
  };

  // ---- row tools ---------------------------------------------------------------------------
  const addRow = () => {
    if (!createRow || !onRowsChange) return;
    const row = createRow();
    const index = dataProp.length;
    const ref: RowRef<T> = {
      row,
      rowId: getRowIdProp ? getRowIdProp(row, index) : String(index),
      index,
    };
    onRowsChange({ type: "add", rows: [ref], source: "edit" });
    record({ kind: "rows-add", rows: [ref] });
  };
  const removeSelectedRows = () => {
    if (!onRowsChange || selection.length === 0) return;
    const positions = new Map<T, number>();
    dataProp.forEach((row, index) => {
      positions.set(row, index);
    });
    const rows: RowRef<T>[] = [];
    for (const key of selection) {
      const row = rowByKey.get(key);
      const index = row === undefined ? undefined : positions.get(row);
      if (row !== undefined && index !== undefined) rows.push({ row, rowId: key, index });
    }
    rows.sort((a, b) => a.index - b.index);
    if (rows.length === 0) return;
    onRowsChange({ type: "remove", rows, source: "edit" });
    record({ kind: "rows-remove", rows });
    setSelection([]);
  };

  // ---- paste and fill ----------------------------------------------------------------------
  const onPaste = (event: ClipboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    if (
      !canWrite ||
      editingRef.current ||
      target.closest("input,textarea,select,[data-detail-content]")
    )
      return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    const bounds = cellRange ? rangeBounds(cellRange) : null;
    const origin = bounds ? { r: bounds.r0, c: bounds.c0 } : { r: activeR, c: activeC };
    const items: CellEdit<T>[] = [];
    for (const cellTarget of planPaste(parseTSV(text), origin, { maxR, maxC }, bounds)) {
      const cell = cellAt(cellTarget.r, cellTarget.c);
      if (!cell || !canEdit(cell.column, cell.row)) continue;
      const result = coerceDraft(cell.column, cell.row, cellTarget.text, true);
      const previous = rawValue(cell.row, cell.column);
      if ("error" in result || sameCellValue(result.value, previous)) continue;
      items.push({
        row: cell.row,
        rowId: keyOf(cell.row),
        column: cell.column,
        value: result.value,
        previous,
      });
    }
    commitChanges(items, "paste");
    if (items.length > 0) setAnnouncement(labels.pasted(items.length));
  };
  const fillRange = (direction: FillDirection) => {
    if (!canWrite) return;
    const bounds = cellRange
      ? rangeBounds(cellRange)
      : direction === "down"
        ? { r0: activeR - 1, r1: activeR, c0: activeC, c1: activeC }
        : { r0: activeR, r1: activeR, c0: activeC - 1, c1: activeC };
    if (bounds.r0 < 1 || bounds.c0 < 0) return;
    const items: CellEdit<T>[] = [];
    for (const step of planFill(bounds, direction)) {
      const from = cellAt(step.from.r, step.from.c);
      const to = cellAt(step.r, step.c);
      if (!from || !to || !canEdit(to.column, to.row)) continue;
      let source = rawValue(from.row, from.column);
      if (sourceIndex && isFormulaText(source)) {
        const dr = (sourceIndex.rows.get(to.row) ?? 0) - (sourceIndex.rows.get(from.row) ?? 0);
        const dc =
          (sourceIndex.cols.get(to.column.id) ?? 0) - (sourceIndex.cols.get(from.column.id) ?? 0);
        source = shiftFormula(source, dr, dc);
      }
      const result =
        typeof source === "string"
          ? coerceDraft(to.column, to.row, source, true)
          : { value: source };
      const previous = rawValue(to.row, to.column);
      if ("error" in result || sameCellValue(result.value, previous)) continue;
      items.push({
        row: to.row,
        rowId: keyOf(to.row),
        column: to.column,
        value: result.value,
        previous,
      });
    }
    commitChanges(items, "fill");
    if (items.length > 0) setAnnouncement(labels.filled(items.length));
  };

  const startEdit = (key: string, column: DataGridColumn<T>, typed?: string) => {
    const row = rowByKey.get(key);
    if (!row || !canEdit(column, row)) return false;
    const value = rawValue(row, column);
    setEditing({
      key,
      columnId: column.id,
      draft: typed ?? (value === null || value === undefined ? "" : String(value)),
      caretEnd: typed !== undefined,
    });
    return true;
  };
  /**
   * Commits the open edit. With `strict` (Enter, Tab) an invalid value keeps the editor open with
   * its message and returns false; on blur an invalid value is discarded.
   */
  const commitEdit = (strict = false): boolean => {
    const current = editingRef.current;
    if (!current) return true;
    const row = rowByKey.get(current.key);
    const column = byId.get(current.columnId);
    const close = () => {
      editingRef.current = null;
      setEditing(null);
    };
    if (!row || !column) {
      close();
      return true;
    }
    const previous = rawValue(row, column);
    const result = coerceDraft(column, row, current.draft);
    if ("error" in result) {
      if (!strict) {
        close();
        return true;
      }
      const next = { ...current, error: result.error };
      editingRef.current = next;
      setEditing(next);
      return false;
    }
    close();
    if (!sameCellValue(result.value, previous)) {
      commitChanges([{ row, rowId: current.key, column, value: result.value, previous }], "edit");
    }
    return true;
  };
  const cancelEdit = () => {
    editingRef.current = null;
    setEditing(null);
  };
  const nextEditable = (r: number, c: number, step: 1 | -1): { r: number; c: number } | null => {
    let row = r;
    let col = c + step;
    while (row >= 1 && row <= maxR) {
      const display = bodyRows[row - 1];
      if (display?.kind === "data") {
        while (col >= 0 && col <= maxC) {
          const entry = renderColumns[col];
          if (entry?.kind === "data" && canEdit(entry.column, display.row))
            return { r: row, c: col };
          col += step;
        }
      }
      row += step;
      col = step > 0 ? 0 : maxC;
    }
    return null;
  };
  const onEditorKey = (event: KeyboardEvent<HTMLElement>, r: number, c: number) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      focusCell(r, c);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!commitEdit(true)) return;
      focusCell(Math.min(r + 1, maxR), c);
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (!commitEdit(true)) return;
      const next = nextEditable(r, c, event.shiftKey ? -1 : 1);
      if (!next) {
        focusCell(r, c);
        return;
      }
      const target = bodyRows[next.r - 1];
      const entry = renderColumns[next.c];
      focusCell(next.r, next.c, false);
      if (target?.kind === "data" && entry?.kind === "data") startEdit(target.key, entry.column);
    }
  };

  // ---- keyboard ----------------------------------------------------------------------------
  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-detail-content]")) return;
    const cell = target.closest<HTMLElement>("[data-r]");
    if (!cell || !event.currentTarget.contains(cell)) return;
    const r = Number(cell.dataset.r);
    const start = Number(cell.dataset.c);
    const spanEnd = Number(cell.dataset.cEnd ?? start);
    const c = activeR === r && activeC >= start && activeC <= spanEnd ? activeC : start;
    const inner = target !== cell;
    if (inner && (event.key === "Enter" || event.key === " ")) return;
    const entry = renderColumns[c];
    const row = r > 0 ? bodyRows[r - 1] : undefined;
    const handled = () => event.preventDefault();
    const mod = event.ctrlKey || event.metaKey;

    if (mod && !event.altKey && !target.closest("input,textarea,select")) {
      const letter = event.key.toLowerCase();
      if (historyEnabled && (letter === "z" || (letter === "y" && !event.shiftKey))) {
        handled();
        if (letter === "y" || event.shiftKey) redo();
        else undo();
        return;
      }
      if (r > 0 && canWrite && !event.shiftKey && (letter === "d" || letter === "r")) {
        handled();
        fillRange(letter === "d" ? "down" : "right");
        return;
      }
    }

    if (r === 0 && entry?.kind === "data") {
      const id = entry.column.id;
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && event.shiftKey) {
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        handled();
        if (mod) {
          if (entry.column.reorderable !== false && moveColumn(id, delta)) focusCell(0, c + delta);
        } else if (entry.column.resizable !== false) {
          grid.setWidth(id, (shownWidths[id] ?? 160) + delta * 16);
        }
        return;
      }
      if (event.key === "ArrowDown" && event.altKey) {
        handled();
        setMenuColumn(id);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        handled();
        if (entry.column.sortable !== false) applySort(toggleSort(sort, id, event.shiftKey));
        return;
      }
    }

    if (r > 0 && rangeSelection && !event.altKey) {
      const step = ARROW_STEPS[event.key];
      if (step && event.shiftKey) {
        handled();
        const from = { r, c: Math.max(c, firstDataIndex) };
        const base = cellRange ?? { anchor: from, focus: from };
        const next = extendRange(base, step.dr * (mod ? maxR : 1), step.dc * (mod ? maxC : 1), {
          minR: 1,
          maxR,
          minC: Math.max(0, firstDataIndex),
          maxC,
        });
        setCellRange(next);
        focusCell(next.focus.r, next.focus.c);
        return;
      }
      if (mod && event.key.toLowerCase() === "c" && cellRange) {
        handled();
        copyRange();
        return;
      }
      if (mod && event.key.toLowerCase() === "a" && !selectable) {
        handled();
        setCellRange({
          anchor: { r: 1, c: Math.max(0, firstDataIndex) },
          focus: { r: maxR, c: maxC },
        });
        return;
      }
      if (
        cellRange &&
        (step || ["Home", "End", "PageUp", "PageDown", "Escape"].includes(event.key))
      ) {
        setCellRange(null);
      }
    }
    if (r > 0 && row?.kind === "data" && event.altKey && !mod) {
      const vertical = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (vertical !== 0 && event.shiftKey && pinningEnabled) {
        handled();
        pinRow(row.key, vertical < 0 ? "top" : "bottom");
        return;
      }
      if (
        vertical !== 0 &&
        !event.shiftKey &&
        reorderAllowed &&
        !pinnedSideOf(pinnedRowIds, row.key)
      ) {
        handled();
        if (reorderRow(row.key, { delta: vertical })) focusCell(r + vertical, c);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const expandable = detailEnabled || !!row.tree?.hasChildren;
        if (expandable) {
          handled();
          setExpandedRow(row.key, event.key === "ArrowRight");
          return;
        }
      }
    }

    switch (event.key) {
      case "ArrowRight":
        handled();
        focusCell(r, spanEnd > start ? spanEnd + 1 : c + 1);
        return;
      case "ArrowLeft":
        handled();
        focusCell(r, spanEnd > start ? start - 1 : c - 1);
        return;
      case "ArrowDown":
        handled();
        focusCell(r + 1, c);
        return;
      case "ArrowUp":
        handled();
        focusCell(r - 1, c);
        return;
      case "Home":
        handled();
        if (mod && scrollerRef.current) scrollerRef.current.scrollTop = 0;
        focusCell(mod ? 0 : r, 0);
        return;
      case "End":
        handled();
        focusCell(mod ? maxR : r, maxC);
        return;
      case "PageDown":
      case "PageUp": {
        handled();
        const step = paged ? 10 : pageStep(rowHeight, bodyViewport);
        focusCell(Math.max(r === 0 ? 0 : 1, r + (event.key === "PageDown" ? step : -step)), c);
        return;
      }
    }

    if (mod && event.key.toLowerCase() === "a" && selectable) {
      handled();
      toggleAll();
      return;
    }
    if (r === 0 && entry?.kind === "select" && (event.key === " " || event.key === "Enter")) {
      handled();
      toggleAll();
      return;
    }
    if (!row || row.kind === "placeholder" || row.kind === "detail") return;
    if (row.kind === "group") {
      if (event.key === "Enter" || event.key === " ") {
        handled();
        toggleGroupRow(row.key);
      } else if (event.key === "ArrowRight" && row.collapsed) {
        handled();
        toggleGroupRow(row.key);
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && entry?.kind === "tools") {
      handled();
      if (detailEnabled) setExpandedRow(row.key);
      return;
    }
    if (event.key === " " && selectable) {
      handled();
      toggleRow(row.key, event.shiftKey);
      return;
    }
    if (formulasOn && event.key === "=" && !mod && !inner && entry?.kind === "data") {
      if (startEdit(row.key, entry.column, "=")) handled();
      return;
    }
    if ((event.key === "Enter" || event.key === "F2") && entry?.kind === "data") {
      if (startEdit(row.key, entry.column)) handled();
      else if (event.key === "Enter" && selectable && entry.kind === "data") return;
    }
    if (event.key === "Enter" && entry?.kind === "select") {
      handled();
      toggleRow(row.key, event.shiftKey);
    }
  };

  const onGridFocus = (event: FocusEvent<HTMLTableElement>) => {
    if ((event.target as HTMLElement).closest("[data-detail-content]")) return;
    const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-r]");
    if (!cell || !event.currentTarget.contains(cell)) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const end = Number(cell.dataset.cEnd ?? c);
    if (r === active.r && active.c >= c && active.c <= end) return;
    setActive({ r, c });
  };

  // ---- pointer: resize and reorder ---------------------------------------------------------
  const onResizeStart = (event: ReactPointerEvent<HTMLElement>, column: DataGridColumn<T>) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = true;
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = shownWidths[column.id] ?? 160;
    const direction = zoneOf.get(column.id) === "right" ? -1 : 1;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) =>
      grid.setWidth(column.id, startWidth + direction * (moveEvent.clientX - startX));
    const end = () => {
      resizing.current = false;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const onDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    if (resizing.current) {
      event.preventDefault();
      return;
    }
    dragId.current = id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (event: DragEvent<HTMLElement>, id: string) => {
    const source = dragId.current;
    if (!source || source === id || zoneOf.get(source) !== zoneOf.get(id)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const place = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
    setDropTarget((previous) =>
      previous?.id === id && previous.place === place ? previous : { id, place },
    );
  };
  const onDrop = (event: DragEvent<HTMLElement>, id: string) => {
    event.preventDefault();
    const source = dragId.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const place = event.clientX < rect.left + rect.width / 2 ? "before" : "after";
    if (source && source !== id && zoneOf.get(source) === zoneOf.get(id)) {
      grid.moveTo(source, id, place);
    }
    dragId.current = null;
    setDropTarget(null);
  };
  const onDragEnd = () => {
    dragId.current = null;
    setDropTarget(null);
  };

  const onRowDragStart = (event: DragEvent<HTMLElement>, key: string) => {
    if (!reorderAllowed) {
      event.preventDefault();
      return;
    }
    rowDrag.current = key;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
    const row = event.currentTarget.closest("tr");
    if (row) event.dataTransfer.setDragImage(row, 16, rowHeight / 2);
  };
  const dropPlace = (event: DragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };
  const onRowDragOver = (event: DragEvent<HTMLElement>, key: string) => {
    const source = rowDrag.current;
    if (!source || source === key) return;
    event.preventDefault();
    const place = dropPlace(event);
    setDropRow((previous) =>
      previous?.key === key && previous.place === place ? previous : { key, place },
    );
  };
  const onRowDrop = (event: DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    const source = rowDrag.current;
    if (source && source !== key) reorderRow(source, { id: key, place: dropPlace(event) });
    rowDrag.current = null;
    setDropRow(null);
  };
  const onRowDragEnd = () => {
    rowDrag.current = null;
    setDropRow(null);
  };

  // ---- rendering helpers -------------------------------------------------------------------
  const pinOf = (entry: RenderColumn<T>): PinPosition | undefined => positions[idOfColumn(entry)];
  const pinStyle = (position: PinPosition | undefined): CSSProperties | undefined =>
    position ? { [position.side]: position.offset } : undefined;
  const pinShadow = (position: PinPosition | undefined) =>
    position?.edge &&
    (position.side === "left" ? scrolled.start : scrolled.end) &&
    (position.side === "left" ? "shadow-pinned-start" : "shadow-pinned-end");
  const cellBase =
    "overflow-hidden border-b-divider px-3 outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 @max-sm/grid:px-2";
  const tabIndexOf = (r: number, c: number) => (tabbable.r === r && tabbable.c === c ? 0 : -1);
  const firstDataIndex = renderColumns.findIndex((entry) => entry.kind === "data");

  const cellLetter = (id: string) => columnLabel(sourceIndex?.cols.get(id) ?? 0);
  const sortOf = (id: string) => {
    const index = sort.findIndex((rule) => rule.id === id);
    return index === -1 ? null : { index, direction: (sort[index] as SortRule).direction };
  };

  const renderHeader = (entry: RenderColumn<T>, c: number) => {
    const position = pinOf(entry);
    const common = {
      "data-r": 0,
      "data-c": c,
      tabIndex: tabIndexOf(0, c),
      style: { ...pinStyle(position), top: headerTop, height: headerHeight },
    };
    const sticky = cn("sticky bg-surface", position ? "z-3" : "z-2", pinShadow(position));
    if (entry.kind === "tools") {
      return (
        <th key={TOOLS_ID} className={cn(cellBase, sticky, "px-0")} {...common}>
          <span className="sr-only">{labels.rowActions}</span>
        </th>
      );
    }
    if (entry.kind === "select") {
      const all = allKeys.length > 0 && selectedInView === allKeys.length;
      return (
        <th key={SELECT_ID} className={cn(cellBase, sticky, "px-0 text-center")} {...common}>
          <input
            type="checkbox"
            tabIndex={-1}
            aria-label={labels.selectAll}
            className="size-4 align-middle accent-accent"
            checked={all}
            ref={(node) => {
              if (node) node.indeterminate = selectedInView > 0 && !all;
            }}
            onChange={toggleAll}
          />
        </th>
      );
    }
    const { column } = entry;
    const align = columnAlign(column);
    const state = sortOf(column.id);
    const sortable = column.sortable !== false;
    const reorderable = column.reorderable !== false;
    const zone = zoneOf.get(column.id) ?? "center";
    const neighbourLeft = neighbourOf(column.id, -1);
    const neighbourRight = neighbourOf(column.id, 1);
    const drop = dropTarget?.id === column.id ? dropTarget.place : null;
    return (
      <th
        key={column.id}
        aria-sort={
          state?.index === 0 ? (state.direction === "asc" ? "ascending" : "descending") : undefined
        }
        draggable={reorderable && !editing}
        onDragStart={(event) => onDragStart(event, column.id)}
        onDragOver={(event) => onDragOver(event, column.id)}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(event) => onDrop(event, column.id)}
        onDragEnd={onDragEnd}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button,[data-resize]")) return;
          if (sortable) applySort(toggleSort(sort, column.id, event.shiftKey));
        }}
        className={cn(
          cellBase,
          sticky,
          "select-none whitespace-nowrap font-[650] text-[11px] text-ink-3 uppercase tracking-[.07em]",
          sortable && "cursor-pointer hover:text-ink",
          drop === "before" && "shadow-[inset_2px_0_0_var(--accent)]",
          drop === "after" && "shadow-[inset_-2px_0_0_var(--accent)]",
        )}
        data-zone={zone}
        {...common}
      >
        <div
          className={cn("flex min-w-0 items-center gap-1", align === "end" && "flex-row-reverse")}
        >
          <span className={cn("flex min-w-0 flex-1 items-center gap-1", justifyClass[align])}>
            {formulasOn ? (
              <span
                aria-hidden="true"
                className="shrink-0 rounded-xs bg-surface-2 px-1 font-[650] text-[10px] text-ink-3 normal-case tracking-normal"
              >
                {cellLetter(column.id)}
              </span>
            ) : null}
            <span className="truncate" title={column.header}>
              {column.header}
            </span>
            {state ? (
              <span className="inline-flex shrink-0 items-center text-accent-ink">
                {state.direction === "asc" ? (
                  <ArrowUp aria-hidden="true" className="size-3" />
                ) : (
                  <ArrowDown aria-hidden="true" className="size-3" />
                )}
                {sort.length > 1 ? (
                  <span className="text-[10px] tabular-nums">{state.index + 1}</span>
                ) : null}
                {state.index > 0 ? (
                  <span className="sr-only">
                    {state.direction === "asc" ? labels.sortAsc : labels.sortDesc}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
          <ColumnMenu
            column={column}
            labels={labels}
            open={menuColumn === column.id}
            onOpenChange={(open) => setMenuColumn(open ? column.id : null)}
            onCloseFocus={() => focusCell(0, c)}
            sortDirection={state?.direction ?? null}
            filter={filters[column.id]}
            values={() => distinctValues(data, column)}
            pinned={zone === "center" ? null : zone}
            grouped={groupBy.includes(column.id)}
            canMoveLeft={!!neighbourLeft}
            canMoveRight={!!neighbourRight}
            canHide={column.hideable !== false && dataColumns.length > 1}
            onSort={(direction) => applySort(direction ? [{ id: column.id, direction }] : [])}
            onFilter={(filter) => setFilter(column.id, filter)}
            onPin={(side) => grid.pin(column.id, side)}
            onGroup={(on) => setGroup(column.id, on)}
            onMove={(delta) => moveColumn(column.id, delta)}
            onResize={(delta) =>
              delta === null
                ? grid.resetWidth(column.id)
                : grid.setWidth(column.id, (shownWidths[column.id] ?? 160) + delta)
            }
            onHide={() => {
              setMenuColumn(null);
              grid.setHidden(column.id, true);
            }}
          />
        </div>
        {column.resizable !== false ? (
          <span
            aria-hidden="true"
            data-resize=""
            onPointerDown={(event) => onResizeStart(event, column)}
            onDoubleClick={() => grid.resetWidth(column.id)}
            className={cn(
              "absolute top-0 z-1 h-full w-2 cursor-col-resize touch-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:bg-line hover:after:w-0.5 hover:after:bg-accent",
              zone === "right" ? "left-0" : "right-0",
            )}
          />
        ) : null}
      </th>
    );
  };

  const renderValue = (row: T, key: string, column: DataGridColumn<T>) => {
    const value = getCellValue(row, column);
    const formatted = formatCellValue(value, column);
    if (column.cell) return column.cell({ row, rowId: key, value, formatted });
    if (formulasOn && isErrorText(value) && isFormulaText(rawValue(row, column))) {
      return (
        <span
          className="block truncate font-[650] text-danger"
          title={`${labels.formulaError}: ${value}`}
        >
          {value}
        </span>
      );
    }
    if (column.type === "status" && formatted) {
      return (
        <Chip tone={column.statusTones?.[String(value)] ?? "neutral"} className="h-5.5">
          {formatted}
        </Chip>
      );
    }
    if (column.type === "boolean" && formatted) {
      return (
        <Chip tone={value === true ? "success" : "neutral"} className="h-5.5">
          {formatted}
        </Chip>
      );
    }
    return (
      <span className="block truncate" title={formatted}>
        {formatted}
      </span>
    );
  };

  const renderEditor = (column: DataGridColumn<T>, r: number, c: number) => {
    if (!editing) return null;
    const errorId = `${helpId}-error`;
    const editorClass = cn(
      "h-[calc(100%-6px)] w-full min-w-0 rounded-xs border bg-surface px-1.5 text-[13px] text-ink outline-none",
      editing.error ? "border-danger" : "border-accent",
    );
    const common = {
      autoFocus: true,
      "aria-label": column.header,
      "aria-invalid": editing.error ? true : undefined,
      "aria-describedby": editing.error ? errorId : undefined,
      value: editing.draft,
      onBlur: () => commitEdit(),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => onEditorKey(event, r, c),
    };
    const change = (draft: string) => setEditing({ ...editing, draft, error: undefined });
    const editor =
      editorOf(column) === "select" ? (
        <select
          {...common}
          onChange={(event) => change(event.target.value)}
          className={editorClass}
        >
          {(column.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type="text"
          inputMode={editorOf(column) === "number" ? "decimal" : undefined}
          onFocus={(event) => {
            const input = event.currentTarget;
            if (editing.caretEnd) input.setSelectionRange(input.value.length, input.value.length);
            else input.select();
          }}
          onChange={(event) => change(event.target.value)}
          className={cn(editorClass, columnAlign(column) === "end" && "text-right")}
        />
      );
    return (
      <>
        {editor}
        {editing.error ? (
          <span
            id={errorId}
            role="alert"
            className="absolute top-full left-1 z-5 mt-0.5 flex max-w-64 items-center gap-1.5 rounded-xs border border-danger bg-surface px-2 py-1 text-[12px] text-danger shadow-overlay"
          >
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            {editing.error}
          </span>
        ) : null}
      </>
    );
  };

  const ariaRowOf = (r: number) => groupLevels + pageOffset + r + 1;
  const dividerRow = (r: number) => (topCount > 0 && r === topCount ? "top" : null);

  const renderGroupRow = (row: Extract<DisplayRow<T>, { kind: "group" }>, r: number) => {
    const header = byId.get(row.columnId)?.header ?? row.columnId;
    // The label spans the leading columns without aggregates so it never truncates to nothing.
    let spanEnd = Math.max(0, firstDataIndex);
    while (spanEnd + 1 < fillerIndex) {
      const next = renderColumns[spanEnd + 1];
      if (next?.kind !== "data" || next.column.aggregate) break;
      spanEnd += 1;
    }
    const labelActive = tabbable.r === r && tabbable.c <= spanEnd;
    const cells = renderColumns.map((entry, c) => {
      if (c > 0 && c <= spanEnd) return null;
      if (c === 0) {
        return (
          <td
            key="label"
            data-r={r}
            data-c={0}
            data-c-end={spanEnd}
            colSpan={spanEnd + 1}
            tabIndex={labelActive ? 0 : -1}
            role="gridcell"
            aria-expanded={!row.collapsed}
            className={cn(cellBase, "cursor-pointer overflow-visible text-[13px]")}
          >
            <span
              className="sticky left-3 flex w-fit max-w-full min-w-0 items-center gap-1.5 whitespace-nowrap font-[650] text-ink"
              style={{ paddingLeft: row.depth * 16 }}
              title={`${header}: ${row.label}`}
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none",
                  row.collapsed && "-rotate-90",
                )}
              />
              <span className="sr-only">
                {row.collapsed ? labels.expandGroup : labels.collapseGroup}:{" "}
              </span>
              <span className="shrink-0 font-normal text-ink-3">{header}:</span>
              <span className="min-w-0 truncate">{row.label}</span>
              <Chip className="h-5 shrink-0 px-2 text-[11px]">{row.count}</Chip>
            </span>
          </td>
        );
      }
      const position = pinOf(entry);
      const column = entry.kind === "data" ? entry.column : null;
      const aggregate = column?.aggregate ? (row.aggregates[column.id] ?? null) : null;
      return (
        <td
          key={idOfColumn(entry)}
          data-r={r}
          data-c={c}
          tabIndex={tabIndexOf(r, c)}
          role="gridcell"
          style={pinStyle(position)}
          className={cn(
            cellBase,
            "cursor-pointer text-[13px]",
            position && "sticky z-1 bg-surface-2",
            pinShadow(position),
            column && alignClass[columnAlign(column)],
          )}
        >
          {column?.aggregate && aggregate !== null ? (
            <span className="block truncate font-[650] text-ink tabular-nums">
              <span className="sr-only">{labels.aggregate[column.aggregate]}: </span>
              {formatAggregate(aggregate, column.aggregate, column)}
            </span>
          ) : null}
        </td>
      );
    });
    return (
      <tr
        key={row.key}
        aria-rowindex={ariaRowOf(r)}
        style={{ height: rowHeight }}
        className="group/row bg-surface-2"
        onClick={() => toggleGroupRow(row.key)}
      >
        {cells.slice(0, fillerIndex)}
        <td aria-hidden="true" className="border-b-divider" />
        {cells.slice(fillerIndex)}
      </tr>
    );
  };

  /** Row stuck to the top or bottom of the scroller (pinned rows), with its sticky offset. */
  const rowPinInfo = (r: number) => {
    const index = r - 1;
    if (index < topCount) {
      return { side: "top" as const, offset: headerTop + headerHeight + index * rowHeight };
    }
    if (index >= bodyLength - bottomCount) {
      const fromEnd = bodyLength - 1 - index;
      return { side: "bottom" as const, offset: (footer ? rowHeight : 0) + fromEnd * rowHeight };
    }
    return null;
  };

  const renderToolsCell = (
    row: Extract<DisplayRow<T>, { kind: "data" }>,
    r: number,
    c: number,
    position: PinPosition | undefined,
    pinInfo: ReturnType<typeof rowPinInfo>,
    sticky: string | undefined | false,
  ) => {
    const isOpen = expandedSet.has(row.key);
    const pinSide = pinnedSideOf(pinnedRowIds, row.key);
    const name = labelOfRow(row.key);
    const tool =
      "grid size-6 shrink-0 place-items-center rounded-xs text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-3.5";
    return (
      <td
        key={TOOLS_ID}
        data-r={r}
        data-c={c}
        tabIndex={tabIndexOf(r, c)}
        role="gridcell"
        style={{ ...pinStyle(position), ...(pinInfo ? { [pinInfo.side]: pinInfo.offset } : null) }}
        className={cn(cellBase, sticky, pinShadow(position), "px-1")}
      >
        <span className="flex items-center justify-center gap-0.5">
          {reorderEnabled && !pinInfo ? (
            <span
              draggable={reorderAllowed}
              aria-hidden="true"
              title={reorderAllowed ? labels.dragRow : labels.reorderBlocked}
              onDragStart={(event) => onRowDragStart(event, row.key)}
              onDragEnd={onRowDragEnd}
              className={cn(
                tool,
                reorderAllowed
                  ? "cursor-grab active:cursor-grabbing"
                  : "cursor-not-allowed opacity-35",
              )}
            >
              <GripVertical aria-hidden="true" />
            </span>
          ) : reorderEnabled ? (
            <span className="size-6 shrink-0" aria-hidden="true" />
          ) : null}
          {detailEnabled ? (
            pinInfo ? (
              <span className="size-6 shrink-0" aria-hidden="true" />
            ) : (
              <button
                type="button"
                tabIndex={-1}
                className={tool}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? labels.collapseRow : labels.expandRow}: ${name}`}
                onClick={() => setExpandedRow(row.key)}
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "transition-transform motion-reduce:transition-none",
                    isOpen && "rotate-90",
                  )}
                />
              </button>
            )
          ) : null}
          {pinningEnabled ? (
            pinSide ? (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  className={cn(tool, "text-accent-ink")}
                  aria-label={`${labels.unpinRow}: ${name}`}
                  title={labels.unpinRow}
                  onClick={() => pinRow(row.key, pinSide)}
                >
                  <PinOff aria-hidden="true" />
                </button>
                <span className="size-6 shrink-0" aria-hidden="true" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  className={tool}
                  aria-label={`${labels.pinRowTop}: ${name}`}
                  title={labels.pinRowTop}
                  onClick={() => pinRow(row.key, "top")}
                >
                  <ArrowUpToLine aria-hidden="true" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  className={tool}
                  aria-label={`${labels.pinRowBottom}: ${name}`}
                  title={labels.pinRowBottom}
                  onClick={() => pinRow(row.key, "bottom")}
                >
                  <ArrowDownToLine aria-hidden="true" />
                </button>
              </>
            )
          ) : null}
        </span>
      </td>
    );
  };

  const renderDataRow = (row: Extract<DisplayRow<T>, { kind: "data" }>, r: number) => {
    const isSelected = selected.has(row.key);
    const pinInfo = rowPinInfo(r);
    const isDropTarget = dropRow?.key === row.key;
    const cells = renderColumns.map((entry, c) => {
      const position = pinOf(entry);
      const stuck = !!position || !!pinInfo;
      const sticky =
        stuck &&
        cn(
          "sticky bg-surface group-hover/row:bg-surface-2 group-aria-selected/row:bg-accent-soft",
          pinInfo ? (position ? "z-3" : "z-2") : "z-1",
        );
      const stuckStyle: CSSProperties = {
        ...pinStyle(position),
        ...(pinInfo ? { [pinInfo.side]: pinInfo.offset } : null),
      };
      if (entry.kind === "select") {
        return (
          <td
            key={SELECT_ID}
            data-r={r}
            data-c={c}
            tabIndex={tabIndexOf(r, c)}
            style={stuckStyle}
            className={cn(cellBase, sticky, pinShadow(position), "px-0 text-center")}
          >
            <input
              type="checkbox"
              tabIndex={-1}
              aria-label={`${labels.selectRow} ${dataColumns[0] ? formatCellValue(getCellValue(row.row, dataColumns[0]), dataColumns[0]) : row.key}`}
              className="size-4 align-middle accent-accent"
              checked={isSelected}
              onChange={() => undefined}
              onClick={(event) => toggleRow(row.key, event.shiftKey)}
            />
          </td>
        );
      }
      if (entry.kind === "tools") {
        return renderToolsCell(row, r, c, position, pinInfo, sticky);
      }
      const { column } = entry;
      const isEditing = editing?.key === row.key && editing.columnId === column.id;
      const editable = canEdit(column, row.row);
      const value = getCellValue(row.row, column);
      const invalid = column.validate ? column.validate(value, row.row) : null;
      const inSelection = rangeSelection && inRange(cellRange, r, c);
      const isTreeCell = !!tree && structured && c === firstDataIndex;
      const parentAggregate =
        row.tree?.hasChildren && column.aggregate ? (row.tree.aggregates[column.id] ?? null) : null;
      const content =
        parentAggregate !== null && column.aggregate ? (
          <span className="block truncate font-[650] tabular-nums">
            <span className="sr-only">{labels.aggregate[column.aggregate]}: </span>
            {formatAggregate(parentAggregate, column.aggregate, column)}
          </span>
        ) : (
          renderValue(row.row, row.key, column)
        );
      const body = isTreeCell ? (
        <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: row.depth * 16 }}>
          {row.tree?.hasChildren ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={`${row.tree.expanded ? labels.collapseRow : labels.expandRow}: ${labelOfRow(row.key)}`}
              aria-expanded={row.tree.expanded}
              onClick={() => setExpandedRow(row.key)}
              className="grid size-5 shrink-0 place-items-center rounded-xs text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform motion-reduce:transition-none",
                  row.tree.expanded && "rotate-90",
                )}
              />
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">{content}</span>
        </span>
      ) : (
        content
      );
      return (
        <td
          key={column.id}
          data-r={r}
          data-c={c}
          tabIndex={tabIndexOf(r, c)}
          role="gridcell"
          aria-readonly={onCellChange && !editable ? true : undefined}
          aria-selected={rangeSelection ? inSelection : undefined}
          aria-invalid={invalid ? true : undefined}
          title={invalid ? `${labels.invalidCell}: ${invalid}` : undefined}
          onPointerDown={rangeSelection ? (event) => onCellPointerDown(event, r, c) : undefined}
          onDoubleClick={() => {
            if (startEdit(row.key, column)) setActive({ r, c });
          }}
          style={{
            ...stuckStyle,
            paddingLeft:
              c === firstDataIndex && row.depth > 0 && !isTreeCell
                ? 12 + row.depth * 16
                : undefined,
          }}
          className={cn(
            cellBase,
            sticky,
            pinShadow(position),
            alignClass[columnAlign(column)],
            (column.type === "number" || column.type === "currency") && "tabular-nums",
            isEditing && "relative overflow-visible px-1",
            editable && "cursor-text",
            invalid && "bg-danger-soft",
            inSelection && "bg-accent-soft",
          )}
        >
          {isEditing ? (
            renderEditor(column, r, c)
          ) : invalid ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 text-danger" />
              <span className="sr-only">
                {labels.invalidCell}: {invalid.replace(/\.$/, "")}.{" "}
              </span>
              <span className="min-w-0 flex-1">{body}</span>
            </span>
          ) : (
            body
          )}
        </td>
      );
    });
    return (
      <tr
        key={row.key}
        aria-rowindex={ariaRowOf(r)}
        aria-selected={selectable ? isSelected : undefined}
        aria-level={tree && structured ? row.depth + 1 : undefined}
        aria-expanded={
          tree && structured && row.tree?.hasChildren
            ? row.tree.expanded
            : detailEnabled
              ? expandedSet.has(row.key)
              : undefined
        }
        data-drop={isDropTarget ? dropRow?.place : undefined}
        data-pinned={pinInfo?.side}
        data-divider={dividerRow(r)}
        style={{ height: rowHeight }}
        onDragOver={reorderAllowed ? (event) => onRowDragOver(event, row.key) : undefined}
        onDrop={reorderAllowed ? (event) => onRowDrop(event, row.key) : undefined}
        className={cn(
          "group/row text-[13px] text-ink hover:bg-surface-2 aria-selected:bg-accent-soft",
          "data-[drop=before]:[&>td]:shadow-[inset_0_2px_0_var(--accent)] data-[drop=after]:[&>td]:shadow-[inset_0_-2px_0_var(--accent)]",
          "data-[divider=top]:[&>td]:border-b-line-strong",
        )}
      >
        {cells.slice(0, fillerIndex)}
        <td aria-hidden="true" className="border-b-divider" />
        {cells.slice(fillerIndex)}
      </tr>
    );
  };

  const renderDetailRow = (row: Extract<DisplayRow<T>, { kind: "detail" }>, r: number) => {
    const labelled = labels.detailOf(labelOfRow(row.rowKey));
    return (
      <tr key={row.key} aria-rowindex={ariaRowOf(r)} style={{ height: row.height }}>
        <td
          data-r={r}
          data-c={0}
          data-c-end={maxC}
          colSpan={colSpan}
          role="gridcell"
          tabIndex={tabbable.r === r ? 0 : -1}
          aria-label={labelled}
          className={cn(cellBase, "overflow-hidden bg-surface-2/50 p-0")}
        >
          <div
            data-detail-content=""
            className="sticky left-0 box-border overflow-auto p-2"
            style={{ width: containerWidth || "100%", height: row.height - 1 }}
          >
            {renderDetail?.(row.row, row.rowKey)}
          </div>
        </td>
      </tr>
    );
  };

  const renderPlaceholderRow = (
    row: Extract<DisplayRow<T>, { kind: "placeholder" }>,
    r: number,
  ) => {
    const cells = renderColumns.map((entry, c) => {
      const position = pinOf(entry);
      return (
        <td
          key={idOfColumn(entry)}
          data-r={r}
          data-c={c}
          tabIndex={tabIndexOf(r, c)}
          role="gridcell"
          style={pinStyle(position)}
          className={cn(cellBase, position && "sticky z-1 bg-surface", pinShadow(position))}
        >
          {entry.kind === "data" ? (
            <span className="block h-2.5 w-3/4 rounded-pill bg-surface-2 motion-safe:animate-pulse" />
          ) : null}
        </td>
      );
    });
    return (
      <tr key={row.key} aria-rowindex={ariaRowOf(r)} aria-busy="true" style={{ height: rowHeight }}>
        {cells.slice(0, fillerIndex)}
        <td aria-hidden="true" className="border-b-divider" />
        {cells.slice(fillerIndex)}
      </tr>
    );
  };

  const headerCells = renderColumns.map(renderHeader);
  const footerCells = renderColumns.map((entry, c) => {
    const position = pinOf(entry);
    const column = entry.kind === "data" ? entry.column : null;
    const value = column?.aggregate ? (totals[column.id] ?? null) : null;
    return (
      <td
        key={idOfColumn(entry)}
        style={pinStyle(position)}
        className={cn(
          "sticky bottom-0 overflow-hidden border-t-divider bg-surface px-3 font-[650] text-[13px] text-ink @max-sm/grid:px-2",
          position ? "z-3" : "z-2",
          pinShadow(position),
          column && alignClass[columnAlign(column)],
          "tabular-nums",
        )}
      >
        {column?.aggregate && value !== null ? (
          <span className="block truncate">
            <span className="sr-only">{labels.aggregate[column.aggregate]}: </span>
            {formatAggregate(value, column.aggregate, column)}
          </span>
        ) : c === firstDataIndex ? (
          <span className="text-[11px] text-ink-3 uppercase tracking-[.07em]">{labels.total}</span>
        ) : null}
      </td>
    );
  });

  const colSpan = renderColumns.length + 1;
  const activeFilters = countActiveFilters(filters);
  const rowCount = bodyLength + groupLevels + 1 + (footer ? 1 : 0);
  const toolbarRows = sourceActive ? (remote.total ?? 0) : sorted.length;

  useEffect(() => {
    if (page > pages - 1) setPage(Math.max(0, pages - 1));
  }, [page, pages]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a range refers to rows by position, so any change of the rows drops it.
  useEffect(() => {
    setCellRange(null);
  }, [sort, filters, search, groupBy, page, advanced, data]);

  const renderGroupHeaderRow = (level: number) => {
    const top = level * GROUP_HEADER_HEIGHT;
    // Labels of scrolling groups stay readable: they stick next to the pinned-left zone.
    const labelInset = renderColumns
      .slice(0, leadingCount + pinned.left.length)
      .reduce((sum, entry) => sum + widthOf(entry), 0);
    const out: ReactNode[] = [];
    let fillerDone = false;
    const filler = () => {
      fillerDone = true;
      out.push(
        <th
          key="filler"
          role="presentation"
          className="sticky z-2 border-b-divider bg-surface"
          style={{ top, height: GROUP_HEADER_HEIGHT }}
        />,
      );
    };
    if (leadingCount > 0) {
      out.push(
        <th
          key="lead"
          role="presentation"
          colSpan={leadingCount}
          className="sticky z-3 border-b-divider bg-surface"
          style={{ left: 0, top, height: GROUP_HEADER_HEIGHT }}
        />,
      );
    }
    for (const cell of headerLevels[level] ?? []) {
      const startIndex = cell.start + leadingCount;
      if (!fillerDone && startIndex >= fillerIndex) filler();
      const zone = zoneOf.get(dataColumns[cell.start]?.id ?? "") ?? "center";
      const first = renderColumns[startIndex];
      const last = renderColumns[startIndex + cell.span - 1];
      const style: CSSProperties = { top, height: GROUP_HEADER_HEIGHT };
      if (zone === "left" && first) style.left = positions[idOfColumn(first)]?.offset;
      if (zone === "right" && last) style.right = positions[idOfColumn(last)]?.offset;
      out.push(
        <th
          key={`${cell.start}-${cell.label}`}
          role={cell.label ? "columnheader" : "presentation"}
          colSpan={cell.span}
          className={cn(
            "sticky overflow-clip border-b-divider bg-surface px-3 text-center font-[650] text-[11px] text-ink-3 uppercase tracking-[.07em] @max-sm/grid:px-2",
            zone === "center" ? "z-2" : "z-3",
            cell.label && "border-x",
          )}
          style={style}
        >
          <span
            className={cn(
              "block w-fit max-w-full truncate",
              zone === "center" && "sticky mx-auto @max-sm/grid:mx-0",
            )}
            style={zone === "center" ? { left: labelInset + 8 } : undefined}
            title={cell.label}
          >
            {cell.label}
          </span>
        </th>,
      );
    }
    if (!fillerDone) filler();
    return (
      <tr key={`group-header-${level}`} aria-rowindex={level + 1}>
        {out}
      </tr>
    );
  };

  const renderBodyRow = (row: DisplayRow<T>, index: number) => {
    const r = index + 1;
    switch (row.kind) {
      case "group":
        return renderGroupRow(row, r);
      case "detail":
        return renderDetailRow(row, r);
      case "placeholder":
        return renderPlaceholderRow(row, r);
      default:
        return renderDataRow(row, r);
    }
  };
  const bodyRowsIn = (start: number, end: number) =>
    bodyRows.slice(start, end).map((row, offset) => renderBodyRow(row, start + offset));
  const spacer = (key: string, px: number) =>
    px > 0 ? (
      <tr key={key} aria-hidden="true" style={{ height: px }}>
        <td colSpan={colSpan} className="p-0" />
      </tr>
    ) : null;

  const stats = cellRange
    ? rangeStats(rangeBounds(cellRange), (r, c) => {
        const cell = cellAt(r, c);
        return cell ? getCellValue(cell.row, cell.column) : undefined;
      })
    : null;
  const rangeCellCount = cellRange
    ? (() => {
        const b = rangeBounds(cellRange);
        return (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1);
      })()
    : 0;
  const rangeIsCurrency = (() => {
    if (!cellRange) return false;
    const b = rangeBounds(cellRange);
    const kinds = new Set<string>();
    for (let c = b.c0; c <= b.c1; c += 1) {
      const entry = renderColumns[c];
      if (
        entry?.kind === "data" &&
        (entry.column.type === "number" || entry.column.type === "currency")
      ) {
        kinds.add(entry.column.type);
      }
    }
    return kinds.size === 1 && kinds.has("currency");
  })();
  const formatStat = (value: number | null) =>
    value === null ? "" : rangeIsCurrency ? formatCurrency(value) : formatNumber(value);

  const barCell = formulasOn ? cellAt(activeR, activeC) : null;
  const [barError, setBarError] = useState<string | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: moving to another cell clears the message.
  useEffect(() => {
    setBarError(undefined);
  }, [activeR, activeC]);
  const barRaw = barCell ? rawValue(barCell.row, barCell.column) : null;
  const commitBar = (text: string) => {
    if (!barCell || !canEdit(barCell.column, barCell.row)) return;
    const result = coerceDraft(barCell.column, barCell.row, text);
    if ("error" in result) {
      setBarError(result.error);
      return;
    }
    setBarError(undefined);
    if (!sameCellValue(result.value, barRaw)) {
      commitChanges(
        [
          {
            row: barCell.row,
            rowId: keyOf(barCell.row),
            column: barCell.column,
            value: result.value,
            previous: barRaw,
          },
        ],
        "edit",
      );
    }
    focusCell(activeR, activeC);
  };

  const emptyFiltered = activeFilters > 0 || search !== "" || advancedCount > 0;

  return (
    <div
      className={cn(
        "@container/grid flex min-w-0 max-w-full flex-col overflow-hidden rounded-card border-card shadow-card surface-card text-ink",
        className,
      )}
    >
      {hideToolbar ? null : (
        <GridToolbar
          labels={labels}
          search={search}
          onSearch={(value) => {
            setSearch(value);
            resetPage();
          }}
          activeFilters={activeFilters}
          onClearFilters={() => {
            setFiltersState({});
            resetPage();
          }}
          groupBy={structured ? groupBy : EMPTY_LIST}
          columns={columns}
          onUngroup={(id) => setGroup(id, false)}
          density={density}
          onDensity={setDensity}
          hidden={layout.hidden}
          onHidden={grid.setHidden}
          onResetColumns={grid.reset}
          onExport={exportFilename === false ? undefined : exportCsv}
          onExportXlsx={xlsxName ? exportToXlsx : undefined}
          exportSelected={selectable && selection.length > 0}
          rowCount={toolbarRows}
          selectedCount={selectable ? selection.length : null}
          actions={toolbarActions}
          hideColumnPicker={toolPanel}
          history={
            historyEnabled
              ? {
                  canUndo: historySummary.canUndo,
                  canRedo: historySummary.canRedo,
                  onUndo: undo,
                  onRedo: redo,
                }
              : undefined
          }
          rowTools={
            structured && onRowsChange && (createRow || selectable)
              ? {
                  onAdd: createRow ? addRow : undefined,
                  onRemove: selectable ? removeSelectedRows : undefined,
                  removeDisabled: selection.length === 0,
                }
              : undefined
          }
          toolPanel={
            toolPanel ? { open: panelOpen, onToggle: () => setPanelOpen(!panelOpen) } : undefined
          }
          advancedFilter={
            showAdvancedFilter && !sourceActive ? (
              <FilterBuilder
                columns={columns}
                value={advanced}
                onChange={(next) => {
                  setAdvanced(next);
                  resetPage();
                }}
                valuesOf={(id) => {
                  const column = byId.get(id);
                  return column
                    ? column.options
                      ? [...column.options]
                      : distinctValues(data, column)
                    : [];
                }}
                labels={labelsProp}
              />
            ) : undefined
          }
          advancedFilterCount={advancedCount}
          onClearAdvancedFilter={() => setAdvanced(emptyGroup("and", "root"))}
        />
      )}
      {formulasOn ? (
        <FormulaBar
          address={
            barCell && sourceIndex
              ? cellAddress(
                  sourceIndex.rows.get(barCell.row) ?? 0,
                  sourceIndex.cols.get(barCell.column.id) ?? 0,
                )
              : ""
          }
          value={barRaw === null || barRaw === undefined ? "" : String(barRaw)}
          editable={!!barCell && canWrite && canEdit(barCell.column, barCell.row)}
          error={barError}
          labels={{ bar: labels.formulaBar, cell: labels.formulaCell, empty: labels.formulaEmpty }}
          onCommit={commitBar}
          onDiscard={() => focusCell(activeR, activeC)}
        />
      ) : null}
      {sourceActive && remote.failed && remote.total !== null ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 border-b-divider bg-danger-soft px-3 py-2 text-[13px] text-danger"
        >
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{labels.loadError}</span>
          <button
            type="button"
            className="rounded-control border border-danger px-2.5 py-1 font-[600] text-[12.5px] hover:bg-surface"
            onClick={remote.retry}
          >
            {labels.retry}
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-col @2xl/grid:flex-row">
        {toolPanel && panelOpen ? (
          <GridToolPanel
            labels={labels}
            columns={columnsProp}
            shownColumns={columns}
            order={layout.order}
            hidden={layout.hidden}
            onHidden={grid.setHidden}
            onMove={grid.move}
            groupBy={groupBy}
            onGroup={setGroup}
            pivot={pivotConfig}
            onPivot={(next) => {
              setPivotConfig(next);
              resetPage();
            }}
            pivotValid={pivotValid}
            canGroup={structured && !tree}
            canPivot={!sourceActive}
            maxHeight={height}
            className="order-first @2xl/grid:order-last"
          />
        ) : null}
        <div
          ref={scrollerRef}
          onScroll={syncScroll}
          className="relative min-h-0 min-w-0 overflow-auto overscroll-contain @2xl/grid:flex-1"
          style={paged ? undefined : { maxHeight: height }}
        >
          <table
            ref={gridRef}
            role="grid"
            aria-label={ariaLabel}
            aria-describedby={helpId}
            aria-rowcount={busy ? -1 : rowCount}
            aria-colcount={renderColumns.length}
            aria-multiselectable={selectable || rangeSelection || undefined}
            aria-busy={busy || undefined}
            onKeyDown={onGridKeyDown}
            onFocus={onGridFocus}
            onPaste={onPaste}
            className={cn(
              "table-fixed border-separate border-spacing-0",
              rangeSelection && "select-none",
            )}
            style={{ width: totalWidth, minWidth: "100%" }}
          >
            <colgroup>
              {renderColumns.slice(0, fillerIndex).map((entry) => (
                <col key={idOfColumn(entry)} style={{ width: widthOf(entry) }} />
              ))}
              <col />
              {renderColumns.slice(fillerIndex).map((entry) => (
                <col key={idOfColumn(entry)} style={{ width: widthOf(entry) }} />
              ))}
            </colgroup>
            <thead>
              {headerLevels.map((_, level) => renderGroupHeaderRow(level))}
              <tr aria-rowindex={groupLevels + 1}>
                {headerCells.slice(0, fillerIndex)}
                <th
                  role="presentation"
                  className="sticky z-2 border-b-divider bg-surface"
                  style={{ top: headerTop, height: headerHeight }}
                />
                {headerCells.slice(fillerIndex)}
              </tr>
            </thead>
            <tbody>
              {busy ? (
                Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows.
                  <tr key={index} aria-hidden="true" style={{ height: rowHeight }}>
                    {renderColumns.map((entry) => (
                      <td key={idOfColumn(entry)} className={cn(cellBase)}>
                        <span className="block h-2.5 w-3/4 rounded-pill bg-surface-2 motion-safe:animate-pulse" />
                      </td>
                    ))}
                    <td className="border-b-divider" />
                  </tr>
                ))
              ) : bodyLength === 0 ? (
                <tr aria-rowindex={groupLevels + 2}>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px] text-ink-3">
                    <div className="sticky left-0 inline-flex max-w-[calc(100cqw-2rem)] flex-col items-center gap-2">
                      <span>
                        {sourceActive && remote.failed
                          ? labels.loadError
                          : emptyFiltered
                            ? labels.emptyFiltered
                            : (emptyMessage ?? labels.empty)}
                      </span>
                      {sourceActive && remote.failed ? (
                        <button
                          type="button"
                          className="rounded-control border-divider px-2.5 py-1 font-[600] text-[12.5px] text-ink-2 hover:text-ink"
                          onClick={remote.retry}
                        >
                          {labels.retry}
                        </button>
                      ) : emptyFiltered ? (
                        <button
                          type="button"
                          className="rounded-control border-divider px-2.5 py-1 font-[600] text-[12.5px] text-ink-2 hover:text-ink"
                          onClick={() => {
                            setFiltersState({});
                            setSearch("");
                            setAdvanced(emptyGroup("and", "root"));
                          }}
                        >
                          {labels.clearFilters}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {bodyRowsIn(0, topCount)}
                  {spacer("gap-top", gapTop)}
                  {bodyRowsIn(midStart, midEnd)}
                  {spacer("gap-bottom", gapBottom)}
                  {bodyRowsIn(bodyLength - bottomCount, bodyLength)}
                </>
              )}
            </tbody>
            {footer ? (
              <tfoot>
                <tr aria-rowindex={rowCount} style={{ height: rowHeight }}>
                  {footerCells.slice(0, fillerIndex)}
                  <td
                    role="presentation"
                    className="sticky bottom-0 z-2 border-t-divider bg-surface"
                  />
                  {footerCells.slice(fillerIndex)}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
      {rangeSelection ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t-divider px-3 py-1.5 text-[12.5px] text-ink-2">
          {stats && cellRange ? (
            <>
              <span className="font-[650] text-ink">{labels.rangeCells(rangeCellCount)}</span>
              <span>
                {labels.rangeCount}:{" "}
                <b className="font-[650] text-ink tabular-nums">{stats.count}</b>
              </span>
              {stats.numeric > 0 ? (
                <>
                  <span>
                    {labels.rangeSum}:{" "}
                    <b className="font-[650] text-ink tabular-nums">{formatStat(stats.sum)}</b>
                  </span>
                  <span>
                    {labels.rangeAvg}:{" "}
                    <b className="font-[650] text-ink tabular-nums">{formatStat(stats.avg)}</b>
                  </span>
                  <span className="@max-sm/grid:hidden">
                    {labels.rangeMin}:{" "}
                    <b className="font-[650] text-ink tabular-nums">{formatStat(stats.min)}</b>
                  </span>
                  <span className="@max-sm/grid:hidden">
                    {labels.rangeMax}:{" "}
                    <b className="font-[650] text-ink tabular-nums">{formatStat(stats.max)}</b>
                  </span>
                </>
              ) : null}
              <button
                type="button"
                onClick={copyRange}
                className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-control border-divider bg-surface-control px-2 font-[600] text-[12px] text-ink-2 hover:border-line-strong hover:text-ink [&_svg]:size-3.5"
              >
                <Copy aria-hidden="true" />
                {labels.copyRange}
              </button>
            </>
          ) : (
            <span className="text-ink-3">{labels.rangeHint}</span>
          )}
        </div>
      ) : null}
      <p id={helpId} className="sr-only">
        {labels.keyboardHelp}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {busy ? labels.loading : announcement}
      </p>
      {paged && split.middle.length > 0 ? (
        <Pagination
          labels={labels}
          page={currentPage}
          pages={pages}
          pageSize={pageSize}
          total={split.middle.length}
          options={pageSizeOptions}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  labels,
  page,
  pages,
  pageSize,
  total,
  options,
  onPage,
  onPageSize,
}: {
  labels: DataGridLabels;
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  options: readonly number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const button =
    "grid size-8 place-items-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4";
  return (
    <nav
      aria-label={labels.rowsPerPage}
      className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t-divider px-2 py-1.5 text-[12.5px] text-ink-2"
    >
      <label className="flex items-center gap-2">
        <span>{labels.rowsPerPage}</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className="h-control-sm rounded-input border-control bg-surface-control px-1.5 text-[12.5px] text-ink"
        >
          {[...new Set([...options, pageSize])]
            .sort((a, b) => a - b)
            .map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
        </select>
      </label>
      <span aria-live="polite" className="tabular-nums">
        {labels.pageRange(first, last, total)}
      </span>
      <span className="flex items-center">
        <button
          type="button"
          className={button}
          aria-label={labels.firstPage}
          disabled={page === 0}
          onClick={() => onPage(0)}
        >
          <ChevronsLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className={button}
          aria-label={labels.previousPage}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className={button}
          aria-label={labels.nextPage}
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={button}
          aria-label={labels.lastPage}
          disabled={page >= pages - 1}
          onClick={() => onPage(pages - 1)}
        >
          <ChevronsRight aria-hidden="true" />
        </button>
      </span>
    </nav>
  );
}
