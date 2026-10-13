// Tick maths shared by chart/scale and chart/axis, so neither entry pulls the other in.

/** Rounds away binary noise such as 0.30000000000000004. */
export function clean(value: number): number {
  return Number(value.toPrecision(12));
}

/** Step between ticks: 1, 2 or 5 times a power of ten, close to `span / count`. */
export function tickStep(min: number, max: number, count: number): number {
  const raw = Math.abs(max - min) / Math.max(1, count);
  if (raw === 0 || !Number.isFinite(raw)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  const factor = error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1;
  return factor * power;
}

/** Widens `[min, max]` so both ends land on a tick. A flat domain gets some room. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    // A flat series sits mid-height on a domain anchored at zero.
    if (lo === 0) hi = 1;
    else if (lo > 0) [lo, hi] = [0, hi * 2];
    else [lo, hi] = [lo * 2, 0];
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const step = tickStep(lo, hi, count);
    lo = clean(Math.floor(lo / step) * step);
    hi = clean(Math.ceil(hi / step) * step);
  }
  return [lo, hi];
}

/** Evenly spaced round values inside `[min, max]`. */
export function linearTicks(min: number, max: number, count = 5): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo === hi) return [lo];
  const step = tickStep(lo, hi, count);
  const first = Math.ceil(lo / step - 1e-9);
  const last = Math.floor(hi / step + 1e-9);
  const out: number[] = [];
  for (let i = first; i <= last; i += 1) out.push(clean(i * step));
  return out;
}
