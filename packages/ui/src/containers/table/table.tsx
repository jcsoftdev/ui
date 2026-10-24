"use client";

import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Checkbox } from "../../atoms/checkbox/checkbox.js";
import { useUiStrings } from "../../i18n/index.js";
import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  ChevronsUpDown,
  PinOff,
} from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { CELL_PY } from "./cell-padding.js";
import {
  computePinOffsets,
  type PinnedColumns,
  type PinPosition,
  type PinSide,
  parseStoredPins,
  sanitizePinned,
  setColumnPin,
} from "./pin.js";
import { formatSelectRow, selectAllState, setKeys, toggleKey } from "./selection.js";
import { ariaSortFor, nextTableSort, type TableSort } from "./sort.js";

export type { PinnedColumns, PinSide } from "./pin.js";
export {
  type AriaSort,
  ariaSortFor,
  nextTableSort,
  type TableSort,
  type TableSortDirection,
} from "./sort.js";

export interface TableLabels {
  pinLeft: string;
  pinRight: string;
  unpin: string;
  /** Name of a row checkbox; `{row}` is replaced by the cell's `label`. Defaults to the UI string. */
  selectRow?: string;
  /** Name of the select-all checkbox. Defaults to the UI string. */
  selectAll?: string;
  /** Name of the overflow menu trigger of a `TableActionsCell`. Defaults to the UI string. */
  rowActions?: string;
}

const DEFAULT_LABELS: TableLabels = {
  pinLeft: "Fijar a la izquierda",
  pinRight: "Fijar a la derecha",
  unpin: "Desfijar",
};

interface PinContextValue {
  positions: Record<string, PinPosition>;
  scrolledStart: boolean;
  scrolledEnd: boolean;
  labels: TableLabels;
  pin: (columnId: string, side: PinSide | null) => void;
}

const PinContext = createContext<PinContextValue | null>(null);

interface SelectionContextValue {
  selected: readonly string[];
  toggle: (key: string) => void;
  setMany: (keys: readonly string[], on: boolean) => void;
  labels: TableLabels;
}

/** `null` while the table has no selection props, so rows stay plain. */
const SelectionContext = createContext<SelectionContextValue | null>(null);

interface SortContextValue {
  sort: TableSort | null;
  toggle: (columnId: string) => void;
}

/** `null` while the table has no sort props, so `sortable` headers stay plain. */
const SortContext = createContext<SortContextValue | null>(null);

/** Ids of the columns the table hides; empty by default. */
const HiddenContext = createContext<ReadonlySet<string>>(new Set());

const FLUSH_START = "[&_:is(th,td):first-child]:pl-0 [&_td:first-child>a]:pl-0";
const FLUSH_END = "[&_:is(th,td):last-child]:pr-0 [&_td:last-child>a]:pr-0";
/**
 * Row density. Each sets `--row-min-h` (the least a body row measures, whatever it holds) and
 * `--table-cell-py` (the vertical cell padding), so a row of text and a row holding a 30px control
 * come out the same height. Override either variable with `className` or `style` to tune it.
 */
export type TableDensity = "comfortable" | "compact";

const DENSITY: Readonly<Record<TableDensity, string>> = {
  comfortable: "[--row-min-h:48px] [--table-cell-py:--spacing(2)]",
  compact: "[--row-min-h:40px] [--table-cell-py:--spacing(1)]",
};
// A table row's `height` works as a minimum: content taller than it still grows the row.
const ROW_MIN_HEIGHT = "[&>tbody>tr]:h-(--row-min-h)";

// The last column (the actions one) sticks to the right edge from 24rem of the wrapper's width, so
// it stays reachable while the other columns scroll under it; a narrower table scrolls it along,
// since a pinned column would take most of a phone screen. Sticky cells in a collapsed-border table
// lose their bottom border, so an inset shadow redraws it, and the edge shadow shows only while
// columns are hidden underneath.
// Written out in full (no interpolation) so Tailwind finds every class in the source.
const STICKY_ACTIONS = cn(
  "@sm/table:[&_:is(th,td):last-child]:sticky @sm/table:[&_:is(th,td):last-child]:right-0 @sm/table:[&_:is(th,td):last-child]:bg-surface",
  "@sm/table:[&_td:last-child]:z-1 @sm/table:[&_th:last-child]:z-2",
  "@sm/table:[&_tr:hover>td:last-child]:bg-surface-2 @sm/table:[&_tr[data-selected]>td:last-child]:bg-accent-soft",
  "@sm/table:[&_:is(th,td):last-child]:[box-shadow:var(--sticky-divider,0_0_transparent),var(--sticky-edge,0_0_transparent)]",
  "[&_th:last-child]:[--sticky-divider:inset_0_-1px_0_var(--border-color-divider)] [&_tbody>tr:not(:last-child)>td:last-child]:[--sticky-divider:inset_0_-1px_0_var(--border-color-divider)]",
);
const STICKY_EDGE = "[&_:is(th,td):last-child]:[--sticky-edge:var(--shadow-pinned-end)]";

