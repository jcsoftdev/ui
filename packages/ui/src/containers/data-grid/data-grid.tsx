// biome-ignore-all lint/a11y/noNoninteractiveElementToInteractiveRole: an ARIA grid is a table with role="grid"; its cells are gridcells.
// biome-ignore-all lint/a11y/noInteractiveElementToNoninteractiveRole: spacer and filler cells of the grid are presentational.
// biome-ignore-all lint/a11y/noAriaHiddenOnFocusable: spacer and skeleton rows are never focusable (no tabindex).
// biome-ignore-all lint/a11y/useFocusableInteractive: footer and empty-state cells are read, not navigated.
"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
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
import { cn } from "../../utils/cn.js";
import { computePinOffsets, type PinPosition, sanitizePinned } from "../table/pin.js";
import { ColumnMenu } from "./column-menu.js";
import { GridToolbar } from "./grid-toolbar.js";
import { type DataGridLabels, DEFAULT_DATA_GRID_LABELS } from "./labels.js";
import {
  aggregateValues,
  buildDisplayRows,
  columnAlign,
  countActiveFilters,
  distinctValues,
  filterRows,
  formatAggregate,
  formatCellValue,
  getCellValue,
  rangeBetween,
  sortRows,
  toCSV,
  toggleSort,
} from "./model.js";
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
import { useGridLayout } from "./use-grid-layout.js";
import {
  computeVirtualWindow,
  pageCount,
  pageStep,
  scrollLeftToReveal,
  scrollTopToReveal,
} from "./virtual.js";

export interface CellChange<T> {
  row: T;
  rowId: string;
  columnId: string;
  value: CellValue;
  previous: CellValue;
}

export interface DataGridProps<T> {
  data: readonly T[];
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

  loading?: boolean;
  /** Shown when there are no rows (a filtered-out message is used when filters are active). */
  emptyMessage?: ReactNode;
  /** Footer with the column aggregates. On when some column has `aggregate`. */
  showFooter?: boolean;
  /** Hides search, chips, density, columns and export. */
  hideToolbar?: boolean;
  /** CSV file name for the export button; `false` hides the button. */
  exportFilename?: string | false;
  toolbarActions?: ReactNode;
  labels?: Partial<DataGridLabels>;
  className?: string;
}

const ROW_HEIGHT: Record<Density, number> = { compact: 32, normal: 40, comfortable: 48 };
const SELECT_ID = "__select";
const SELECT_WIDTH = 44;
const SKELETON_ROWS = 8;
const EMPTY_SORT: readonly SortRule[] = [];
const EMPTY_FILTERS: Filters = {};
const EMPTY_LIST: readonly string[] = [];

type RenderColumn<T> = { kind: "select" } | { kind: "data"; column: DataGridColumn<T> };
type Zone = PinSide | "center";

