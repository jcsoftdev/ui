// Golden parity: indicators, stats, transforms and drawing math in `src/internal/e23-stock.ts` are a
// port of the React stock chart. The React modules are imported by path at runtime, never statically.
import { describe, expect, it } from "vitest";
import * as mine from "../src/internal/e23-stock.ts";
import { columns } from "../src/internal/e23-stock-canvas.ts";

const indicators = (await import("../../ui/src/charts/core/indicators.ts")) as typeof mine;
const transforms = (await import(
  "../../ui/src/charts/stock-chart/stock-transforms.ts"
)) as typeof mine;
const stats = (await import("../../ui/src/charts/stock-chart/stock-stats.ts")) as typeof mine;
const drawings = (await import("../../ui/src/charts/stock-chart/stock-drawings.ts")) as typeof mine;

// A deterministic random walk, so the numbers are stable and non-trivial.
function walk(n: number): mine.StockBar[] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let price = 100;
  return Array.from({ length: n }, (_, i) => {
    const open = price;
    const close = open + (rand() - 0.48) * 4;
    price = close;
    return {
      date: new Date(2026, 0, 1 + i),
      open,
      high: Math.max(open, close) + rand() * 2,
      low: Math.min(open, close) - rand() * 2,
      close,
      volume: 1000 + Math.round(rand() * 5000),
    };
  });
}
const DATA = walk(120);
const CLOSES = DATA.map((bar) => bar.close);

describe("stock math matches the React chart", () => {
  it("indicators", () => {
    expect(mine.sma(CLOSES, 10)).toEqual(indicators.sma(CLOSES, 10));
    expect(mine.ema(CLOSES, 12)).toEqual(indicators.ema(CLOSES, 12));
    expect(mine.bollinger(CLOSES, 20, 2)).toEqual(indicators.bollinger(CLOSES, 20, 2));
    expect(mine.vwap(DATA, 30)).toEqual(indicators.vwap(DATA, 30));
    expect(mine.rsi(CLOSES, 14)).toEqual(indicators.rsi(CLOSES, 14));
    expect(mine.macd(CLOSES)).toEqual(indicators.macd(CLOSES));
    expect(mine.rebase(CLOSES, 5)).toEqual(indicators.rebase(CLOSES, 5));
  });

  it("transforms, stats and live bars", () => {
    expect(mine.heikinAshi(DATA)).toEqual(transforms.heikinAshi(DATA));
    expect(mine.renko(DATA, 2)).toEqual(transforms.renko(DATA, 2));
    expect(mine.renko(DATA)).toEqual(transforms.renko(DATA));
    expect(mine.stockStats(DATA)).toEqual(stats.stockStats(DATA));
    const extra = { ...(DATA[119] as mine.StockBar), close: 99 };
    const next = { ...extra, date: new Date(2026, 6, 1) };
    expect(mine.appendBars(DATA, [extra, next], 100)).toEqual(
      stats.appendBars(DATA, [extra, next], 100),
    );
  });

  it("drawing geometry", () => {
    const times = DATA.map((bar) => +bar.date);
    const probes = [
      (times[0] as number) - 86_400_000 * 2,
      times[10] as number,
      (times[10] as number) + 40_000_000,
      (times[119] as number) + 86_400_000 * 3,
    ];
    for (const time of probes) {
      expect(mine.indexAtTime(times, time)).toBe(drawings.indexAtTime(times, time));
    }
    for (const index of [-2, 0, 3.5, 119, 122]) {
      expect(mine.timeAtIndex(times, index)).toBe(drawings.timeAtIndex(times, index));
    }
    expect(mine.fibLevels(100, 140)).toEqual(drawings.fibLevels(100, 140));
    const a = { time: times[5] as number, price: 101 };
    const b = { time: times[40] as number, price: 117 };
    expect(mine.measureRange(times, a, b)).toEqual(drawings.measureRange(times, a, b));
    expect(mine.distanceToSegment({ x: 5, y: 9 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(
      drawings.distanceToSegment({ x: 5, y: 9 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    );
  });
});

describe("canvas columns", () => {
  it("merge the bars that share a pixel and keep first open, last close and the extremes", () => {
    const view = DATA.slice(0, 40);
    const positions = view.map((_, i) => i * 0.25); // four bars per pixel
    const merged = columns(view, positions, true);
    const slots = new Set(positions.map((x) => Math.round(x)));
    expect(merged).toHaveLength(slots.size);
    const first = merged[0];
    expect(first?.open).toBe(view[0]?.open);
    expect(first?.close).toBe(view[1]?.close);
    expect(first?.high).toBe(Math.max(...view.slice(0, 2).map((b) => b.high)));
    expect(first?.volume).toBe(view.slice(0, 2).reduce((sum, b) => sum + (b.volume ?? 0), 0));
    expect(columns(view, positions, false)).toHaveLength(40);
  });
});
