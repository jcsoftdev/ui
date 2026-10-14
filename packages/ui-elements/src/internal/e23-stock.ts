/**
 * Pure model behind the stock chart: indicators, overlay and oscillator lines, summary stats,
 * live bar appending, Heikin-Ashi and Renko transforms, and the maths of drawings. A port of the
 * React `charts/core/indicators.ts` and `charts/stock-chart/stock-*.ts`; the tests compare them.
 */

import {
  bollinger,
  ema,
  type IndicatorSeries,
  macd,
  rebase,
  rsi,
  type StockAnchor,
  type StockBar,
  sma,
  vwap,
} from "@jcsoftdev/ui-core/chart/indicators";
import { type ChartTone, seriesColor } from "@jcsoftdev/ui-core/chart/palette";

export {
  averageTrueRange,
  type BollingerBands,
  bollinger,
  defaultBrickSize,
  distanceToSegment,
  durationDays,
  ema,
  FIB_LEVELS,
  type FibLevel,
  fibLevels,
  heikinAshi,
  type IndicatorInput,
  type IndicatorSeries,
  indexAtTime,
  type MacdResult,
  type Measurement,
  macd,
  measureRange,
  rebase,
  renko,
  rsi,
  type StockAnchor,
  type StockBar,
  type StockDrawdown,
  type StockExtreme,
  type StockStats,
  sma,
  stockStats,
  timeAtIndex,
  type VolumeBar,
  vwap,
} from "@jcsoftdev/ui-core/chart/indicators";

// ---- model ---------------------------------------------------------------------------

export type StockSeriesType =
  | "candle"
  | "ohlc"
  | "line"
  | "area"
  | "column"
  | "heikin-ashi"
  | "renko";

/** The types drawn as candles (the last two are transforms of the data first). */
export function isCandleLike(type: StockSeriesType): boolean {
  return type === "candle" || type === "heikin-ashi" || type === "renko";
}

/** Indicators drawn over the price. */
export type StockOverlay =
  | { type: "sma"; period: number; color?: string }
  | { type: "ema"; period: number; color?: string }
  | { type: "bollinger"; period?: number; deviations?: number; color?: string }
  /** Anchored at the first visible bar. */
  | { type: "vwap"; color?: string };

/** Oscillator in the lower pane. */
export type StockOscillator =
  | { type: "rsi"; period?: number }
  | { type: "macd"; fast?: number; slow?: number; signal?: number };

export interface StockComparison {
  id: string;
  name: string;
  /** One close per bar of `data` (same dates), null where missing. */
  values: ReadonlyArray<number | null>;
  color?: string;
}

export interface StockFlag {
  date: Date | number;
  /** One or two characters on the flag, e.g. "P". */
  label: string;
  /** Full text for the tooltip and screen readers. */
  text: string;
  tone?: ChartTone;
}

/** One line of an overlay (Bollinger has three that share an id). */
export interface OverlayLine {
  id: string;
  name: string;
  color: string;
  values: IndicatorSeries;
  dashed?: boolean;
  /** Bollinger: the band between `values` (upper) and `lower`. */
  lower?: IndicatorSeries;
}

export function overlayId(overlay: StockOverlay, index: number): string {
  return `${overlay.type}-${index}`;
}

export function overlayName(overlay: StockOverlay): string {
  if (overlay.type === "sma") return `SMA ${overlay.period}`;
  if (overlay.type === "ema") return `EMA ${overlay.period}`;
  if (overlay.type === "bollinger") {
    return `Bollinger ${overlay.period ?? 20}, ${overlay.deviations ?? 2}`;
  }
  return "VWAP";
}

