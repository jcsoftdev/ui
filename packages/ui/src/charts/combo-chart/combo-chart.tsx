"use client";

import { useMemo } from "react";
import { CartesianChart } from "../core/cartesian/cartesian-chart.js";
import type { CartesianChartProps, CartesianSeries } from "../core/cartesian/types.js";
import type { ChartSeries } from "../core/types.js";

export interface ComboSeries extends ChartSeries {
  type: "column" | "line" | "area";
  /** Measure against the right axis (configure it with `rightAxis`). */
  axis?: "left" | "right";
}

export interface ComboChartProps
  extends Omit<CartesianChartProps, "series" | "orientation" | "brush" | "xScale"> {
  series: readonly ComboSeries[];
}

/**
 * Columns and lines on one plot, e.g. revenue as columns with appointments
 * as a line on a second axis. `stack` applies to the columns only.
 */
export function ComboChart({ series, curve = "smooth", ...props }: ComboChartProps) {
  const mixed = useMemo<CartesianSeries[]>(
    () => series.map(({ type, ...item }) => ({ ...item, kind: type })),
    [series],
  );
  return <CartesianChart {...props} curve={curve} series={mixed} />;
}
