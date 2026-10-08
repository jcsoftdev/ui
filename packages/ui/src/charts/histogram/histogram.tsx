"use client";

import { memo, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { PlotExplorer } from "../core/distribution/explorer.js";
import { type DistributionLabels, resolveDistributionLabels } from "../core/distribution/labels.js";
import { type DistributionAxisOptions, tooltipFit, xyLayout } from "../core/distribution/layout.js";
import { XYAxes } from "../core/distribution/marks.js";
import {
  type Bin,
  type BinRule,
  binCounts,
  binEdges,
  mean,
  normalPdf,
  sortedFinite,
  standardDeviation,
} from "../core/distribution/stats.js";
import { type ColoredSeries, useDistributionLegend } from "../core/distribution/use-legend.js";
import { formatNumber, formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { barPath, linePath } from "../core/path.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";

export interface HistogramSeries {
  id: string;
  name: string;
  /** Raw observations, e.g. every ticket of the month. */
  values: ReadonlyArray<number | null>;
  color?: string;
}

export interface HistogramProps {
  title: string;
  /** One or more samples binned on the same edges; several series overlap. */
  series: readonly HistogramSeries[];
  /** Bin rule or approximate count. `auto` = Freedman–Diaconis (Sturges when the IQR is 0). */
  bins?: BinRule | number;
  /** Exact bin width in data units; wins over `bins`. */
  binWidth?: number;
  /** Range to bin; the data range by default. */
  domain?: readonly [number, number];
  /** "count": observations per bin. "density": count / (n · width), area 1. */
  mode?: "count" | "density";
  /** Overlay the normal curve fitted to each series (same mean and standard deviation). */
  normalCurve?: boolean;
  /** Format of the binned values (x axis, tooltip ranges). */
  valueFormat?: ValueFormat;
  xAxis?: DistributionAxisOptions;
  yAxis?: DistributionAxisOptions;
  /**
   * Explode every bin into one dot per observation (a dot plot on the same
   * bins). Controlled when set; otherwise `defaultExploded` starts it.
   */
  exploded?: boolean;
  defaultExploded?: boolean;
  onExplodedChange?: (exploded: boolean) => void;
  /** Shows the toggle button under the plot. */
  explodeToggle?: boolean;
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

interface Binned {
  series: ColoredSeries<HistogramSeries>;
  bins: Bin[];
  total: number;
  mean: number;
  sd: number;
}

/**
 * Histogram with automatic (Freedman–Diaconis / Sturges) or fixed bins,
 * counts or densities, and an optional fitted normal curve. Hovering or
 * arrowing through the bins shows their range and counts.
 */
export function Histogram({
  title,
  series,
  bins = "auto",
  binWidth,
  domain,
  mode = "count",
  normalCurve = false,
  valueFormat,
  xAxis,
  yAxis,
  exploded: explodedProp,
  defaultExploded = false,
  onExplodedChange,
  explodeToggle = false,
  height = 300,
  aspectRatio,
  legend,
  grid = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelsProp,
  className,
}: HistogramProps) {
  const labels = resolveDistributionLabels(labelsProp);
  const legendState = useDistributionLegend(series, legend);
  const format = resolveFormat(valueFormat);
  const visibleIds = legendState.visible.map((item) => item.id).join("|");
  const [innerExploded, setInnerExploded] = useState(defaultExploded);
  const exploded = explodedProp ?? innerExploded;
  const setExploded = (next: boolean) => {
    if (explodedProp == null) setInnerExploded(next);
    onExplodedChange?.(next);
  };

  // Edges come from every visible sample, so overlapping series share bins.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `visibleIds` stands for the visible set.
  const binned = useMemo(() => {
    const pooled = legendState.visible.flatMap((item) => sortedFinite(item.source.values));
    const edges = binEdges(pooled, { bins, binWidth, domain });
    return {
      edges,
      series: legendState.visible.map<Binned>((item) => {
        const values = sortedFinite(item.source.values);
        const counted = binCounts(values, edges);
        return {
          series: item,
          bins: counted,
          total: counted.reduce((sum, bin) => sum + bin.count, 0),
          mean: mean(values),
          sd: standardDeviation(values),
        };
      }),
    };
  }, [series, visibleIds, bins, binWidth, domain]);

  const empty = binned.edges.length < 2 || binned.series.every((item) => item.total === 0);
  const rangeText = (bin: Bin) => `${format(bin.x0)} – ${format(bin.x1)}`;
  const first = binned.series[0];
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
      footer={
        explodeToggle ? (
          <div className="flex px-2">
            <button
              type="button"
              aria-pressed={exploded}
              onClick={() => setExploded(!exploded)}
              className="inline-flex min-h-8 items-center gap-2 rounded-pill border border-line bg-surface px-3 font-semibold text-[12px] text-ink-2 transition-colors hover:bg-surface-2 aria-pressed:border-accent aria-pressed:text-ink"
            >
              {exploded ? labels.bars : labels.explode}
            </button>
          </div>
        ) : null
      }
      table={
        <ChartDataTable
          caption={title}
          categoryHeader={labels.range}
          categories={(first?.bins ?? []).map(rangeText)}
          columns={binned.series.map((item) => ({
            id: item.series.id,
            name: item.series.name,
            values: item.bins.map((bin) => String(bin.count)),
          }))}
        />
      }
    >
      {(width, measuredHeight) => (
        <HistogramPlot
          width={width}
          height={measuredHeight}
          title={title}
          binned={binned.series}
          edges={binned.edges}
          mode={mode}
          normalCurve={normalCurve}
          valueFormat={valueFormat}
          xAxis={xAxis}
          yAxis={yAxis}
          exploded={exploded}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
          rangeText={rangeText}
          isDimmed={legendState.isDimmed}
        />
      )}
    </ChartFrame>
  );
}

const Bars = memo(function Bars({
  item,
  paths,
  overlap,
  dimmed,
  hidden,
}: {
  item: Binned;
  paths: ReadonlyArray<string | null>;
  overlap: boolean;
  dimmed: boolean;
  hidden: boolean;
}) {
  if (hidden) return null;
  return (
    <g className="transition-opacity duration-150" style={{ opacity: dimmed ? 0.25 : 1 }}>
      {paths.map((d, index) =>
        d ? (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: bins are positional.
            key={index}
            d={d}
            data-bar=""
            style={{
              fill: item.series.color,
              fillOpacity: overlap ? 0.5 : 0.88,
              transformBox: "fill-box",
              transformOrigin: "center bottom",
            }}
          />
        ) : null,
      )}
    </g>
  );
});

interface PlotProps {
  width: number;
  height: number;
  title: string;
  binned: Binned[];
  edges: number[];
  mode: "count" | "density";
  normalCurve: boolean;
  valueFormat?: ValueFormat;
  xAxis?: DistributionAxisOptions;
  yAxis?: DistributionAxisOptions;
  exploded: boolean;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: DistributionLabels;
  rangeText: (bin: Bin) => string;
  isDimmed: (id: string) => boolean;
}

function HistogramPlot({
  width,
  height,
  title,
  binned,
  edges,
  mode,
  normalCurve,
  valueFormat,
  xAxis,
  yAxis,
  exploded,
  grid,
  tooltip,
  animate,
  labels,
  rangeText,
  isDimmed,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const density = mode === "density";

  const geometry = useMemo(() => {
    const yFormat: ValueFormat = density
      ? (value) => formatNumber(value, { maximumFractionDigits: 3 })
      : "integer";
    const lo = edges[0] as number;
    const hi = edges[edges.length - 1] as number;
    const binSize = edges.length > 1 ? (edges[1] as number) - lo : 1;
    const heightOf = (item: Binned, count: number) =>
      density ? count / Math.max(1, item.total) / binSize : count;
    const curveOf = (item: Binned, x: number) => {
      const pdf = normalPdf(x, item.mean, item.sd);
      return density ? pdf : pdf * item.total * binSize;
    };
    let top = 0;
    for (const item of binned) {
      for (const bin of item.bins) top = Math.max(top, heightOf(item, bin.count));
      if (normalCurve && item.sd > 0) top = Math.max(top, curveOf(item, item.mean));
    }
    const lanes = Math.max(1, binned.length);
    const layoutFor = (yMax?: number) =>
      xyLayout({
        width,
        height,
        xExtent: [lo, hi],
        yExtent: [0, top || 1],
        xFormat: valueFormat,
        yFormat,
        xAxis: { ...xAxis, min: lo, max: hi },
        yAxis: { ...yAxis, min: 0, ...(yMax != null ? { max: yMax } : {}) },
      });
    const laneOf = (scaleX: (value: number) => number) =>
      Math.max(2, (scaleX(lo + binSize) - scaleX(lo) - 2) / lanes);
    let layout = layoutFor();
    if (exploded) {
      // One dot per observation, one column per bin: a dot is one count tall on the
      // axis. When dots would be taller than the bin is wide, stretch the axis so
      // they stay round instead of wrapping into extra columns.
      const unit = Math.max(...binned.map((item) => heightOf(item, 1)), Number.MIN_VALUE);
      const lane = laneOf(layout.xScale.map);
      const cell = layout.innerHeight / (layout.yScale.domain[1] / unit);
      if (cell > lane) layout = layoutFor((layout.innerHeight / lane) * unit);
    }
    const { xScale, yScale } = layout;
    const baseline = yScale.map(0);
    const paths = binned.map((item) =>
      item.bins.map((bin) => {
        if (bin.count === 0) return null;
        const x0 = xScale.map(bin.x0);
        const x1 = xScale.map(bin.x1);
        const gap = Math.min(2, (x1 - x0) * 0.12);
        const y = yScale.map(heightOf(item, bin.count));
        const w = Math.max(1, x1 - x0 - gap);
        return barPath(x0 + gap / 2, y, w, Math.max(1, baseline - y), Math.min(4, w / 3), "top");
      }),
    );
    const lane = laneOf(xScale.map);
    const cellOf = (item: Binned) => baseline - yScale.map(heightOf(item, 1));
    const dotRadius = Math.max(1, Math.min(lane, ...binned.map((item) => cellOf(item))) / 2 - 0.5);
    // Dot k sits in the k-th unit cell of the axis, so a stack is exactly as tall as its count.
    const dots = binned.map((item, seriesIndex) =>
      item.bins.map((bin) => {
        const cx = xScale.map(bin.x0) + 1 + seriesIndex * lane + lane / 2;
        return Array.from({ length: bin.count }, (_unused, k) => ({
          cx,
          cy: yScale.map(heightOf(item, k + 0.5)),
        }));
      }),
    );
    const curves = normalCurve
      ? binned.map((item) => {
          if (!(item.sd > 0)) return "";
          const points = Array.from({ length: 81 }, (_, i) => {
            const x = lo + ((hi - lo) * i) / 80;
            return { x: xScale.map(x), y: yScale.map(curveOf(item, x)) };
          });
          return linePath(points, "smooth");
        })
      : [];
    return { layout, paths, curves, heightOf, dots, dotRadius };
  }, [width, height, edges, binned, density, normalCurve, valueFormat, xAxis, yAxis, exploded]);

  const { layout, paths, curves, dots, dotRadius } = geometry;
  const { margin, innerWidth, innerHeight, xScale, yScale } = layout;
  const overlap = binned.length > 1;
  const binCount = Math.max(0, edges.length - 1);

  useEntryAnimation(
    svgRef,
    (root) => {
      if (exploded) {
        root.querySelectorAll("[data-dot]").forEach((dot, index) => {
          dot.animate(
            [
              { opacity: 0, transform: "translateY(-18px) scale(0.2)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: 420,
              delay: Math.min(600, index * 3),
              easing: "cubic-bezier(.34,1.56,.64,1)",
              fill: "backwards",
            },
          );
        });
        return;
      }
      root.querySelectorAll("[data-bar]").forEach((bar, index) => {
        bar.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
          duration: 520,
          delay: (index % Math.max(1, binCount)) * 22,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
      root.querySelectorAll("[data-curve]").forEach((curve) => {
        curve.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 500,
          delay: 420,
          easing: "ease-out",
          fill: "backwards",
        });
      });
    },
    { disabled: !animate, replayKey: `${binCount}-${exploded}` },
  );

  const pick = (x: number) => {
    const value = xScale.invert(x);
    for (let index = 0; index < binCount; index += 1) {
      if (value >= (edges[index] as number) && value <= (edges[index + 1] as number)) return index;
    }
    return null;
  };

  const bin = active != null ? binned[0]?.bins[active] : undefined;
  const rows: TooltipRow[] = bin
    ? binned.map((item) => {
        const count = item.bins[active as number]?.count ?? 0;
        return {
          id: item.series.id,
          name: item.series.name,
          value: density
            ? formatNumber(geometry.heightOf(item, count), { maximumFractionDigits: 4 })
            : formatNumber(count),
          color: item.series.color,
          note: item.total ? `(${formatPercent(count / item.total)})` : undefined,
        };
      })
    : [];
  const valueText = bin
    ? `${labels.range} ${rangeText(bin)}: ${rows.map((row) => `${row.name} ${row.value} ${row.note ?? ""}`).join(", ")}`
    : title;
  const tallest = bin
    ? Math.max(
        ...binned.map((item) => geometry.heightOf(item, item.bins[active as number]?.count ?? 0)),
      )
    : 0;

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
          <XYAxes
            layout={layout}
            xTitle={xAxis?.title}
            yTitle={yAxis?.title ?? (density ? labels.density : labels.frequency)}
            grid={grid}
          />
          {bin ? (
            <rect
              x={xScale.map(bin.x0)}
              y={0}
              width={Math.max(1, xScale.map(bin.x1) - xScale.map(bin.x0))}
              height={innerHeight}
              rx={6}
              style={{ fill: "var(--chart-grid)" }}
            />
          ) : null}
          {binned.map((item, index) => (
            <Bars
              key={item.series.id}
              item={item}
              paths={paths[index] ?? []}
              overlap={overlap}
              dimmed={isDimmed(item.series.id)}
              hidden={exploded}
            />
          ))}
          {exploded
            ? binned.map((item, index) => (
                <g
                  key={`dots-${item.series.id}`}
                  className="pointer-events-none transition-opacity duration-150"
                  style={{ opacity: isDimmed(item.series.id) ? 0.25 : 1 }}
                >
                  {(dots[index] ?? []).flatMap((bin, binIndex) =>
                    bin.map((dot, dotIndex) => (
                      <circle
                        // biome-ignore lint/suspicious/noArrayIndexKey: bins and dots are positional.
                        key={`${binIndex}-${dotIndex}`}
                        data-dot=""
                        cx={dot.cx}
                        cy={dot.cy}
                        r={dotRadius}
                        style={{
                          fill: item.series.color,
                          fillOpacity: overlap ? 0.7 : 0.9,
                          stroke: "var(--surface)",
                          strokeWidth: 0.75,
                        }}
                      />
                    )),
                  )}
                </g>
              ))
            : null}
          {curves.map((d, index) =>
            d ? (
              <g key={binned[index]?.series.id} data-curve="">
                <path
                  d={d}
                  fill="none"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  style={{ stroke: "var(--surface)" }}
                />
                <path
                  d={d}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={overlap ? undefined : "5 4"}
                  style={{ stroke: overlap ? binned[index]?.series.color : "var(--ink-2)" }}
                />
              </g>
            ) : null,
          )}
        </g>
      </svg>
      <PlotExplorer
        count={binCount}
        active={active}
        onActiveChange={setActive}
        pick={(x) => pick(x)}
        label={labels.explore}
        valueText={valueText}
        margin={margin}
        width={innerWidth}
        height={innerHeight}
      />
      {tooltip && bin ? (
        <ChartTooltip
          x={margin.left + xScale.map(bin.x1)}
          y={margin.top + Math.max(24, yScale.map(tallest))}
          {...tooltipFit(width)}
          title={rangeText(bin)}
          rows={rows}
        />
      ) : null}
    </div>
  );
}
