"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { PlotExplorer } from "../core/distribution/explorer.js";
import type { DistributionSeries } from "../core/distribution/geometry.js";
import { type DistributionLabels, resolveDistributionLabels } from "../core/distribution/labels.js";
import {
  categoryLayout,
  type DistributionAxisOptions,
  tooltipFit,
} from "../core/distribution/layout.js";
import {
  BoxGlyph,
  BoxStatsTable,
  boxTooltipRows,
  boxValueText,
  CategoryAxes,
} from "../core/distribution/marks.js";
import { type BoxStats, boxStats } from "../core/distribution/stats.js";
import { type ColoredSeries, useDistributionLegend } from "../core/distribution/use-legend.js";
import { resolveFormat, type ValueFormat, type ValueFormatter } from "../core/format.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { ChartTooltip } from "../core/tooltip.js";

export interface BoxPlotProps {
  /** Accessible name of the chart and caption of its data table. */
  title: string;
  /** One box (per series) for each category, e.g. the barbers. */
  categories: readonly string[];
  /** `data[i]` holds the raw samples of `categories[i]`. Several series are drawn side by side. */
  series: readonly DistributionSeries[];
  /** "vertical": boxes stand on the x axis. "horizontal": one row per category. */
  orientation?: "vertical" | "horizontal";
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  /** Tukey fence multiplier; `Infinity` stretches the whiskers to min and max. */
  whisker?: number;
  /** Diamond on the mean. */
  showMean?: boolean;
  /** Dots for values outside the whiskers. */
  showOutliers?: boolean;
  /** Height of the drawing in pixels. */
  height?: number;
  /** Shown automatically with more than one series. */
  legend?: boolean | "top" | "bottom";
  grid?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<DistributionLabels>;
  className?: string;
}

interface BoxItem {
  key: string;
  category: number;
  series: ColoredSeries<DistributionSeries>;
  stats: BoxStats;
  center: number;
  size: number;
  format: ValueFormatter;
}

/**
 * Box-and-whisker plot: median, quartiles, Tukey whiskers, outliers and the
 * mean for every category, optionally grouped by series.
 */
