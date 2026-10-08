export interface IndexedPoint {
  x: number;
  y: number;
  /** Mark radius in pixels (0 for plain points). */
  r?: number;
}

export interface PointIndex {
  /**
   * Index of the mark closest to `(x, y)` within `radius` pixels of its edge
   * (a pointer inside a mark counts as distance 0), or null. Ties go to the
   * smaller mark, so a small bubble inside a big one stays reachable.
   */
  nearest(x: number, y: number, radius?: number): number | null;
}

/**
 * Uniform-grid spatial index for high-density scatter plots. Building is
 * O(n), a lookup only visits the few buckets around the pointer, so hit
 * testing 50 000 points costs microseconds instead of a full scan.
 */
export function createPointIndex(
  points: ReadonlyArray<IndexedPoint | null>,
  cellSize = 24,
): PointIndex {
  const cell = Math.max(4, cellSize);
  const buckets = new Map<number, number[]>();
  let maxRadius = 0;
  const key = (cx: number, cy: number) => cx * 73_856_093 + cy * 19_349_663;
  points.forEach((point, index) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    maxRadius = Math.max(maxRadius, point.r ?? 0);
    const id = key(Math.floor(point.x / cell), Math.floor(point.y / cell));
    const bucket = buckets.get(id);
    if (bucket) bucket.push(index);
    else buckets.set(id, [index]);
  });
  return {
    nearest(x, y, radius = 16) {
      const reach = radius + maxRadius;
      const x0 = Math.floor((x - reach) / cell);
      const x1 = Math.floor((x + reach) / cell);
      const y0 = Math.floor((y - reach) / cell);
      const y1 = Math.floor((y + reach) / cell);
      let best: number | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestRadius = Number.POSITIVE_INFINITY;
      for (let cx = x0; cx <= x1; cx += 1) {
        for (let cy = y0; cy <= y1; cy += 1) {
          const bucket = buckets.get(key(cx, cy));
          if (!bucket) continue;
          for (const index of bucket) {
            const point = points[index] as IndexedPoint;
            const r = point.r ?? 0;
            const distance = Math.max(0, Math.hypot(point.x - x, point.y - y) - r);
            if (distance > radius) continue;
            if (distance < bestDistance || (distance === bestDistance && r < bestRadius)) {
              best = index;
              bestDistance = distance;
              bestRadius = r;
            }
          }
        }
      }
      return best;
    },
  };
}
