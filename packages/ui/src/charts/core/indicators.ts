/**
 * Technical indicators as pure functions. Every result is aligned with its
 * input: one entry per input point, `null` while the indicator is warming up
 * (or where the input itself is missing).
 */

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
