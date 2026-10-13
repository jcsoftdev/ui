import { computeVirtualWindow, scrollTopToReveal, type VirtualWindow } from "../virtual-list.js";

export interface ColumnWindow {
  /** First rendered column of the zone (index into the zone's column list). */
  start: number;
  /** One past the last rendered column. */
  end: number;
}

/**
 * Columns of one zone that intersect `[from, to)`, in the zone's own coordinates (`offsets[i]` is
 * where column `i` starts, the last entry is the zone's width). `overscan` extra columns on each
 * side. Binary search, so 10 000 columns cost the same as 10.
 */
export function computeColumnWindow(
  offsets: readonly number[],
  from: number,
  to: number,
  overscan = 2,
): ColumnWindow {
  const count = offsets.length - 1;
  if (count <= 0 || to <= from) return { start: 0, end: 0 };
  const total = offsets[count] as number;
  if (to <= 0 || from >= total) return { start: 0, end: 0 };
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((offsets[mid + 1] as number) <= from) low = mid + 1;
    else high = mid;
  }
  const first = low;
  low = first;
  high = count;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((offsets[mid] as number) < to) low = mid + 1;
    else high = mid;
  }
  return { start: Math.max(0, first - overscan), end: Math.min(count, low + overscan) };
}

/**
 * Horizontal scroll that reveals a scrolling column at `[left, left + width)` without it hiding
 * under the pinned zones. All values are logical (distance from the inline start), so callers
 * negate `scrollLeft` themselves in right-to-left.
 */
export function scrollInlineToReveal(
  left: number,
  width: number,
  viewportWidth: number,
  scroll: number,
  insetStart: number,
  insetEnd: number,
): number {
  const start = scroll + insetStart;
  const end = scroll + viewportWidth - insetEnd;
  if (left < start) return Math.max(0, left - insetStart);
  if (left + width > end) return Math.max(0, left + width - viewportWidth + insetEnd);
  return scroll;
}

export interface GridWindow {
  rows: VirtualWindow;
  /** Window over the scrolling (center) columns. */
  columns: ColumnWindow;
}

export interface GridViewportOptions {
  rowCount: () => number;
  rowHeight: () => number;
  /** Height of the sticky header, subtracted from the viewport. */
  headerHeight: () => number;
  /** Offsets of the scrolling columns (see `columnOffsets`). */
  centerOffsets: () => readonly number[];
  /** Width of the start-pinned zone: where the scrolling columns begin. */
  insetStart: () => number;
  rtl: () => boolean;
  overscanRows?: number;
  overscanColumns?: number;
  /** Called only when the rendered window changed. */
  onChange: (window: GridWindow) => void;
}

export interface GridViewport {
  readonly window: GridWindow;
  /** Recomputes now (data, widths or layout changed). Notifies only when the window moved. */
  update(force?: boolean): void;
  /** Scrolls row `index` (0-based body row) into view. */
  scrollToRow(index: number): void;
  /** Scrolls scrolling-column `index` into view. */
  scrollToColumn(index: number, insetEnd: number): void;
  destroy(): void;
}

const EMPTY: GridWindow = {
  rows: { start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight: 0 },
  columns: { start: 0, end: 0 },
};

/**
 * Two-axis windowing for a scroll container: rows by arithmetic (`virtual-list`), columns by binary
 * search over their offsets. Scroll events already fire once per frame, so there is no extra rAF
 * hop; a scroll that stays inside the rendered window does no work beyond two comparisons.
 */
export function createGridViewport(
  scroller: HTMLElement,
  options: GridViewportOptions,
): GridViewport {
  let current = EMPTY;

  const compute = (): GridWindow => {
    const height = Math.max(0, scroller.clientHeight - options.headerHeight());
    const rows = computeVirtualWindow({
      count: options.rowCount(),
      rowHeight: options.rowHeight(),
      viewportHeight: height,
      scrollTop: scroller.scrollTop,
      overscan: options.overscanRows,
    });
    const inset = options.insetStart();
    const scrollInline = Math.abs(scroller.scrollLeft);
    const columns = computeColumnWindow(
      options.centerOffsets(),
      scrollInline - inset,
      scrollInline - inset + scroller.clientWidth,
      options.overscanColumns,
    );
    return { rows, columns };
  };

  const same = (a: GridWindow, b: GridWindow) =>
    a.rows.start === b.rows.start &&
    a.rows.end === b.rows.end &&
    a.rows.totalHeight === b.rows.totalHeight &&
    a.columns.start === b.columns.start &&
    a.columns.end === b.columns.end;

  const update = (force = false) => {
    const next = compute();
    if (!force && same(next, current)) return;
    current = next;
    options.onChange(next);
  };

  const observer =
    typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => update());
  observer?.observe(scroller);
  const onScroll = () => update();
  scroller.addEventListener("scroll", onScroll, { passive: true });
  update(true);

  return {
    get window() {
      return current;
    },
    update,
    scrollToRow(index) {
      const rowHeight = options.rowHeight();
      const viewport = Math.max(0, scroller.clientHeight - options.headerHeight());
      scroller.scrollTop = scrollTopToReveal(index, rowHeight, viewport, scroller.scrollTop);
    },
    scrollToColumn(index, insetEnd) {
      const offsets = options.centerOffsets();
      const left = (offsets[index] ?? 0) + options.insetStart();
      const width = (offsets[index + 1] ?? left) - (offsets[index] ?? 0);
      const sign = options.rtl() ? -1 : 1;
      const next = scrollInlineToReveal(
        left,
        width,
        scroller.clientWidth,
        Math.abs(scroller.scrollLeft),
        options.insetStart(),
        insetEnd,
      );
      scroller.scrollLeft = sign * next;
    },
    destroy() {
      observer?.disconnect();
      scroller.removeEventListener("scroll", onScroll);
    },
  };
}
