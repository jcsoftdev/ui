/**
 * Pure maths of price charts, shared by the stock chart and anything else that needs them:
 * indicators (SMA, EMA, Bollinger bands, VWAP, RSI, MACD), summary statistics, Heikin-Ashi and
 * Renko transforms, and the arithmetic of chart drawings (Fibonacci levels, measuring a range).
 * No DOM and no chart code: importing a function pulls in only that function.
 */

// ---- indicators ----------------------------------------------------------------------

export type IndicatorInput = ReadonlyArray<number | null>;
export type IndicatorSeries = Array<number | null>;

/** Simple moving average over `period` points; null until a full window of numbers exists. */
export function sma(values: IndicatorInput, period: number): IndicatorSeries {
  const out: IndicatorSeries = new Array(values.length).fill(null);
  let sum = 0;
  let filled = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) {
      sum = 0;
      filled = 0;
      continue;
    }
    sum += value;
    filled += 1;
    if (filled > period) {
      sum -= values[i - period] as number;
      filled = period;
    }
    if (filled === period) out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential moving average with smoothing `2 / (period + 1)`. It is seeded
 * with the simple average of the first `period` numbers, so leading nulls
 * (e.g. another indicator's warm-up) are skipped.
 */
export function ema(values: IndicatorInput, period: number): IndicatorSeries {
  const out: IndicatorSeries = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let previous: number | null = null;
  let seed = 0;
  let seeded = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value == null) continue;
    if (previous == null) {
      seed += value;
      seeded += 1;
      if (seeded === period) {
        previous = seed / period;
        out[i] = previous;
      }
      continue;
    }
    previous = value * k + previous * (1 - k);
    out[i] = previous;
  }
  return out;
}

export interface BollingerBands {
  middle: IndicatorSeries;
  upper: IndicatorSeries;
  lower: IndicatorSeries;
}

/** Simple average ± `k` population standard deviations of the same window. */
export function bollinger(values: IndicatorInput, period = 20, k = 2): BollingerBands {
  const middle = sma(values, period);
  const upper: IndicatorSeries = new Array(values.length).fill(null);
  const lower: IndicatorSeries = new Array(values.length).fill(null);
  middle.forEach((mean, i) => {
    if (mean == null) return;
    let squares = 0;
    for (let j = i - period + 1; j <= i; j += 1) squares += ((values[j] as number) - mean) ** 2;
    const deviation = Math.sqrt(squares / period);
    upper[i] = mean + k * deviation;
    lower[i] = mean - k * deviation;
  });
  return { middle, upper, lower };
}

