// Whole-unit sharing used by the hemicycle and the unit charts (waffle, pictogram).

/** Drops floating point noise (0.6000000000000001 -> 0.6). */
export function clean(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * Shares `total` whole units between weights so they add up exactly
 * (largest remainder method). Negative or missing weights count as zero; all
 * zero weights get nothing.
 */
export function largestRemainder(weights: readonly number[], total: number): number[] {
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  const slots = Math.max(0, Math.round(total));
  if (sum <= 0 || slots === 0) return safe.map(() => 0);
  const exact = safe.map((weight) => (weight / sum) * slots);
  const counts = exact.map((share) => Math.floor(clean(share)));
  let left = slots - counts.reduce((acc, count) => acc + count, 0);
  const order = exact
    .map((share, index) => ({ index, rest: share - (counts[index] as number) }))
    .filter((entry) => (safe[entry.index] as number) > 0)
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let i = 0; left > 0 && order.length > 0; i += 1, left -= 1) {
    const entry = order[i % order.length] as { index: number };
    counts[entry.index] = (counts[entry.index] as number) + 1;
  }
  return counts;
}

/** Category of each position when `counts` are laid one after the other. */
export function assignUnits(counts: readonly number[]): number[] {
  const owners: number[] = [];
  counts.forEach((count, category) => {
    for (let i = 0; i < count; i += 1) owners.push(category);
  });
  return owners;
}
