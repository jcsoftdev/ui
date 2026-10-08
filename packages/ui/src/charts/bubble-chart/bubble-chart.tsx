"use client";

import { XYPointChart, type XYPointChartProps } from "../core/distribution/xy-points.js";

export type BubbleChartProps = Omit<XYPointChartProps, "sized" | "radius">;

/**
 * Bubble chart: x, y and a third value as the bubble's area (radius grows
 * with the square root, so twice the value is twice the ink). Labels sit
 * inside large bubbles and next to small ones; a size key explains the scale.
 */
export function BubbleChart({ showLabels = true, ...props }: BubbleChartProps) {
  return <XYPointChart {...props} showLabels={showLabels} sized />;
}
