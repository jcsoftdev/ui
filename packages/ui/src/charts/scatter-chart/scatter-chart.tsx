"use client";

import { XYPointChart, type XYPointChartProps } from "../core/distribution/xy-points.js";

export type ScatterChartProps = Omit<
  XYPointChartProps,
  "sized" | "sizeRange" | "sizeLegend" | "sizeFormat"
>;

/**
 * Scatter plot: one dot per observation on two numeric axes, several series,
 * an optional least-squares trend line per series and quadrant annotations.
 */
export function ScatterChart(props: ScatterChartProps) {
  return <XYPointChart {...props} sized={false} />;
}