export interface VolumeBar {
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Volume weighted average price anchored at `from`: running sum of the
 * typical price `(high + low + close) / 3` times volume, over the running
 * volume. Points before the anchor, or before any volume, are null.
 */
export function vwap(bars: readonly VolumeBar[], from = 0): IndicatorSeries {
  const out: IndicatorSeries = new Array(bars.length).fill(null);
  let priceVolume = 0;
  let volume = 0;
  for (let i = Math.max(0, from); i < bars.length; i += 1) {
    const bar = bars[i] as VolumeBar;
    const v = bar.volume ?? 0;
    priceVolume += ((bar.high + bar.low + bar.close) / 3) * v;
    volume += v;
    out[i] = volume > 0 ? priceVolume / volume : null;
  }
  return out;
}

/**
 * Relative strength index with Wilder smoothing: the first average gain and
 * loss are plain means of `period` changes, later ones are
 * `(previous * (period - 1) + current) / period`. 100 when there are no losses.
 */
export function rsi(values: IndicatorInput, period = 14): IndicatorSeries {
  const out: IndicatorSeries = new Array(values.length).fill(null);
  let gain = 0;
  let loss = 0;
  let changes = 0;
  for (let i = 1; i < values.length; i += 1) {
    const current = values[i];
    const previous = values[i - 1];
    if (current == null || previous == null) continue;
    const change = current - previous;
    const up = Math.max(0, change);
    const down = Math.max(0, -change);
    changes += 1;
    if (changes <= period) {
      gain += up / period;
      loss += down / period;
      if (changes < period) continue;
    } else {
      gain = (gain * (period - 1) + up) / period;
      loss = (loss * (period - 1) + down) / period;
    }
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export interface MacdResult {
  /** Fast EMA minus slow EMA. */
  macd: IndicatorSeries;
  /** EMA of the MACD line. */
  signal: IndicatorSeries;
  /** MACD minus signal. */
  histogram: IndicatorSeries;
}

/** Moving average convergence divergence, 12 / 26 / 9 by default. */
export function macd(values: IndicatorInput, fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);
  const line: IndicatorSeries = fastLine.map((value, i) => {
    const other = slowLine[i];
    return value == null || other == null ? null : value - other;
  });
  const signal = ema(line, signalPeriod);
  const histogram: IndicatorSeries = line.map((value, i) => {
    const s = signal[i];
    return value == null || s == null ? null : value - s;
  });
  return { macd: line, signal, histogram };
}

/**
 * Change relative to the value at `base` (0.1 = +10%), for comparing series
 * that live on different scales. Null when the base is missing or zero.
 */
export function rebase(values: IndicatorInput, base: number): IndicatorSeries {
  const origin = values[base];
  return values.map((value) =>
    value == null || origin == null || origin === 0 ? null : value / origin - 1,
  );
}

// ---- bars ----------------------------------------------------------------------------

export interface StockBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** A point on the chart in data space: a moment and a price. */
export interface StockAnchor {
  /** Milliseconds since the epoch. */
  time: number;
  price: number;
}

// ---- stats ---------------------------------------------------------------------------

export interface StockExtreme {
  price: number;
  date: Date;
  index: number;
}

export interface StockDrawdown {
  /** Peak-to-trough fall as a fraction of the peak (0.18 = -18%); 0 when the price never fell. */
  depth: number;
  peak: StockExtreme;
  trough: StockExtreme;
}

export interface StockStats {
  count: number;
  first: number;
  last: number;
  /** Absolute and relative change from the first close to the last. */
  change: number;
  changePercent: number;
  /** Simple close-to-close returns, one fewer than the bars. */
  returns: number[];
  meanReturn: number;
  /** Sample standard deviation of the returns, per bar. */
  volatility: number;
  /** `volatility` scaled to a year with `periodsPerYear` bars (252 by default). */
  annualizedVolatility: number;
  high: StockExtreme;
  low: StockExtreme;
  bestDay: StockExtreme & { change: number };
  worstDay: StockExtreme & { change: number };
  maxDrawdown: StockDrawdown;
  totalVolume: number;
}

/**
 * Summary numbers of a price series: returns, volatility, extremes and the
 * maximum drawdown. Returns `null` for an empty series. Pure and headless: it
 * does not read the chart, so it works on the visible slice or on all the data.
 */
export function stockStats(data: readonly StockBar[], periodsPerYear = 252): StockStats | null {
  if (data.length === 0) return null;
  const firstBar = data[0] as StockBar;
  const lastBar = data[data.length - 1] as StockBar;
  const extreme = (price: number, index: number): StockExtreme => ({
    price,
    date: (data[index] as StockBar).date,
    index,
  });

  let high = extreme(firstBar.high, 0);
  let low = extreme(firstBar.low, 0);
  let totalVolume = 0;
  const returns: number[] = [];
  let best = { ...extreme(firstBar.close, 0), change: Number.NEGATIVE_INFINITY };
  let worst = { ...extreme(firstBar.close, 0), change: Number.POSITIVE_INFINITY };
  let peak = extreme(firstBar.close, 0);
  let drawdown: StockDrawdown = { depth: 0, peak, trough: peak };

  data.forEach((bar, i) => {
    totalVolume += bar.volume ?? 0;
    if (bar.high > high.price) high = extreme(bar.high, i);
    if (bar.low < low.price) low = extreme(bar.low, i);
    if (bar.close > peak.price) peak = extreme(bar.close, i);
    const depth = peak.price > 0 ? (peak.price - bar.close) / peak.price : 0;
    if (depth > drawdown.depth) drawdown = { depth, peak, trough: extreme(bar.close, i) };
    if (i === 0) return;
    const before = (data[i - 1] as StockBar).close;
    const change = before ? (bar.close - before) / Math.abs(before) : 0;
    returns.push(change);
    if (change > best.change) best = { ...extreme(bar.close, i), change };
    if (change < worst.change) worst = { ...extreme(bar.close, i), change };
  });

  const meanReturn = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((s, v) => s + (v - meanReturn) ** 2, 0) / (returns.length - 1)
      : 0;
  const volatility = Math.sqrt(variance);
  const change = lastBar.close - firstBar.close;
  const flat = { ...extreme(firstBar.close, 0), change: 0 };
  return {
    count: data.length,
    first: firstBar.close,
    last: lastBar.close,
    change,
    changePercent: firstBar.close ? change / Math.abs(firstBar.close) : 0,
    returns,
    meanReturn,
    volatility,
    annualizedVolatility: volatility * Math.sqrt(periodsPerYear),
    high,
    low,
    bestDay: returns.length ? best : flat,
    worstDay: returns.length ? worst : flat,
    maxDrawdown: drawdown,
    totalVolume,
  };
}

// ---- transforms ----------------------------------------------------------------------

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

// ---- drawing maths -------------------------------------------------------------------

export const FIB_LEVELS: readonly number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * Fractional bar index of a moment over ascending `times`: integers are bars,
 * values between two bars interpolate their times, and moments outside the
 * series extrapolate with the nearest gap.
 */
export function indexAtTime(times: readonly number[], time: number): number {
  const last = times.length - 1;
  if (last <= 0) return 0;
  const first = times[0] as number;
  const end = times[last] as number;
  if (time <= first) return (time - first) / ((times[1] as number) - first || 1);
  if (time >= end) return last + (time - end) / (end - (times[last - 1] as number) || 1);
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] as number) <= time) lo = mid;
    else hi = mid;
  }
  const a = times[lo] as number;
  const b = times[hi] as number;
  return lo + (time - a) / (b - a || 1);
}

