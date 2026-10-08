"use client";

import { memo, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { PlotExplorer } from "../core/distribution/explorer.js";
import { type DistributionSeries, violinPath } from "../core/distribution/geometry.js";
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
import {
  type BoxStats,
  boxStats,
  type DensityPoint,
  gaussianKde,
  seededRandom,
  silvermanBandwidth,
  sortedFinite,
} from "../core/distribution/stats.js";
import { type ColoredSeries, useDistributionLegend } from "../core/distribution/use-legend.js";
import { resolveFormat, type ValueFormat, type ValueFormatter } from "../core/format.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { ChartTooltip } from "../core/tooltip.js";

export interface RaincloudChartProps {
  title: string;
  /** One row per category, e.g. barbers or time slots. */
  categories: readonly string[];
  /** `data[i]` holds the raw samples of `categories[i]`. Several series stack inside a row. */
  series: readonly DistributionSeries[];
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  /** Kernel bandwidth in data units; Silverman's rule per cloud by default. */
  bandwidth?: number;
  /** Draw the raw observations under the box. */
  rain?: boolean;
  /** Radius of each raw point in pixels. */
  pointRadius?: number;
  showMean?: boolean;
  /** Seed of the vertical jitter, so the rain is stable between renders. */
  seed?: number;
  /** Height of the drawing; grows with the number of rows by default. */
  height?: number;
  legend?: boolean | "top" | "bottom";
  grid?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<DistributionLabels>;
  className?: string;
}

interface CloudItem {
  key: string;
  category: number;
  series: ColoredSeries<DistributionSeries>;
  stats: BoxStats;
  density: DensityPoint[];
  values: number[];
  /** Row slot on the cross axis. */
  top: number;
  size: number;
  format: ValueFormatter;
}

/**
 * Raincloud plot (horizontal): a half violin "cloud" for the shape, a slim
 * box for the summary and the jittered raw observations falling below as
 * "rain", so nothing about the distribution is hidden.
 */
export function RaincloudChart({
  title,
  categories,
  series,
  valueFormat,
  valueAxis,
  bandwidth,
  rain = true,
  pointRadius = 2.5,
  showMean = true,
  seed = 7,
  height: heightProp,
  legend,
  grid = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelsProp,
  className,
}: RaincloudChartProps) {
  const labels = resolveDistributionLabels(labelsProp);
  const legendState = useDistributionLegend(series, legend);
  const height =
    heightProp ?? Math.max(220, categories.length * Math.max(1, series.length) * 92 + 48);
  const prepared = useMemo(
    () =>
      series.map((item) =>
        categories.map((_, index) => {
          const values = sortedFinite(item.data[index] ?? []);
          const stats = boxStats(values);
          if (!stats) return null;
          const h = bandwidth ?? silvermanBandwidth(values);
          return {
            stats,
            values,
            density: gaussianKde(values, { bandwidth: h, points: 72 }),
          };
        }),
      ),
    [series, categories, bandwidth],
  );
  const empty = !prepared.some((row) => row.some(Boolean));
  const fallback = resolveFormat(valueFormat);
  return (
    <ChartFrame
      height={height}
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton="line"
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
      {(width) => (
        <RaincloudPlot
          width={width}
          height={height}
          title={title}
          categories={categories}
          visible={legendState.visible}
          prepared={prepared}
          valueFormat={valueFormat}
          valueAxis={valueAxis}
          rain={rain}
          pointRadius={pointRadius}
          showMean={showMean}
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

/** Splits a row slot into cloud, box and rain bands. */
function rowBands(top: number, size: number) {
  const baseline = top + size * 0.5;
  const box = Math.max(5, Math.min(12, size * 0.11));
  return {
    baseline,
    cloud: size * 0.48,
    boxCenter: baseline + box / 2 + 3,
    box,
    rainFrom: baseline + box + 8,
    rainTo: top + size - 2,
  };
}

const Cloud = memo(function Cloud({
  item,
  map,
  domain,
  rain,
  pointRadius,
  showMean,
  seed,
  dimmed,
  active,
}: {
  item: CloudItem;
  map: (value: number) => number;
  domain: readonly [number, number];
  rain: boolean;
  pointRadius: number;
  showMean: boolean;
  seed: number;
  dimmed: boolean;
  active: boolean;
}) {
  const bands = rowBands(item.top, item.size);
  const maxDensity = Math.max(...item.density.map((point) => point.density), 1e-12);
  const random = seededRandom(seed + item.category * 977 + item.series.index * 131);
  const spread = Math.max(0, bands.rainTo - bands.rainFrom);
  const color = item.series.color;
  return (
    <g className="transition-opacity duration-150" style={{ opacity: dimmed ? 0.3 : 1 }}>
      <path
        data-cloud=""
        d={violinPath({
          density: item.density,
          map,
          center: bands.baseline,
          halfWidth: bands.cloud,
          maxDensity,
          horizontal: true,
          side: "start",
          domain,
        })}
        strokeWidth={active ? 2 : 1.25}
        strokeLinejoin="round"
        style={{
          fill: color,
          fillOpacity: active ? 0.4 : 0.26,
          stroke: color,
          transformBox: "fill-box",
          transformOrigin: "center bottom",
        }}
      />
      <BoxGlyph
        stats={item.stats}
        map={map}
        center={bands.boxCenter}
        size={bands.box}
        horizontal
        color={color}
        showMean={showMean}
        showOutliers={false}
        active={active}
      />
      {rain && spread > 0 ? (
        <g data-rain="">
          {item.values.map((value, index) => (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: samples repeat; order is stable.
              key={index}
              cx={map(value)}
              cy={bands.rainFrom + random() * spread}
              r={pointRadius}
              style={{ fill: color, fillOpacity: 0.55 }}
            />
          ))}
        </g>
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
  prepared: ReadonlyArray<
    ReadonlyArray<{ stats: BoxStats; density: DensityPoint[]; values: number[] } | null>
  >;
  valueFormat?: ValueFormat;
  valueAxis?: DistributionAxisOptions;
  rain: boolean;
  pointRadius: number;
  showMean: boolean;
  seed: number;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: DistributionLabels;
  isDimmed: (id: string) => boolean;
}

function RaincloudPlot({
  width,
  height,
  title,
  categories,
  visible,
  prepared,
  valueFormat,
  valueAxis,
  rain,
  pointRadius,
  showMean,
  seed,
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
      for (const entry of prepared[item.index] ?? []) {
        if (!entry) continue;
        // The data range decides the axis; the density tails are cut at its (nice) ends.
        lo = Math.min(lo, entry.stats.min);
        hi = Math.max(hi, entry.stats.max);
      }
    }
    const layout = categoryLayout({
      width,
      height,
      orientation: "horizontal",
      categories,
      seriesCount: visible.length,
      extent: Number.isFinite(lo) ? [lo, hi] : null,
      valueFormat,
      axis: valueAxis,
      padding: 0.12,
    });
    const fallback = resolveFormat(valueFormat);
    const items: CloudItem[] = [];
    categories.forEach((_, category) => {
      visible.forEach((item, slotIndex) => {
        const entry = prepared[item.index]?.[category];
        if (!entry) return;
        const slot = layout.slot(category, slotIndex);
        items.push({
          key: `${item.id}-${category}`,
          category,
          series: item,
          stats: entry.stats,
          density: entry.density,
          values: entry.values,
          top: slot.center - slot.size / 2,
          size: slot.size,
          format: item.source.format ? resolveFormat(item.source.format) : fallback,
        });
      });
    });
    return { layout, items };
  }, [width, height, categories, visible, prepared, valueFormat, valueAxis]);

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-cloud]").forEach((cloud, index) => {
        cloud.animate(
          [
            { opacity: 0, transform: "scaleY(0)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 620, delay: index * 60, easing: EASE_OUT, fill: "backwards" },
        );
      });
      root.querySelectorAll("[data-rain]").forEach((drops, index) => {
        drops.animate(
          [
            { opacity: 0, transform: "translateY(-8px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 520, delay: 240 + index * 60, easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate, replayKey: categories.length },
  );

  const { margin, innerWidth, innerHeight, valueScale } = layout;
  const current = active != null ? items[active] : undefined;
  const pick = (_x: number, y: number) => {
    const index = items.findIndex((item) => y >= item.top && y <= item.top + item.size);
    return index < 0 ? null : index;
  };
  const name = (item: CloudItem) =>
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
          {items.map((item, index) => (
            <Cloud
              key={item.key}
              item={item}
              map={valueScale.map}
              domain={valueScale.domain}
              rain={rain}
              pointRadius={pointRadius}
              showMean={showMean}
              seed={seed}
              dimmed={isDimmed(item.series.id)}
              active={active === index}
            />
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
          x={margin.left + valueScale.map(current.stats.q3)}
          y={margin.top + rowBands(current.top, current.size).baseline}
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
