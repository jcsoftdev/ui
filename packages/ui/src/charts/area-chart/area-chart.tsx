"use client";

import { useMemo } from "react";
import { CartesianChart } from "../core/cartesian/cartesian-chart.js";
import type { CartesianChartProps, CartesianSeries } from "../core/cartesian/types.js";
import type { ChartSeries } from "../core/types.js";

export interface AreaChartProps
  extends Omit<CartesianChartProps, "series" | "orientation" | "barRadius" | "rightAxis"> {
  series: readonly ChartSeries[];
}

/**
 * Volume over time with a soft gradient fill. `stack="normal"` piles series
 * into a total; `stack="percent"` shows each one's share of 100%.
 */
export function AreaChart({ series, curve = "smooth", ...props }: AreaChartProps) {
  const areas = useMemo<CartesianSeries[]>(
    () => series.map((item) => ({ ...item, kind: "area" })),
    [series],
  );
  return <CartesianChart {...props} curve={curve} series={areas} />;
}
