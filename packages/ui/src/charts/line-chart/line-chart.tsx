"use client";

import { useMemo } from "react";
import { CartesianChart } from "../core/cartesian/cartesian-chart.js";
import type { CartesianChartProps, CartesianSeries } from "../core/cartesian/types.js";
import type { ChartSeries } from "../core/types.js";

export interface LineChartProps
  extends Omit<
    CartesianChartProps,
    "series" | "orientation" | "stack" | "gradient" | "barRadius" | "rightAxis"
  > {
  series: readonly ChartSeries[];
}

/**
 * Trends over categories or time. Smooth monotone curves by default (they
 * never overshoot the data), straight with `curve="linear"`; `dashed` series
 * for forecasts or comparisons; `brush` for zooming long date ranges.
 */
export function LineChart({ series, curve = "smooth", ...props }: LineChartProps) {
  const lines = useMemo<CartesianSeries[]>(
    () => series.map((item) => ({ ...item, kind: "line" })),
    [series],
  );
  return <CartesianChart {...props} curve={curve} series={lines} />;
}
