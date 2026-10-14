/** Funnel and pyramid stage geometry. */
export interface FunnelStage {
  index: number;
  value: number;
  /** Main-axis start and end of the stage. */
  from: number;
  to: number;
  /** Cross-axis full widths at `from` and at `to`. */
  widthFrom: number;
  widthTo: number;
  /** Share of the first stage, 0-1. */
  ofFirst: number;
  /** Share of the previous stage, null for the first one. */
  conversion: number | null;
}

export interface FunnelOptions {
  /** Main-axis length available. */
  length: number;
  /** Cross-axis width of the largest stage. */
  thickness: number;
  gap?: number;
  /** `funnel` keeps a flat neck; `pyramid` tapers the last stage to a point. */
  variant?: "funnel" | "pyramid";
  /** Width of the last stage's far edge relative to its own width (funnel only). */
  neck?: number;
  /**
   * `true` (default) narrows each stage towards the next one (trapezoids, one
   * continuous outline); `false` keeps every stage a straight bar of its own width.
   */
  tapered?: boolean;
}

/**
 * Stage geometry along one axis: each stage spans its slice of `length`,
 * starts as wide as its own value and ends as wide as the next stage, so the
 * outline is continuous. Widths are proportional to value.
 */
export function funnelStages(values: readonly number[], options: FunnelOptions): FunnelStage[] {
  const { length, thickness, gap = 0, variant = "funnel", neck = 0.72, tapered = true } = options;
  const clean = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  let max = 0;
  for (const value of clean) if (value > max) max = value;
  const count = clean.length;
  const first = clean[0] ?? 0;
  const size = count > 0 ? Math.max(0, (length - gap * (count - 1)) / count) : 0;
  return clean.map((value, index) => {
    const next = clean[index + 1];
    const widthFrom = max > 0 ? (value / max) * thickness : 0;
    const widthTo =
      !tapered && variant !== "pyramid"
        ? widthFrom
        : next != null && max > 0
          ? (next / max) * thickness
          : variant === "pyramid"
            ? 0
            : widthFrom * neck;
    const previous = clean[index - 1];
    return {
      index,
      value,
      from: index * (size + gap),
      to: index * (size + gap) + size,
      widthFrom,
      widthTo,
      ofFirst: first > 0 ? value / first : 0,
      conversion: previous == null ? null : previous > 0 ? value / previous : 0,
    };
  });
}