export function BoxPlot({
  title,
  categories,
  series,
  orientation = "vertical",
  valueFormat,
  valueAxis,
  whisker = 1.5,
  showMean = true,
  showOutliers = true,
  height = 320,
  legend,
  grid = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelsProp,
  className,
}: BoxPlotProps) {
  const labels = resolveDistributionLabels(labelsProp);
  const legendState = useDistributionLegend(series, legend);
  const stats = useMemo(
    () =>
      series.map((item) => categories.map((_, index) => boxStats(item.data[index] ?? [], whisker))),
    [series, categories, whisker],
  );
  const empty = !stats.some((row) => row.some(Boolean));
  const fallback = resolveFormat(valueFormat);
  return (
    <ChartFrame
      height={height}
      labels={labels}
      loading={loading}
      empty={empty}
      className={cn("@container", className)}
      legend={legendState.node}
      legendPosition={legendState.position}
      table={
        <BoxStatsTable
          caption={title}
          labels={labels}
          rows={legendState.all.flatMap((item) =>
            categories.map((category, index) => ({
              name: series.length > 1 ? `${category} · ${item.name}` : category,
              stats: stats[item.index]?.[index] ?? null,
              format: item.source.format ? resolveFormat(item.source.format) : fallback,
            })),
          )}
        />
      }
    >
      {(width) => (
        <BoxPlotPlot
          width={width}
          height={height}
          title={title}
          categories={categories}
          visible={legendState.visible}
          stats={stats}
          orientation={orientation}
          valueFormat={valueFormat}
          valueAxis={valueAxis}
          showMean={showMean}
          showOutliers={showOutliers}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          isDimmed={legendState.isDimmed}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  title: string;
  categories: readonly string[];
  visible: ColoredSeries<DistributionSeries>[];
  stats: ReadonlyArray<ReadonlyArray<BoxStats | null>>;
  orientation: "vertical" | "horizontal";
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  showMean: boolean;
  showOutliers: boolean;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: DistributionLabels;
  isDimmed: (id: string) => boolean;
}

function BoxPlotPlot({
  width,
  height,
  title,
  categories,
  visible,
  stats,
  orientation,
  valueFormat,
  valueAxis,
  showMean,
  showOutliers,
  grid,
  tooltip,
  animate,
  labels,
  isDimmed,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const { layout, items } = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const item of visible) {
      for (const summary of stats[item.index] ?? []) {
        if (!summary) continue;
        lo = Math.min(lo, showOutliers ? summary.min : summary.lowerWhisker);
        hi = Math.max(hi, showOutliers ? summary.max : summary.upperWhisker);
      }
    }
    const layout = categoryLayout({
      width,
      height,
      orientation,
      categories,
      seriesCount: visible.length,
      extent: Number.isFinite(lo) ? [lo, hi] : null,
      valueFormat,
      axis: valueAxis,
    });
    const items: BoxItem[] = [];
    const fallback = resolveFormat(valueFormat);
    categories.forEach((_, category) => {
      visible.forEach((item, slotIndex) => {
        const summary = stats[item.index]?.[category];
        if (!summary) return;
        const slot = layout.slot(category, slotIndex);
        items.push({
          key: `${item.id}-${category}`,
          category,
          series: item,
          stats: summary,
          center: slot.center,
          size: Math.min(slot.size * 0.72, 72),
          format: item.source.format ? resolveFormat(item.source.format) : fallback,
        });
      });
    });
    return { layout, items };
  }, [
    width,
    height,
    orientation,
    categories,
    visible,
    stats,
    valueFormat,
    valueAxis,
    showOutliers,
  ]);

  const { margin, innerWidth, innerHeight, horizontal, valueScale } = layout;
  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-enter]").forEach((box, index) => {
        box.animate(
          [
            { opacity: 0, transform: horizontal ? "scaleX(0.4)" : "scaleY(0.4)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 520, delay: index * 45, easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate, replayKey: categories.length },
  );

  const map = valueScale.map;
  const current = active != null ? items[active] : undefined;
  const pick = (x: number, y: number) => {
    const cross = horizontal ? y : x;
    let best: number | null = null;
    let distance = layout.band.step / 2;
    items.forEach((item, index) => {
      const d = Math.abs(item.center - cross);
      if (d <= distance) {
        best = index;
        distance = d;
      }
    });
    return best;
  };
  const name = (item: BoxItem) =>
    visible.length > 1
      ? `${categories[item.category]} · ${item.series.name}`
      : (categories[item.category] as string);

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          <CategoryAxes layout={layout} title={valueAxis?.title} grid={grid} />
          {current ? (
            <rect
              x={
                horizontal
                  ? 0
                  : current.center - layout.band.step / (2 * Math.max(1, visible.length))
              }
              y={
                horizontal
                  ? current.center - layout.band.step / (2 * Math.max(1, visible.length))
                  : 0
              }
              width={horizontal ? innerWidth : layout.band.step / Math.max(1, visible.length)}
              height={horizontal ? layout.band.step / Math.max(1, visible.length) : innerHeight}
              rx={8}
              style={{ fill: "var(--chart-grid)", opacity: 0.6 }}
            />
          ) : null}
          {items.map((item, index) => (
            <g
              key={item.key}
              data-enter=""
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            >
              <BoxGlyph
                stats={item.stats}
                map={map}
                center={item.center}
                size={item.size}
                horizontal={horizontal}
                color={item.series.color}
                showMean={showMean}
                showOutliers={showOutliers}
                dimmed={isDimmed(item.series.id)}
                active={active === index}
              />
            </g>
          ))}
        </g>
      </svg>
      <PlotExplorer
        count={items.length}
        active={active}
        onActiveChange={setActive}
        pick={pick}
        label={labels.explore}
        valueText={
          current ? boxValueText(name(current), current.stats, labels, current.format) : title
        }
        margin={margin}
        width={innerWidth}
        height={innerHeight}
      />
      {tooltip && current ? (
        <ChartTooltip
          x={margin.left + (horizontal ? map(current.stats.q3) : current.center + current.size / 2)}
          y={margin.top + (horizontal ? current.center : map(current.stats.median))}
          {...tooltipFit(width)}
          title={name(current)}
          rows={boxTooltipRows(
            current.stats,
            labels,
            current.format,
            current.series.color,
            showMean,
          )}
        />
      ) : null}
    </div>
  );
}
