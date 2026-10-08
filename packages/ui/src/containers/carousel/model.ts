/** Next slide index; wraps when `loop`, otherwise stays at the ends. */
export function stepIndex(index: number, count: number, direction: 1 | -1, loop: boolean): number {
  if (count <= 0) return 0;
  const next = index + direction;
  if (loop) return (next + count) % count;
  return Math.min(count - 1, Math.max(0, next));
}

/** Index of the slide whose left edge is closest to `scrollLeft`. */
export function nearestIndex(scrollLeft: number, offsets: number[]): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  offsets.forEach((offset, i) => {
    const d = Math.abs(offset - scrollLeft);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}
