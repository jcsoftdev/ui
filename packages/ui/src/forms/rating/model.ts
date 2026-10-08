/** Rounds a value to the nearest `precision` (1 = whole stars, 0.5 = halves) inside [0, max]. */
export function roundRating(value: number, max: number, precision: 0.5 | 1 = 1): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value / precision) * precision;
  return Math.min(max, Math.max(0, rounded));
}

/** Rating under the pointer: the left half of a star counts as .5 when halves are allowed. */
export function ratingFromPointer(
  index: number,
  offsetRatio: number,
  max: number,
  precision: 0.5 | 1 = 1,
): number {
  const half = precision === 0.5 && offsetRatio < 0.5;
  return Math.min(max, index + (half ? 0.5 : 1));
}

/** Fill of star `index` (0-based) for a rating: 0, 0.5 or 1. */
export function starFill(index: number, rating: number): 0 | 0.5 | 1 {
  const diff = rating - index;
  if (diff >= 1) return 1;
  if (diff >= 0.5) return 0.5;
  return 0;
}

/** Next rating for a keyboard key, or null when the key is not handled. */
export function ratingKey(
  key: string,
  current: number,
  max: number,
  precision: 0.5 | 1 = 1,
): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(max, current + precision);
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(0, current - precision);
    case "Home":
      return 0;
    case "End":
      return max;
    default:
      return null;
  }
}
