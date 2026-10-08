"use client";

import { useMemo } from "react";
import { ChartBreadcrumb } from "../core/breadcrumb.js";
import type { HierarchyDatum } from "../core/hierarchy.js";
import { useDrill } from "../core/use-drill.js";
import { LineChart, type LineChartProps } from "./line-chart.js";

export interface LineDrilldownProps
  extends Omit<LineChartProps, "categories" | "series" | "onPointClick"> {
  /**
   * Hierarchy to walk. The children of the focused node are the points of the
   * line, in the order given; a node's value is its own or the sum of its children.
   */
  data: HierarchyDatum;
  /** Name of the line in legend and tooltip. */
  seriesName?: string;
  /** Accessible name of the breadcrumb landmark. */
  breadcrumbLabel?: string;
}

/**
 * A line chart you can drill into: click (or press Enter on) a point that has
 * children to zoom into it, and use the breadcrumb to climb back out.
 */
export function LineDrilldown({
  data,
  seriesName,
  breadcrumbLabel = "Drilldown path",
  ...props
}: LineDrilldownProps) {
  const { focus, path, drill } = useDrill(data, false);
  const categories = useMemo(() => focus.children.map((node) => node.name), [focus]);
  const series = useMemo(
    () => [
      {
        id: focus.id,
        name: seriesName ?? focus.name,
        data: focus.children.map((node) => node.value),
      },
    ],
    [focus, seriesName],
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <ChartBreadcrumb
        items={path.map((node) => ({ id: node.id, name: node.name }))}
        onSelect={drill}
        label={breadcrumbLabel}
      />
      <div className="min-h-0 flex-1">
        <LineChart
          key={focus.id}
          {...props}
          categories={categories}
          series={series}
          onPointClick={({ index }) => {
            const node = focus.children[index];
            if (node) drill(node.id);
          }}
        />
      </div>
    </div>
  );
}
