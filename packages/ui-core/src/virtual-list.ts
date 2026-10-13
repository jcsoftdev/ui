export interface VirtualWindowInput {
  count: number;
  rowHeight: number;
  /** Height available to rows. */
  viewportHeight: number;
  scrollTop: number;
  /** Extra rows rendered above and below the visible ones. Default 6. */
  overscan?: number;
}

export interface VirtualWindow {
  /** First rendered index. */
  start: number;
  /** One past the last rendered index. */
  end: number;
  /** Height of the spacer above the rendered rows. */
  padTop: number;
  /** Height of the spacer below the rendered rows. */
  padBottom: number;
  totalHeight: number;
}

/** Window of a list whose rows all have the same height. */
export function computeVirtualWindow({
  count,
  rowHeight,
  viewportHeight,
  scrollTop,
  overscan = 6,
}: VirtualWindowInput): VirtualWindow {
  const total = Math.max(0, count) * rowHeight;
  if (count <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight: 0 };
  }
  const maxScroll = Math.max(0, total - viewportHeight);
  const top = Math.min(Math.max(0, scrollTop), maxScroll);
  const firstVisible = Math.floor(top / rowHeight);
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 1;
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(count, firstVisible + visible + overscan);
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: (count - end) * rowHeight,
    totalHeight: total,
  };
}

/** Scroll position that brings row `index` fully into view, moving as little as possible. */
export function scrollTopToReveal(
  index: number,
  rowHeight: number,
  viewportHeight: number,
  scrollTop: number,
): number {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return Math.max(0, bottom - viewportHeight);
  return scrollTop;
}

/**
 * Like `scrollTopToReveal` for a row at any `top` with any `height`, keeping it clear of rows that
 * stay on screen on their own (pinned rows): `insetTop` / `insetBottom` px of the viewport.
 */
export function scrollTopToRevealSpan(
  top: number,
  height: number,
  viewportHeight: number,
  scrollTop: number,
  insetTop = 0,
  insetBottom = 0,
): number {
  const bottom = top + height;
  if (top < scrollTop + insetTop) return Math.max(0, top - insetTop);
  if (bottom > scrollTop + viewportHeight - insetBottom) {
    return Math.max(0, bottom - viewportHeight + insetBottom);
  }
  return scrollTop;
}

/** Rows that fit in the viewport: the PageUp/PageDown step. */
export function pageStep(rowHeight: number, viewportHeight: number): number {
  return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
}

export interface VariableWindow {
  start: number;
  end: number;
  /** `offsets[i]` is the top of row `i`; the last entry is the total height. */
  offsets: number[];
  totalHeight: number;
}

/** Window of a list whose rows have different heights (`heights[i]` is row `i`). */
export function computeVariableWindow(input: {
  heights: readonly number[];
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
}): VariableWindow {
  const { heights, viewportHeight, scrollTop, overscan = 6 } = input;
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < heights.length; i += 1) {
    offsets[i + 1] = (offsets[i] as number) + (heights[i] as number);
  }
  const totalHeight = offsets[heights.length] as number;
  if (heights.length === 0) return { start: 0, end: 0, offsets, totalHeight };
  const top = Math.min(Math.max(0, scrollTop), Math.max(0, totalHeight - viewportHeight));
  const bottom = top + Math.max(0, viewportHeight);
  let low = 0;
  let high = heights.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((offsets[mid + 1] as number) <= top) low = mid + 1;
    else high = mid;
  }
  const first = low;
  let last = first;
  while (last < heights.length && (offsets[last] as number) < bottom) last += 1;
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(heights.length, last + overscan),
    offsets,
    totalHeight,
  };
}

export interface VirtualListOptions {
  /** Row count. */
  count: () => number;
  /** Fixed row height in px. Omit it to measure rows (see `estimateHeight`). */
  rowHeight?: number;
  /** Height used for rows not measured yet. Default 40. Only for measured lists. */
  estimateHeight?: number;
  overscan?: number;
  /** Called with the new window whenever it, the viewport or a measured height changes. */
  onChange: (window: VirtualWindow) => void;
}

export interface VirtualList {
  /** Latest window. */
  readonly window: VirtualWindow;
  /** Scrolls row `index` into view with the least movement. */
  scrollToIndex(index: number): void;
  /** Records the real height of a rendered row (measured lists). Cheap to call each render. */
  measure(index: number, height: number): void;
  /** Recomputes after `count` changed. */
  update(): void;
  destroy(): void;
}

/**
 * Windowing for a scroll container. Fixed rows use arithmetic only. Measured rows keep a height
 * cache seeded with `estimateHeight`; feed it real heights through `measure` (or let
 * `observe` do it with a ResizeObserver) and the offsets stay exact. The caller renders rows
 * `start..end` between two spacers of `padTop` and `padBottom`.
 */
export function createVirtualList(scroller: HTMLElement, options: VirtualListOptions): VirtualList {
  const fixed = options.rowHeight;
  const estimate = options.estimateHeight ?? 40;
  const heights = new Map<number, number>();
  let current: VirtualWindow = { start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight: 0 };
  let offsets: number[] = [0];

  const compute = (): VirtualWindow => {
    const count = options.count();
    const input = { viewportHeight: scroller.clientHeight, scrollTop: scroller.scrollTop };
    if (fixed !== undefined) {
      return computeVirtualWindow({
        ...input,
        count,
        rowHeight: fixed,
        overscan: options.overscan,
      });
    }
    const list = Array.from({ length: count }, (_, i) => heights.get(i) ?? estimate);
    const win = computeVariableWindow({ ...input, heights: list, overscan: options.overscan });
    offsets = win.offsets;
    return {
      start: win.start,
      end: win.end,
      padTop: win.offsets[win.start] as number,
      padBottom: win.totalHeight - (win.offsets[win.end] as number),
      totalHeight: win.totalHeight,
    };
  };

  const same = (a: VirtualWindow, b: VirtualWindow) =>
    a.start === b.start &&
    a.end === b.end &&
    a.padTop === b.padTop &&
    a.padBottom === b.padBottom &&
    a.totalHeight === b.totalHeight;

  const update = () => {
    const next = compute();
    if (same(next, current)) return;
    current = next;
    options.onChange(next);
  };

  const resizeObserver =
    typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
  resizeObserver?.observe(scroller);
  scroller.addEventListener("scroll", update, { passive: true });
  update();

  return {
    get window() {
      return current;
    },
    scrollToIndex(index) {
      const viewport = scroller.clientHeight;
      if (fixed !== undefined) {
        scroller.scrollTop = scrollTopToReveal(index, fixed, viewport, scroller.scrollTop);
        return;
      }
      compute();
      const top = offsets[index] ?? 0;
      const height = (offsets[index + 1] ?? top) - top;
      scroller.scrollTop = scrollTopToRevealSpan(top, height, viewport, scroller.scrollTop);
    },
    measure(index, height) {
      if (fixed !== undefined || height <= 0 || heights.get(index) === height) return;
      heights.set(index, height);
      update();
    },
    update,
    destroy() {
      resizeObserver?.disconnect();
      scroller.removeEventListener("scroll", update);
    },
  };
}
