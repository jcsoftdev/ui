// Pure motion math shared by the motion components: token parsing, easing and the count-up tween.

/** Fallbacks when the theme does not define `--motion-duration` / `--motion-ease`. */
export const DEFAULT_DURATION_MS = 180;
export const DEFAULT_EASE = "cubic-bezier(.2,.8,.2,1)";

/** A count-up runs this many token durations: long enough to read, still under 300ms by default. */
export const COUNT_UP_SCALE = 1.5;

export type Easing = (t: number) => number;

/** Milliseconds from a CSS time (`180ms`, `.18s`); `fallback` when it does not parse. */
export function parseDuration(value: string | null | undefined, fallback = DEFAULT_DURATION_MS) {
  const match = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/i.exec(value ?? "");
  if (!match) return fallback;
  const amount = Number(match[1]) * (match[2]?.toLowerCase() === "s" ? 1000 : 1);
  return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const sample = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sample(x1, x2, t) - x;
      if (Math.abs(error) < 1e-6) return sample(y1, y2, t);
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i += 1) {
      const value = sample(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sample(y1, y2, t);
  };
}

const KEYWORDS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** Easing function for a CSS `<easing-function>`: `linear`, the `ease*` keywords or `cubic-bezier()`. */
export function parseEasing(value: string | null | undefined): Easing {
  const text = (value ?? "").trim().toLowerCase();
  if (text === "linear") return (t) => Math.min(1, Math.max(0, t));
  const keyword = KEYWORDS[text];
  if (keyword) return cubicBezier(...keyword);
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(text);
  const points = match?.[1]?.split(",").map(Number);
  if (points?.length === 4 && points.every(Number.isFinite)) {
    const [x1, y1, x2, y2] = points as [number, number, number, number];
    if (x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1) return cubicBezier(x1, y1, x2, y2);
  }
  return cubicBezier(0.2, 0.8, 0.2, 1);
}

/**
 * Value a count-up shows `elapsed` ms into a run of `duration` ms. It lands exactly on `to` at the
 * end, and integer runs stay integers so a formatter never flashes decimals.
 */
export function countAt(
  from: number,
  to: number,
  elapsed: number,
  duration: number,
  ease: Easing,
): number {
  if (!(duration > 0) || elapsed >= duration) return to;
  const value = from + (to - from) * ease(Math.max(0, elapsed) / duration);
  return Number.isInteger(from) && Number.isInteger(to) ? Math.round(value) : value;
}
