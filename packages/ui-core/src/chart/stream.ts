// Stream graph layout: baseline-shifted stacking (wiggle, silhouette, expand) and the stacking order.
export type StreamOffset = "wiggle" | "silhouette" | "zero" | "expand";
export type StreamOrder = "inside-out" | "ascending" | "none";

export interface StreamLayer {
  /** Lower edge per index, in value units. */
  y0: number[];
  /** Upper edge per index. */
  y1: number[];
}

export interface StreamLayout {
  /** One layer per input series, in input order. */
  layers: StreamLayer[];
  /** Bottom-to-top stacking order, as input indices. */
  order: number[];
  /** Lowest and highest edge over all indices. */
  domain: [number, number];
  /** Sum of the series at every index. */
  totals: number[];
}

const sum = (values: ReadonlyArray<number>) => values.reduce((acc, v) => acc + v, 0);

/**
 * Stacking order. `inside-out` puts the streams that peak earliest/latest on
 * the outside and the biggest in the middle, which keeps the silhouette calm;
 * `ascending` puts the smallest total at the bottom.
 */
export function streamOrder(
  data: ReadonlyArray<ReadonlyArray<number>>,
  order: StreamOrder,
): number[] {
  const indices = data.map((_, i) => i);
  if (order === "none") return indices;
  if (order === "ascending") {
    return indices.sort((a, b) => sum(data[a] as number[]) - sum(data[b] as number[]) || a - b);
  }
  const peak = (i: number) => {
    const values = data[i] as number[];
    let best = 0;
    for (let k = 1; k < values.length; k += 1)
      if ((values[k] as number) > (values[best] as number)) best = k;
    return best;
  };
  const sorted = indices.sort((a, b) => peak(a) - peak(b) || a - b);
  const tops: number[] = [];
  const bottoms: number[] = [];
  let topSum = 0;
  let bottomSum = 0;
  for (const i of sorted) {
    const total = sum(data[i] as number[]);
    if (topSum < bottomSum) {
      tops.push(i);
      topSum += total;
    } else {
      bottoms.push(i);
      bottomSum += total;
    }
  }
  return bottoms.reverse().concat(tops);
}

/**
 * Baseline-shifted stacking for stream graphs. Negative and missing values
 * count as zero. Offsets:
 * - `zero`: ordinary stacked area from 0.
 * - `silhouette`: centered, so the shape is symmetric around 0.
 * - `wiggle`: baseline moves to minimize the slope of the streams (Byron and
 *   Wattenberg), then the whole shape is re-centered around 0.
 * - `expand`: shares of 100% from 0 to 1.
 */
export function streamLayout(
  series: ReadonlyArray<ReadonlyArray<number | null>>,
  offset: StreamOffset = "wiggle",
  order: StreamOrder = "inside-out",
): StreamLayout {
  const length = Math.max(0, ...series.map((data) => data.length));
  const data = series.map((values) =>
    Array.from({ length }, (_, i) => Math.max(0, values[i] ?? 0)),
  );
  const totals = Array.from({ length }, (_, i) => sum(data.map((values) => values[i] as number)));
  const stack = streamOrder(data, order);
  const n = stack.length;

  const scale = (i: number) => (offset === "expand" ? 1 / ((totals[i] as number) || 1) : 1);
  const base = new Array<number>(length).fill(0);
  if (offset === "silhouette") {
    for (let i = 0; i < length; i += 1) base[i] = -(totals[i] as number) / 2;
  } else if (offset === "wiggle") {
    for (let j = 1; j < length; j += 1) {
      let shift = 0;
      stack.forEach((index, k) => {
        const values = data[index] as number[];
        shift += (n - k) * ((values[j] as number) - (values[j - 1] as number));
      });
      base[j] = (base[j - 1] as number) - shift / (n + 1);
    }
    if (length) {
      const mid = sum(base.map((b, i) => b + (totals[i] as number) / 2)) / length;
      for (let i = 0; i < length; i += 1) base[i] = (base[i] as number) - mid;
    }
  }

  const layers: StreamLayer[] = series.map(() => ({ y0: [], y1: [] }));
  const running = base.map((b, i) => b * scale(i));
  for (const index of stack) {
    const values = data[index] as number[];
    const layer = layers[index] as StreamLayer;
    for (let i = 0; i < length; i += 1) {
      const start = running[i] as number;
      const end = start + (values[i] as number) * scale(i);
      layer.y0.push(start);
      layer.y1.push(end);
      running[i] = end;
    }
  }
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const layer of layers) {
    for (let i = 0; i < length; i += 1) {
      lo = Math.min(lo, layer.y0[i] as number);
      hi = Math.max(hi, layer.y1[i] as number);
    }
  }
  return {
    layers,
    order: stack,
    domain: lo === Number.POSITIVE_INFINITY ? [0, 1] : [lo, hi],
    totals,
  };
}
