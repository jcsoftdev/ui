"use client";

import { useMemo } from "react";
import { CartesianChart } from "../core/cartesian/cartesian-chart.js";
import type { CartesianChartProps, CartesianSeries } from "../core/cartesian/types.js";
import type { ChartSeries } from "../core/types.js";

export interface BarChartProps
  extends Omit<
    CartesianChartProps,
    "series" | "curve" | "markers" | "gradient" | "brush" | "rightAxis" | "xScale"
  > {
  series: readonly ChartSeries[];
}

/**
 * Columns (`orientation="vertical"`, default) or horizontal bars. Several
 * series are grouped side by side, or piled with `stack`. Bars are rounded at
 * their value end only, negative values grow downwards (or to the left).
 */
export function BarChart({ series, ...props }: BarChartProps) {
  const columns = useMemo<CartesianSeries[]>(
    () => series.map((item) => ({ ...item, kind: "column" })),
    [series],
  );
  return <CartesianChart {...props} series={columns} />;
}
