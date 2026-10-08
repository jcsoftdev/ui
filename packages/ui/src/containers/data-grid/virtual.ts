// Fixed-height row windowing: which rows to render for a scroll position, and how to reveal one.

export interface VirtualWindowInput {
  count: number;
  rowHeight: number;
  /** Height available to body rows (scroll viewport minus sticky header and footer). */
  viewportHeight: number;
  scrollTop: number;
  /** Extra rows rendered above and below the visible ones. */
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

/** Rows that fit in the viewport: the PageUp/PageDown step. */
export function pageStep(rowHeight: number, viewportHeight: number): number {
  return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
}

/**
 * Horizontal scroll that reveals a scrolling (unpinned) column at `[left, left + width)` without
 * it hiding under the pinned columns of either edge.
 */
export function scrollLeftToReveal(
  left: number,
  width: number,
  viewportWidth: number,
  scrollLeft: number,
  pinnedLeft: number,
  pinnedRight: number,
): number {
  const start = scrollLeft + pinnedLeft;
  const end = scrollLeft + viewportWidth - pinnedRight;
  if (left < start) return Math.max(0, left - pinnedLeft);
  if (left + width > end) return Math.max(0, left + width - viewportWidth + pinnedRight);
  return scrollLeft;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}
