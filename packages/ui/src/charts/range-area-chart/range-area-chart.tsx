"use client";

import { memo, useId, useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft, estimateTextWidth, GridLines } from "../core/axes.js";
import { buildCategoryAxis, fullCategoryLabel } from "../core/category-axis.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveAxisFormat, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend } from "../core/legend.js";
import { revealClip, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { areaPath, type Curve, linePath, type Point } from "../core/path.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import {
  type ChartLabels,
  resolveLabels,
  type ValueAxisOptions,
  type XValue,
} from "../core/types.js";
import { useSeriesState } from "../core/use-series-state.js";

export interface RangeBand {
  id: string;
  name: string;
  /** Lower edge per category; `null` leaves a gap. */
  min: ReadonlyArray<number | null>;
  /** Upper edge per category. */
  max: ReadonlyArray<number | null>;
  /** Optional central line (average or median). */
  mean?: ReadonlyArray<number | null>;
  color?: string;
  format?: ValueFormat;
}

export interface RangeAreaChartProps {
  categories: readonly XValue[];
  bands: readonly RangeBand[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Height of the plot in pixels. */
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  curve?: Curve;
  /** Draw the central line of bands that provide `mean` (default true). */
  showMean?: boolean;
  valueFormat?: ValueFormat;
  xFormat?: (value: XValue) => string;
  /** "auto" uses a real time axis when every category is a Date. */
  xScale?: "auto" | "point" | "time";
  yAxis?: ValueAxisOptions;
  grid?: boolean;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  initialHidden?: readonly string[];
  /** Words used in the tooltip and the data table. */
  minLabel?: string;
  maxLabel?: string;
  meanLabel?: string;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const MARGIN = { top: 14, right: 18, bottom: 30 };

interface PlotProps {
  width: number;
  height: number;
  categories: readonly XValue[];
  bands: readonly RangeBand[];
  colors: readonly string[];
  hidden: ReadonlySet<string>;
  highlighted: string | null;
  curve: Curve;
  showMean: boolean;
  fmt: (band: RangeBand) => (value: number) => string;
  valueFormat?: ValueFormat;
  xFormat?: (value: XValue) => string;
  xScale: "auto" | "point" | "time";
  yAxis?: ValueAxisOptions;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  meanLabel: string;
  rangeText: (index: number) => string;
  labels: ChartLabels;
  title: string;
}

const BandMarks = memo(function BandMarks({
  band,
  color,
  top,
  bottom,
  mean,
  dimmed,
  showMean,
  curve,
}: {
  band: RangeBand;
  color: string;
  top: Array<Point | null>;
  bottom: Point[];
  mean: Array<Point | null> | null;
  dimmed: boolean;
  showMean: boolean;
  curve: Curve;
}) {
  return (
    <g
      className="motion-safe:transition-opacity motion-safe:duration-150"
      style={{ opacity: dimmed ? 0.18 : 1 }}
      data-band={band.id}
    >
      <path d={areaPath(top, bottom, curve)} style={{ fill: color, fillOpacity: 0.2 }} />
      {showMean && mean ? (
        <path
          d={linePath(mean, curve)}
          fill="none"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: color }}
        />
      ) : null}
    </g>
  );
});

