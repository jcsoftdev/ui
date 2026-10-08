/**
 * Index-based categorical scale. `band` gives every category a slot with a
 * bar-sized `bandwidth`; `point` spreads categories edge to edge (bandwidth 0),
 * which suits lines and areas.
 */
export interface BandScale {
  readonly type: "band" | "point";
  readonly count: number;
  readonly range: readonly [number, number];
  readonly step: number;
  readonly bandwidth: number;
  /** Leading edge of category `index`. */
  start(index: number): number;
  /** Center of category `index`. */
  center(index: number): number;
  /** Category under `pixel`, clamped to the valid range; -1 when empty. */
  indexAt(pixel: number): number;
}

export interface BandScaleOptions {
  count: number;
  range: readonly [number, number];
  /** Gap between bands, as a fraction of the step (0-1). */
  paddingInner?: number;
  /** Space before the first and after the last band, as a fraction of the step. */
  paddingOuter?: number;
}

export function bandScale({
  count,
  range,
  paddingInner = 0.2,
  paddingOuter = 0.1,
}: BandScaleOptions): BandScale {
  const [r0, r1] = range;
  const slots = Math.max(1, count - paddingInner + paddingOuter * 2);
  const step = (r1 - r0) / slots;
  const bandwidth = step * (1 - paddingInner);
  const offset = r0 + step * paddingOuter;
  return {
    type: "band",
    count,
    range,
    step,
    bandwidth,
    start: (index) => offset + index * step,
    center: (index) => offset + index * step + bandwidth / 2,
    indexAt: (pixel) => {
      if (count === 0) return -1;
      const raw = Math.floor((pixel - offset + (step - bandwidth) / 2) / step);
      return Math.min(count - 1, Math.max(0, raw));
    },
  };
}

export interface PointScaleOptions {
  count: number;
  range: readonly [number, number];
  /** Space before the first and after the last point, as a fraction of the step. */
  padding?: number;
}

export function pointScale({ count, range, padding = 0 }: PointScaleOptions): BandScale {
  const [r0, r1] = range;
  if (count <= 1) {
    const mid = (r0 + r1) / 2;
    return {
      type: "point",
      count,
      range,
      step: r1 - r0,
      bandwidth: 0,
      start: () => mid,
      center: () => mid,
      indexAt: () => (count === 0 ? -1 : 0),
    };
  }
  const step = (r1 - r0) / (count - 1 + padding * 2);
  const offset = r0 + step * padding;
  return {
    type: "point",
    count,
    range,
    step,
    bandwidth: 0,
    start: (index) => offset + index * step,
    center: (index) => offset + index * step,
    indexAt: (pixel) => Math.min(count - 1, Math.max(0, Math.round((pixel - offset) / step))),
  };
}
