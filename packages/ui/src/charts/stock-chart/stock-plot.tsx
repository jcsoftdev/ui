"use client";

import { memo, useMemo, useRef, useState } from "react";
import { DECORATIVE } from "../core/a11y.js";
import { AxisBottom, AxisRight, estimateTextWidth, GridLines } from "../core/axes.js";
import { ChartBrush, type IndexRange } from "../core/cartesian/brush.js";
import { buildCategoryAxis, fullCategoryLabel } from "../core/category-axis.js";
import {
  formatNumber,
  formatPercent,
  resolveAxisFormat,
  type ValueFormat,
} from "../core/format.js";
import type { IndicatorSeries } from "../core/indicators.js";
import { EASE_OUT, fadeIn, revealClip, useEntryAnimation } from "../core/motion.js";
import { DIRECTION_COLORS, TONE_COLORS } from "../core/palette.js";
import { areaPath, linePath, type Point } from "../core/path.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import type { ChartLabels } from "../core/types.js";
import {
  type OscillatorModel,
  type OverlayLine,
  rebaseFrom,
  type StockBar,
  type StockComparison,
  type StockFlag,
  type StockSeriesType,
  sameDay,
} from "./stock-model.js";

export interface StockTexts {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  change: string;
  /** Name of the main series in the legend and in % mode. */
  price: string;
  /** Accessible names of the toolbar groups. */
  ranges: string;
  seriesTypes: string;
  seriesTypeNames: Record<StockSeriesType, string>;
  signal: string;
  histogram: string;
  /** Header of the events column in the data table. */
  events: string;
}

export const MARGIN = { top: 12, bottom: 28, left: 0 };
export const NAVIGATOR_HEIGHT = 44;
export const NAVIGATOR_GAP = 12;
const PANE_GAP = 22;
const UP = DIRECTION_COLORS.up;
const DOWN = DIRECTION_COLORS.down;
const MAIN_COLOR = "var(--accent-word)";
const OSCILLATOR_COLOR = "var(--chart-cat-5)";
const SIGNAL_COLOR = "var(--chart-cat-6)";

export interface StockPlotProps {
  width: number;
  height: number;
  title: string;
  data: readonly StockBar[];
  range: IndexRange;
  onRangeChange: (range: IndexRange) => void;
  seriesType: StockSeriesType;
  showVolume: boolean;
  overlays: readonly OverlayLine[];
  middles: ReadonlyMap<string, IndicatorSeries>;
  comparisons: readonly StockComparison[];
  oscillator: OscillatorModel | null;
  flags: readonly StockFlag[];
  lastPrice: boolean;
  navigator: boolean;
  fmt: (value: number) => string;
  vfmt: (value: number) => string;
  valueFormat?: ValueFormat;
  axisRoom: number;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  texts: StockTexts;
  labels: ChartLabels;
}

