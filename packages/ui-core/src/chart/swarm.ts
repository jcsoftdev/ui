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

/**
 * Beeswarm layout: offsets perpendicular to the value axis so that no two
 * circles overlap. Circles are placed in value order; each one takes the free
 * offset closest to the axis, tested against the circles already placed that
 * are close enough along the axis to touch it. Returns one offset per item,
 * in the input order.
 */
export function beeswarm(items: readonly SwarmItem[], options: SwarmOptions = {}): number[] {
  const gap = options.gap ?? 1;
  const both = (options.side ?? "both") === "both";
  const order = items
    .map((_, index) => index)
    .sort((a, b) => {
      const pa = (items[a] as SwarmItem).position;
      const pb = (items[b] as SwarmItem).position;
      return pa - pb || a - b;
    });
  const offsets = new Array<number>(items.length).fill(0);
  const placed: number[] = [];
  let maxRadius = 0;
  for (const index of order) {
    const item = items[index] as SwarmItem;
    maxRadius = Math.max(maxRadius, item.radius);
    const reach = item.radius + maxRadius + gap;
    // Neighbours along the axis: placed is in position order, walk back from the end.
    const near: number[] = [];
    for (let k = placed.length - 1; k >= 0; k -= 1) {
      const other = placed[k] as number;
      if (item.position - (items[other] as SwarmItem).position > reach) break;
      near.push(other);
    }
    const collides = (offset: number) =>
      near.some((other) => {
        const o = items[other] as SwarmItem;
        const min = item.radius + o.radius + gap;
        const dx = item.position - o.position;
        const dy = offset - (offsets[other] as number);
        return dx * dx + dy * dy < min * min - 1e-6;
      });
    const candidates = [0];
    for (const other of near) {
      const o = items[other] as SwarmItem;
      const min = item.radius + o.radius + gap;
      const dx = item.position - o.position;
      if (Math.abs(dx) >= min) continue;
      const dy = Math.sqrt(min * min - dx * dx);
      const base = offsets[other] as number;
      candidates.push(base + dy, base - dy);
    }
    let best = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (!both && candidate < 0) continue;
      if (Math.abs(candidate) < Math.abs(best) && !collides(candidate)) best = candidate;
    }
    offsets[index] = Number.isFinite(best) ? best : 0;
    placed.push(index);
  }
  return offsets;
}
