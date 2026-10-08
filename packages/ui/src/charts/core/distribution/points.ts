import { seededRandom } from "./stats.js";

export type PointColoring = "series" | "value";

export interface JitteredValue {
  value: number;
  /** Signed pixel offset from the category axis. */
  offset: number;
}

/**
 * Deterministic jitter for raw observations. `reach(value)` is the largest
 * absolute offset in pixels at that value (a violin passes its density
 * profile, a box a constant), so the dots follow the shape they sit in.
 * Non-finite values are dropped. The same seed always yields the same layout.
 */
export function jitterValues(
  values: Iterable<number | null | undefined>,
  seed: number,
  reach: number | ((value: number) => number),
): JitteredValue[] {
  const random = seededRandom(seed);
  const out: JitteredValue[] = [];
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    const limit = typeof reach === "function" ? reach(value) : reach;
    out.push({ value, offset: (random() * 2 - 1) * Math.max(0, limit) });
  }
  return out;
}

/** Seed of one box or violin, so every group gets its own stable jitter. */
export function groupSeed(seed: number, category: number, series: number): number {
  return seed + category * 977 + series * 131;
}
