export type PlanePoint = readonly [number, number];

function distanceToSegmentSquared(p: PlanePoint, a: PlanePoint, b: PlanePoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/**
 * Douglas-Peucker line simplification (iterative, so long coastlines cannot
 * overflow the stack). The first and last points are always kept, which is
 * what lets neighbouring regions keep sharing their borders: each shared arc
 * is simplified once, with fixed ends. Points farther than `tolerance` from the
 * simplified line are never dropped.
 */
export function simplifyLine<P extends PlanePoint>(points: readonly P[], tolerance: number): P[] {
  const count = points.length;
  if (count <= 2 || tolerance <= 0) return [...points];
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const limit = tolerance * tolerance;
  const stack: Array<[number, number]> = [[0, count - 1]];
  while (stack.length > 0) {
    const [from, to] = stack.pop() as [number, number];
    let worst = -1;
    let worstDistance = limit;
    for (let i = from + 1; i < to; i++) {
      const distance = distanceToSegmentSquared(points[i] as P, points[from] as P, points[to] as P);
      if (distance > worstDistance) {
        worst = i;
        worstDistance = distance;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([from, worst], [worst, to]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
}

/** Signed area of a ring (shoelace); positive when counter-clockwise in a y-up plane. */
export function ringArea(ring: readonly PlanePoint[]): number {
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i] as PlanePoint;
    const [x1, y1] = ring[(i + 1) % n] as PlanePoint;
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}
