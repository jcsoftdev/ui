"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft, estimateTextWidth, GridLines } from "../core/axes.js";
import { ChartBrush, type IndexRange } from "../core/cartesian/brush.js";
import { buildCategoryAxis, fullCategoryLabel } from "../core/category-axis.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import {
  formatPercent,
  resolveAxisFormat,
  resolveFormat,
  type ValueFormat,
} from "../core/format.js";
import { ChartLegend } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { DIRECTION_COLORS } from "../core/palette.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels, type XValue } from "../core/types.js";

export interface Candle {
  date: XValue;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlestickTexts {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  change: string;
  up: string;
  down: string;
}

const DEFAULT_TEXTS: CandlestickTexts = {
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
  change: "Change",
  up: "Up",
  down: "Down",
};

export interface CandlestickChartProps {
  data: readonly Candle[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Height of the plot (price and volume), 360 by default. */
  height?: number;
  /** Volume bars below the price, sharing the x axis. Default: shown when any candle has a volume. */
  volume?: boolean;
  /** "filled" paints every body; "hollow" leaves rising candles empty. */
  candleStyle?: "filled" | "hollow";
  /** Overview with a draggable view to zoom the x axis. */
  brush?: boolean;
  /** Dashed line and tag at the last close (default true). */
  lastPrice?: boolean;
  valueFormat?: ValueFormat;
  volumeFormat?: ValueFormat;
  xFormat?: (value: XValue) => string;
  /** Overrides the rising color (default the `chart-up` token). */
  upColor?: string;
  /** Overrides the falling color (default the `chart-down` token). */
  downColor?: string;
  grid?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  texts?: Partial<CandlestickTexts>;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const MARGIN = { top: 12, bottom: 30 };
const BRUSH_HEIGHT = 52;
const VOLUME_GAP = 16;

const CandleMark = memo(function CandleMark({
  x,
  width,
  wickTop,
  wickBottom,
  bodyTop,
  bodyHeight,
  color,
  hollow,
  active,
  muted,
}: {
  x: number;
  width: number;
  wickTop: number;
  wickBottom: number;
  bodyTop: number;
  bodyHeight: number;
  color: string;
  hollow: boolean;
  active: boolean;
  muted: boolean;
}) {
  return (
    <g
      data-bar=""
      style={{
        opacity: muted ? 0.5 : 1,
        transformBox: "fill-box",
        transformOrigin: "center center",
      }}
    >
      <line
        x1={x}
        x2={x}
        y1={wickTop}
        y2={wickBottom}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={{ stroke: color }}
      />
      <rect
        x={x - width / 2}
        y={bodyTop}
        width={width}
        height={bodyHeight}
        rx={Math.min(2.5, width / 3)}
        strokeWidth={hollow ? 1.5 : active ? 1.5 : 0}
        style={{
          fill: hollow ? "var(--surface)" : color,
          stroke: active ? "var(--ink)" : color,
        }}
      />
    </g>
  );
});

/**
 * Open-high-low-close candles with up and down tokens, optional volume bars
 * on the same x axis, a last-price line and a brush to zoom. Arrow keys walk
 * the candles; the tooltip reads open, high, low, close, change and volume.
 */
export function CandlestickChart({
  data,
  title,
  description,
  height = 360,
  volume,
  candleStyle = "filled",
  brush = false,
  lastPrice = true,
  valueFormat,
  volumeFormat = "compact",
  xFormat,
  upColor = DIRECTION_COLORS.up,
  downColor = DIRECTION_COLORS.down,
  grid = true,
  legend = true,
  tooltip = true,
  loading,
  animate = true,
  texts: textOverrides,
  labels: labelOverrides,
  className,
}: CandlestickChartProps) {
  const labels = resolveLabels(labelOverrides);
  const texts = { ...DEFAULT_TEXTS, ...textOverrides };
  const fmt = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const vfmt = useMemo(() => resolveFormat(volumeFormat), [volumeFormat]);
  const showVolume = volume ?? data.some((candle) => candle.volume != null);
  const frameHeight = height + (brush ? BRUSH_HEIGHT + 12 : 0);

  return (
    <ChartFrame
      height={frameHeight}
      labels={labels}
      loading={loading}
      empty={data.length === 0}
      skeleton="bars"
      legend={
        legend ? (
          <ChartLegend
            items={[
              { id: "up", name: texts.up, color: upColor, shape: "square" },
              { id: "down", name: texts.down, color: downColor, shape: "square" },
            ]}
          />
        ) : null
      }
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={data.map((candle) => fullCategoryLabel(candle.date))}
          columns={[
            { id: "open", name: texts.open, values: data.map((c) => fmt(c.open)) },
            { id: "high", name: texts.high, values: data.map((c) => fmt(c.high)) },
            { id: "low", name: texts.low, values: data.map((c) => fmt(c.low)) },
            { id: "close", name: texts.close, values: data.map((c) => fmt(c.close)) },
            ...(showVolume
              ? [
                  {
                    id: "volume",
                    name: texts.volume,
                    values: data.map((c) => (c.volume == null ? "" : vfmt(c.volume))),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      {(width) => (
        <CandlePlot
          width={width}
          height={height}
          data={data}
          showVolume={showVolume}
          hollow={candleStyle === "hollow"}
          brush={brush}
          lastPrice={lastPrice}
          fmt={fmt}
          vfmt={vfmt}
          valueFormat={valueFormat}
          xFormat={xFormat}
          upColor={upColor}
          downColor={downColor}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          texts={texts}
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
  data: readonly Candle[];
  showVolume: boolean;
  hollow: boolean;
  brush: boolean;
  lastPrice: boolean;
  fmt: (value: number) => string;
  vfmt: (value: number) => string;
  valueFormat?: ValueFormat;
  xFormat?: (value: XValue) => string;
  upColor: string;
  downColor: string;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  texts: CandlestickTexts;
  labels: ChartLabels;
  title: string;
}

function CandlePlot({
  width,
  height,
  data,
  showVolume,
  hollow,
  brush,
  lastPrice,
  fmt,
  vfmt,
  valueFormat,
  xFormat,
  upColor,
  downColor,
  grid,
  tooltip,
  animate,
  texts,
  labels,
  title,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [range, setRange] = useState<IndexRange>([0, Math.max(0, data.length - 1)]);
  useEffect(() => setRange([0, Math.max(0, data.length - 1)]), [data.length]);

  const [from, to] = range;
  const view = useMemo(() => data.slice(from, to + 1), [data, from, to]);
  const zoomed = from > 0 || to < data.length - 1;
  const narrow = width < 440;
  const tagRoom = lastPrice && !narrow ? 56 : 12;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const priceHeight = showVolume ? Math.round((innerHeight - VOLUME_GAP) * 0.76) : innerHeight;
  const volumeTop = priceHeight + VOLUME_GAP;
  const volumeHeight = innerHeight - volumeTop;

  const model = useMemo(() => {
    const lows = view.map((c) => c.low);
    const highs = view.map((c) => c.high);
    const lo = Math.min(...lows);
    const hi = Math.max(...highs);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.06;
    const y = linearScale({
      domain: [lo - pad, hi + pad],
      range: [priceHeight, 0],
      tickCount: Math.max(3, Math.round(priceHeight / 54)),
    });
    const axisFormat = resolveAxisFormat(valueFormat);
    const yTicks = y
      .ticks()
      .map((tick) => ({ key: tick, position: y.map(tick), label: axisFormat(tick) }));
    const left = Math.max(...yTicks.map((tick) => estimateTextWidth(tick.label)), 16) + 18;
    const innerWidth = Math.max(60, width - left - tagRoom);
    const axis = buildCategoryAxis(
      view.map((c) => c.date),
      innerWidth,
      { mode: "band", format: xFormat, paddingInner: 0.3 },
    );
    const maxVolume = Math.max(0, ...view.map((c) => c.volume ?? 0));
    const vy = linearScale({ domain: [0, maxVolume || 1], range: [volumeHeight, 0], nice: false });
    return { y, yTicks, left, innerWidth, axis, vy, maxVolume };
  }, [view, priceHeight, volumeHeight, valueFormat, width, tagRoom, xFormat]);
  const { y, yTicks, left, innerWidth, axis, vy, maxVolume } = model;
  const candleWidth = Math.max(2, Math.min(22, axis.bandwidth));

  useEntryAnimation(
    svgRef,
    (root) => {
      const list = root.querySelectorAll("[data-bar]");
      const per = Math.min(14, 600 / Math.max(1, list.length));
      list.forEach((bar, i) => {
        bar.animate(
          [
            { transform: "scaleY(0.2)", opacity: 0 },
            { transform: "scaleY(1)", opacity: 1 },
          ],
          {
            duration: 480,
            delay: i * per,
            easing: EASE_OUT,
            fill: "backwards",
          },
        );
      });
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 360, 500);
    },
    { disabled: !animate, replayKey: data },
  );

  useEffect(
    () => setActive((current) => (current != null && current >= view.length ? null : current)),
    [view.length],
  );

  const colorOf = (c: Candle) => (c.close >= c.open ? upColor : downColor);
  const change = (c: Candle) => (c.open ? (c.close - c.open) / Math.abs(c.open) : 0);
  const signedPercent = (c: Candle) => `${c.close > c.open ? "+" : ""}${formatPercent(change(c))}`;
  const current = active != null ? view[active] : undefined;
  const last = view[view.length - 1];
  const dateLabel = (c: Candle) => fullCategoryLabel(c.date);

  const valueText = current
    ? `${dateLabel(current)}. ${texts.open} ${fmt(current.open)}, ${texts.high} ${fmt(current.high)}, ${texts.low} ${fmt(current.low)}, ${texts.close} ${fmt(current.close)}, ${texts.change} ${signedPercent(current)}${
        current.volume != null ? `, ${texts.volume} ${vfmt(current.volume)}` : ""
      }`
    : labels.explore;

  const brushSeries = useMemo(
    () => [{ id: "close", color: "var(--accent-word)", data: data.map((c) => c.close) }],
    [data],
  );
  const lastTone = last ? colorOf(last) : upColor;

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
          {grid ? <GridLines ticks={yTicks} direction="horizontal" length={innerWidth} /> : null}
          <AxisLeft ticks={yTicks} offset={0} />
          <AxisBottom ticks={axis.ticks} offset={innerHeight} />
          {showVolume ? (
            <g transform={`translate(0,${volumeTop})`}>
              <line
                x1={0}
                x2={innerWidth}
                y1={volumeHeight}
                y2={volumeHeight}
                shapeRendering="crispEdges"
                style={{ stroke: "var(--line-strong)" }}
              />
              <text
                x={-10}
                y={4}
                dy="0.34em"
                textAnchor="end"
                className="fill-ink-3 font-medium text-[10.5px] tabular-nums"
              >
                {vfmt(maxVolume)}
              </text>
              {view.map((c, i) => {
                if (c.volume == null) return null;
                const h = Math.max(1, volumeHeight - vy.map(c.volume));
                return (
                  <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: candles follow the data order.
                    key={i}
                    data-bar=""
                    x={(axis.positions[i] as number) - candleWidth / 2}
                    y={volumeHeight - h}
                    width={candleWidth}
                    height={h}
                    rx={Math.min(2.5, candleWidth / 3)}
                    style={{
                      fill: colorOf(c),
                      fillOpacity: active === i ? 0.85 : 0.42,
                      transformBox: "fill-box",
                      transformOrigin: "center bottom",
                    }}
                  />
                );
              })}
            </g>
          ) : null}
          {active != null ? (
            <rect
              x={(axis.positions[active] as number) - axis.step / 2}
              y={0}
              width={axis.step}
              height={innerHeight}
              style={{ fill: "var(--chart-grid)" }}
            />
          ) : null}
          {view.map((c, i) => {
            const top = y.map(Math.max(c.open, c.close));
            const bottom = y.map(Math.min(c.open, c.close));
            return (
              <CandleMark
                // biome-ignore lint/suspicious/noArrayIndexKey: candles follow the data order.
                key={i}
                x={axis.positions[i] as number}
                width={candleWidth}
                wickTop={y.map(c.high)}
                wickBottom={y.map(c.low)}
                bodyTop={top}
                bodyHeight={Math.max(1.5, bottom - top)}
                color={colorOf(c)}
                hollow={hollow && c.close >= c.open}
                active={active === i}
                muted={active != null && active !== i}
              />
            );
          })}
          {lastPrice && last ? (
            <g data-fade="" className="pointer-events-none">
              <line
                x1={0}
                x2={innerWidth}
                y1={y.map(last.close)}
                y2={y.map(last.close)}
                strokeDasharray="4 4"
                shapeRendering="crispEdges"
                style={{ stroke: lastTone, strokeOpacity: 0.7 }}
              />
              {!narrow ? (
                <g transform={`translate(${innerWidth + 4},${y.map(last.close)})`}>
                  <rect
                    x={0}
                    y={-9}
                    width={tagRoom - 6}
                    height={18}
                    rx={6}
                    style={{ fill: lastTone }}
                  />
                  <text
                    x={(tagRoom - 6) / 2}
                    y={0}
                    dy="0.34em"
                    textAnchor="middle"
                    className="font-bold text-[10.5px] tabular-nums"
                    style={{ fill: "var(--surface)" }}
                  >
                    {fmt(last.close)}
                  </text>
                </g>
              ) : null}
            </g>
          ) : null}
        </g>
      </svg>
      <PlotOverlay
        left={left}
        top={MARGIN.top}
        width={innerWidth}
        height={innerHeight}
        label={labels.explore}
        count={view.length}
        active={active}
        valueText={valueText}
        onActiveChange={setActive}
        indexAt={({ x }) => (view.length ? axis.indexAt(x) : null)}
      />
      {zoomed ? (
        <button
          type="button"
          onClick={() => setRange([0, data.length - 1])}
          className="absolute top-0 right-0 z-10 cursor-pointer rounded-pill border border-line bg-surface px-2.5 py-1 font-semibold text-[11px] text-ink-2 hover:bg-surface-2"
        >
          {labels.resetZoom}
        </button>
      ) : null}
      {tooltip && current && active != null ? (
        <ChartTooltip
          x={left + (axis.positions[active] as number)}
          y={MARGIN.top + y.map(current.high)}
          containerWidth={width}
          title={dateLabel(current)}
          rows={[
            {
              id: "open",
              name: texts.open,
              value: fmt(current.open),
              color: "var(--ink-3)",
              shape: "dot",
            },
            {
              id: "high",
              name: texts.high,
              value: fmt(current.high),
              color: "var(--ink-3)",
              shape: "dot",
            },
            {
              id: "low",
              name: texts.low,
              value: fmt(current.low),
              color: "var(--ink-3)",
              shape: "dot",
            },
            {
              id: "close",
              name: texts.close,
              value: fmt(current.close),
              color: colorOf(current),
              shape: "square",
            },
            {
              id: "change",
              name: texts.change,
              value: signedPercent(current),
              color: "transparent",
              emphasis: true,
            },
            ...(current.volume != null
              ? [
                  {
                    id: "volume",
                    name: texts.volume,
                    value: vfmt(current.volume),
                    color: "var(--ink-3)",
                    shape: "dot" as const,
                  },
                ]
              : []),
          ]}
        />
      ) : null}
      {brush && data.length > 3 ? (
        <div className="mt-3">
          <ChartBrush
            count={data.length}
            series={brushSeries}
            range={range}
            onChange={setRange}
            width={width}
            left={left}
            right={tagRoom}
            height={BRUSH_HEIGHT}
            label={labels.brush}
            valueText={`${fullCategoryLabel((data[from] as Candle).date)} – ${fullCategoryLabel((data[to] as Candle).date)}`}
          />
        </div>
      ) : null}
    </div>
  );
}
