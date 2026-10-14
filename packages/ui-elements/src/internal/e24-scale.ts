/**
 * Color scale and legend of the value maps (`ui-choropleth-map`, `ui-hex-tile-map`, `ui-globe-chart`):
 * a port of React's `heatmapScale` on top of ui-core's color maths. DOM-free.
 */
import {
  type ColorRange,
  type ColorStop,
  divergingColor,
  normalize,
  rangeColor,
  rangeIndex,
  type ScaleColors,
  sequentialColor,
} from "@jcsoftdev/ui-core/chart/color-scale";
import type { LegendItem, LegendScale } from "./chart-protocol.js";

/** Fill of a region without a value, or whose range is hidden. */
export const NO_DATA_FILL = "var(--surface-2)";

export interface ColorScaleOptions {
  scale?: "sequential" | "diverging";
  /** Fixed `[min, max]`; the data extent by default. */
  domain?: readonly [number, number];
  /** Neutral value of a diverging scale. */
  center?: number;
  colors?: ScaleColors;
  /** Stepped coloring: each value takes the color of the range that contains it. */
  ranges?: readonly ColorRange[];
}

export interface RegionScale {
  domain: readonly [number, number];
  /** `null` when the value falls outside every range. */
  color(value: number): ColorStop | null;
}

/** Builds the color function of a choropleth or tile map from its options and every finite value. */
export function colorScale(
  values: readonly number[],
  { scale = "sequential", domain, center = 0, colors, ranges }: ColorScaleOptions,
): RegionScale {
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
  if (ranges && ranges.length > 0)
    return {
      domain: extent,
      color: (value) => {
        const index = rangeIndex(value, ranges);
        return index < 0 ? null : rangeColor(ranges[index] as ColorRange, index, ranges.length);
      },
    };
  return {
    domain: extent,
    color: (value) =>
      scale === "diverging"
        ? divergingColor(value, extent, center, colors)
        : sequentialColor(value, extent, colors),
  };
}

/**
 * What the legend shows for the scale: a gradient (`scale`) for a continuous one, one item per
 * range (`legend`) for a stepped one. The diverging gradient puts its neutral color at `center`.
 */
export function legendFor(
  options: ColorScaleOptions,
  domain: readonly [number, number],
  format: (value: number) => string,
  label: string,
): { scale?: LegendScale; legend?: LegendItem[] } {
  const { scale = "sequential", center = 0, colors, ranges } = options;
  if (ranges && ranges.length > 0)
    return {
      legend: ranges.map((range, index) => ({
        id: `range-${index}`,
        name: range.label,
        color: rangeColor(range, index, ranges.length).color,
        shape: "square",
      })),
    };
  const [min, max] = domain;
  if (scale === "diverging") {
    const at = (value: number) => divergingColor(value, domain, center, colors).color;
    const middle = Math.min(1, Math.max(0, normalize(center, min, max)));
    return {
      scale: {
        min,
        max,
        colors: [at(min), at(center), at(max)],
        stops: [0, middle, 1],
        format,
        label,
      },
    };
  }
  return {
    scale: {
      min,
      max,
      colors: [
        sequentialColor(min, domain, colors).color,
        sequentialColor(max, domain, colors).color,
      ],
      format,
      label,
    },
  };
}