const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${formatPercent(value)}`;

function finite(values: Iterable<number | null | undefined>): number[] {
  const out: number[] = [];
  for (const value of values) if (value != null && Number.isFinite(value)) out.push(value);
  return out;
}

const Candles = memo(function Candles({
  bars,
  positions,
  width,
  y,
  ohlc,
}: {
  bars: readonly StockBar[];
  positions: readonly number[];
  width: number;
  y: (value: number) => number;
  ohlc: boolean;
}) {
  return (
    <g {...DECORATIVE}>
      {bars.map((bar, i) => {
        const x = positions[i] as number;
        const color = bar.close >= bar.open ? UP : DOWN;
        if (ohlc) {
          const tick = Math.max(2, width / 2);
          return (
            <g
              // biome-ignore lint/suspicious/noArrayIndexKey: bars follow the data order.
              key={i}
              data-bar=""
              strokeWidth={1.5}
              strokeLinecap="round"
              style={{ stroke: color, transformBox: "fill-box", transformOrigin: "center" }}
            >
              <line x1={x} x2={x} y1={y(bar.high)} y2={y(bar.low)} />
              <line x1={x - tick} x2={x} y1={y(bar.open)} y2={y(bar.open)} />
              <line x1={x} x2={x + tick} y1={y(bar.close)} y2={y(bar.close)} />
            </g>
          );
        }
        const top = y(Math.max(bar.open, bar.close));
        const bottom = y(Math.min(bar.open, bar.close));
        return (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: bars follow the data order.
            key={i}
            data-bar=""
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <line
              x1={x}
              x2={x}
              y1={y(bar.high)}
              y2={y(bar.low)}
              strokeWidth={1.25}
              style={{ stroke: color }}
            />
            <rect
              x={x - width / 2}
              y={top}
              width={width}
              height={Math.max(1.25, bottom - top)}
              rx={Math.min(2, width / 3)}
              style={{ fill: color }}
            />
          </g>
        );
      })}
    </g>
  );
});

function points(
  values: ReadonlyArray<number | null>,
  positions: readonly number[],
  y: (value: number) => number,
): Array<Point | null> {
  return values.map((value, i) =>
    value == null ? null : { x: positions[i] as number, y: y(value) },
  );
}

/**
 * Price pane (+ volume), optional oscillator pane, shared x axis and
 * crosshair, the last-price tag, flags and the navigator.
 */
export function StockPlot({
  width,
  height,
  title,
  data,
  range,
  onRangeChange,
  seriesType,
  showVolume,
  overlays,
  middles,
  comparisons,
  oscillator,
  flags,
  lastPrice,
  navigator,
  fmt,
  vfmt,
  valueFormat,
  axisRoom,
  grid,
  tooltip,
  animate,
  texts,
  labels,
}: StockPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [pointerY, setPointerY] = useState<number | null>(null);
  const [from, to] = range;
  const view = useMemo(() => data.slice(from, to + 1), [data, from, to]);
  const percent = comparisons.length > 0;
  const innerWidth = Math.max(60, width - MARGIN.left - axisRoom);
  const innerHeight = Math.max(80, height - MARGIN.top - MARGIN.bottom);
  const lowerHeight = oscillator ? Math.round((innerHeight - PANE_GAP) * 0.27) : 0;
  const priceHeight = oscillator ? innerHeight - PANE_GAP - lowerHeight : innerHeight;
  const lowerTop = priceHeight + PANE_GAP;
  const volumeHeight = showVolume && !percent ? Math.round(priceHeight * 0.2) : 0;
  const narrow = width < 440;

  const model = useMemo(() => {
    const axis = buildCategoryAxis(
      view.map((bar) => bar.date),
      innerWidth,
      { mode: "band", paddingInner: 0.3 },
    );
    const slice = (values: IndicatorSeries) => values.slice(from, to + 1);
    const main = percent
      ? rebaseFrom(
          data.map((bar) => bar.close),
          from,
        ).slice(from, to + 1)
      : null;
    const compared = comparisons.map((comparison) => ({
      ...comparison,
      view: rebaseFrom(comparison.values, from).slice(from, to + 1),
    }));
    const lines = percent
      ? []
      : overlays.map((line) => ({
          ...line,
          view: slice(line.values),
          lowerView: line.lower ? slice(line.lower) : undefined,
          middleView: middles.get(line.id)
            ? slice(middles.get(line.id) as IndicatorSeries)
            : undefined,
        }));
    const pool = percent
      ? finite([...(main ?? []), ...compared.flatMap((c) => c.view)])
      : finite([
          ...view.flatMap((bar) =>
            seriesType === "candle" || seriesType === "ohlc" ? [bar.low, bar.high] : [bar.close],
          ),
          ...lines.flatMap((line) => [...line.view, ...(line.lowerView ?? [])]),
        ]);
    const lo = Math.min(...pool);
    const hi = Math.max(...pool);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
    // Volume takes the bottom of the price pane: the price keeps clear of it.
    const priceBottom = priceHeight - (volumeHeight ? volumeHeight * 0.6 : 0);
    const y = linearScale({
      domain: [lo - pad, hi + pad],
      range: [priceBottom, 0],
      tickCount: Math.max(3, Math.round(priceHeight / 56)),
    });
    const axisFormat = percent ? signedPercent : resolveAxisFormat(valueFormat);
    const yTicks = y
      .ticks()
      .filter((tick) => y.map(tick) >= 0 && y.map(tick) <= priceHeight)
      .map((tick) => ({ key: tick, position: y.map(tick), label: axisFormat(tick) }));
    const maxVolume = Math.max(0, ...view.map((bar) => bar.volume ?? 0));
    let lower: {
      y: ReturnType<typeof linearScale>;
      ticks: Array<{ key: number; position: number; label: string }>;
      main: IndicatorSeries;
      signal?: IndicatorSeries;
      histogram?: IndicatorSeries;
    } | null = null;
    if (oscillator) {
      const mainView = slice(oscillator.main);
      const signalView = oscillator.signal ? slice(oscillator.signal) : undefined;
      const histogramView = oscillator.histogram ? slice(oscillator.histogram) : undefined;
      if (oscillator.type === "rsi") {
        const ly = linearScale({ domain: [0, 100], range: [lowerHeight, 0], nice: false });
        lower = {
          y: ly,
          ticks: [30, 70].map((tick) => ({
            key: tick,
            position: ly.map(tick),
            label: String(tick),
          })),
          main: mainView,
        };
      } else {
        const values = finite([...mainView, ...(signalView ?? []), ...(histogramView ?? [])]);
        const bound = Math.max(1e-9, ...values.map(Math.abs));
        const ly = linearScale({ domain: [-bound, bound], range: [lowerHeight, 0], nice: false });
        lower = {
          y: ly,
          ticks: [{ key: 0, position: ly.map(0), label: "0" }],
          main: mainView,
          signal: signalView,
          histogram: histogramView,
        };
      }
    }
    return { axis, main, compared, lines, y, yTicks, maxVolume, lower, axisFormat };
  }, [
    view,
    innerWidth,
    data,
    from,
    to,
    percent,
    comparisons,
    overlays,
    middles,
    seriesType,
    priceHeight,
    volumeHeight,
    valueFormat,
    oscillator,
    lowerHeight,
  ]);
  const { axis, main, compared, lines, y, yTicks, maxVolume, lower, axisFormat } = model;
  const positions = axis.positions;
  // Date labels are centered on their bar: drop the ones that would leave the drawing.
  const xTicks = axis.ticks.filter(
    (tick) =>
      tick.position - estimateTextWidth(tick.label) / 2 >= -MARGIN.left &&
      tick.position + estimateTextWidth(tick.label) / 2 <= innerWidth + axisRoom,
  );
  const barWidth = Math.max(1.5, Math.min(14, axis.bandwidth));

  useEntryAnimation(
    svgRef,
    (root) => {
      const bars = root.querySelectorAll("[data-bar]");
      const per = Math.min(8, 400 / Math.max(1, bars.length));
      bars.forEach((bar, i) => {
        bar.animate(
          [
            { transform: "scaleY(0.2)", opacity: 0 },
            { transform: "scaleY(1)", opacity: 1 },
          ],
          { duration: 420, delay: i * per, easing: EASE_OUT, fill: "backwards" },
        );
      });
      for (const node of root.querySelectorAll("[data-reveal]")) revealClip(node, 900);
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 360, 400);
    },
    { disabled: !animate },
  );

  const flagMarks = useMemo(() => {
    const stacks = new Map<number, number>();
    return flags.flatMap((flag) => {
      const index = view.findIndex((bar) => sameDay(bar.date, flag.date));
      if (index < 0) return [];
      const level = stacks.get(index) ?? 0;
      stacks.set(index, level + 1);
      return [{ flag, index, level }];
    });
  }, [flags, view]);

  const current = active != null ? view[active] : undefined;
  const previous = active != null && active > 0 ? view[active - 1] : data[from - 1];
  const last = view[view.length - 1];
  const beforeLast = view.length > 1 ? view[view.length - 2] : data[from - 1];
  const lastUp = !last || !beforeLast || last.close >= beforeLast.close;
  const flagsAt = (index: number) =>
    flagMarks.filter((mark) => mark.index === index).map((mark) => mark.flag);

  const changeOf = (bar: StockBar, before?: StockBar) => {
    const base = before?.close ?? bar.open;
    return base ? (bar.close - base) / Math.abs(base) : 0;
  };

  const valueText = (() => {
    if (!current || active == null) return labels.explore;
    const parts = [fullCategoryLabel(current.date)];
    if (percent) {
      parts.push(`${texts.price} ${signedPercent(main?.[active] ?? 0)}`);
      for (const c of compared) {
        const value = c.view[active];
        if (value != null) parts.push(`${c.name} ${signedPercent(value)}`);
      }
    } else if (seriesType === "candle" || seriesType === "ohlc") {
      parts.push(
        `${texts.open} ${fmt(current.open)}, ${texts.high} ${fmt(current.high)}, ${texts.low} ${fmt(current.low)}, ${texts.close} ${fmt(current.close)}`,
      );
    } else parts.push(`${texts.close} ${fmt(current.close)}`);
    parts.push(`${texts.change} ${signedPercent(changeOf(current, previous))}`);
    if (current.volume != null && showVolume) parts.push(`${texts.volume} ${vfmt(current.volume)}`);
    for (const line of lines) {
      const value = line.view[active];
      if (value != null) parts.push(`${line.name} ${fmt(value)}`);
    }
    if (oscillator && lower) {
      const value = lower.main[active];
      if (value != null)
        parts.push(`${oscillator.name} ${formatNumber(value, { maximumFractionDigits: 2 })}`);
    }
    for (const flag of flagsAt(active)) parts.push(flag.text);
    return parts.join(". ");
  })();

  const tooltipRows = (): TooltipRow[] => {
    if (!current || active == null) return [];
    const rows: TooltipRow[] = [];
    if (percent) {
      rows.push({
        id: "main",
        name: texts.price,
        value: signedPercent(main?.[active] ?? 0),
        color: MAIN_COLOR,
        shape: "line",
      });
      for (const c of compared) {
        const value = c.view[active];
        if (value != null) {
          rows.push({
            id: c.id,
            name: c.name,
            value: signedPercent(value),
            color: c.color ?? "",
            shape: "line",
          });
        }
      }
    } else if (seriesType === "candle" || seriesType === "ohlc") {
      const color = current.close >= current.open ? UP : DOWN;
      rows.push(
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
        { id: "close", name: texts.close, value: fmt(current.close), color, shape: "square" },
      );
    } else {
      rows.push({
        id: "close",
        name: texts.close,
        value: fmt(current.close),
        color: MAIN_COLOR,
        shape: "line",
      });
    }
    if (!percent) {
      rows.push({
        id: "change",
        name: texts.change,
        value: signedPercent(changeOf(current, previous)),
        color: "transparent",
      });
    }
    if (current.volume != null && showVolume && !percent) {
      rows.push({
        id: "volume",
        name: texts.volume,
        value: vfmt(current.volume),
        color: "var(--ink-3)",
        shape: "dot",
      });
    }
    for (const line of lines) {
      const value = line.view[active];
      if (value != null)
        rows.push({
          id: line.id,
          name: line.name,
          value: fmt(value),
          color: line.color,
          shape: "line",
        });
    }
    if (oscillator && lower) {
      const value = lower.main[active];
      if (value != null) {
        rows.push({
          id: "osc",
          name: oscillator.name,
          value: formatNumber(value, { maximumFractionDigits: 2 }),
          color: OSCILLATOR_COLOR,
          shape: "line",
        });
      }
      const signal = lower.signal?.[active];
      if (signal != null) {
        rows.push({
          id: "signal",
          name: texts.signal,
          value: formatNumber(signal, { maximumFractionDigits: 2 }),
          color: SIGNAL_COLOR,
          shape: "line",
        });
      }
    }
    for (const [i, flag] of flagsAt(active).entries()) {
      rows.push({
        id: `flag-${i}`,
        name: flag.label,
        value: flag.text,
        color: "transparent",
        emphasis: true,
      });
    }
    return rows;
  };

  const mainPath = useMemo(() => {
    if (percent) return linePath(points(main ?? [], positions, y.map), "linear");
    if (seriesType !== "line" && seriesType !== "area") return "";
    return linePath(
      points(
        view.map((bar) => bar.close),
        positions,
        y.map,
      ),
      "linear",
    );
  }, [percent, main, positions, y, seriesType, view]);
  const mainArea = useMemo(() => {
    if (percent || seriesType !== "area") return "";
    const top = points(
      view.map((bar) => bar.close),
      positions,
      y.map,
    );
    const base = top.map((point, i) => ({
      x: point?.x ?? (positions[i] as number),
      y: y.map(y.domain[0]),
    }));
    return areaPath(top, base, "linear");
  }, [percent, seriesType, view, positions, y]);

  // The navigator draws from zero: lift the closes off their minimum so the shape reads.
  const navigatorSeries = useMemo(() => {
    const floor = Math.min(...data.map((bar) => bar.close));
    return [{ id: "close", color: MAIN_COLOR, data: data.map((bar) => bar.close - floor) }];
  }, [data]);
  const crossX = active != null ? (positions[active] as number) : null;
  const lastValue = last ? (percent ? (main?.[view.length - 1] ?? 0) : last.close) : null;
  const tagColor = percent ? MAIN_COLOR : lastUp ? UP : DOWN;
  const hoverValue =
    pointerY != null && pointerY >= 0 && pointerY <= priceHeight ? y.invert(pointerY) : null;
  const navExtra = navigator ? NAVIGATOR_HEIGHT + NAVIGATOR_GAP : 0;

  return (
    <div className="relative" style={{ width, height: height + navExtra }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {grid ? <GridLines ticks={yTicks} direction="horizontal" length={innerWidth} /> : null}
          <AxisRight ticks={yTicks} offset={innerWidth} />
          <AxisBottom ticks={xTicks} offset={innerHeight} />
          {volumeHeight > 0 ? (
            <g {...DECORATIVE} transform={`translate(0,${priceHeight - volumeHeight})`}>
              {view.map((bar, i) => {
                if (bar.volume == null || maxVolume === 0) return null;
                const h = Math.max(1, (bar.volume / maxVolume) * volumeHeight);
                return (
                  <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: bars follow the data order.
                    key={i}
                    x={(positions[i] as number) - barWidth / 2}
                    y={volumeHeight - h}
                    width={barWidth}
                    height={h}
                    style={{
                      fill: bar.close >= bar.open ? UP : DOWN,
                      fillOpacity: active === i ? 0.55 : 0.22,
                    }}
                  />
                );
              })}
            </g>
          ) : null}
          {lines.map((line) =>
            line.lowerView ? (
              <g key={`${line.id}-band`} {...DECORATIVE} data-fade="">
                <path
                  d={areaPath(
                    points(line.view, positions, y.map),
                    points(line.lowerView, positions, y.map).map(
                      (point, i) => point ?? { x: positions[i] as number, y: 0 },
                    ),
                    "linear",
                  )}
                  style={{ fill: line.color, fillOpacity: 0.08 }}
                />
                <path
                  d={linePath(points(line.lowerView, positions, y.map))}
                  fill="none"
                  strokeWidth={1.25}
                  style={{ stroke: line.color, strokeOpacity: 0.8 }}
                />
                {line.middleView ? (
                  <path
                    d={linePath(points(line.middleView, positions, y.map))}
                    fill="none"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    style={{ stroke: line.color, strokeOpacity: 0.7 }}
                  />
                ) : null}
              </g>
            ) : null,
          )}
          {seriesType === "area" && !percent ? (
            <path d={mainArea} data-fade="" style={{ fill: MAIN_COLOR, fillOpacity: 0.12 }} />
          ) : null}
          <g data-reveal="" style={{ transformBox: "fill-box", transformOrigin: "left" }}>
            {!percent && (seriesType === "candle" || seriesType === "ohlc") ? (
              <Candles
                bars={view}
                positions={positions}
                width={barWidth}
                y={y.map}
                ohlc={seriesType === "ohlc"}
              />
            ) : null}
          </g>
          {mainPath ? (
            <path
              data-reveal=""
              d={mainPath}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              style={{ stroke: MAIN_COLOR }}
            />
          ) : null}
          {compared.map((c) => (
            <path
              key={c.id}
              data-reveal=""
              d={linePath(points(c.view, positions, y.map))}
              fill="none"
              strokeWidth={1.75}
              strokeLinejoin="round"
              style={{ stroke: c.color }}
            />
          ))}
          {lines.map((line) => (
            <path
              key={line.id}
              data-reveal=""
              d={linePath(points(line.view, positions, y.map))}
              fill="none"
              strokeWidth={line.lowerView ? 1.25 : 1.5}
              style={{ stroke: line.color, strokeOpacity: line.lowerView ? 0.8 : 1 }}
            />
          ))}
          {flagMarks.map(({ flag, index, level }) => {
            const bar = view[index] as StockBar;
            const x = positions[index] as number;
            const anchor = percent ? y.map(main?.[index] ?? 0) : y.map(bar.high);
            const top = Math.max(2, anchor - 30 - level * 22);
            const tone = TONE_COLORS[flag.tone ?? "accent"];
            return (
              <g key={`${index}-${level}-${flag.label}`} {...DECORATIVE} data-fade="">
                <line
                  x1={x}
                  x2={x}
                  y1={top + 16}
                  y2={anchor - 4}
                  strokeWidth={1}
                  style={{ stroke: tone.ink }}
                />
                <rect x={x} y={top} width={16} height={16} rx={4} style={{ fill: tone.ink }} />
                <text
                  x={x + 8}
                  y={top + 8}
                  dy="0.34em"
                  textAnchor="middle"
                  className="font-bold text-[10px]"
                  style={{ fill: "var(--surface)" }}
                >
                  {flag.label}
                </text>
              </g>
            );
          })}
          {lower && oscillator ? (
            <g transform={`translate(0,${lowerTop})`}>
              <text {...DECORATIVE} x={0} y={-7} className="fill-ink-3 font-semibold text-[10.5px]">
                {oscillator.name}
                {(() => {
                  const index = active ?? view.length - 1;
                  const value = lower.main[index];
                  return value == null
                    ? ""
                    : ` · ${formatNumber(value, { maximumFractionDigits: 2 })}`;
                })()}
              </text>
              <line
                x1={0}
                x2={innerWidth}
                y1={0}
                y2={0}
                shapeRendering="crispEdges"
                style={{ stroke: "var(--line)" }}
              />
              {oscillator.type === "rsi" ? (
                <rect
                  x={0}
                  y={lower.y.map(70)}
                  width={innerWidth}
                  height={lower.y.map(30) - lower.y.map(70)}
                  style={{ fill: "var(--surface-2)", fillOpacity: 0.7 }}
                />
              ) : null}
              {lower.ticks.map((tick) => (
                <line
                  key={tick.key}
                  x1={0}
                  x2={innerWidth}
                  y1={tick.position}
                  y2={tick.position}
                  strokeDasharray="3 3"
                  shapeRendering="crispEdges"
                  style={{ stroke: "var(--line-strong)" }}
                />
              ))}
              <AxisRight ticks={lower.ticks} offset={innerWidth} />
              {lower.histogram
                ? lower.histogram.map((value, i) => {
                    if (value == null) return null;
                    const zero = lower.y.map(0);
                    const end = lower.y.map(value);
                    return (
                      <rect
                        // biome-ignore lint/suspicious/noArrayIndexKey: bars follow the data order.
                        key={i}
                        {...DECORATIVE}
                        x={(positions[i] as number) - barWidth / 2}
                        y={Math.min(zero, end)}
                        width={barWidth}
                        height={Math.max(0.5, Math.abs(end - zero))}
                        style={{ fill: value >= 0 ? UP : DOWN, fillOpacity: 0.45 }}
                      />
                    );
                  })
                : null}
              <path
                data-reveal=""
                d={linePath(points(lower.main, positions, lower.y.map))}
                fill="none"
                strokeWidth={1.5}
                style={{ stroke: OSCILLATOR_COLOR }}
              />
              {lower.signal ? (
                <path
                  data-reveal=""
                  d={linePath(points(lower.signal, positions, lower.y.map))}
                  fill="none"
                  strokeWidth={1.25}
                  style={{ stroke: SIGNAL_COLOR }}
                />
              ) : null}
            </g>
          ) : null}
          {crossX != null ? (
            <g {...DECORATIVE} className="pointer-events-none">
              <line
                x1={crossX}
                x2={crossX}
                y1={0}
                y2={innerHeight}
                strokeDasharray="3 3"
                style={{ stroke: "var(--chart-crosshair)" }}
              />
              {hoverValue != null && pointerY != null ? (
                <>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={pointerY}
                    y2={pointerY}
                    strokeDasharray="3 3"
                    style={{ stroke: "var(--chart-crosshair)" }}
                  />
                  <AxisTag
                    x={innerWidth}
                    y={pointerY}
                    width={axisRoom}
                    color="var(--ink)"
                    text={axisFormat(hoverValue)}
                  />
                </>
              ) : null}
            </g>
          ) : null}
          {lastPrice && lastValue != null ? (
            <g {...DECORATIVE} data-fade="" className="pointer-events-none">
              <line
                x1={0}
                x2={innerWidth}
                y1={y.map(lastValue)}
                y2={y.map(lastValue)}
                strokeDasharray="2 3"
                shapeRendering="crispEdges"
                style={{ stroke: tagColor, strokeOpacity: 0.75 }}
              />
              {!(
                hoverValue != null &&
                pointerY != null &&
                Math.abs(pointerY - y.map(lastValue)) < 16
              ) ? (
                <AxisTag
                  x={innerWidth}
                  y={y.map(lastValue)}
                  width={axisRoom}
                  color={tagColor}
                  text={percent ? signedPercent(lastValue) : fmt(lastValue)}
                />
              ) : null}
            </g>
          ) : null}
        </g>
      </svg>
      <PlotOverlay
        left={MARGIN.left}
        top={MARGIN.top}
        width={innerWidth}
        height={innerHeight}
        label={labels.explore}
        count={view.length}
        active={active}
        valueText={valueText}
        onActiveChange={(index) => {
          setActive(index);
          if (index == null) setPointerY(null);
        }}
        indexAt={({ x, y: py }) => {
          setPointerY(py);
          return view.length ? axis.indexAt(x) : null;
        }}
      />
      {tooltip && current && crossX != null ? (
        <ChartTooltip
          x={MARGIN.left + crossX}
          y={MARGIN.top + (pointerY ?? y.map(current.close))}
          containerWidth={width - axisRoom}
          title={fullCategoryLabel(current.date)}
          rows={tooltipRows()}
          className={narrow ? "max-w-[50cqw]" : undefined}
        />
      ) : null}
      {navigator && data.length > 3 ? (
        <div style={{ marginTop: NAVIGATOR_GAP }}>
          <ChartBrush
            count={data.length}
            series={navigatorSeries}
            range={range}
            onChange={onRangeChange}
            width={width}
            left={MARGIN.left}
            right={axisRoom}
            height={NAVIGATOR_HEIGHT}
            label={labels.brush}
            valueText={`${fullCategoryLabel((data[from] as StockBar).date)} – ${fullCategoryLabel((data[to] as StockBar).date)}`}
          />
        </div>
      ) : null}
    </div>
  );
}

function AxisTag({
  x,
  y,
  width,
  color,
  text,
}: {
  x: number;
  y: number;
  width: number;
  color: string;
  text: string;
}) {
  return (
    <g transform={`translate(${x + 3},${y})`}>
      <rect x={0} y={-9} width={width - 4} height={18} rx={5} style={{ fill: color }} />
      <text
        x={(width - 4) / 2}
        y={0}
        dy="0.34em"
        textAnchor="middle"
        className="font-bold text-[10.5px] tabular-nums"
        style={{ fill: "var(--surface)" }}
      >
        {text}
      </text>
    </g>
  );
}
