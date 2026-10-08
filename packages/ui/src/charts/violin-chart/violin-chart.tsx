"use client";

import { memo, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { PlotExplorer } from "../core/distribution/explorer.js";
import { type DistributionSeries, toXY, violinPath } from "../core/distribution/geometry.js";
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
import { ObservationDots } from "../core/distribution/observations.js";
import {
  groupSeed,
  type JitteredValue,
  jitterValues,
  type PointColoring,
} from "../core/distribution/points.js";
import {
  type BoxStats,
  boxStats,
  type DensityPoint,
  gaussianKde,
  silvermanBandwidth,
} from "../core/distribution/stats.js";
import { type ColoredSeries, useDistributionLegend } from "../core/distribution/use-legend.js";
import { resolveFormat, type ValueFormat, type ValueFormatter } from "../core/format.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { ChartTooltip } from "../core/tooltip.js";

export type ViolinInner = "box" | "quartiles" | "none";

export interface ViolinChartProps {
  title: string;
  categories: readonly string[];
  /** `data[i]` holds the raw samples of `categories[i]`. */
  series: readonly DistributionSeries[];
  orientation?: "vertical" | "horizontal";
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  /** What is drawn inside each violin: a slim box, quartile lines or nothing. */
  inner?: ViolinInner;
  /**
   * Two series share one violin per category: the first on the left (top when
   * horizontal), the second on the right. Ignored unless exactly two series are visible.
   */
  split?: boolean;
  /** Kernel bandwidth in data units; Silverman's rule per violin by default. */
  bandwidth?: number;
  /**
   * "width": every violin uses its full width (shapes compare, sizes do not).
   * "area": one density scale for all, so a wider violin means a denser peak.
   */
  scale?: "width" | "area";
  /** Every raw observation as a dot inside the violin, spread by its density. */
  showPoints?: boolean;
  /** Share (0-1) of the local violin width the dots spread over. */
  jitter?: number;
  /** "value" grades each dot from pale to full colour across the value range. */
  pointColor?: PointColoring;
  /** Seed of the jitter, so the dots are stable between renders. */
  seed?: number;
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  legend?: boolean | "top" | "bottom";
  grid?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<DistributionLabels>;
  className?: string;
}

interface ViolinItem {
  key: string;
  category: number;
  series: ColoredSeries<DistributionSeries>;
  stats: BoxStats;
  density: DensityPoint[];
  center: number;
  halfWidth: number;
  side: "both" | "start" | "end";
  format: ValueFormatter;
}

function densityAt(curve: readonly DensityPoint[], value: number): number {
  if (curve.length === 0) return 0;
  const first = curve[0] as DensityPoint;
  const last = curve[curve.length - 1] as DensityPoint;
  if (value <= first.value) return first.density;
  if (value >= last.value) return last.density;
  const step = (last.value - first.value) / (curve.length - 1);
  const index = Math.min(curve.length - 2, Math.floor((value - first.value) / step));
  const a = curve[index] as DensityPoint;
  const b = curve[index + 1] as DensityPoint;
  return a.density + ((b.density - a.density) * (value - a.value)) / (b.value - a.value || 1);
}

/**
 * Violin plot: a Gaussian kernel density mirrored around each category axis,
 * with an optional inner box or quartile lines. Two series can share one
 * split violin per category to compare them side by side.
 */
export function ViolinChart({
  title,
  categories,
  series,
  orientation = "vertical",
  valueFormat,
  valueAxis,
  inner = "box",
  split = false,
  bandwidth,
  scale = "width",
  showPoints = false,
  jitter = 0.8,
  pointColor = "series",
  seed = 11,
  height = 340,
  aspectRatio,
  legend,
  grid = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelsProp,
  className,
}: ViolinChartProps) {
  const labels = resolveDistributionLabels(labelsProp);
  const legendState = useDistributionLegend(series, legend);
  const prepared = useMemo(
    () =>
      series.map((item) =>
        categories.map((_, index) => {
          const values = item.data[index] ?? [];
          const stats = boxStats(values);
          if (!stats) return null;
          const h = bandwidth ?? silvermanBandwidth(values);
          return { stats, density: gaussianKde(values, { bandwidth: h, points: 72 }) };
        }),
      ),
    [series, categories, bandwidth],
  );
  const empty = !prepared.some((row) => row.some(Boolean));
  const fallback = resolveFormat(valueFormat);
  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
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
              stats: prepared[item.index]?.[index]?.stats ?? null,
              format: item.source.format ? resolveFormat(item.source.format) : fallback,
            })),
          )}
        />
      }
    >
      {(width, measuredHeight) => (
        <ViolinPlot
          width={width}
          height={measuredHeight}
          title={title}
          categories={categories}
          visible={legendState.visible}
          prepared={prepared}
          orientation={orientation}
          valueFormat={valueFormat}
          valueAxis={valueAxis}
          inner={inner}
          split={split && legendState.visible.length === 2}
          scale={scale}
          showPoints={showPoints}
          jitter={jitter}
          pointColor={pointColor}
          seed={seed}
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

const ViolinShape = memo(function ViolinShape({
  item,
  map,
  maxDensity,
  domain,
  horizontal,
  inner,
  dimmed,
  active,
}: {
  item: ViolinItem;
  map: (value: number) => number;
  maxDensity: number;
  domain: readonly [number, number];
  horizontal: boolean;
  inner: ViolinInner;
  dimmed: boolean;
  active: boolean;
}) {
  const { stats, density, center, halfWidth, side, series } = item;
  const d = violinPath({ density, map, center, halfWidth, maxDensity, horizontal, side, domain });
  const sign = side === "start" ? -1 : 1;
  const quartile = (value: number, kind: "median" | "quartile") => {
    const reach = (densityAt(density, value) / maxDensity) * halfWidth;
    const from = side === "both" ? center - reach : center;
    const to = side === "both" ? center + reach : center + sign * reach;
    const [x1, y1] = toXY(horizontal, map(value), from).split(",");
    const [x2, y2] = toXY(horizontal, map(value), to).split(",");
    return (
      <line
        key={`${kind}-${value}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth={kind === "median" ? 2 : 1.25}
        strokeDasharray={kind === "median" ? undefined : "3 3"}
        style={{ stroke: kind === "median" ? "var(--ink)" : "var(--ink-2)" }}
      />
    );
  };
  const useQuartiles = inner === "quartiles" || (inner === "box" && side !== "both");
  return (
    <g
      data-enter=""
      className="transition-opacity duration-150"
      style={{
        opacity: dimmed ? 0.3 : 1,
        transformBox: "fill-box",
        transformOrigin: "center",
      }}
    >
      <path
        d={d}
        strokeWidth={active ? 2 : 1.25}
        strokeLinejoin="round"
        style={{ fill: series.color, fillOpacity: active ? 0.42 : 0.28, stroke: series.color }}
      />
      {useQuartiles ? (
        <>
          {quartile(stats.q1, "quartile")}
          {quartile(stats.median, "median")}
          {quartile(stats.q3, "quartile")}
        </>
      ) : inner === "box" ? (
        <BoxGlyph
          stats={stats}
          map={map}
          center={center}
          size={Math.max(4, Math.min(10, halfWidth * 0.18))}
          horizontal={horizontal}
          color={series.color}
          variant="inner"
          showMean={false}
          showOutliers={false}
        />
      ) : null}
    </g>
  );
});

interface PlotProps {
  width: number;
  height: number;
  title: string;
  categories: readonly string[];
  visible: ColoredSeries<DistributionSeries>[];
  prepared: ReadonlyArray<ReadonlyArray<{ stats: BoxStats; density: DensityPoint[] } | null>>;
  orientation: "vertical" | "horizontal";
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  inner: ViolinInner;
  split: boolean;
  scale: "width" | "area";
  showPoints: boolean;
  jitter: number;
  pointColor: PointColoring;
  seed: number;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: DistributionLabels;
  isDimmed: (id: string) => boolean;
}

function ViolinPlot({
  width,
  height,
  title,
  categories,
  visible,
  prepared,
  orientation,
  valueFormat,
  valueAxis,
  inner,
  split,
  scale,
  showPoints,
  jitter,
  pointColor,
  seed,
  grid,
  tooltip,
  animate,
  labels,
  isDimmed,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const { layout, items, globalMax } = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    let globalMax = 0;
    for (const item of visible) {
      for (const entry of prepared[item.index] ?? []) {
        if (!entry) continue;
        // The data range decides the axis; the density tails are cut at its (nice) ends.
        lo = Math.min(lo, entry.stats.min);
        hi = Math.max(hi, entry.stats.max);
        for (const point of entry.density) globalMax = Math.max(globalMax, point.density);
      }
    }
    const layout = categoryLayout({
      width,
      height,
      orientation,
      categories,
      seriesCount: split ? 1 : visible.length,
      extent: Number.isFinite(lo) ? [lo, hi] : null,
      valueFormat,
      axis: valueAxis,
      padding: 0.18,
    });
    const fallback = resolveFormat(valueFormat);
    const items: ViolinItem[] = [];
    categories.forEach((_, category) => {
      visible.forEach((item, slotIndex) => {
        const entry = prepared[item.index]?.[category];
        if (!entry) return;
        const slot = layout.slot(category, split ? 0 : slotIndex);
        items.push({
          key: `${item.id}-${category}`,
          category,
          series: item,
          stats: entry.stats,
          density: entry.density,
          center: slot.center,
          halfWidth: Math.min(slot.size / 2, 80) * 0.96,
          side: split ? (slotIndex === 0 ? "start" : "end") : "both",
          format: item.source.format ? resolveFormat(item.source.format) : fallback,
        });
      });
    });
    return { layout, items, globalMax };
  }, [width, height, orientation, categories, visible, prepared, valueFormat, valueAxis, split]);

  const { margin, innerWidth, innerHeight, horizontal, valueScale } = layout;
  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-enter]").forEach((shape, index) => {
        shape.animate(
          [
            { opacity: 0, transform: horizontal ? "scaleY(0)" : "scaleX(0)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 620, delay: index * 50, easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate, replayKey: categories.length },
  );

  const current = active != null ? items[active] : undefined;
  const pick = (x: number, y: number) => {
    const cross = horizontal ? y : x;
    let best: number | null = null;
    let distance = Number.POSITIVE_INFINITY;
    items.forEach((item, index) => {
      // Split halves: the side of the axis decides the series.
      if (item.side === "start" && cross > item.center) return;
      if (item.side === "end" && cross < item.center) return;
      const d = Math.abs(item.center - cross);
      if (d <= item.halfWidth + 8 && d < distance) {
        best = index;
        distance = d;
      }
    });
    return best;
  };
  const name = (item: ViolinItem) =>
    visible.length > 1
      ? `${categories[item.category]} · ${item.series.name}`
      : (categories[item.category] as string);
  const maxFor = (item: ViolinItem) =>
    scale === "area" ? globalMax : Math.max(...item.density.map((p) => p.density), 1e-12);
  const dots = useMemo(() => {
    if (!showPoints) return [] as JitteredValue[][];
    const share = Math.min(1, Math.max(0, jitter));
    return items.map((item) => {
      const top =
        scale === "area" ? globalMax : Math.max(...item.density.map((p) => p.density), 1e-12);
      const sign = item.side === "start" ? -1 : 1;
      const placed = jitterValues(
        item.series.source.data[item.category] ?? [],
        groupSeed(seed, item.category, item.series.index),
        (value) => (densityAt(item.density, value) / top) * item.halfWidth * share,
      );
      return item.side === "both"
        ? placed
        : placed.map((point) => ({ ...point, offset: sign * Math.abs(point.offset) }));
    });
  }, [showPoints, jitter, items, scale, globalMax, seed]);

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
          {items.map((item, index) => (
            <ViolinShape
              key={item.key}
              item={item}
              map={valueScale.map}
              maxDensity={maxFor(item)}
              domain={valueScale.domain}
              horizontal={horizontal}
              inner={inner}
              dimmed={isDimmed(item.series.id)}
              active={active === index}
            />
          ))}
          {showPoints
            ? items.map((item, index) => (
                <ObservationDots
                  key={`dots-${item.key}`}
                  points={dots[index] ?? []}
                  map={valueScale.map}
                  center={item.center}
                  horizontal={horizontal}
                  color={item.series.color}
                  coloring={pointColor}
                  range={[item.stats.min, item.stats.max]}
                  dimmed={isDimmed(item.series.id)}
                />
              ))
            : null}
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
          x={
            margin.left +
            (horizontal ? valueScale.map(current.stats.q3) : current.center + current.halfWidth / 2)
          }
          y={margin.top + (horizontal ? current.center : valueScale.map(current.stats.median))}
          {...tooltipFit(width)}
          title={name(current)}
          rows={boxTooltipRows(current.stats, labels, current.format, current.series.color)}
        />
      ) : null}
    </div>
  );
}
