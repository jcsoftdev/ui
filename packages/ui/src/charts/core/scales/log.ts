import { type ContinuousScale, clean } from "./linear.js";

export interface LogScaleOptions {
  /** Non-positive values are clamped to the smallest positive number. */
  domain: readonly [number, number];
  range: readonly [number, number];
}

/** Base-10 logarithmic scale, extended to whole decades. */
export function logScale({ domain, range }: LogScaleOptions): ContinuousScale {
  const lo = Math.max(Math.min(domain[0], domain[1]), Number.MIN_VALUE);
  const hi = Math.max(domain[0], domain[1], lo);
  const e0 = Math.floor(Math.log10(lo));
  const e1 = Math.max(Math.ceil(Math.log10(hi)), e0 + 1);
  const [r0, r1] = range;
  const span = e1 - e0;
  return {
    type: "log",
    domain: [10 ** e0, 10 ** e1],
    range,
    map: (value) => r0 + ((Math.log10(Math.max(value, 10 ** e0)) - e0) / span) * (r1 - r0),
    invert: (pixel) => 10 ** (e0 + ((pixel - r0) / (r1 - r0 || 1)) * span),
    ticks: () => {
      const out: number[] = [];
      const multiples = span <= 2 ? [1, 2, 5] : [1];
      for (let e = e0; e <= e1; e += 1) {
        for (const m of multiples) {
          const value = clean(m * 10 ** e);
          if (value <= 10 ** e1) out.push(value);
        }
      }
      return out;
    },
  };
}
