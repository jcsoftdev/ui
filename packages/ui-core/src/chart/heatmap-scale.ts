import {
  type ColorRange,
  type ColorStop,
  divergingColor,
  rangeColor,
  rangeIndex,
  type ScaleColors,
  sequentialColor,
} from "./color-scale.ts";

export interface HeatmapScaleOptions {
  /** "sequential": empty to brand; "diverging": low hue, neutral at `center`, brand. */
  scale?: "sequential" | "diverging";
  /** Fixed [min, max]; the data extent by default. */
  domain?: readonly [number, number];
  /** Neutral value of a diverging scale, 0 by default. */
  center?: number;
  colors?: ScaleColors;
  /** Stepped coloring: each value takes the color of the range that contains it. */
  ranges?: readonly ColorRange[];
}

export interface HeatmapScale {
  domain: readonly [number, number];
  /** `null` when the value falls outside every range. */
  color: (value: number) => ColorStop | null;
}

/** Builds the color function of a heatmap from its options and every finite value. */
export function heatmapScale(
  values: readonly number[],
  { scale = "sequential", domain, center = 0, colors, ranges }: HeatmapScaleOptions,
): HeatmapScale {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  const extent: readonly [number, number] = domain ?? [
    scale === "sequential" ? Math.min(0, min) : min,
    max,
  ];
  if (ranges && ranges.length > 0) {
    return {
      domain: extent,
      color: (value) => {
        const index = rangeIndex(value, ranges);
        return index < 0 ? null : rangeColor(ranges[index] as ColorRange, index, ranges.length);
      },
    };
  }
  return {
    domain: extent,
    color: (value) =>
      scale === "diverging"
        ? divergingColor(value, extent, center, colors)
        : sequentialColor(value, extent, colors),
  };
}
