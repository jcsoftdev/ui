// Beeswarm layout: offsets perpendicular to the value axis so that no two circles overlap.
export interface SwarmItem {
  /** Pixel position along the value axis. */
  position: number;
  radius: number;
}

export interface SwarmOptions {
  /** Extra space between circles in pixels (default 1). */
  gap?: number;
  /** "both" grows the swarm on both sides of the axis; "positive" only to one side. */
  side?: "both" | "positive";
}

/** How far the inner edge of an interval is from the axis: the order in which a run reaches it. */
const key = (low: number, high: number): number => (low > 0 ? low : high < 0 ? -high : 0);

const SORT_BUCKETS = 256;

/**
 * Beeswarm layout: offsets perpendicular to the value axis so that no two
 * circles overlap. Circles are placed in value order; each one takes the free
 * offset closest to the axis, tested against the circles already placed that
 * are close enough along the axis to touch it. Returns one offset per item,
 * in the input order.
 *
 * Each neighbour blocks an open interval of offsets on the line of the circle being placed. The
 * free offset closest to the axis is 0 or an edge of the blocked run around 0, so the run is grown
 * from 0 instead of testing every tangent point against every neighbour.
 */
export function beeswarm(items: readonly SwarmItem[], options: SwarmOptions = {}): number[] {
  const gap = options.gap ?? 1;
  const both = (options.side ?? "both") === "both";
  const count = items.length;
  const order = new Array<number>(count);
  for (let i = 0; i < count; i += 1) order[i] = i;
  order.sort((a, b) => {
    const pa = (items[a] as SwarmItem).position;
    const pb = (items[b] as SwarmItem).position;
    return pa - pb || a - b;
  });
  const offsets = new Array<number>(count).fill(0);
  // Placed circles in value order, as flat arrays.
  const px = new Float64Array(count);
  const pr = new Float64Array(count);
  const py = new Float64Array(count);
  // Blocked intervals of the circle being placed, and the offsets that clear each of them.
  const lo = new Float64Array(count);
  const hi = new Float64Array(count);
  const edgeLo = new Float64Array(count);
  const edgeHi = new Float64Array(count);
  // The same intervals ordered by their inner edge, which lets the run grow in few passes.
  const sLo = new Float64Array(count);
  const sHi = new Float64Array(count);
  const sEdgeLo = new Float64Array(count);
  const sEdgeHi = new Float64Array(count);
  const bucketOf = new Uint8Array(count);
  const starts = new Int32Array(SORT_BUCKETS + 1);
  let placed = 0;
  let maxRadius = 0;
  for (const index of order) {
    const item = items[index] as SwarmItem;
    const { position, radius } = item;
    maxRadius = Math.max(maxRadius, radius);
    const reach = radius + maxRadius + gap;
    let n = 0;
    let farthest = 0;
    for (let k = placed - 1; k >= 0; k -= 1) {
      const dx = position - (px[k] as number);
      if (dx > reach) break;
      const min = radius + (pr[k] as number) + gap;
      const room = min * min - dx * dx;
      if (room <= 1e-6) continue;
      const dy = Math.sqrt(room);
      // sqrt(room - 1e-6), without a second root: the difference is far below a pixel.
      const half = dy - 5e-7 / dy;
      const base = py[k] as number;
      lo[n] = base - half;
      hi[n] = base + half;
      edgeLo[n] = base - dy;
      edgeHi[n] = base + dy;
      n += 1;
      const near = key(base - half, base + half);
      if (near > farthest) farthest = near;
    }
    // Counting sort by the inner edge of each interval, the order in which the run reaches them.
    starts.fill(0);
    const scale = farthest > 0 ? (SORT_BUCKETS - 1) / farthest : 0;
    for (let k = 0; k < n; k += 1) {
      const bucket = Math.floor(key(lo[k] as number, hi[k] as number) * scale);
      bucketOf[k] = bucket < SORT_BUCKETS ? bucket : SORT_BUCKETS - 1;
      starts[(bucketOf[k] as number) + 1] = (starts[(bucketOf[k] as number) + 1] as number) + 1;
    }
    for (let b = 0; b < SORT_BUCKETS; b += 1)
      starts[b + 1] = (starts[b + 1] as number) + (starts[b] as number);
    for (let k = 0; k < n; k += 1) {
      const at = starts[bucketOf[k] as number] as number;
      starts[bucketOf[k] as number] = at + 1;
      sLo[at] = lo[k] as number;
      sHi[at] = hi[k] as number;
      sEdgeLo[at] = edgeLo[k] as number;
      sEdgeHi[at] = edgeHi[k] as number;
    }
    let low = 0;
    let high = 0;
    let lowEdge = 0;
    let highEdge = 0;
    // An interval inside the run can never matter again, so it leaves the list.
    for (let changed = true; changed; ) {
      changed = false;
      let kept = 0;
      for (let k = 0; k < n; k += 1) {
        const a = sLo[k] as number;
        const b = sHi[k] as number;
        if (a >= high || b <= low) {
          sLo[kept] = a;
          sHi[kept] = b;
          sEdgeLo[kept] = sEdgeLo[k] as number;
          sEdgeHi[kept] = sEdgeHi[k] as number;
          kept += 1;
          continue;
        }
        if (a < low) {
          low = a;
          lowEdge = sEdgeLo[k] as number;
          changed = true;
        }
        if (b > high) {
          high = b;
          highEdge = sEdgeHi[k] as number;
          changed = true;
        }
      }
      n = kept;
    }
    let best = 0;
    if (high > low) best = !both || Math.abs(highEdge) <= Math.abs(lowEdge) ? highEdge : lowEdge;
    if (!Number.isFinite(best)) best = 0;
    offsets[index] = best;
    px[placed] = position;
    pr[placed] = radius;
    py[placed] = best;
    placed += 1;
  }
  return offsets;
}
