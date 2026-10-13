/**
 * Moves labels apart so neighbours keep at least `gap` pixels between their
 * centers, staying inside `[min, max]` and keeping their original order.
 * Overlapping pairs are pushed apart symmetrically, so a cluster spreads
 * around the center of mass instead of drifting down. When the labels cannot
 * fit at all, they are spread evenly over the whole range.
 *
 * Returns positions in the same order as the input.
 */
export function spreadSlopeLabels(
  positions: ReadonlyArray<number>,
  gap: number,
  min: number,
  max: number,
): number[] {
  const n = positions.length;
  if (n === 0) return [];
  const order = positions
    .map((_, i) => i)
    .sort((a, b) => (positions[a] as number) - (positions[b] as number) || a - b);
  if (n > 1 && (n - 1) * gap > max - min) {
    const step = (max - min) / (n - 1);
    const out = new Array<number>(n);
    order.forEach((index, rank) => {
      out[index] = min + rank * step;
    });
    return out;
  }
  const y = order.map((index) => Math.min(max, Math.max(min, positions[index] as number)));
  for (let pass = 0; pass < 200; pass += 1) {
    let moved = false;
    for (let i = 1; i < n; i += 1) {
      const overlap = gap - ((y[i] as number) - (y[i - 1] as number));
      if (overlap > 0.01) {
        y[i - 1] = (y[i - 1] as number) - overlap / 2;
        y[i] = (y[i] as number) + overlap / 2;
        moved = true;
      }
    }
    for (let i = 0; i < n; i += 1) y[i] = Math.min(max, Math.max(min, y[i] as number));
    if (!moved) break;
  }
  const out = new Array<number>(n);
  order.forEach((index, rank) => {
    out[index] = y[rank] as number;
  });
  return out;
}