const STICKY_HEADER =
  "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-2 [&_thead_th]:bg-surface [&_thead_th]:shadow-[inset_0_-1px_0_var(--border-color-divider)]";

export interface TableProps extends ComponentPropsWithoutRef<"table"> {
  /** Controlled pinned columns (ids of `columnId`). Pair it with `onPinnedColumnsChange`. */
  pinnedColumns?: PinnedColumns;
  /** Initial pins when uncontrolled. */
  defaultPinnedColumns?: PinnedColumns;
  onPinnedColumnsChange?: (pinned: { left: string[]; right: string[] }) => void;
  /** localStorage key that remembers the user's pins (uncontrolled only). */
  pinStorageKey?: string;
  /** Texts of the pin buttons (Spanish by default). */
  labels?: Partial<TableLabels>;
  /** Classes of the scroll wrapper. */
  wrapperClassName?: string;
  /**
   * Drops the outer cell padding of the first (`"start"`), last (`"end"`) or both (`true`) columns,
   * so their content sits on the container edge and the page layout owns the gutter. The padding
   * between columns stays.
   */
  flush?: boolean | "start" | "end";
  /**
   * Keeps the header row in view while the body scrolls. It sticks inside the scroll wrapper, so
   * give the table a `maxHeight` (or a bounded `wrapperClassName`) for it to have anything to scroll.
   */
  stickyHeader?: boolean;
  /** Caps the wrapper height; the body scrolls vertically past it. Any CSS length. */
  maxHeight?: CSSProperties["maxHeight"];
  /** Controlled selected row keys (the `rowKey` of each `TableRow`). Setting it turns selection on. */
  selectedKeys?: readonly string[];
  /** Initial selected keys when uncontrolled. Setting it turns selection on. */
  defaultSelectedKeys?: readonly string[];
  /** Called with the next keys. Setting it turns selection on. */
  onSelectedKeysChange?: (keys: string[]) => void;
  /**
   * Controlled sort state. Setting it, `defaultSort` or `onSortChange` turns sorting on for the
   * headers marked `sortable`. The table only reports the state: sort your rows yourself.
   */
  sort?: TableSort | null;
  /** Initial sort when uncontrolled. */
  defaultSort?: TableSort | null;
  /** Called with the next sort (`null` when the sort is cleared). */
  onSortChange?: (sort: TableSort | null) => void;
  /** Ids (`columnId`) of the columns to hide. Headers and cells with that id render nothing. */
  hiddenColumns?: readonly string[];
  /**
   * Row density: `comfortable` (default) gives every body row at least 48px, `compact` 40px, with
   * the cells centred vertically. Rows never depend on what a cell holds for their height.
   */
  density?: TableDensity;
  /**
   * Keeps the last column (the row actions) stuck to the right edge while the table scrolls
   * sideways, from 24rem of the table's own width up. Leave the last column unpinned when using it.
   */
  stickyActions?: boolean;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode, quota); pins just stop persisting.
  }
}

function sameLists(a: PinnedColumns, b: PinnedColumns): boolean {
  return (
    JSON.stringify([a.left ?? [], a.right ?? []]) === JSON.stringify([b.left ?? [], b.right ?? []])
  );
}

/**
 * Table inside its own horizontal scroll wrapper. Give columns a `columnId` (header and cells)
 * and mark header cells `pinnable` to let the user pin them to the left or right edge: pinned
 * columns stay sticky while the rest scrolls.
 */
