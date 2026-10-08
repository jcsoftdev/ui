import type { StockBar } from "./stock-model.js";

/**
 * Heikin-Ashi candles: each bar opens at the midpoint of the previous HA bar
 * and closes at the average of the raw bar, which smooths the trend.
 * One output bar per input bar, same dates and volume.
 */
export function heikinAshi(data: readonly StockBar[]): StockBar[] {
  const out: StockBar[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const bar = data[i] as StockBar;
    const close = (bar.open + bar.high + bar.low + bar.close) / 4;
    const previous = out[i - 1];
    const open = previous ? (previous.open + previous.close) / 2 : (bar.open + bar.close) / 2;
    out.push({
      date: bar.date,
      open,
      close,
      high: Math.max(bar.high, open, close),
      low: Math.min(bar.low, open, close),
      volume: bar.volume,
    });
  }
  return out;
}

/** Average true range over the last `period` bars (simple mean of the true ranges). */
export function averageTrueRange(data: readonly StockBar[], period = 14): number {
  if (data.length === 0) return 0;
  const ranges = data.map((bar, i) => {
    const before = data[i - 1]?.close ?? bar.open;
    return Math.max(bar.high - bar.low, Math.abs(bar.high - before), Math.abs(bar.low - before));
  });
  const tail = ranges.slice(-period);
  return tail.reduce((sum, value) => sum + value, 0) / tail.length;
}

/** Brick size used when none is given: the ATR(14), never below 0.01. */
export function defaultBrickSize(data: readonly StockBar[]): number {
  return Math.max(0.01, averageTrueRange(data));
}

/**
 * Renko bricks from the closes. A brick is added every time the close moves a
 * full `brickSize` past the last brick's top (up) or bottom (down); a reversal
 * therefore needs one brick more than a continuation, which filters the noise.
 * Each brick is a bar without wicks dated at the bar that completed it; the
 * volume of the bars in between goes to the first brick they produced.
 */
export function renko(data: readonly StockBar[], brickSize?: number): StockBar[] {
  if (data.length === 0) return [];
  const size = brickSize && brickSize > 0 ? brickSize : defaultBrickSize(data);
  const out: StockBar[] = [];
  let top = (data[0] as StockBar).close;
  let bottom = top;
  let pending = 0;
  for (const bar of data) {
    pending += bar.volume ?? 0;
    // The cap only protects against absurd gaps with a tiny brick size.
    for (let guard = 0; guard < 1000; guard += 1) {
      let open: number;
      let close: number;
      if (bar.close >= top + size) {
        open = top;
        close = top + size;
        bottom = open;
        top = close;
      } else if (bar.close <= bottom - size) {
        open = bottom;
        close = bottom - size;
        top = open;
        bottom = close;
      } else break;
      out.push({
        date: bar.date,
        open,
        close,
        high: Math.max(open, close),
        low: Math.min(open, close),
        volume: pending,
      });
      pending = 0;
    }
  }
  return out;
}
