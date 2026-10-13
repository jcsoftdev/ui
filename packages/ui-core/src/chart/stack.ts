export type StackMode = "none" | "normal" | "percent";

/** One stacked layer: for every index, where the segment starts and ends. */
export interface StackLayer {
  y0: number[];
  y1: number[];
  /** Original value (null keeps gaps visible in tooltips). */
  values: Array<number | null>;
}

/**
 * Stacks series on top of each other per index. Positive values grow up from
 * zero, negative values grow down, so diverging data stays readable. In
 * `percent` mode every index is normalised to a 0-1 share of its absolute total.
 */
export function stackLayers(
  series: ReadonlyArray<ReadonlyArray<number | null>>,
  mode: Exclude<StackMode, "none">,
): StackLayer[] {
  const length = Math.max(0, ...series.map((data) => data.length));
  const totals = Array.from({ length }, (_, i) =>
    series.reduce((sum, data) => sum + Math.abs(data[i] ?? 0), 0),
  );
  const up = new Array<number>(length).fill(0);
  const down = new Array<number>(length).fill(0);
  return series.map((data) => {
    const y0: number[] = [];
    const y1: number[] = [];
    for (let i = 0; i < length; i += 1) {
      const raw = data[i] ?? 0;
      const total = totals[i] as number;
      const value = mode === "percent" ? (total ? raw / total : 0) : raw;
      const base = value >= 0 ? (up[i] as number) : (down[i] as number);
      y0.push(base);
      y1.push(base + value);
      if (value >= 0) up[i] = base + value;
      else down[i] = base + value;
    }
    return { y0, y1, values: Array.from({ length }, (_, i) => data[i] ?? null) };
  });
}