export function Table({
  className,
  wrapperClassName,
  pinnedColumns,
  defaultPinnedColumns,
  onPinnedColumnsChange,
  pinStorageKey,
  labels,
  flush,
  stickyHeader,
  maxHeight,
  selectedKeys,
  defaultSelectedKeys,
  onSelectedKeysChange,
  sort,
  defaultSort,
  onSortChange,
  hiddenColumns,
  density = "comfortable",
  stickyActions,
  ...props
}: TableProps) {
  const strings = useUiStrings();
  const selectionOn =
    selectedKeys !== undefined ||
    defaultSelectedKeys !== undefined ||
    onSelectedKeysChange !== undefined;
  const [selected, setSelected] = useControllableState<readonly string[]>({
    prop: selectedKeys,
    defaultProp: defaultSelectedKeys ?? [],
    onChange: onSelectedKeysChange ? (keys) => onSelectedKeysChange([...keys]) : undefined,
  });
  const sortOn = sort !== undefined || defaultSort !== undefined || onSortChange !== undefined;
  const [currentSort, setSort] = useControllableState<TableSort | null>({
    prop: sort,
    defaultProp: defaultSort ?? null,
    onChange: onSortChange,
  });
  const sortContext: SortContextValue | null = sortOn
    ? { sort: currentSort, toggle: (columnId) => setSort(nextTableSort(currentSort, columnId)) }
    : null;
  const hiddenKey = (hiddenColumns ?? []).join("\u0000");
  // biome-ignore lint/correctness/useExhaustiveDependencies: hiddenKey is the content of hiddenColumns
  const hidden = useMemo(() => new Set(hiddenColumns ?? []), [hiddenKey]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const controlled = pinnedColumns !== undefined;
  const [internal, setInternal] = useState<PinnedColumns>(defaultPinnedColumns ?? {});
  const [knownIds, setKnownIds] = useState<string[] | null>(null);
  const [positions, setPositions] = useState<Record<string, PinPosition>>({});
  const [scrolled, setScrolled] = useState({ start: false, end: false });

  useEffect(() => {
    if (!pinStorageKey || controlled) return;
    const stored = parseStoredPins(readStorage(pinStorageKey));
    if (stored) setInternal(stored);
  }, [pinStorageKey, controlled]);

  const pinned = sanitizePinned((controlled ? pinnedColumns : internal) ?? {}, knownIds);
  const pinnedKey = JSON.stringify(pinned);

  const measure = useCallback(() => {
    const table = tableRef.current;
    const wrapper = wrapperRef.current;
    if (!table || !wrapper) return;
    const ids: string[] = [];
    const widths: Record<string, number> = {};
    for (const cell of table.querySelectorAll<HTMLElement>("thead [data-column-id]")) {
      const id = cell.dataset.columnId;
      if (!id) continue;
      ids.push(id);
      widths[id] = cell.getBoundingClientRect().width;
    }
    setKnownIds((previous) =>
      previous && previous.length === ids.length && previous.every((id, i) => id === ids[i])
        ? previous
        : ids,
    );
    const next = computePinOffsets(widths, JSON.parse(pinnedKey));
    setPositions((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    );
    const start = wrapper.scrollLeft > 0;
    const end = wrapper.scrollLeft + wrapper.clientWidth < wrapper.scrollWidth - 1;
    setScrolled((previous) =>
      previous.start === start && previous.end === end ? previous : { start, end },
    );
  }, [pinnedKey]);

  useLayoutEffect(() => {
    measure();
    const table = tableRef.current;
    const wrapper = wrapperRef.current;
    if (!table || !wrapper) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(wrapper);
    resize.observe(table);
    for (const cell of table.querySelectorAll("thead [data-column-id]")) resize.observe(cell);
    const mutation = new MutationObserver(schedule);
    mutation.observe(table, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
    };
  }, [measure]);

  const pin = useCallback(
    (columnId: string, side: PinSide | null) => {
      const next = setColumnPin(pinned, columnId, side, knownIds ?? []);
      if (sameLists(next, pinned)) return;
      if (!controlled) {
        setInternal(next);
        if (pinStorageKey) writeStorage(pinStorageKey, JSON.stringify(next));
      }
      onPinnedColumnsChange?.(next);
    },
    [pinned, knownIds, controlled, pinStorageKey, onPinnedColumnsChange],
  );

  const context: PinContextValue = {
    positions,
    scrolledStart: scrolled.start,
    scrolledEnd: scrolled.end,
    labels: { ...DEFAULT_LABELS, ...labels },
    pin,
  };

  const selection: SelectionContextValue | null = selectionOn
    ? {
        selected,
        toggle: (key) => setSelected(toggleKey(selected, key)),
        setMany: (keys, on) => setSelected(setKeys(selected, keys, on)),
        labels: {
          ...context.labels,
          selectRow: labels?.selectRow ?? strings.selectRow,
          selectAll: labels?.selectAll ?? strings.selectAll,
          rowActions: labels?.rowActions ?? strings.rowActions,
        },
      }
    : null;

  return (
    <PinContext.Provider value={context}>
      <SelectionContext.Provider value={selection}>
        <SortContext.Provider value={sortContext}>
          <HiddenContext.Provider value={hidden}>
            <div
              ref={wrapperRef}
              onScroll={measure}
              style={maxHeight !== undefined ? { maxHeight } : undefined}
              tabIndex={maxHeight !== undefined ? 0 : undefined}
              className={cn(
                "@container/table max-w-full overflow-x-auto",
                maxHeight !== undefined && "overflow-y-auto focus-visible:focus-ring",
                wrapperClassName,
              )}
            >
              <table
                ref={tableRef}
                data-table-density={density}
                className={cn(
                  "w-full border-collapse text-fs-130",
                  DENSITY[density],
                  ROW_MIN_HEIGHT,
                  stickyActions && STICKY_ACTIONS,
                  stickyActions && scrolled.end && STICKY_EDGE,
                  (flush === true || flush === "start") && FLUSH_START,
                  (flush === true || flush === "end") && FLUSH_END,
                  stickyHeader && STICKY_HEADER,
                  className,
                )}
                {...props}
              />
            </div>
          </HiddenContext.Provider>
        </SortContext.Provider>
      </SelectionContext.Provider>
    </PinContext.Provider>
  );
}

export function TableHead(props: ComponentPropsWithoutRef<"thead">) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentPropsWithoutRef<"tbody">) {
  return <tbody {...props} />;
}

interface ColumnProps {
  /** Identifies the column so it can be pinned. Use the same id on the header and its cells. */
  columnId?: string;
}

interface AlignProps extends ColumnProps {
  alignRight?: boolean;
}

/** Sticky styles and data attributes of a cell in a pinned column (empty otherwise). */
function usePinnedCell(columnId: string | undefined, header: boolean) {
  const context = useContext(PinContext);
  const position = columnId ? context?.positions[columnId] : undefined;
  if (!context || !columnId) return { context, attrs: {}, className: "", style: undefined };
  const attrs = { "data-column-id": columnId, "data-pinned": position?.side };
  if (!position) return { context, attrs, className: "", style: undefined };
  const shadowed =
    position.edge && (position.side === "left" ? context.scrolledStart : context.scrolledEnd);
  const className = cn(
    "sticky bg-surface",
    header
      ? "z-2"
      : "z-1 group-hover/row:bg-surface-2 group-aria-selected/row:bg-accent-soft group-data-[selected=true]/row:bg-accent-soft",
    shadowed && (position.side === "left" ? "shadow-pinned-start" : "shadow-pinned-end"),
  );
  const style: CSSProperties = { [position.side]: position.offset };
  return { context, attrs, className, style };
}

function PinButtons({ columnId }: { columnId: string }) {
  const context = useContext(PinContext);
  if (!context) return null;
  const side = context.positions[columnId]?.side;
  const button =
    "grid size-5 shrink-0 place-items-center rounded-xs text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:text-ink";
  if (side) {
    return (
      <button
        type="button"
        aria-pressed="true"
        aria-label={context.labels.unpin}
        title={context.labels.unpin}
        onClick={() => context.pin(columnId, null)}
        className={cn(button, "text-accent-ink")}
      >
        <PinOff aria-hidden="true" className="size-3.5" />
      </button>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center">
      <button
        type="button"
        aria-pressed="false"
        aria-label={context.labels.pinLeft}
        title={context.labels.pinLeft}
        onClick={() => context.pin(columnId, "left")}
        className={button}
      >
        <ArrowLeftToLine aria-hidden="true" className="size-3.5" />
      </button>
      <button
        type="button"
        aria-pressed="false"
        aria-label={context.labels.pinRight}
        title={context.labels.pinRight}
        onClick={() => context.pin(columnId, "right")}
        className={button}
      >
        <ArrowRightToLine aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  );
}

function SortButton({
  columnId,
  context,
  children,
}: {
  columnId: string;
  context: SortContextValue;
  children: ReactNode;
}) {
  const direction = ariaSortFor(context.sort, columnId);
  const Icon =
    direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => context.toggle(columnId)}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded-xs px-1 font-[inherit] text-[length:inherit] uppercase tracking-[inherit] hover:text-ink focus-visible:focus-ring",
        direction !== "none" ? "text-ink" : "text-inherit",
      )}
    >
      {children}
      <Icon
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", direction === "none" && "opacity-50")}
      />
    </button>
  );
}

