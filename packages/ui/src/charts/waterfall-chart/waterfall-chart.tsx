"use client";

import { memo, useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft, estimateTextWidth, GridLines } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveAxisFormat, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { DIRECTION_COLORS } from "../core/palette.js";
import { roundedRectPath } from "../core/path.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { bandScale } from "../core/scales/band.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels, type ValueAxisOptions } from "../core/types.js";
import {
  pickLabels,
  type WaterfallBar,
  type WaterfallKind,
  type WaterfallStep,
  waterfallLayout,
} from "./waterfall-layout.js";

export interface WaterfallChartProps {
  steps: readonly WaterfallStep[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  yAxis?: ValueAxisOptions;
  /** Dashed line from each bar to the next (default true). */
  connectors?: boolean;
  /** Values written above the bars (default true). */
  dataLabels?: boolean;
  grid?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  /** Words for the legend, the tooltip and the table. */
  increaseLabel?: string;
  decreaseLabel?: string;
  totalLabel?: string;
  runningLabel?: string;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const MARGIN = { top: 22, right: 14, bottom: 30 };

const FILL: Record<WaterfallKind, string> = {
  increase: DIRECTION_COLORS.up,
  decrease: DIRECTION_COLORS.down,
  start: DIRECTION_COLORS.flat,
  subtotal: DIRECTION_COLORS.flat,
  total: DIRECTION_COLORS.flat,
};

const Bar = memo(function Bar({
  path,
  kind,
  active,
  muted,
}: {
  path: string;
  kind: WaterfallKind;
  active: boolean;
  muted: boolean;
}) {
  return (
    <path
      data-bar=""
      d={path}
      className="motion-safe:transition-[fill-opacity] motion-safe:duration-150"
      style={{
        fill: FILL[kind],
        fillOpacity: muted ? 0.4 : kind === "subtotal" ? 0.62 : active ? 1 : 0.9,
        transformBox: "fill-box",
        transformOrigin: "center bottom",
      }}
    />
  );
});

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/**
 * Bridge from a start value to a total: increases and decreases float on the
 * running total, subtotals and totals stand on the baseline, and dashed
 * connectors carry the eye from one step to the next.
 */
export function WaterfallChart({
  steps,
  title,
  description,
  height = 320,
  aspectRatio,
  valueFormat,
  yAxis,
  connectors = true,
  dataLabels = true,
  grid = true,
  legend = true,
  tooltip = true,
  loading,
  animate = true,
  increaseLabel = "Increase",
  decreaseLabel = "Decrease",
  totalLabel = "Total",
  runningLabel = "Running total",
  labels: labelOverrides,
  className,
}: WaterfallChartProps) {
  const labels = resolveLabels(labelOverrides);
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const layout = useMemo(() => waterfallLayout(steps), [steps]);
  const signed = (bar: WaterfallBar) =>
    bar.kind === "increase" ? `+${fmt(bar.value)}` : fmt(bar.value);
  const kindName = (kind: WaterfallKind) =>
    kind === "increase" ? increaseLabel : kind === "decrease" ? decreaseLabel : totalLabel;

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={steps.length === 0}
      skeleton="bars"
      legend={
        legend ? (
          <ChartLegend
            items={[
              { id: "up", name: increaseLabel, color: DIRECTION_COLORS.up, shape: "square" },
              { id: "down", name: decreaseLabel, color: DIRECTION_COLORS.down, shape: "square" },
              { id: "total", name: totalLabel, color: DIRECTION_COLORS.flat, shape: "square" },
            ]}
          />
        ) : null
      }
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={layout.bars.map((bar) => bar.label)}
          columns={[
            {
              id: "value",
              name: labels.total,
              values: layout.bars.map((bar) => `${kindName(bar.kind)}: ${signed(bar)}`),
            },
            { id: "running", name: runningLabel, values: layout.bars.map((bar) => fmt(bar.to)) },
          ]}
        />
      }
    >
      {(width, measuredHeight) => (
        <WaterfallPlot
          width={width}
          height={measuredHeight}
          bars={layout.bars}
          min={layout.min}
          max={layout.max}
          fmt={fmt}
          valueFormat={valueFormat}
          yAxis={yAxis}
          connectors={connectors}
          dataLabels={dataLabels}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          signed={signed}
          kindName={kindName}
          runningLabel={runningLabel}
          labels={labels}
          title={title}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  bars: readonly WaterfallBar[];
  min: number;
  max: number;
  fmt: (value: number) => string;
  valueFormat?: ValueFormat;
  yAxis?: ValueAxisOptions;
  connectors: boolean;
  dataLabels: boolean;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  signed: (bar: WaterfallBar) => string;
  kindName: (kind: WaterfallKind) => string;
  runningLabel: string;
  labels: ChartLabels;
  title: string;
}

function WaterfallPlot({
  width,
  height,
  bars,
  min,
  max,
  fmt,
  valueFormat,
  yAxis,
  connectors,
  dataLabels,
  grid,
  tooltip,
  animate,
  signed,
  kindName,
  runningLabel,
  labels,
  title,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const model = useMemo(() => {
    const y = linearScale({
      domain: [yAxis?.min ?? min, yAxis?.max ?? max],
      range: [innerHeight, 0],
      tickCount: yAxis?.tickCount ?? Math.max(3, Math.round(innerHeight / 56)),
    });
    const axisFormat = resolveAxisFormat(yAxis?.format ?? valueFormat);
    const yTicks = y
      .ticks()
      .map((tick) => ({ key: tick, position: y.map(tick), label: axisFormat(tick) }));
    const left = Math.max(...yTicks.map((tick) => estimateTextWidth(tick.label)), 16) + 18;
    const innerWidth = Math.max(40, width - left - MARGIN.right);
    const x = bandScale({
      count: bars.length,
      range: [0, innerWidth],
      paddingInner: 0.32,
      paddingOuter: 0.16,
    });
    const maxChars = Math.max(3, Math.floor(x.step / 6.4));
    const xTicks = bars.map((bar, i) => ({
      key: bar.id,
      position: x.center(i),
      label: truncate(bar.label, maxChars),
    }));
    const shapes = bars.map((bar, i) => {
      const top = y.map(Math.max(bar.from, bar.to));
      const bottom = y.map(Math.min(bar.from, bar.to));
      const h = Math.max(1.5, bottom - top);
      return {
        bar,
        x: x.start(i),
        top,
        bottom,
        path: roundedRectPath(x.start(i), top, x.bandwidth, h, { tl: 4, tr: 4, br: 4, bl: 4 }),
      };
    });
    return { y, yTicks, left, innerWidth, x, xTicks, shapes };
  }, [bars, min, max, innerHeight, width, yAxis, valueFormat]);

  const { y, yTicks, left, innerWidth, x, xTicks, shapes } = model;

  useEntryAnimation(
    svgRef,
    (root) => {
      const list = root.querySelectorAll("[data-bar]");
      const per = Math.min(60, 520 / Math.max(1, list.length));
      list.forEach((bar, i) => {
        bar.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
          duration: 560,
          delay: i * per,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 360, 520);
    },
    { disabled: !animate },
  );

  const current = active != null ? (bars[active] as WaterfallBar) : null;
  const valueText = current
    ? `${current.label}. ${kindName(current.kind)} ${signed(current)}. ${runningLabel} ${fmt(current.to)}`
    : labels.explore;
  const zero = y.map(0);
  const shownLabels = pickLabels(
    shapes.map((shape) => ({
      center: shape.x + x.bandwidth / 2,
      width: estimateTextWidth(signed(shape.bar), 11),
      y: shape.top - 6,
    })),
  );

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
        <g transform={`translate(${left},${MARGIN.top})`}>
          {grid ? (
            <GridLines ticks={yTicks} direction="horizontal" length={innerWidth} zero={zero} />
          ) : null}
          <AxisLeft ticks={yTicks} offset={0} title={yAxis?.title} />
          <AxisBottom ticks={xTicks} offset={innerHeight} />
          {connectors
            ? shapes.slice(0, -1).map((shape, i) => {
                const next = shapes[i + 1];
                if (!next) return null;
                const level = y.map(shape.bar.to);
                return (
                  <line
                    key={shape.bar.id}
                    data-fade=""
                    x1={shape.x + x.bandwidth}
                    x2={next.x}
                    y1={level}
                    y2={level}
                    strokeDasharray="3 3"
                    shapeRendering="crispEdges"
                    style={{ stroke: "var(--ink-3)", strokeOpacity: 0.7 }}
                  />
                );
              })
            : null}
          {shapes.map((shape, i) => (
            <Bar
              key={shape.bar.id}
              path={shape.path}
              kind={shape.bar.kind}
              active={active === i}
              muted={active != null && active !== i}
            />
          ))}
          {dataLabels
            ? shapes.map((shape, i) =>
                !shownLabels[i] ? null : (
                  <text
                    key={shape.bar.id}
                    data-fade=""
                    x={shape.x + x.bandwidth / 2}
                    y={shape.top - 6}
                    textAnchor="middle"
                    className="font-bold text-[11px] tabular-nums"
                    style={{
                      fill:
                        shape.bar.kind === "increase"
                          ? DIRECTION_COLORS.up
                          : shape.bar.kind === "decrease"
                            ? DIRECTION_COLORS.down
                            : "var(--ink)",
                      opacity: active != null && active !== i ? 0.45 : 1,
                    }}
                  >
                    {signed(shape.bar)}
                  </text>
                ),
              )
            : null}
        </g>
      </svg>
      <PlotOverlay
        left={left}
        top={0}
        width={innerWidth}
        height={height}
        label={labels.explore}
        count={bars.length}
        active={active}
        valueText={valueText}
        onActiveChange={setActive}
        indexAt={({ x: px }) => (bars.length ? x.indexAt(px) : null)}
      />
      {tooltip && current && active != null ? (
        <ChartTooltip
          x={left + x.center(active)}
          y={MARGIN.top + (shapes[active] as { top: number }).top}
          containerWidth={width}
          title={current.label}
          rows={[
            {
              id: "value",
              name: kindName(current.kind),
              value: signed(current),
              color: FILL[current.kind],
              shape: "square",
            },
            {
              id: "running",
              name: runningLabel,
              value: fmt(current.to),
              color: "var(--ink-3)",
              shape: "dot",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
