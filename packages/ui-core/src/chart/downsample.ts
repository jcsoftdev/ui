/** Largest-Triangle-Three-Buckets downsampling for dense line and area series. */

export interface SamplePoint {
  x: number;
  y: number;
}

/**
 * Indices LTTB keeps from `points` (ascending, always including the first and
 * last). The shape is preserved: every bucket keeps the point forming the
 * largest triangle with the point already kept and the average of the next bucket.
 * Returns every index when `threshold` is not smaller than the input or below 3.
 */
export function lttbIndices(points: readonly SamplePoint[], threshold: number): number[] {
  const n = points.length;
  const keep = Math.floor(threshold);
  if (keep >= n || keep < 3) return Array.from({ length: n }, (_, i) => i);
  const picked: number[] = [0];
  const bucket = (n - 2) / (keep - 2);
  let anchor = 0;
  for (let b = 0; b < keep - 2; b += 1) {
    const from = Math.floor(b * bucket) + 1;
    const to = Math.min(n - 1, Math.floor((b + 1) * bucket) + 1);
    const nextTo = Math.min(n, Math.floor((b + 2) * bucket) + 1);
    let avgX = 0;
    let avgY = 0;
    for (let i = to; i < nextTo; i += 1) {
      avgX += (points[i] as SamplePoint).x;
      avgY += (points[i] as SamplePoint).y;
    }
    const size = Math.max(1, nextTo - to);
    avgX /= size;
    avgY /= size;
    const a = points[anchor] as SamplePoint;
    let best = from;
    let bestArea = -1;
    for (let i = from; i < to; i += 1) {
      const p = points[i] as SamplePoint;
      const area = Math.abs((a.x - avgX) * (p.y - a.y) - (a.x - p.x) * (avgY - a.y));
      if (area > bestArea) {
        bestArea = area;
        best = i;
      }
    }
    picked.push(best);
    anchor = best;
  }
  picked.push(n - 1);
  return picked;
}

/** LTTB over `{ x, y }` points: at most `threshold` points that keep the visual shape. */
export function downsample<T extends SamplePoint>(points: readonly T[], threshold: number): T[] {
  return lttbIndices(points, threshold).map((index) => points[index] as T);
}

/**
 * Indices to keep so several series that share one category axis stay aligned:
 * the union of the LTTB picks of each series (computed on its non-null values),
 * plus the neighbours of every gap so a gap is never bridged. Ascending.
 * `null` means the data is small enough and nothing should be dropped.
 */
export function sharedSampleIndices(
  series: ReadonlyArray<ReadonlyArray<number | null>>,
  threshold: number,
): number[] | null {
  const count = series.reduce((max, data) => Math.max(max, data.length), 0);
  if (count <= threshold || threshold < 3) return null;
  const keep = new Set<number>([0, count - 1]);
  for (const data of series) {
    const present: SamplePoint[] = [];
    const where: number[] = [];
    data.forEach((value, index) => {
      if (value == null) {
        if (index > 0) keep.add(index - 1);
        if (index < count - 1) keep.add(index + 1);
        return;
      }
      present.push({ x: index, y: value });
      where.push(index);
    });
    for (const picked of lttbIndices(present, threshold)) keep.add(where[picked] as number);
  }
  return [...keep].sort((a, b) => a - b);
}
