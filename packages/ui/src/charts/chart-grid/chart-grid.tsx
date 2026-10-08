"use client";

import { type ReactNode, useId, useMemo, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartSyncProvider } from "../core/cartesian/sync.js";
import { ChartEmpty } from "../core/chart-states.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { useChartWidth } from "../core/use-chart-size.js";
import { type Extent, gridColumns, panelWidth, sharedDomain } from "./grid-math.js";

export interface ChartGridPanel {
  id: string;
  /** Heading of the panel, e.g. the barber. */
  title: string;
  /** Short line under the title, e.g. a total. */
  subtitle?: ReactNode;
  /** Range of this panel on the value axis; feeds the shared value domain. */
  extent?: Extent;
  /** Range on the x axis; feeds the shared x domain. */
  xExtent?: Extent;
}

export interface ChartGridContext {
  index: number;
  columns: number;
  /** Panel is narrow: hide secondary decoration (titles, extra ticks). */
  compact: boolean;
  /** Pixel height the chart of the panel should use. */
  height: number;
  /** Ticks the value axis can afford at that height (3 to 6); also what the shared domain was rounded for. */
  tickCount: number;
  /** Pass to the charts' `syncId` when `syncHover` is on: they then share one real crosshair and tooltip. */
  syncId?: string;
  /** Shared value-axis domain, or undefined when `sharedValueDomain` is off. */
  valueDomain?: readonly [number, number];
  /** Shared x-axis domain, or undefined when `sharedXDomain` is off. */
  xDomain?: readonly [number, number];
  /** Series id hovered in the shared legend. */
  highlight: string | null;
}

export interface ChartGridProps {
  /** Accessible name of the whole grid. */
  title: string;
  panels: readonly ChartGridPanel[];
  /** Renders the chart of one panel. Fill the panel: pass `ctx.height` and the shared domain on. */
  children: (panel: ChartGridPanel, context: ChartGridContext) => ReactNode;
  /** Narrowest a panel may get before the grid drops a column (container-based). */
  minPanelWidth?: number;
  maxColumns?: number;
  gap?: number;
  /** Height of every chart in pixels. Default: derived from the panel width (about 1.4:1), at least 180. */
  panelHeight?: number;
  /** Width / height ratio for the charts; wins over `panelHeight`. */
  aspectRatio?: number;
  /** One value domain for every panel (default true). */
  sharedValueDomain?: boolean;
  /** One x domain for every panel. */
  sharedXDomain?: boolean;
  /** Bars: keep zero inside the shared domain. */
  includeZero?: boolean;
  /** One legend for all panels (their own legends should be off). */
  legend?: readonly LegendItem[];
  /**
   * Hovering a panel shows the real crosshair and tooltip in every other panel.
   * The charts must receive `context.syncId` as their `syncId`; panels only
   * react when the hovered category exists in them.
   */
  syncHover?: boolean;
  /** Draw a border around every panel. */
  bordered?: boolean;
  /** Text when there are no panels. */
  emptyLabel?: string;
  className?: string;
}

const COMPACT_BELOW = 260;

/**
 * Small multiples (trellis): the same chart repeated per category over shared
 * scales, so panels compare at a glance. Columns follow the width of the
 * container, never the viewport.
 */
export function ChartGrid({
  title,
  panels,
  children,
  minPanelWidth = 220,
  maxColumns = 6,
  gap = 16,
  panelHeight,
  aspectRatio,
  sharedValueDomain = true,
  sharedXDomain = false,
  includeZero = false,
  legend,
  syncHover = false,
  bordered = false,
  emptyLabel = "No data",
  className,
}: ChartGridProps) {
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const uid = useId();
  const [highlight, setHighlight] = useState<string | null>(null);
  const columns = gridColumns(width, panels.length, { minPanelWidth, maxColumns, gap });
  const eachWidth = panelWidth(width, columns, gap);
  const chartHeight = Math.max(
    90,
    Math.round(
      aspectRatio ? eachWidth / aspectRatio : (panelHeight ?? Math.max(180, eachWidth / 1.4)),
    ),
  );
  const tickCount = Math.min(6, Math.max(3, Math.round((chartHeight - 60) / 42)));
  const valueDomain = useMemo(
    () =>
      sharedValueDomain
        ? (sharedDomain(
            panels.map((panel) => panel.extent),
            { includeZero, tickCount },
          ) ?? undefined)
        : undefined,
    [panels, sharedValueDomain, includeZero, tickCount],
  );
  const xDomain = useMemo(
    () =>
      sharedXDomain
        ? (sharedDomain(
            panels.map((panel) => panel.xExtent),
            { nice: false },
          ) ?? undefined)
        : undefined,
    [panels, sharedXDomain],
  );

  return (
    <ChartSyncProvider>
      <section
        ref={ref}
        aria-label={title}
        className={cn("@container/grid flex w-full min-w-0 flex-col gap-3", className)}
      >
        {legend && legend.length > 0 ? (
          <ChartLegend items={legend} onHighlight={setHighlight} className="px-1" />
        ) : null}
        {panels.length === 0 ? (
          <ChartEmpty height={chartHeight} label={emptyLabel} />
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }}
          >
            {panels.map((panel, index) => {
              const headingId = `${uid}-${panel.id}`;
              return (
                <article
                  key={panel.id}
                  aria-labelledby={headingId}
                  className={cn(
                    "flex min-w-0 flex-col gap-1.5",
                    bordered && "rounded-xl border border-line p-3",
                  )}
                >
                  <header className="flex min-w-0 items-baseline justify-between gap-2">
                    <h3
                      id={headingId}
                      className="m-0 truncate font-bold text-[12.5px] text-ink-2 leading-tight"
                    >
                      {panel.title}
                    </h3>
                    {panel.subtitle ? (
                      <span className="shrink-0 font-semibold text-[11.5px] text-ink-3 tabular-nums">
                        {panel.subtitle}
                      </span>
                    ) : null}
                  </header>
                  <div className="relative min-w-0">
                    {children(panel, {
                      index,
                      columns,
                      compact: eachWidth < COMPACT_BELOW,
                      height: chartHeight,
                      tickCount,
                      syncId: syncHover ? `${uid}-sync` : undefined,
                      valueDomain,
                      xDomain,
                      highlight,
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </ChartSyncProvider>
  );
}
