// Small helpers shared by the E17 charts: loop-based extremes (a spread over a large array throws a
// RangeError), tolerant attribute parsing and a color check for values that end up in `style`.

/** Smallest finite value, or `fallback` when there is none. Safe for any length. */
export function minOf(values: ArrayLike<number>, fallback = 0): number {
  let out = Number.POSITIVE_INFINITY;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] as number;
    if (value < out) out = value;
  }
  return out === Number.POSITIVE_INFINITY ? fallback : out;
}

/** Largest finite value, or `fallback` when there is none. Safe for any length. */
export function maxOf(values: ArrayLike<number>, fallback = 0): number {
  let out = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] as number;
    if (value > out) out = value;
  }
  return out === Number.NEGATIVE_INFINITY ? fallback : out;
}

/** A finite number from an attribute, or `fallback` for a missing, empty or non-numeric value. */
export function numberAttr(value: string | null, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Comma-separated finite numbers (`"4,30"`), or `undefined` unless every part parses. */
export function numberList(value: string | null, length: number): number[] | undefined {
  if (value == null) return undefined;
  const parts = value.split(",").map((part) => (part.trim() === "" ? Number.NaN : Number(part)));
  return parts.length === length && parts.every(Number.isFinite) ? parts : undefined;
}

const COLOR = /^[#a-z0-9(),.%\s/_-]+$/i;

/**
 * `value` when it is only color syntax (a name, hex, `rgb()`, `oklch()`, `var(--x)`...), so it can
 * go into a `style` string; `undefined` for anything that could carry other declarations.
 */
export function cssColor(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text || text.length > 120 || !COLOR.test(text) || /url\s*\(|expression/i.test(text))
    return undefined;
  return text;
}
