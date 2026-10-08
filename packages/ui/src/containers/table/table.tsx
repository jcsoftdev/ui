"use client";

import { ArrowLeftToLine, ArrowRightToLine, PinOff } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import {
  computePinOffsets,
  type PinnedColumns,
  type PinPosition,
  type PinSide,
  parseStoredPins,
  sanitizePinned,
  setColumnPin,
} from "./pin.js";

export type { PinnedColumns, PinSide } from "./pin.js";

export interface TableLabels {
  pinLeft: string;
  pinRight: string;
  unpin: string;
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
  ...props
}: TableProps) {
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

  return (
    <PinContext.Provider value={context}>
      <div
        ref={wrapperRef}
        onScroll={measure}
        className={cn("@container/table max-w-full overflow-x-auto", wrapperClassName)}
      >
        <table
          ref={tableRef}
          className={cn("w-full border-collapse text-[13px]", className)}
          {...props}
        />
      </div>
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
    shadowed &&
      (position.side === "left"
        ? "shadow-[6px_0_8px_-6px_rgb(0_0_0/0.28)]"
        : "shadow-[-6px_0_8px_-6px_rgb(0_0_0/0.28)]"),
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

export function TableHeaderCell({
  className,
  alignRight,
  columnId,
  pinnable,
  children,
  style,
  ...props
}: ComponentPropsWithoutRef<"th"> & AlignProps & { pinnable?: boolean }): ReactNode {
  const pinned = usePinnedCell(columnId, true);
  const showPin = pinnable && columnId && pinned.context;
  return (
    <th
      className={cn(
        "whitespace-nowrap border-line border-b px-4 py-2.5 text-left font-[650] text-[11px] text-ink-3 uppercase tracking-[.07em] @max-sm/table:px-2.5",
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
          {children}
          <PinButtons columnId={columnId} />
        </span>
      ) : (
        children
      )}
    </th>
  );
}

export function TableRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      className={cn("group/row border-line border-b last:border-b-0 hover:bg-surface-2", className)}
      {...props}
    />
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
  return (
    <td
      className={cn(
        "px-4 py-[11px] align-middle @max-sm/table:px-2.5",
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
  children,
  className,
  ...props
}: TableLinkRowProps) {
  const pinned = usePinnedCell(primaryColumnId, false);
  return (
    <tr
      className={cn(
        "group/row relative border-line border-b last:border-b-0 hover:bg-surface-2",
        className,
      )}
      {...props}
    >
      <td
        className={cn("p-0 align-middle", pinned.className)}
        style={pinned.style}
        {...pinned.attrs}
      >
        <a
          href={href}
          className="block px-4 py-[11px] font-[650] text-ink no-underline before:absolute before:inset-0 before:content-[''] @max-sm/table:px-2.5"
        >
          {primary}
        </a>
      </td>
      {children}
    </tr>
  );
}
