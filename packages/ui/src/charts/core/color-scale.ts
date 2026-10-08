/**
 * Continuous and stepped color scales built only from tokens. Colors are
 * `color-mix()` expressions over CSS variables, so they follow the theme
 * (light/dark) and the active accent palette without any JavaScript.
 */

import { type ChartTone, TONE_COLORS } from "./palette.js";

/** Mixes `percent`% of `color` into `base` (the surface by default). */
export function tint(color: string, percent: number, base = "var(--surface)"): string {
  const p = Math.round(Math.min(100, Math.max(0, percent)));
  if (p >= 100) return color;
  if (p <= 0) return base;
  return `color-mix(in oklab, ${color} ${p}%, ${base})`;
}

/** Text color readable on a `tint(color, percent)` fill. */
export function inkOn(percent: number): string {
  return percent >= 80 ? "var(--surface)" : "var(--ink)";
}

export interface ScaleColors {
  /** Low end of a diverging scale. */
  low?: string;
  /** Neutral middle (diverging) or empty end (sequential). */
  mid?: string;
  /** High end; the brand by default. */
  high?: string;
}

export const DEFAULT_SCALE_COLORS: Required<ScaleColors> = {
  low: "var(--chart-cat-1)",
  mid: "var(--surface-2)",
  high: "var(--accent-word)",
};

/** Lightest share of the color, so the smallest value still differs from an empty cell. */
const FLOOR = 12;

/** Clamped position of `value` in [min, max], 0-1. */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export interface ColorStop {
  color: string;
  /** Strength 0-100 of the hue in the mix, for picking text color. */
  strength: number;
}

/** Sequential scale: `mid` (empty) to `high`. */
export function sequentialColor(
  value: number,
  [min, max]: readonly [number, number],
  colors: ScaleColors = {},
): ColorStop {
  const { high, mid } = { ...DEFAULT_SCALE_COLORS, ...colors };
  const strength = FLOOR + normalize(value, min, max) * (100 - FLOOR);
  return { color: tint(high, strength, mid), strength };
}

/** Diverging scale: `low` below `center`, `mid` at it, `high` above. */
export function divergingColor(
  value: number,
  [min, max]: readonly [number, number],
  center = 0,
  colors: ScaleColors = {},
): ColorStop {
  const { low, mid, high } = { ...DEFAULT_SCALE_COLORS, ...colors };
  const reach = Math.max(center - min, max - center) || 1;
  const t = Math.max(-1, Math.min(1, (value - center) / reach));
  const strength = Math.abs(t) * 100;
  return { color: tint(t < 0 ? low : high, strength, mid), strength };
}

export interface ColorRange {
  /** Inclusive lower bound; open when omitted. */
  from?: number;
  /** Exclusive upper bound; open when omitted. */
  to?: number;
  label: string;
  /** CSS color; or use `tone`. */
  color?: string;
  tone?: ChartTone;
}

/** Index of the first range containing `value`, or -1. */
export function rangeIndex(value: number, ranges: readonly ColorRange[]): number {
  return ranges.findIndex(
    (range) =>
      (range.from == null || value >= range.from) && (range.to == null || value < range.to),
  );
}

/**
 * Fill of a stepped range: its own `color`, a `tone` (its ink at 55% over the
 * surface, readable with ink text in both themes), or a step of the brand
 * scale by position.
 */
export function rangeColor(range: ColorRange, index: number, count: number): ColorStop {
  if (range.color) return { color: range.color, strength: 100 };
  if (range.tone) return { color: tint(TONE_COLORS[range.tone].ink, 55), strength: 55 };
  const strength = FLOOR + ((index + 1) / Math.max(1, count)) * (100 - FLOOR);
  return { color: tint(DEFAULT_SCALE_COLORS.high, strength, DEFAULT_SCALE_COLORS.mid), strength };
}

/** CSS gradient for a legend bar of a continuous scale. */
export function scaleGradient(
  kind: "sequential" | "diverging",
  colors: ScaleColors = {},
  direction = "to right",
): string {
  const { low, mid, high } = { ...DEFAULT_SCALE_COLORS, ...colors };
  if (kind === "diverging") return `linear-gradient(${direction}, ${low}, ${mid}, ${high})`;
  return `linear-gradient(${direction}, ${tint(high, FLOOR, mid)}, ${high})`;
}
