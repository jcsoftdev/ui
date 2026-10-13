"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { cn } from "../../utils/cn.js";
import {
  type ChartDockMode,
  ChartDockProvider,
  resolveDocked,
  useCoarsePointer,
} from "./chart-dock.js";
import { ChartEmpty, ChartSkeleton } from "./chart-states.js";
import { useTouchSelection } from "./touch-select.js";
import type { ChartLabels } from "./types.js";
import { resolveDrawingHeight, useChartSize } from "./use-chart-size.js";

/** Smallest drawing height while filling a parent that has no height of its own. */
const FILL_MIN_HEIGHT = 120;

export interface ChartFrameProps {
  /**
   * Height of the drawing area in pixels (legend and brush are extra), or
   * `"fill"` to take whatever height the parent leaves after the legend and
   * footer. The parent needs a definite height (fixed, flex or grid sized).
   * A function derives the height from the measured width.
   */
  height: number | "fill" | ((width: number) => number);
  /** Width / height ratio of the drawing. Wins over a pixel `height`; ignored with `"fill"`. */
  aspectRatio?: number;
  labels: ChartLabels;
  loading?: boolean;
  /** Nothing to plot: renders the empty state instead of `children`. */
  empty?: boolean;
  /** Skeleton silhouette while loading. */
  skeleton?: "bars" | "line" | "ring";
  legend?: ReactNode;
  legendPosition?: "top" | "bottom";
  /**
   * Polar charts: when the container is wide (`@lg/chart`) the legend moves
   * to a column beside the drawing instead of stacking above or below it.
   */
  legendAside?: boolean;
  /** Accessible data table (usually `ChartDataTable`), rendered after the drawing. */
  table?: ReactNode;
  /**
   * Where a chart's details go. `auto` (default) docks them in a panel under the drawing when the
   * frame is 480px wide or less, or the primary pointer is coarse; `always` / `never` force it.
   * The panel reserves a fixed height (it scrolls past that), so the content below never jumps.
   */
  dock?: ChartDockMode;
  /** Content under the drawing, e.g. the brush. Hidden while loading or empty. */
  footer?: ReactNode;
  className?: string;
  /** Receives the measured width and the drawing height (a fallback on the server). */
  children: (width: number, height: number) => ReactNode;
}

/**
 * Shared outer shell for every chart: measures its slot (width and, when
 * filling, height), swaps in the loading or empty state, and places the
 * legend, drawing, footer and the hidden data table in a consistent order.
 * The root has no padding or margin: the drawing touches the container edges.
 */
export function ChartFrame({
  height,
  aspectRatio,
  labels,
  loading,
  empty,
  skeleton = "bars",
  legend,
  legendPosition = "top",
  legendAside = false,
  table,
  footer,
  dock = "auto",
  className,
  children,
}: ChartFrameProps) {
  const [ref, size] = useChartSize<HTMLDivElement>();
  const [rootRef, rootSize] = useChartSize<HTMLDivElement>();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const coarse = useCoarsePointer();
  const fill = height === "fill";
  const drawingHeight = resolveDrawingHeight({
    height,
    aspectRatio,
    width: size.width,
    measured: size.height,
  });
  const ready = !loading && !empty;
  const docked = ready && resolveDocked(dock, rootSize.width, coarse);
  const readDetails = useCallback(
    () => rootRef.current?.querySelector("[data-chart-tooltip]")?.textContent ?? null,
    [],
  );
  useTouchSelection(ref, readDetails, ready);
  const dockValue = useMemo(() => ({ slot, docked }), [slot, docked]);
  const legendNode =
    ready && legend ? (
      legendAside ? (
        <div className="@lg/chart:order-last @lg/chart:w-44 @lg/chart:shrink-0 @lg/chart:[&_ul]:flex-col @lg/chart:[&_ul]:flex-nowrap @lg/chart:[&_ul]:items-start">
          {legend}
        </div>
      ) : (
        legend
      )
    ) : null;

  return (
    <div
      ref={rootRef}
      className={cn("@container/chart relative w-full min-w-0", fill && "h-full", className)}
    >
      <ChartDockProvider value={dockValue}>
        <div
          className={cn(
            "flex w-full min-w-0 flex-col gap-2",
            fill && "h-full",
            legendAside && "@lg/chart:flex-row @lg/chart:items-center @lg/chart:gap-4",
          )}
        >
          {legendPosition === "top" ? legendNode : null}
          <div
            ref={ref}
            className={cn(
              "relative min-w-0",
              fill
                ? "min-h-0 flex-1 basis-0 @lg/chart:self-stretch"
                : cn("w-full", legendAside && "@lg/chart:w-auto @lg/chart:flex-1"),
            )}
            style={fill ? { minHeight: FILL_MIN_HEIGHT } : { height: drawingHeight }}
          >
            {loading ? (
              <ChartSkeleton height={drawingHeight} label={labels.loading} shape={skeleton} />
            ) : empty ? (
              <ChartEmpty height={drawingHeight} label={labels.empty} />
            ) : (
              children(size.width, drawingHeight)
            )}
          </div>
          {docked ? (
            <div
              ref={setSlot}
              data-chart-dock=""
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="h-40 shrink-0 overflow-y-auto overscroll-contain"
            />
          ) : null}
          {ready ? footer : null}
          {legendPosition === "bottom" ? legendNode : null}
          {ready ? table : null}
        </div>
      </ChartDockProvider>
    </div>
  );
}