function idOfColumn<T>(entry: RenderColumn<T>): string {
  return entry.kind === "select" ? SELECT_ID : entry.column.id;
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
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
  data,
  columns,
  "aria-label": ariaLabel,
  getRowId,
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
  loading = false,
  emptyMessage,
  showFooter,
  hideToolbar = false,
  exportFilename = "datos.csv",
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
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeProp ?? 25);
  const [active, setActive] = useState({ r: 0, c: 0 });
  const [menuColumn, setMenuColumn] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; columnId: string; draft: string } | null>(
    null,
  );
  const [firstRow, setFirstRow] = useState(0);
  const [scrolled, setScrolled] = useState({ start: false, end: false });
  const [dropTarget, setDropTarget] = useState<{ id: string; place: "before" | "after" } | null>(
    null,
  );
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const pendingFocus = useRef(false);
  const anchor = useRef<string | null>(null);
  const resizing = useRef(false);
  const dragId = useRef<string | null>(null);

  const paged = pageSizeProp !== undefined;
  const layoutDefaults = useMemo(
    () => ({ pinned: defaultPinned, hidden: defaultHidden, density: defaultDensity }),
    [defaultPinned, defaultHidden, defaultDensity],
  );
  const grid = useGridLayout(columns, layoutDefaults, storageKey);
  const { layout } = grid;
  const density = densityProp ?? layout.density ?? defaultDensity;
  const rowHeight = ROW_HEIGHT[density];
  const headerHeight = Math.max(rowHeight, 36);

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

  const renderColumns = useMemo<RenderColumn<T>[]>(
    () => [
      ...(selectable ? [{ kind: "select" } as const] : []),
      ...dataColumns.map((column) => ({ kind: "data", column }) as const),
    ],
    [selectable, dataColumns],
  );
  const fillerIndex = renderColumns.length - pinned.right.length;
  const widthOf = useCallback(
    (entry: RenderColumn<T>) =>
      entry.kind === "select" ? SELECT_WIDTH : (layout.widths[entry.column.id] ?? 160),
    [layout.widths],
  );
  const positions = useMemo(() => {
    const widths: Record<string, number> = { [SELECT_ID]: SELECT_WIDTH, ...layout.widths };
    const left = selectable ? [SELECT_ID, ...pinned.left] : pinned.left;
    return computePinOffsets(widths, { left, right: pinned.right });
  }, [layout.widths, pinned, selectable]);
  const totalWidth = renderColumns.reduce((sum, entry) => sum + widthOf(entry), 0);

  // ---- rows --------------------------------------------------------------------------------
  const keyOf = useMemo(() => {
    const keys = new Map<T, string>();
    data.forEach((row, index) => {
      keys.set(row, getRowId ? getRowId(row, index) : String(index));
    });
    return (row: T) => keys.get(row) ?? "";
  }, [data, getRowId]);
  const rowByKey = useMemo(() => new Map(data.map((row) => [keyOf(row), row])), [data, keyOf]);

  const filtered = useMemo(
    () => filterRows(data, columns, filters, search),
    [data, columns, filters, search],
  );
  const sorted = useMemo(() => sortRows(filtered, columns, sort), [filtered, columns, sort]);
  const display = useMemo<DisplayRow<T>[]>(
    () => buildDisplayRows(sorted, columns, groupBy, collapsed, keyOf, sort),
    [sorted, columns, groupBy, collapsed, keyOf, sort],
  );
  const hasAggregates = columns.some((column) => column.aggregate);
  const footer = (showFooter ?? hasAggregates) && !loading && display.length > 0;
  const totals = useMemo(() => {
    if (!footer) return {};
    const result: Record<string, number | null> = {};
    for (const column of columns) {
      if (!column.aggregate) continue;
      const values = filtered.map((row) => getCellValue(row, column));
      result[column.id] = aggregateValues(values, column.aggregate);
    }
    return result;
  }, [footer, columns, filtered]);

  const pages = pageCount(display.length, pageSize);
  const currentPage = Math.min(page, pages - 1);
  const pageOffset = paged ? currentPage * pageSize : 0;
  const bodyRows = paged ? display.slice(pageOffset, pageOffset + pageSize) : display;
  const bodyViewport = Math.max(rowHeight, height - headerHeight - (footer ? rowHeight : 0));
  const win = paged
    ? { start: 0, end: bodyRows.length, padTop: 0, padBottom: 0 }
    : computeVirtualWindow({
        count: bodyRows.length,
        rowHeight,
        viewportHeight: bodyViewport,
        scrollTop: firstRow * rowHeight,
        overscan: 8,
      });

  const selected = useMemo(() => new Set(selection), [selection]);
  const visibleKeys = useMemo(
    () => display.filter((row) => row.kind === "data").map((row) => row.key),
    [display],
  );
  const allKeys = useMemo(() => sorted.map(keyOf), [sorted, keyOf]);
  const selectedInView = allKeys.filter((key) => selected.has(key)).length;

  // ---- navigation geometry -----------------------------------------------------------------
  const maxR = loading ? 0 : bodyRows.length;
  const maxC = renderColumns.length - 1;
  const activeR = Math.min(active.r, maxR);
  const activeC = Math.min(active.c, Math.max(0, maxC));
  const activeRendered = activeR === 0 || (activeR - 1 >= win.start && activeR - 1 < win.end);
  const tabbable = activeRendered ? { r: activeR, c: activeC } : { r: 0, c: activeC };

  const syncScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setFirstRow(Math.floor(scroller.scrollTop / rowHeight));
    const start = scroller.scrollLeft > 0;
    const end = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
    setScrolled((previous) =>
      previous.start === start && previous.end === end ? previous : { start, end },
    );
  }, [rowHeight]);

  useLayoutEffect(() => {
    syncScroll();
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncScroll);
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
      if (!paged && r > 0) {
        const top = scrollTopToReveal(r - 1, rowHeight, bodyViewport, scroller.scrollTop);
        if (top !== scroller.scrollTop) {
          scroller.scrollTop = top;
          setFirstRow(Math.floor(top / rowHeight));
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
    [paged, rowHeight, bodyViewport, renderColumns, positions, widthOf],
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
    downloadCSV(exportFilename, toCSV(sorted, dataColumns, { bom: true }));
  };

  // ---- editing -----------------------------------------------------------------------------
  const startEdit = (key: string, column: DataGridColumn<T>) => {
    const row = rowByKey.get(key);
    if (!row || !canEdit(column, row)) return false;
    const value = getCellValue(row, column);
    setEditing({
      key,
      columnId: column.id,
      draft: value === null || value === undefined ? "" : String(value),
    });
    return true;
  };
  const commitEdit = () => {
    const current = editingRef.current;
    if (!current) return;
    editingRef.current = null;
    setEditing(null);
    const row = rowByKey.get(current.key);
    const column = byId.get(current.columnId);
    if (!row || !column) return;
    const previous = getCellValue(row, column);
    let value: CellValue = current.draft;
    if (editorOf(column) === "number") {
      const number = Number.parseFloat(current.draft.replace(",", "."));
      if (!Number.isFinite(number)) return;
      value = number;
    }
    const unchanged =
      value === previous ||
      (typeof previous !== "number" && String(value) === String(previous ?? ""));
    if (unchanged) return;
    onCellChange?.({ row, rowId: current.key, columnId: column.id, value, previous });
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
      commitEdit();
      focusCell(Math.min(r + 1, maxR), c);
    } else if (event.key === "Tab") {
      event.preventDefault();
      commitEdit();
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

    if (r === 0 && entry?.kind === "data") {
      const id = entry.column.id;
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && event.shiftKey) {
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        handled();
        if (mod) {
          if (entry.column.reorderable !== false && moveColumn(id, delta)) focusCell(0, c + delta);
        } else if (entry.column.resizable !== false) {
          grid.setWidth(id, (layout.widths[id] ?? 160) + delta * 16);
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
    if (!row) return;
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
    if (event.key === " " && selectable) {
      handled();
      toggleRow(row.key, event.shiftKey);
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
    const startWidth = layout.widths[column.id] ?? 160;
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

  // ---- rendering helpers -------------------------------------------------------------------
  const pinOf = (entry: RenderColumn<T>): PinPosition | undefined => positions[idOfColumn(entry)];
  const pinStyle = (position: PinPosition | undefined): CSSProperties | undefined =>
    position ? { [position.side]: position.offset } : undefined;
  const pinShadow = (position: PinPosition | undefined) =>
    position?.edge &&
    (position.side === "left" ? scrolled.start : scrolled.end) &&
    (position.side === "left"
      ? "shadow-[6px_0_8px_-6px_rgb(0_0_0/0.28)]"
      : "shadow-[-6px_0_8px_-6px_rgb(0_0_0/0.28)]");
  const cellBase =
    "overflow-hidden border-line border-b px-3 outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 @max-sm/grid:px-2";
  const tabIndexOf = (r: number, c: number) => (tabbable.r === r && tabbable.c === c ? 0 : -1);
  const firstDataIndex = renderColumns.findIndex((entry) => entry.kind === "data");

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
      style: { ...pinStyle(position), height: headerHeight },
    };
    const sticky = cn("sticky top-0 bg-surface", position ? "z-3" : "z-2", pinShadow(position));
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
                : grid.setWidth(column.id, (layout.widths[column.id] ?? 160) + delta)
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
    if (column.type === "status" && formatted) {
      return (
        <Chip tone={column.statusTones?.[String(value)] ?? "neutral"} className="h-5.5">
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
    const editorClass =
      "h-[calc(100%-6px)] w-full min-w-0 rounded-xs border border-accent bg-surface px-1.5 text-[13px] text-ink outline-none";
    const common = {
      autoFocus: true,
      "aria-label": column.header,
      value: editing.draft,
      onBlur: commitEdit,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => onEditorKey(event, r, c),
    };
    if (editorOf(column) === "select") {
      return (
        <select
          {...common}
          onChange={(event) => setEditing({ ...editing, draft: event.target.value })}
          className={editorClass}
        >
          {(column.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        {...common}
        type="text"
        inputMode={editorOf(column) === "number" ? "decimal" : undefined}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setEditing({ ...editing, draft: event.target.value })}
        className={cn(editorClass, columnAlign(column) === "end" && "text-right")}
      />
    );
  };

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
        aria-rowindex={pageOffset + r + 1}
        style={{ height: rowHeight }}
        className="group/row bg-surface-2"
        onClick={() => toggleGroupRow(row.key)}
      >
        {cells.slice(0, fillerIndex)}
        <td aria-hidden="true" className="border-line border-b" />
        {cells.slice(fillerIndex)}
      </tr>
    );
  };

  const renderDataRow = (row: Extract<DisplayRow<T>, { kind: "data" }>, r: number) => {
    const isSelected = selected.has(row.key);
    const cells = renderColumns.map((entry, c) => {
      const position = pinOf(entry);
      const sticky =
        position &&
        "sticky z-1 bg-surface group-hover/row:bg-surface-2 group-aria-selected/row:bg-accent-soft";
      if (entry.kind === "select") {
        return (
          <td
            key={SELECT_ID}
            data-r={r}
            data-c={c}
            tabIndex={tabIndexOf(r, c)}
            style={pinStyle(position)}
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
      const { column } = entry;
      const isEditing = editing?.key === row.key && editing.columnId === column.id;
      const editable = canEdit(column, row.row);
      return (
        <td
          key={column.id}
          data-r={r}
          data-c={c}
          tabIndex={tabIndexOf(r, c)}
          role="gridcell"
          aria-readonly={onCellChange && !editable ? true : undefined}
          onDoubleClick={() => {
            if (startEdit(row.key, column)) setActive({ r, c });
          }}
          style={{
            ...pinStyle(position),
            paddingLeft: c === firstDataIndex && row.depth > 0 ? 12 + row.depth * 16 : undefined,
          }}
          className={cn(
            cellBase,
            sticky,
            pinShadow(position),
            alignClass[columnAlign(column)],
            (column.type === "number" || column.type === "currency") && "tabular-nums",
            isEditing && "px-1",
            editable && "cursor-text",
          )}
        >
          {isEditing ? renderEditor(column, r, c) : renderValue(row.row, row.key, column)}
        </td>
      );
    });
    return (
      <tr
        key={row.key}
        aria-rowindex={pageOffset + r + 1}
        aria-selected={selectable ? isSelected : undefined}
        style={{ height: rowHeight }}
        className="group/row text-[13px] text-ink hover:bg-surface-2 aria-selected:bg-accent-soft"
      >
        {cells.slice(0, fillerIndex)}
        <td aria-hidden="true" className="border-line border-b" />
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
          "sticky bottom-0 overflow-hidden border-line border-t bg-surface px-3 font-[650] text-[13px] text-ink @max-sm/grid:px-2",
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

  const rendered = bodyRows.slice(win.start, win.end);
  const colSpan = renderColumns.length + 1;
  const activeFilters = countActiveFilters(filters);
  const rowCount = display.length + 1 + (footer ? 1 : 0);

  useEffect(() => {
    if (page > pages - 1) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  return (
    <div
      className={cn(
        "@container/grid flex min-w-0 max-w-full flex-col overflow-hidden rounded-card border border-line bg-surface text-ink",
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
          groupBy={groupBy}
          columns={columns}
          onUngroup={(id) => setGroup(id, false)}
          density={density}
          onDensity={setDensity}
          hidden={layout.hidden}
          onHidden={grid.setHidden}
          onResetColumns={grid.reset}
          onExport={exportFilename === false ? undefined : exportCsv}
          rowCount={sorted.length}
          selectedCount={selectable ? selection.length : null}
          actions={toolbarActions}
        />
      )}
      <div
        ref={scrollerRef}
        onScroll={syncScroll}
        className="relative min-h-0 overflow-auto overscroll-contain"
        style={paged ? undefined : { maxHeight: height }}
      >
        <table
          ref={gridRef}
          role="grid"
          aria-label={ariaLabel}
          aria-describedby={helpId}
          aria-rowcount={loading ? -1 : rowCount}
          aria-colcount={renderColumns.length}
          aria-multiselectable={selectable || undefined}
          aria-busy={loading || undefined}
          onKeyDown={onGridKeyDown}
          onFocus={onGridFocus}
          className="table-fixed border-separate border-spacing-0"
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
            <tr aria-rowindex={1}>
              {headerCells.slice(0, fillerIndex)}
              <th
                role="presentation"
                className="sticky top-0 z-2 border-line border-b bg-surface"
                style={{ height: headerHeight }}
              />
              {headerCells.slice(fillerIndex)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows.
                <tr key={index} aria-hidden="true" style={{ height: rowHeight }}>
                  {renderColumns.map((entry) => (
                    <td key={idOfColumn(entry)} className={cn(cellBase)}>
                      <span className="block h-2.5 w-3/4 rounded-pill bg-surface-2 motion-safe:animate-pulse" />
                    </td>
                  ))}
                  <td className="border-line border-b" />
                </tr>
              ))
            ) : display.length === 0 ? (
              <tr aria-rowindex={2}>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px] text-ink-3">
                  <div className="sticky left-0 inline-flex max-w-[calc(100cqw-2rem)] flex-col items-center gap-2">
                    <span>
                      {activeFilters > 0 || search
                        ? labels.emptyFiltered
                        : (emptyMessage ?? labels.empty)}
                    </span>
                    {activeFilters > 0 || search ? (
                      <button
                        type="button"
                        className="rounded-control border border-line px-2.5 py-1 font-[600] text-[12.5px] text-ink-2 hover:text-ink"
                        onClick={() => {
                          setFiltersState({});
                          setSearch("");
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
                {win.padTop > 0 ? (
                  <tr aria-hidden="true" style={{ height: win.padTop }}>
                    <td colSpan={colSpan} className="p-0" />
                  </tr>
                ) : null}
                {rendered.map((row, index) => {
                  const r = win.start + index + 1;
                  return row.kind === "group" ? renderGroupRow(row, r) : renderDataRow(row, r);
                })}
                {win.padBottom > 0 ? (
                  <tr aria-hidden="true" style={{ height: win.padBottom }}>
                    <td colSpan={colSpan} className="p-0" />
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
          {footer ? (
            <tfoot>
              <tr aria-rowindex={rowCount} style={{ height: rowHeight }}>
                {footerCells.slice(0, fillerIndex)}
                <td
                  role="presentation"
                  className="sticky bottom-0 z-2 border-line border-t bg-surface"
                />
                {footerCells.slice(fillerIndex)}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p id={helpId} className="sr-only">
        {labels.keyboardHelp}
      </p>
      {loading ? (
        <p className="sr-only" role="status">
          {labels.loading}
        </p>
      ) : null}
      {paged && display.length > 0 ? (
        <Pagination
          labels={labels}
          page={currentPage}
          pages={pages}
          pageSize={pageSize}
          total={display.length}
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
      className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-line border-t px-2 py-1.5 text-[12.5px] text-ink-2"
    >
      <label className="flex items-center gap-2">
        <span>{labels.rowsPerPage}</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className="h-8 rounded-control border border-line-control bg-surface px-1.5 text-[12.5px] text-ink"
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
