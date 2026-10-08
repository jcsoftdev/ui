"use client";

import { useCallback, useMemo } from "react";
import { cn } from "../../utils/cn.js";
import { ChartBreadcrumb } from "../core/breadcrumb.js";
import type { HierarchyDatum } from "../core/hierarchy.js";
import { seriesColor } from "../core/palette.js";
import { useDrill } from "../core/use-drill.js";
import { BarChart, type BarChartProps } from "./bar-chart.js";

export interface DrilldownBarChartProps
  extends Omit<BarChartProps, "series" | "categories" | "onCategoryClick" | "distributed"> {
  /** Tree to explore: the chart shows the children of the focused node. */
  data: HierarchyDatum;
  /** Name of the single series (tooltip and data table). */
  seriesName?: string;
  /** Accessible name of the breadcrumb navigation. */
  breadcrumbLabel?: string;
  /** Largest first (default) or in data order. */
  sort?: boolean;
}

/**
 * Bars of one level of a hierarchy. Click (or Enter on) a bar that has
 * children to drill into it; the breadcrumb above brings you back out.
 * Bars that can be opened carry a `›` after their label.
 */
export function DrilldownBarChart({
  data,
  seriesName = "Value",
  breadcrumbLabel = "Drill-down path",
  sort = true,
  height,
  className,
  ...rest
}: DrilldownBarChartProps) {
  const { focus, path, drill } = useDrill(data, sort);
  const items = focus.children;
  const categories = useMemo(() => items.map((node) => node.name), [items]);
  const series = useMemo(
    () => [
      {
        id: focus.id,
        name: seriesName,
        data: items.map((node) => node.value),
        colors: items.map((node, index) => node.color ?? seriesColor(index)),
      },
    ],
    [focus.id, items, seriesName],
  );
  const drillable = useMemo(
    () => new Set(items.filter((node) => node.children.length > 0).map((node) => node.name)),
    [items],
  );
  const label = useCallback(
    (value: string | number | Date) =>
      drillable.has(String(value)) ? `${value} ›` : String(value),
    [drillable],
  );
  const fill = height === "fill";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-2", fill && "h-full", className)}>
      <ChartBreadcrumb
        items={path.map((node) => ({ id: node.id, name: node.name }))}
        onSelect={drill}
        label={breadcrumbLabel}
      />
      <div className={cn("min-w-0", fill && "min-h-0 flex-1")}>
        <BarChart
          {...rest}
          height={height}
          legend={false}
          categories={categories}
          series={series}
          xFormat={label}
          onCategoryClick={(index) => {
            const node = items[index];
            if (node) drill(node.id);
          }}
        />
      </div>
    </div>
  );
}
