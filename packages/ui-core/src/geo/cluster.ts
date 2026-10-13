export interface ClusterInput {
  /** Screen position. */
  x: number;
  y: number;
  /** Weight of the point (its size value); a point without weight counts as 1. */
  value: number;
}

export interface Cluster {
  x: number;
  y: number;
  /** Sum of the member values. */
  value: number;
  /** Indices into the input, in input order. */
  members: number[];
}

/**
 * Greedy screen-distance clustering: the heaviest unassigned point claims
 * every unassigned point closer than `distance`; the cluster sits at the
 * value-weighted centre of its members. Points are bucketed on a grid of
 * `distance`, so the cost stays near-linear. Deterministic for equal input.
 */
export function clusterPoints(items: readonly ClusterInput[], distance: number): Cluster[] {
  if (distance <= 0) {
    return items.map((item, index) => ({
      x: item.x,
      y: item.y,
      value: item.value,
      members: [index],
    }));
  }
  const cell = distance;
  const grid = new Map<string, number[]>();
  const cellOf = (item: ClusterInput) =>
    [Math.floor(item.x / cell), Math.floor(item.y / cell)] as const;
  items.forEach((item, index) => {
    const [cx, cy] = cellOf(item);
    const key = `${cx}:${cy}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(index);
    else grid.set(key, [index]);
  });
  const taken = new Uint8Array(items.length);
  const order = items
    .map((_, index) => index)
    .sort((a, b) => (items[b]?.value ?? 0) - (items[a]?.value ?? 0) || a - b);
  const limit = distance * distance;
  const clusters: Cluster[] = [];
  for (const seedIndex of order) {
    if (taken[seedIndex]) continue;
    const seed = items[seedIndex] as ClusterInput;
    const [cx, cy] = cellOf(seed);
    const members: number[] = [];
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const index of grid.get(`${gx}:${gy}`) ?? []) {
          if (taken[index]) continue;
          const other = items[index] as ClusterInput;
          if ((other.x - seed.x) ** 2 + (other.y - seed.y) ** 2 <= limit) members.push(index);
        }
      }
    }
    members.sort((a, b) => a - b);
    let weight = 0;
    let x = 0;
    let y = 0;
    let value = 0;
    for (const index of members) {
      taken[index] = 1;
      const item = items[index] as ClusterInput;
      const w = item.value > 0 ? item.value : 1;
      weight += w;
      x += item.x * w;
      y += item.y * w;
      value += item.value;
    }
    clusters.push({ x: x / weight, y: y / weight, value, members });
  }
  return clusters.sort((a, b) => (a.members[0] as number) - (b.members[0] as number));
}