export function TableHeaderCell({
  className,
  alignRight,
  columnId,
  pinnable,
  sortable,
  children,
  style,
  ...props
}: ComponentPropsWithoutRef<"th"> &
  AlignProps & {
    pinnable?: boolean;
    /**
     * Makes the header a button that cycles the sort (ascending, descending, off) and reports it
     * as `aria-sort`. Needs a `columnId` and a `Table` with `sort`, `defaultSort` or `onSortChange`.
     */
    sortable?: boolean;
  }): ReactNode {
  const pinned = usePinnedCell(columnId, true);
  const hiddenIds = useContext(HiddenContext);
  const sortContext = useContext(SortContext);
  if (columnId && hiddenIds.has(columnId)) return null;
  const sorting = sortable && columnId && sortContext ? { columnId, context: sortContext } : null;
  const content = sorting ? (
    <SortButton columnId={sorting.columnId} context={sorting.context}>
      {children}
    </SortButton>
  ) : (
    children
  );
  const showPin = pinnable && columnId && pinned.context;
  return (
    <th
      aria-sort={sorting ? ariaSortFor(sorting.context.sort, sorting.columnId) : undefined}
      className={cn(
        "whitespace-nowrap border-b-divider px-4 py-2.5 text-left font-[650] text-fs-110 text-ink-3 uppercase tracking-[.07em] @max-sm/table:px-2.5",
        alignRight && "text-right",
        pinned.className,
        className,
      )}
      style={{ ...pinned.style, ...style }}
      {...pinned.attrs}
      {...props}
    >
      {showPin ? (
        <span className={cn("inline-flex items-center gap-1", alignRight && "flex-row-reverse")}>
          {content}
          <PinButtons columnId={columnId} />
        </span>
      ) : (
        content
      )}
    </th>
  );
}

