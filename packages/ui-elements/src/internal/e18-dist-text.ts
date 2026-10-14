// Loaded on demand by the distribution charts: the tooltip rows and the data table snapshot are only
// needed once something is hovered, focused or read, so they stay out of the eager graph.
import type { BoxStats } from "@jcsoftdev/ui-core/chart/distribution";
import type { ValueFormatter } from "@jcsoftdev/ui-core/chart/format";
import type { ChartSnapshot, SnapshotSeries, TooltipRow } from "./chart-base.js";
import type { StatLabels } from "./e18-dist.js";

/** Tooltip rows for a five-number summary. */
export function boxTooltipRows(
  stats: BoxStats,
  labels: StatLabels,
  format: ValueFormatter,
  color: string,
  showMean = true,
): TooltipRow[] {
  const row = (id: string, name: string, value: string, emphasis = false): TooltipRow => ({
    id,
    name,
    value,
    color,
    shape: "square",
    emphasis,
  });
  const rows = [
    row("max", labels.max, format(stats.max)),
    row("q3", labels.q3, format(stats.q3)),
    row("median", labels.median, format(stats.median)),
    row("q1", labels.q1, format(stats.q1)),
    row("min", labels.min, format(stats.min)),
  ];
  if (showMean) rows.push(row("mean", labels.mean, format(stats.mean)));
  rows.push(row("count", labels.count, String(stats.count), true));
  if (stats.outliers.length)
    rows.push(row("outliers", labels.outliers, String(stats.outliers.length)));
  return rows;
}

/** The summary of every box, violin or cloud as data table columns and legend items. */
export function statsSnapshot(
  title: string,
  rows: ReadonlyArray<{ name: string; stats: BoxStats | null; format: ValueFormatter }>,
  labels: StatLabels,
  legend: ReadonlyArray<{ id: string; name: string; color: string }>,
): ChartSnapshot {
  const keys = ["count", "min", "q1", "median", "q3", "max", "mean", "outliers"] as const;
  const series: SnapshotSeries[] = keys.map((key) => ({
    id: key,
    name: labels[key],
    color: "transparent",
    values: rows.map(({ stats }) => {
      if (!stats) return null;
      return key === "outliers" ? stats.outliers.length : stats[key];
    }),
    text: rows.map(({ stats, format }) => {
      if (!stats) return "";
      if (key === "count") return String(stats.count);
      if (key === "outliers") return stats.outliers.map(format).join(", ");
      return format(stats[key]);
    }),
  }));
  return {
    title,
    categoryHeader: labels.category,
    categories: rows.map((row) => row.name),
    series,
    legend: legend.map((item) => ({ ...item, shape: "square" as const })),
  };
}
