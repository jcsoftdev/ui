/** Pure geometry behind `BulletChart`: domains, qualitative bands and the band an actual value lands in. */

export interface BulletRow {
  actual: number;
  target?: number;
  /** Upper bounds of the qualitative ranges, ascending (e.g. `[60, 85, 100]`). */
  ranges?: readonly number[];
}

export interface BulletBand {
  index: number;
  /** Start and end on the value axis. */
  from: number;
  to: number;
}

/** Consecutive bands from 0 up to every range bound; bounds are sorted and non-positive ones dropped. */
export function bulletBands(ranges: readonly number[] | undefined): BulletBand[] {
  const bounds = [...(ranges ?? [])].filter((bound) => bound > 0).sort((a, b) => a - b);
  let from = 0;
  return bounds.map((to, index) => {
    const band = { index, from, to };
    from = to;
    return band;
  });
}

/** Upper end of the axis: the largest of the ranges, the actual and the target. */
export function bulletMax(row: BulletRow): number {
  const bands = bulletBands(row.ranges);
  const top = bands.length ? (bands[bands.length - 1] as BulletBand).to : 0;
  return Math.max(top, row.actual, row.target ?? 0, 0) || 1;
}

/** Index of the qualitative band that contains `value`, the last one when it goes past them; -1 without bands. */
export function bulletLevel(value: number, ranges: readonly number[] | undefined): number {
  const bands = bulletBands(ranges);
  if (bands.length === 0) return -1;
  const found = bands.findIndex((band) => value <= band.to);
  return found === -1 ? bands.length - 1 : found;
}

/** Opacity of the neutral fill of band `index` out of `count`: the darkest is the lowest range. */
export function bandOpacity(index: number, count: number): number {
  if (count <= 1) return 0.2;
  return 0.34 - (0.24 * index) / (count - 1);
}
