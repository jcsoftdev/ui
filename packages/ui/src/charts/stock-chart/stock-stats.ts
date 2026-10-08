import type { StockBar } from "./stock-model.js";

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
