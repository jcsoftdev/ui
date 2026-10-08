"use client";

import { DonutChart, type DonutChartProps } from "../donut-chart/donut-chart.js";

export type PieChartProps = Omit<
  DonutChartProps,
  "variant" | "innerRadius" | "centerLabel" | "centerValue"
>;

/**
 * A donut without the hole: same slices, rounded corners, gaps, explode on
 * hover, outside labels and legend toggling (see `DonutChart`).
 */
export function PieChart({ cornerRadius = 8, ...props }: PieChartProps) {
  return <DonutChart {...props} cornerRadius={cornerRadius} variant="pie" />;
}
