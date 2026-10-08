"use client";

import { useMemo } from "react";
import { CartesianChart } from "../core/cartesian/cartesian-chart.js";
import type { CartesianChartProps, CartesianSeries } from "../core/cartesian/types.js";
import { seriesColor } from "../core/palette.js";
import type { ChartSeries } from "../core/types.js";

/** One series of bars. Give `ranges` instead of `data` for floating bars. */
export interface BarSeries extends Omit<ChartSeries, "data"> {
  /** One value per category; `null` leaves a gap. Not needed with `ranges`. */
  data?: ReadonlyArray<number | null>;
  /**
   * Floating bars: `[start, end]` per category (range column or range bar).
   * The value shown on tooltips and labels is the end; both ends are rounded.
   */
  ranges?: ReadonlyArray<readonly [number, number] | null>;
  /**
   * With `stack`, series of the same group pile up and every group is a
   * column of its own next to the others (grouped stacked bars).
   */
  stackGroup?: string;
  /** Color of each bar; `undefined` entries keep the series color. */
  colors?: ReadonlyArray<string | undefined>;
}

export interface BarChartProps
  extends Omit<
    CartesianChartProps,
    "series" | "curve" | "markers" | "gradient" | "brush" | "rightAxis" | "xScale"
  > {
  series: readonly BarSeries[];
  /** One palette color per bar instead of one per series (single-series charts). */
  distributed?: boolean;
}

function toSeries(item: BarSeries, index: number, distributed: boolean): CartesianSeries {
  const { ranges, colors, data, ...rest } = item;
  const base: CartesianSeries = {
    ...rest,
    kind: "column",
    data: ranges ? ranges.map((range) => (range ? range[1] : null)) : (data ?? []),
  };
  if (ranges) base.from = ranges.map((range) => (range ? range[0] : null));
  if (colors) base.pointColors = colors;
  else if (distributed) {
    base.pointColors = base.data.map((_, position) => seriesColor(position + index));
  }
  return base;
}

/**
 * Columns (`orientation="vertical"`, default) or horizontal bars. Several
 * series are grouped side by side, or piled with `stack`. Bars are rounded at
 * their value end only, negative values grow downwards (or to the left).
 *
 * Also: floating `ranges`, `stackGroup` piles side by side, `categoryGroups`
 * labels under the axis, a `reversed` value axis (`yAxis.reversed`), SVG
 * `pattern` fills per series, per-bar `colors` / `distributed`, and
 * `onCategoryClick` for drill-down.
 */
export function BarChart({ series, distributed = false, ...props }: BarChartProps) {
  const columns = useMemo<CartesianSeries[]>(
    () => series.map((item, index) => toSeries(item, index, distributed)),
    [series, distributed],
  );
  return <CartesianChart {...props} series={columns} />;
}