/** Overlay lines on the full data (warm-up before the visible window is kept). */
export function overlayLines(
  data: readonly StockBar[],
  overlays: readonly StockOverlay[],
  vwapFrom: number,
): OverlayLine[] {
  const closes = data.map((bar) => bar.close);
  return overlays.map((overlay, index) => {
    const id = overlayId(overlay, index);
    const color = overlay.color ?? seriesColor(index + 1);
    const name = overlayName(overlay);
    if (overlay.type === "sma") return { id, name, color, values: sma(closes, overlay.period) };
    if (overlay.type === "ema") return { id, name, color, values: ema(closes, overlay.period) };
    if (overlay.type === "vwap") return { id, name, color, values: vwap(data, vwapFrom) };
    const bands = bollinger(closes, overlay.period ?? 20, overlay.deviations ?? 2);
    return { id, name, color, values: bands.upper, lower: bands.lower, dashed: false };
  });
}

/** Bollinger's middle line, drawn dashed inside the band. */
export function bollingerMiddle(data: readonly StockBar[], overlay: StockOverlay): IndicatorSeries {
  if (overlay.type !== "bollinger") return [];
  return bollinger(
    data.map((bar) => bar.close),
    overlay.period ?? 20,
    overlay.deviations ?? 2,
  ).middle;
}

export interface OscillatorModel {
  type: "rsi" | "macd";
  name: string;
  /** RSI value or MACD line. */
  main: IndicatorSeries;
  signal?: IndicatorSeries;
  histogram?: IndicatorSeries;
}

export function oscillatorModel(
  data: readonly StockBar[],
  oscillator: StockOscillator,
): OscillatorModel {
  const closes = data.map((bar) => bar.close);
  if (oscillator.type === "rsi") {
    const period = oscillator.period ?? 14;
    return { type: "rsi", name: `RSI ${period}`, main: rsi(closes, period) };
  }
  const fast = oscillator.fast ?? 12;
  const slow = oscillator.slow ?? 26;
  const signal = oscillator.signal ?? 9;
  const result = macd(closes, fast, slow, signal);
  return {
    type: "macd",
    name: `MACD ${fast}, ${slow}, ${signal}`,
    main: result.macd,
    signal: result.signal,
    histogram: result.histogram,
  };
}

/** Comparison values rebased at the first visible bar that has a value. */
export function rebaseFrom(values: ReadonlyArray<number | null>, from: number): IndicatorSeries {
  let base = from;
  while (base < values.length && values[base] == null) base += 1;
  return base < values.length ? rebase(values, base) : values.map(() => null);
}

/** Same calendar day. */
export function sameDay(a: Date | number, b: Date | number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * Adds live bars to a series: a bar with the same date as the last one
 * replaces it (the candle still forming), a newer bar is appended, an older
 * one is ignored. `maxBars` drops the oldest bars so a long stream stays bounded.
 */
export function appendBars(
  data: readonly StockBar[],
  incoming: StockBar | readonly StockBar[],
  maxBars = Number.POSITIVE_INFINITY,
): StockBar[] {
  const next = [...data];
  const list: readonly StockBar[] = "date" in incoming ? [incoming] : incoming;
  for (const bar of list) {
    const last = next[next.length - 1];
    if (last && +last.date === +bar.date) next[next.length - 1] = bar;
    else if (!last || +bar.date > +last.date) next.push(bar);
  }
  return next.length > maxBars ? next.slice(next.length - maxBars) : next;
}

// ---- drawings ------------------------------------------------------------------------

export type StockDrawing =
  | { id: string; type: "trend"; a: StockAnchor; b: StockAnchor }
  | { id: string; type: "horizontal"; price: number }
  | { id: string; type: "range"; a: StockAnchor; b: StockAnchor }
  | { id: string; type: "fib"; a: StockAnchor; b: StockAnchor };

/** Tools of the drawing toolbar: `cursor` selects, `measure` is transient (never persisted). */
export type StockTool = "cursor" | "trend" | "horizontal" | "range" | "fib" | "measure";

export const DEFAULT_STOCK_TOOLS: readonly StockTool[] = [
  "cursor",
  "trend",
  "horizontal",
  "range",
  "fib",
  "measure",
];