export interface TableRowProps extends ComponentPropsWithoutRef<"tr"> {
  /**
   * Identifies the row for selection. In a table with selection the row reports `aria-selected`
   * and highlights when its key is selected.
   */
  rowKey?: string;
}

export function TableRow({ className, rowKey, ...props }: TableRowProps) {
  const selection = useContext(SelectionContext);
  const isSelected =
    selection && rowKey !== undefined ? selection.selected.includes(rowKey) : undefined;
  return (
    <tr
      aria-selected={isSelected}
      data-selected={isSelected || undefined}
      className={cn(
        "group/row border-b-divider last:border-b-0 hover:bg-surface-2",
        isSelected && "bg-accent-soft hover:bg-accent-soft",
        className,
      )}
      {...props}
    />
  );
}

export interface TableSelectCellProps extends ComponentPropsWithoutRef<"td"> {
  /** Key of the row, the same as the row's `rowKey`. */
  rowKey: string;
  /** Names the checkbox: "Select {label}". Defaults to the key. */
  label?: string;
}

/** Cell with the checkbox that selects its row. Needs a `Table` with selection props. */
export function TableSelectCell({ rowKey, label, className, ...props }: TableSelectCellProps) {
  const selection = useContext(SelectionContext);
  if (!selection)
    throw new Error("TableSelectCell needs a Table with selectedKeys or onSelectedKeysChange");
  return (
    <td
      className={cn("w-px px-4 align-middle @max-sm/table:px-2.5", CELL_PY, className)}
      {...props}
    >
      <Checkbox
        checked={selection.selected.includes(rowKey)}
        onCheckedChange={() => selection.toggle(rowKey)}
        aria-label={formatSelectRow(selection.labels.selectRow ?? "", label ?? rowKey)}
      />
    </td>
  );
}

export interface TableSelectAllCellProps extends ComponentPropsWithoutRef<"th"> {
  /** Keys of the rows on screen. The box is checked when all are selected, mixed when some are. */
  rowKeys: readonly string[];
}

