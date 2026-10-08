export type RangeValue = [number, number];

function decimals(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Snaps to the nearest multiple of `step` counted from `min` (or from 0 when `min` is not
 * finite), kept inside [min, max]. Either bound may be infinite.
 */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clampValue(value, min, max);
  const base = Number.isFinite(min) ? min : 0;
  const places = Math.max(decimals(step), decimals(base));
  const snapped = Number((base + Math.round((value - base) / step) * step).toFixed(places));
  if (snapped > max) {
    // The last step may not land on `max`; fall back to the largest valid multiple.
    return Number((base + Math.floor((max - base) / step) * step).toFixed(places));
  }
  return clampValue(snapped, min, max);
}

/** Position of a value along the track, 0..1. */
export function ratioOf(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clampValue((value - min) / (max - min), 0, 1);
}

export function valueFromRatio(ratio: number, min: number, max: number, step: number): number {
  return snapToStep(min + clampValue(ratio, 0, 1) * (max - min), min, max, step);
}

/** Moves one thumb of a range, never crossing the other one and keeping `minGap` between them. */
export function setRangeThumb(
  values: RangeValue,
  index: 0 | 1,
  next: number,
  min: number,
  max: number,
  step: number,
  minGap = 0,
): RangeValue {
  const snapped = snapToStep(next, min, max, step);
  if (index === 0) return [Math.min(snapped, values[1] - minGap), values[1]];
  return [values[0], Math.max(snapped, values[0] + minGap)];
}

/** Thumb a pointer press should grab: the closest one; on a tie, the one the press is outside of. */
export function nearestThumb(values: RangeValue, target: number): 0 | 1 {
  const d0 = Math.abs(values[0] - target);
  const d1 = Math.abs(values[1] - target);
  if (d0 === d1) return target < values[0] ? 0 : 1;
  return d0 < d1 ? 0 : 1;
}

/** Next value for a slider key, or null when the key is not handled. */
export function keyboardValue(
  key: string,
  current: number,
  min: number,
  max: number,
  step: number,
  page: number,
): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return current + step;
    case "ArrowLeft":
    case "ArrowDown":
      return current - step;
    case "PageUp":
      return current + page;
    case "PageDown":
      return current - page;
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}
