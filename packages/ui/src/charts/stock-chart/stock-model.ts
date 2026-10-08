import {
  bollinger,
  ema,
  type IndicatorSeries,
  macd,
  rebase,
  rsi,
  sma,
  vwap,
} from "../core/indicators.js";
import type { ChartTone } from "../core/palette.js";
import { seriesColor } from "../core/palette.js";

export interface StockBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type StockSeriesType = "candle" | "ohlc" | "line" | "area";

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