/** Header cell with the select-all checkbox for the rows on screen. */
export function TableSelectAllCell({ rowKeys, className, ...props }: TableSelectAllCellProps) {
  const selection = useContext(SelectionContext);
  if (!selection)
    throw new Error("TableSelectAllCell needs a Table with selectedKeys or onSelectedKeysChange");
  const state = selectAllState(selection.selected, rowKeys);
  return (
    <th
      scope="col"
      className={cn(
        "w-px border-b-divider px-4 py-2.5 text-left align-middle @max-sm/table:px-2.5",
        className,
      )}
      {...props}
    >
      <Checkbox
        checked={state}
        onCheckedChange={() => selection.setMany(rowKeys, state !== true)}
        aria-label={selection.labels.selectAll}
      />
    </th>
  );
}

export interface TableActionsCellProps extends ComponentPropsWithoutRef<"td"> {
  /**
   * An overflow menu (a `DropdownMenu` with a trigger, say). When set, it replaces the inline
   * actions under a narrow table container (under 48rem of the wrapper's own width), so the
   * actions never clip or wrap. Without it the inline actions wrap and stay right-aligned.
   */
  menu?: ReactNode;
}

/**
 * Right-aligned cell for row actions (buttons, links). Inline actions wrap onto more lines under
 * a narrow table container instead of clipping; pass `menu` to collapse them into an overflow
 * menu there. The container query is on the table wrapper, never the viewport.
 */
export function TableActionsCell({ menu, className, children, ...props }: TableActionsCellProps) {
  return (
    <td
      className={cn("w-px px-4 text-right align-middle @max-sm/table:px-2.5", CELL_PY, className)}
      {...props}
    >
      <div
        className={cn(
          "inline-flex items-center justify-end gap-1.5",
          menu !== undefined ? "@max-3xl/table:hidden" : "@max-3xl/table:flex-wrap",
        )}
      >
        {children}
      </div>
      {menu !== undefined ? (
        <div className="hidden justify-end @max-3xl/table:inline-flex">{menu}</div>
      ) : null}
    </td>
  );
}

export function TableCell({
  className,
  alignRight,
  columnId,
  style,
  ...props
}: ComponentPropsWithoutRef<"td"> & AlignProps) {
  const pinned = usePinnedCell(columnId, false);
  const hiddenIds = useContext(HiddenContext);
  if (columnId && hiddenIds.has(columnId)) return null;
  return (
    <td
      className={cn(
        "px-4 align-middle @max-sm/table:px-2.5",
        CELL_PY,
        alignRight && "text-right",
        pinned.className,
        className,
      )}
      style={{ ...pinned.style, ...style }}
      {...pinned.attrs}
      {...props}
    />
  );
}

export interface TableLinkRowProps extends Omit<ComponentPropsWithoutRef<"tr">, "children"> {
  /** Row destination: rendered as a real `<a href>` in the first cell. */
  href: string;
  /** Content of the first cell, wrapped by the anchor. */
  primary: ReactNode;
  /** `columnId` of the first cell, so that column can be pinned. */
  primaryColumnId?: string;
  /** Selection key of the row; see `TableRow`. */
  rowKey?: string;
  /** Additional `<td>` cells of the row. */
  children?: ReactNode;
}

/**
 * Fully navigable table row: the real link lives in the first cell and, via a
 * stretched link (positioned `<tr>` + anchor `::before` at `inset-0`), its
 * click area covers the whole row without duplicating the link per cell.
 */
export function TableLinkRow({
  href,
  primary,
  primaryColumnId,
  rowKey,
  children,
  className,
  ...props
}: TableLinkRowProps) {
  const pinned = usePinnedCell(primaryColumnId, false);
  const hiddenIds = useContext(HiddenContext);
  const selection = useContext(SelectionContext);
  const isSelected =
    selection && rowKey !== undefined ? selection.selected.includes(rowKey) : undefined;
  return (
    <tr
      aria-selected={isSelected}
      data-selected={isSelected || undefined}
      className={cn(
        "group/row relative border-b-divider last:border-b-0 hover:bg-surface-2",
        isSelected && "bg-accent-soft hover:bg-accent-soft",
        className,
      )}
      {...props}
    >
      {primaryColumnId && hiddenIds.has(primaryColumnId) ? null : (
        <td
          className={cn("p-0 align-middle", pinned.className)}
          style={pinned.style}
          {...pinned.attrs}
        >
          <a
            href={href}
            className={cn(
              "block px-4 font-[650] text-ink no-underline before:absolute before:inset-0 before:content-[''] @max-sm/table:px-2.5",
              CELL_PY,
            )}
          >
            {primary}
          </a>
        </td>
      )}
      {children}
    </tr>
  );
}
