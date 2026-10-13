/** One point of a line or scatter chart in drawing coordinates; `null` is a gap. */
export type HitPoint = { x: number; y: number } | null | undefined;

/**
 * Index of the point whose x is nearest to `x`, or -1 when there is none. Gap-free: for line and
 * area charts, where the whole column of a point belongs to it. Gaps (`null`) are skipped.
 */
export function nearestX(points: ArrayLike<HitPoint>, x: number): number {
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    const d = Math.abs(point.x - x);
    if (d < distance) {
      distance = d;
      best = i;
    }
  }
  return best;
}

/**
 * Index of the point nearest to (`x`, `y`) within `radius` pixels, or -1. Use it for scatter and
 * line charts with the `radius` that `hit` receives: it is a few pixels for a mouse and the
 * `--touch-target` token (44px by default) for a finger or pen, so a 2px line is easy to tap.
 */
export function nearestPoint(
  points: ArrayLike<HitPoint>,
  x: number,
  y: number,
  radius: number,
): number {
  let best = -1;
  let distance = radius * radius;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    const d = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (d <= distance) {
      distance = d;
      best = i;
    }
  }
  return best;
}
