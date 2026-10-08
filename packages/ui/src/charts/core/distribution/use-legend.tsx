"use client";

import type { ReactNode } from "react";
import { ChartLegend, type LegendShape } from "../legend.js";
import { seriesColor } from "../palette.js";
import { useSeriesState } from "../use-series-state.js";

export interface LegendSource {
  id: string;
  name: string;
  color?: string;
}

export interface ColoredSeries<T extends LegendSource> {
  /** The original series. */
  source: T;
  id: string;
  name: string;
  color: string;
  /** Position in the original list (palette slot). */
  index: number;
}

export interface DistributionLegend<T extends LegendSource> {
  all: ColoredSeries<T>[];
  visible: ColoredSeries<T>[];
  highlighted: string | null;
  isDimmed: (id: string) => boolean;
  node: ReactNode;
  position: "top" | "bottom";
}

/**
 * Colors, legend toggling and highlight for a list of series. The legend shows
 * by default when there is more than one series; `legend` forces it on/off or
 * picks its position. A top legend moves below the plot in frames narrower
 * than `@md` (the chart root must be an `@container`).
 */
export function useDistributionLegend<T extends LegendSource>(
  series: readonly T[],
  legend: boolean | "top" | "bottom" | undefined,
  shape: LegendShape = "square",
): DistributionLegend<T> {
  const state = useSeriesState();
  const all = series.map((item, index) => ({
    source: item,
    id: item.id,
    name: item.name,
    color: seriesColor(index, item.color),
    index,
  }));
  const visible = all.filter((item) => !state.isHidden(item.id));
  const show = legend === undefined ? series.length > 1 : legend !== false;
  const node = show ? (
    <ChartLegend
      items={all.map((item) => ({
        id: item.id,
        name: item.name,
        color: item.color,
        shape,
        hidden: state.isHidden(item.id),
      }))}
      onToggle={series.length > 1 ? state.toggle : undefined}
      onHighlight={state.setHighlighted}
      className={legend === "bottom" ? undefined : "order-last @md:order-none"}
    />
  ) : null;
  return {
    all,
    visible,
    highlighted: state.highlighted,
    isDimmed: state.isDimmed,
    node,
    position: legend === "bottom" ? "bottom" : "top",
  };
}
