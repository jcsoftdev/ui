"use client";

import { useMemo } from "react";
import { seriesColor } from "../core/palette.js";
import { type AlluvialInput, alluvialGraph } from "../core/sankey.js";
import { SankeyChart, type SankeyChartProps } from "./sankey-chart.js";

export interface AlluvialChartProps
  extends AlluvialInput,
    Omit<
      SankeyChartProps,
      "nodes" | "links" | "compare" | "columns" | "align" | "relax" | "legendItems"
    > {}

/**
 * Alluvial diagram: how the same categories flow from one moment to the next
 * (client segments month by month, services chosen by season). Each stage is a
 * column; every category keeps its color and its place from top to bottom, so
 * the eye follows who moved where. Built on `SankeyChart`.
 */
export function AlluvialChart({
  stages,
  categories,
  flows,
  linkColor,
  ...rest
}: AlluvialChartProps) {
  const coloured = useMemo(
    () =>
      categories.map((category, index) => ({
        ...category,
        color: seriesColor(index, category.color),
      })),
    [categories],
  );
  const graph = useMemo(
    () => alluvialGraph({ stages, categories: coloured, flows }),
    [stages, coloured, flows],
  );
  return (
    <SankeyChart
      {...rest}
      nodes={graph.nodes}
      links={graph.links}
      columns={stages}
      align="left"
      relax={false}
      linkColor={linkColor ?? "source"}
      legendItems={coloured.map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
      }))}
    />
  );
}
