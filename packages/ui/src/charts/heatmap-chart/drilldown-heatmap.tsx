"use client";

import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartBreadcrumb } from "../core/breadcrumb.js";
import type { ValueFormat } from "../core/format.js";
import { HeatmapChart, type HeatmapChartProps } from "./heatmap-chart.js";
import type { HeatmapCellInfo } from "./heatmap-grid.js";

/** One matrix of a drill-down: the root, or the detail behind a cell. */
export interface HeatmapLevel {
  /** Name in the breadcrumb and, unless `title` is set, the chart title. */
  name: string;
  title?: string;
  rows: readonly string[];
  columns: ReadonlyArray<string | Date>;
  values: ReadonlyArray<ReadonlyArray<number | null>>;
  /** Fixed color domain of this level; the data extent by default. */
  domain?: readonly [number, number];
  valueFormat?: ValueFormat;
  /**
   * Detail behind a cell (for example the days of a month, or the hours of a
   * day). Return null or undefined when the cell has nothing underneath.
   */
  drill?: (cell: HeatmapCellInfo) => HeatmapLevel | null | undefined;
}

export interface DrilldownHeatmapProps
  extends Omit<
    HeatmapChartProps,
    "title" | "rows" | "columns" | "values" | "domain" | "valueFormat" | "onCellClick"
  > {
  /** Accessible name when a level has no `title`. */
  title: string;
  root: HeatmapLevel;
  /** Accessible name of the breadcrumb landmark. */
  breadcrumbLabel?: string;
  onLevelChange?: (path: readonly HeatmapLevel[]) => void;
}

/**
 * Heatmap you can dive into: click (or press Enter on) a cell to open the
 * matrix behind it. The breadcrumb above climbs back to any earlier level.
 */
export function DrilldownHeatmap({
  title,
  root,
  breadcrumbLabel = "Path",
  onLevelChange,
  className,
  ...chart
}: DrilldownHeatmapProps) {
  const [path, setPath] = useState<readonly HeatmapLevel[]>([root]);
  // A new root (new data) starts again from the top.
  const [seenRoot, setSeenRoot] = useState(root);
  if (seenRoot !== root) {
    setSeenRoot(root);
    setPath([root]);
  }
  const level = path[path.length - 1] as HeatmapLevel;
  const move = (next: readonly HeatmapLevel[]) => {
    setPath(next);
    onLevelChange?.(next);
  };
  const open = (cell: HeatmapCellInfo) => {
    const child = level.drill?.(cell);
    if (child) move([...path, child]);
  };
  return (
    <div className={cn("@container flex min-w-0 flex-col gap-2", className)}>
      {path.length > 1 ? (
        <ChartBreadcrumb
          label={breadcrumbLabel}
          items={path.map((item, index) => ({ id: String(index), name: item.name }))}
          onSelect={(id) => move(path.slice(0, Number(id) + 1))}
          className="px-1"
        />
      ) : null}
      <HeatmapChart
        key={path.map((item) => item.name).join("/")}
        {...chart}
        title={level.title ?? (path.length > 1 ? level.name : title)}
        rows={level.rows}
        columns={level.columns}
        values={level.values}
        domain={level.domain}
        valueFormat={level.valueFormat}
        onCellClick={level.drill ? open : undefined}
      />
    </div>
  );
}
