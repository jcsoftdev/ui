export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Gap (px) a pointer may sit in between two adjacent cells and still count as on the nearest one. */
export const GUTTER_SNAP = 6;

/**
 * The item whose box contains `(x, y)`, else the nearest box within `radius` px, else null. Later
 * items win ties, like paint order. Crossing the thin gutter between two cells therefore goes A to
 * B without an empty frame in between.
 */
export function boxAt<T>(
  items: readonly T[],
  x: number,
  y: number,
  box: (item: T) => Box,
  radius: number = GUTTER_SNAP,
): T | null {
  let best: T | null = null;
  let gap = radius;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i] as T;
    const { x0, y0, x1, y1 } = box(item);
    const dx = Math.max(x0 - x, 0, x - x1);
    const dy = Math.max(y0 - y, 0, y - y1);
    if (dx === 0 && dy === 0) return item;
    const distance = Math.hypot(dx, dy);
    if (distance <= gap && (best === null || distance < gap)) {
      best = item;
      gap = distance;
    }
  }
  return best;
}
