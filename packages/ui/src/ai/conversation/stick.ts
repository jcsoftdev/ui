// Pure decisions behind the stick-to-bottom scroll behavior of <Conversation>.

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
 * unsticks; a scroll event with no upward movement (content grew under a stuck viewport) keeps
 * the previous state so streaming text never drops the lock by itself.
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
