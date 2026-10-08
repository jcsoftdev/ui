"use client";

import { useMemo } from "react";
import { CartesianChart } from "../core/cartesian/cartesian-chart.js";
import type { CartesianChartProps, CartesianSeries } from "../core/cartesian/types.js";
import type { ChartSeries } from "../core/types.js";

export interface LineChartProps
  extends Omit<
    CartesianChartProps,
    "series" | "orientation" | "stack" | "gradient" | "lineGradient" | "barRadius" | "rightAxis"
  > {
  series: readonly ChartSeries[];
  /** Strokes each line with a gradient from its color towards the next palette color. */
  gradient?: boolean;
}

/**
 * Trends over categories or time. Smooth monotone curves by default (they
 * never overshoot the data), straight with `curve="linear"`; `dashed` series
 * for forecasts or comparisons; `brush` for zooming long date ranges. Other
 * curves: `"step"`, `"step-before"`, `"step-after"` for values that hold until
 * they change (stock levels, prices).
 */
export function LineChart({
  series,
  curve = "smooth",
  gradient = false,
  ...props
}: LineChartProps) {
  const lines = useMemo<CartesianSeries[]>(
    () => series.map((item) => ({ ...item, kind: "line" })),
    [series],
  );
  return <CartesianChart {...props} curve={curve} lineGradient={gradient} series={lines} />;
}
