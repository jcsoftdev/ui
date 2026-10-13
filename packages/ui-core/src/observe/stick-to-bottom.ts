/** Chat-log scrolling: stay pinned to the newest content until the reader scrolls away. */
export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Distance in px from the bottom that still counts as "at the bottom". */
export const STICK_THRESHOLD = 48;

/** Distance in px (never negative) between the viewport bottom and the content bottom. */
export function distanceFromBottom(m: ScrollMetrics): number {
  return Math.max(0, m.scrollHeight - m.scrollTop - m.clientHeight);
}

export function isNearBottom(m: ScrollMetrics, threshold = STICK_THRESHOLD): boolean {
  return distanceFromBottom(m) <= threshold;
}

/**
 * Next "stuck to bottom" state after a scroll event. Reaching the bottom sticks; scrolling up
 * unsticks; a scroll event with no upward movement (content grew under a stuck viewport) keeps the
 * previous state so streaming text never drops the lock by itself.
 */
export function nextStuck(
  prevStuck: boolean,
  metrics: ScrollMetrics,
  prevScrollTop: number,
  threshold = STICK_THRESHOLD,
): boolean {
  if (isNearBottom(metrics, threshold)) return true;
  if (metrics.scrollTop < prevScrollTop) return false;
  return prevStuck;
}

/** The "jump to latest" button shows only when the user left the bottom. */
export function showJumpToLatest(stuck: boolean, metrics: ScrollMetrics): boolean {
  return !stuck && !isNearBottom(metrics);
}

export interface StickToBottomOptions {
  scroller: HTMLElement;
  /** The growing child; its resizes keep the view pinned while stuck. */
  content: Element;
  /** Fires when the "jump to latest" affordance should show or hide. */
  onJumpChange?: (show: boolean) => void;
}

export interface StickToBottom {
  readonly stuck: boolean;
  scrollToBottom(smooth?: boolean): void;
  /** Re-sticks and scrolls (the jump button). */
  jump(smooth?: boolean): void;
  destroy(): void;
}

/** Chat-log scrolling: follows new content while the reader is at the bottom, lets go on scroll up. */
export function createStickToBottom({
  scroller,
  content,
  onJumpChange,
}: StickToBottomOptions): StickToBottom {
  let stuck = true;
  let lastTop = 0;
  let shown = false;
  const report = (show: boolean) => {
    if (show === shown) return;
    shown = show;
    onJumpChange?.(show);
  };
  const toBottom = (smooth = false) =>
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  const onScroll = () => {
    stuck = nextStuck(stuck, scroller, lastTop);
    lastTop = scroller.scrollTop;
    report(showJumpToLatest(stuck, scroller));
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  toBottom();
  const resizer =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          if (stuck) toBottom();
          else report(showJumpToLatest(false, scroller));
        });
  resizer?.observe(content);
  return {
    get stuck() {
      return stuck;
    },
    scrollToBottom: toBottom,
    jump(smooth = false) {
      stuck = true;
      report(false);
      toBottom(smooth);
    },
    destroy() {
      scroller.removeEventListener("scroll", onScroll);
      resizer?.disconnect();
    },
  };
}