function Plot({
  width,
  height,
  categories,
  bands,
  colors,
  hidden,
  highlighted,
  curve,
  showMean,
  fmt,
  valueFormat,
  xFormat,
  xScale,
  yAxis,
  grid,
  tooltip,
  animate,
  meanLabel,
  rangeText,
  labels,
  title,
}: PlotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const visible = bands.filter((band) => !hidden.has(band.id));

  const layout = useMemo(() => {
    const all: number[] = [];
    for (const band of visible) {
      for (let i = 0; i < categories.length; i += 1) {
        const lo = band.min[i];
        const hi = band.max[i];
        if (lo != null && hi != null) all.push(lo, hi);
        const m = band.mean?.[i];
        if (m != null) all.push(m);
      }
    }
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const zero = yAxis?.zero ?? (all.length > 0 && lo <= hi * 0.35);
    const domainLo = yAxis?.min ?? (zero ? Math.min(0, lo) : lo);
    const domainHi = yAxis?.max ?? hi;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const probe = linearScale({
      domain: all.length ? [domainLo, domainHi] : [0, 1],
      range: [innerHeight, 0],
      tickCount: yAxis?.tickCount ?? Math.max(3, Math.round(innerHeight / 56)),
    });
    const axisFormat = resolveAxisFormat(yAxis?.format ?? valueFormat);
    const yTicks = probe.ticks().map((tick) => ({
      key: tick,
      position: probe.map(tick),
      label: axisFormat(tick),
    }));
    const left = Math.max(...yTicks.map((tick) => estimateTextWidth(tick.label)), 16) + 18;
    const innerWidth = Math.max(40, width - left - MARGIN.right);
    const axis = buildCategoryAxis(categories, innerWidth, {
      mode: xScale === "point" ? "point" : "time",
      format: xFormat,
    });
    return { y: probe, yTicks, left, innerWidth, innerHeight, axis };
  }, [visible, categories, height, width, yAxis, valueFormat, xFormat, xScale]);

  const { y, yTicks, left, innerWidth, innerHeight, axis } = layout;

  const geometry = useMemo(
    () =>
      visible.map((band) => {
        const top: Array<Point | null> = [];
        const bottom: Point[] = [];
        const mean: Array<Point | null> = [];
        categories.forEach((_, i) => {
          const lo = band.min[i];
          const hi = band.max[i];
          const x = axis.positions[i] as number;
          if (lo == null || hi == null) {
            top.push(null);
            bottom.push({ x, y: innerHeight });
          } else {
            top.push({ x, y: y.map(hi) });
            bottom.push({ x, y: y.map(lo) });
          }
          const m = band.mean?.[i];
          mean.push(m == null ? null : { x, y: y.map(m) });
        });
        return { band, top, bottom, mean: band.mean ? mean : null };
      }),
    [visible, categories, axis, y, innerHeight],
  );

  useEntryAnimation(
    svgRef,
    (root) => {
      const clip = root.querySelector("[data-reveal]");
      if (clip) revealClip(clip, 900);
    },
    { disabled: !animate },
  );

  const activeX = active != null ? (axis.positions[active] as number) : null;
  const rows: TooltipRow[] =
    active != null
      ? visible.flatMap((band) => {
          const lo = band.min[active];
          const hi = band.max[active];
          if (lo == null || hi == null) return [];
          const f = fmt(band);
          const m = band.mean?.[active];
          return [
            {
              id: band.id,
              name: band.name,
              value: `${f(lo)} – ${f(hi)}`,
              color: colors[bands.indexOf(band)] as string,
              shape: "square" as const,
              note: showMean && m != null ? `${meanLabel} ${f(m)}` : undefined,
            },
          ];
        })
      : [];
  const anchorY =
    active != null
      ? MARGIN.top +
        Math.min(
          ...visible
            .map((band) => band.max[active])
            .filter((value): value is number => value != null)
            .map((value) => y.map(value)),
          innerHeight,
        )
      : 0;

  return (
    <div className="relative" style={{ width }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <defs>
          <clipPath id={`${uid}-reveal`}>
            <rect
              data-reveal=""
              x={-6}
              y={-24}
              width={innerWidth + 12}
              height={innerHeight + 48}
              style={{ transformBox: "fill-box", transformOrigin: "left center" }}
            />
          </clipPath>
        </defs>
        <g transform={`translate(${left},${MARGIN.top})`}>
          {grid ? <GridLines ticks={yTicks} direction="horizontal" length={innerWidth} /> : null}
          <AxisLeft ticks={yTicks} offset={0} title={yAxis?.title} />
          <AxisBottom ticks={axis.ticks} offset={innerHeight} />
          <g clipPath={`url(#${uid}-reveal)`}>
            {geometry.map((item) => (
              <BandMarks
                key={item.band.id}
                band={item.band}
                color={colors[bands.indexOf(item.band)] as string}
                top={item.top}
                bottom={item.bottom}
                mean={item.mean}
                showMean={showMean}
                curve={curve}
                dimmed={highlighted != null && highlighted !== item.band.id}
              />
            ))}
          </g>
          {activeX != null ? (
            <>
              <line
                x1={activeX}
                x2={activeX}
                y1={0}
                y2={innerHeight}
                strokeDasharray="3 4"
                style={{ stroke: "var(--chart-crosshair)" }}
              />
              {geometry.map((item) => {
                const lo = item.bottom[active as number];
                const hi = item.top[active as number];
                const m = item.mean?.[active as number];
                const color = colors[bands.indexOf(item.band)] as string;
                return hi && lo ? (
                  <g key={item.band.id}>
                    {[hi, lo].map((point) => (
                      <circle
                        key={point.y}
                        cx={point.x}
                        cy={point.y}
                        r={3.5}
                        strokeWidth={2}
                        style={{ fill: "var(--surface)", stroke: color }}
                      />
                    ))}
                    {showMean && m ? (
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={4.5}
                        strokeWidth={2.5}
                        style={{ fill: color, stroke: "var(--surface)" }}
                      />
                    ) : null}
                  </g>
                ) : null;
              })}
            </>
          ) : null}
        </g>
      </svg>
      <PlotOverlay
        left={left}
        top={MARGIN.top}
        width={innerWidth}
        height={innerHeight}
        label={labels.explore}
        count={categories.length}
        active={active}
        valueText={active != null ? rangeText(active) : labels.explore}
        onActiveChange={setActive}
        indexAt={({ x }) => axis.indexAt(x)}
      />
      {tooltip && active != null && rows.length ? (
        <ChartTooltip
          x={left + (activeX as number)}
          y={anchorY}
          containerWidth={width}
          title={fullCategoryLabel(categories[active] as XValue)}
          rows={rows}
        />
      ) : null}
    </div>
  );
}

/**
 * Min–max band over time (or categories) with an optional line for the
 * average. Several bands overlay each other; the legend toggles them.
 * Ideal for ranges such as waiting time per day or price floor and ceiling.
 */
export function RangeAreaChart({
  categories,
  bands,
  title,
  description,
  height = 300,
  aspectRatio,
  curve = "smooth",
  showMean = true,
  valueFormat,
  xFormat,
  xScale = "auto",
  yAxis,
  grid = true,
  legend,
  tooltip = true,
  loading,
  animate = true,
  initialHidden,
  minLabel = "Min",
  maxLabel = "Max",
  meanLabel = "Mean",
  labels: labelOverrides,
  className,
}: RangeAreaChartProps) {
  const labels = resolveLabels(labelOverrides);
  const state = useSeriesState(initialHidden);
  const colors = useMemo(() => bands.map((band, i) => seriesColor(i, band.color)), [bands]);
  const fmt = useMemo(() => {
    const base = resolveFormat(valueFormat);
    return (band: RangeBand) => (band.format ? resolveFormat(band.format) : base);
  }, [valueFormat]);

  const hasData = bands.some((band) =>
    categories.some((_, i) => band.min[i] != null && band.max[i] != null),
  );
  const showLegend = legend ?? bands.length > 1;
  const legendNode = showLegend ? (
    <ChartLegend
      items={bands.map((band, i) => ({
        id: band.id,
        name: band.name,
        color: colors[i] as string,
        shape: "square",
        hidden: state.isHidden(band.id),
      }))}
      onToggle={state.toggle}
      onHighlight={state.setHighlighted}
    />
  ) : null;

  const rangeText = (index: number) => {
    const parts = bands
      .filter((band) => !state.isHidden(band.id))
      .map((band) => {
        const f = fmt(band);
        const lo = band.min[index];
        const hi = band.max[index];
        if (lo == null || hi == null) return `${band.name}: -`;
        const m = band.mean?.[index];
        return `${band.name}: ${minLabel} ${f(lo)}, ${maxLabel} ${f(hi)}${
          showMean && m != null ? `, ${meanLabel} ${f(m)}` : ""
        }`;
      });
    return `${fullCategoryLabel(categories[index] as XValue)}. ${parts.join(". ")}`;
  };

  const columns = bands.flatMap((band) => {
    const f = fmt(band);
    const pick = (data: ReadonlyArray<number | null> | undefined) =>
      categories.map((_, i) => {
        const v = data?.[i];
        return v == null ? "" : f(v);
      });
    const cols = [
      { id: `${band.id}-min`, name: `${band.name} ${minLabel}`, values: pick(band.min) },
      { id: `${band.id}-max`, name: `${band.name} ${maxLabel}`, values: pick(band.max) },
    ];
    if (band.mean)
      cols.push({
        id: `${band.id}-mean`,
        name: `${band.name} ${meanLabel}`,
        values: pick(band.mean),
      });
    return cols;
  });

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={!hasData}
      skeleton="line"
      legend={legendNode}
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={categories.map(fullCategoryLabel)}
          columns={columns}
        />
      }
    >
      {(width, measuredHeight) => (
        <Plot
          width={width}
          height={measuredHeight}
          categories={categories}
          bands={bands}
          colors={colors}
          hidden={state.hidden}
          highlighted={state.highlighted}
          curve={curve}
          showMean={showMean}
          fmt={fmt}
          valueFormat={valueFormat}
          xFormat={xFormat}
          xScale={xScale}
          yAxis={yAxis}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          meanLabel={meanLabel}
          rangeText={rangeText}
          labels={labels}
          title={title}
        />
      )}
    </ChartFrame>
  );
}
