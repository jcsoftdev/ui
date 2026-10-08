import { type ChartLabels, DEFAULT_LABELS } from "../types.js";

/** Statistic names shown in tooltips and data tables. English defaults. */
export interface StatLabels {
  count: string;
  min: string;
  q1: string;
  median: string;
  q3: string;
  max: string;
  mean: string;
  outliers: string;
  outlier: string;
  density: string;
  frequency: string;
  range: string;
  trend: string;
  size: string;
  value: string;
  series: string;
  point: string;
  /** Toggle that explodes histogram bins into dots. */
  explode: string;
}

export const DEFAULT_STAT_LABELS: StatLabels = {
  count: "n",
  min: "Min",
  q1: "Q1",
  median: "Median",
  q3: "Q3",
  max: "Max",
  mean: "Mean",
  outliers: "Outliers",
  outlier: "Outlier",
  density: "Density",
  frequency: "Count",
  range: "Range",
  trend: "Trend",
  size: "Size",
  value: "Value",
  series: "Series",
  point: "Point",
  explode: "Show each observation",
};

export type DistributionLabels = ChartLabels & StatLabels;

export function resolveDistributionLabels(
  labels?: Partial<DistributionLabels>,
): DistributionLabels {
  return { ...DEFAULT_LABELS, ...DEFAULT_STAT_LABELS, ...labels };
}