/** Inverse of `indexAtTime`. */
export function timeAtIndex(times: readonly number[], index: number): number {
  const last = times.length - 1;
  if (last < 0) return 0;
  if (last === 0) return times[0] as number;
  if (index <= 0) {
    return (times[0] as number) + index * ((times[1] as number) - (times[0] as number));
  }
  if (index >= last) {
    const gap = (times[last] as number) - (times[last - 1] as number);
    return (times[last] as number) + (index - last) * gap;
  }
  const lo = Math.floor(index);
  const a = times[lo] as number;
  return a + (index - lo) * ((times[lo + 1] as number) - a);
}

export interface FibLevel {
  ratio: number;
  price: number;
}

/** Retracement levels between two prices: ratio 0 sits at `a`, ratio 1 at `b`. */
export function fibLevels(a: number, b: number): FibLevel[] {
  return FIB_LEVELS.map((ratio) => ({ ratio, price: a + (b - a) * ratio }));
}

export interface Measurement {
  change: number;
  /** Fraction of the start price (0.05 = +5%), negative when falling. */
  percent: number;
  /** Whole bars between the two ends. */
  bars: number;
  /** Milliseconds between the two ends. */
  duration: number;
}

/** What a drag between two anchors measures. */
export function measureRange(
  times: readonly number[],
  a: StockAnchor,
  b: StockAnchor,
): Measurement {
  const change = b.price - a.price;
  return {
    change,
    percent: a.price ? change / Math.abs(a.price) : 0,
    bars: Math.round(Math.abs(indexAtTime(times, b.time) - indexAtTime(times, a.time))),
    duration: Math.abs(b.time - a.time),
  };
}

/** Whole days in a duration. */
export function durationDays(duration: number): number {
  return Math.round(duration / 86_400_000);
}

/** Distance from point `p` to the segment `a`-`b`, in pixels. */
export function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
