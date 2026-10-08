"use client";

import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";
import { ChartEmpty, ChartSkeleton } from "./chart-states.js";
import type { ChartLabels } from "./types.js";
import { useChartWidth } from "./use-chart-size.js";

export interface ChartFrameProps {
  /** Height of the drawing area in pixels (legend and brush are extra). */
  height: number;
  labels: ChartLabels;
  loading?: boolean;
  /** Nothing to plot: renders the empty state instead of `children`. */
  empty?: boolean;
  /** Skeleton silhouette while loading. */
  skeleton?: "bars" | "line" | "ring";
  legend?: ReactNode;
  legendPosition?: "top" | "bottom";
  /** Accessible data table (usually `ChartDataTable`), rendered after the drawing. */
  table?: ReactNode;
  /** Content under the drawing, e.g. the brush. Hidden while loading or empty. */
  footer?: ReactNode;
  className?: string;
  /** Receives the measured width (a fallback on the server). */
  children: (width: number) => ReactNode;
}

/**
 * Shared outer shell for every chart: measures the width, swaps in the
 * loading or empty state, and places the legend, drawing, footer and the
 * hidden data table in a consistent order.
 */
export function ChartFrame({
  height,
  labels,
  loading,
  empty,
  skeleton = "bars",
  legend,
  legendPosition = "top",
  table,
  footer,
  className,
  children,
}: ChartFrameProps) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const ready = !loading && !empty;
  return (
    <div className={cn("relative flex w-full min-w-0 flex-col gap-2", className)}>
      {ready && legend && legendPosition === "top" ? legend : null}
      <div ref={ref} className="relative w-full min-w-0" style={{ height }}>
        {loading ? (
          <ChartSkeleton height={height} label={labels.loading} shape={skeleton} />
        ) : empty ? (
          <ChartEmpty height={height} label={labels.empty} />
        ) : (
          children(width)
        )}
      </div>
      {ready ? footer : null}
      {ready && legend && legendPosition === "bottom" ? legend : null}
      {ready ? table : null}
    </div>
  );
}
