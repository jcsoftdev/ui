// Pure logic added for StockChart parity (transforms, stats, drawings math) and the map extras.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

async function load(files) {
  const bundle = await build({
    stdin: {
      contents: files
        .map((file) => `export * from ${JSON.stringify(join(charts, file))};`)
        .join("\n"),
      resolveDir: charts,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const stock = await load([
  "stock-chart/stock-transforms.ts",
  "stock-chart/stock-stats.ts",
  "stock-chart/stock-drawings.ts",
]);

const day = (n) => new Date(2026, 0, 1 + n);
const bar = (n, open, high, low, close, volume = 10) => ({
  date: day(n),
  open,
  high,
  low,
  close,
  volume,
});
const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`);

test("heikinAshi: first bar opens at the midpoint, next ones chain from the previous HA bar", () => {
  const ha = stock.heikinAshi([bar(0, 10, 14, 8, 12), bar(1, 12, 16, 11, 15)]);
  assert.equal(ha.length, 2);
  near(ha[0].close, (10 + 14 + 8 + 12) / 4, "close 0");
  near(ha[0].open, 11, "open 0");
  near(ha[1].open, (ha[0].open + ha[0].close) / 2, "open 1");
  near(ha[1].close, (12 + 16 + 11 + 15) / 4, "close 1");
  assert.ok(ha[1].high >= Math.max(ha[1].open, ha[1].close));
  assert.ok(ha[1].low <= Math.min(ha[1].open, ha[1].close));
  assert.equal(+ha[1].date, +day(1));
  assert.equal(ha[1].volume, 10);
});

test("renko: bricks need a full brick, reversals need two, volume is conserved", () => {
  const closes = [100, 103, 106, 104, 100, 101, 97];
  const bars = closes.map((c, i) => bar(i, c, c + 1, c - 1, c));
  const bricks = stock.renko(bars, 3);
  // 100 -> 103 up, 103 -> 106 up, 106 -> 104 nothing, 100 <= 103 - 3 down, 97 <= 100 - 3 down
  assert.deepEqual(
    bricks.map((b) => [b.open, b.close]),
    [
      [100, 103],
      [103, 106],
      [103, 100],
      [100, 97],
    ],
  );
  for (const brick of bricks) {
    assert.equal(brick.high, Math.max(brick.open, brick.close));
    assert.equal(brick.low, Math.min(brick.open, brick.close));
  }
  const total = bricks.reduce((sum, b) => sum + b.volume, 0);
  assert.equal(total, 70);
});

test("renko: a gap makes several bricks and flat data makes none", () => {
  const gap = stock.renko([bar(0, 50, 51, 49, 50), bar(1, 50, 60, 50, 59)], 2);
  assert.equal(gap.length, 4);
  assert.equal(gap[3].close, 58);
  assert.equal(stock.renko([bar(0, 5, 6, 4, 5), bar(1, 5, 6, 4, 5.5)], 2).length, 0);
  assert.deepEqual(stock.renko([], 2), []);
});

test("defaultBrickSize is the ATR and never zero", () => {
  const bars = [bar(0, 10, 12, 10, 11), bar(1, 11, 13, 11, 12)];
  near(stock.averageTrueRange(bars, 14), 2, "atr");
  assert.equal(stock.defaultBrickSize([bar(0, 5, 5, 5, 5)]), 0.01);
});

test("stockStats: returns, extremes and max drawdown", () => {
  const bars = [
    bar(0, 100, 101, 99, 100),
    bar(1, 100, 112, 100, 110),
    bar(2, 110, 111, 85, 88),
    bar(3, 88, 95, 87, 93),
    bar(4, 93, 99, 92, 99),
  ];
  const stats = stock.stockStats(bars);
  assert.equal(stats.count, 5);
  near(stats.changePercent, -0.01, "change");
  near(stats.returns[0], 0.1, "r0");
  near(stats.returns[1], (88 - 110) / 110, "r1");
  assert.equal(stats.high.price, 112);
  assert.equal(stats.high.index, 1);
  assert.equal(stats.low.price, 85);
  assert.equal(stats.low.index, 2);
  near(stats.maxDrawdown.depth, 22 / 110, "drawdown");
  assert.equal(stats.maxDrawdown.peak.index, 1);
  assert.equal(stats.maxDrawdown.trough.index, 2);
  assert.equal(stats.bestDay.index, 1);
  assert.equal(stats.worstDay.index, 2);
  assert.ok(stats.volatility > 0);
  near(stats.annualizedVolatility, stats.volatility * Math.sqrt(252), "annualized");
  assert.equal(stats.totalVolume, 50);
});

test("stockStats: empty and single-bar series", () => {
  assert.equal(stock.stockStats([]), null);
  const one = stock.stockStats([bar(0, 10, 11, 9, 10)]);
  assert.equal(one.volatility, 0);
  assert.equal(one.maxDrawdown.depth, 0);
  assert.deepEqual(one.returns, []);
});

test("appendBars replaces the forming bar, appends newer ones and caps the length", () => {
  const base = [bar(0, 1, 2, 1, 2), bar(1, 2, 3, 2, 3)];
  const tick = stock.appendBars(base, bar(1, 2, 4, 2, 4));
  assert.equal(tick.length, 2);
  assert.equal(tick[1].close, 4);
  assert.equal(base[1].close, 3, "input is not mutated");
  assert.equal(stock.appendBars(base, bar(2, 3, 4, 3, 4)).length, 3);
  assert.equal(stock.appendBars(base, bar(0, 1, 1, 1, 1)).length, 2, "older bars are ignored");
  const capped = stock.appendBars(base, [bar(2, 3, 4, 3, 4), bar(3, 4, 5, 4, 5)], 3);
  assert.deepEqual(
    capped.map((b) => +b.date),
    [+day(1), +day(2), +day(3)],
  );
});

test("indexAtTime / timeAtIndex interpolate and extrapolate", () => {
  const times = [0, 10, 20, 40];
  assert.equal(stock.indexAtTime(times, 10), 1);
  assert.equal(stock.indexAtTime(times, 15), 1.5);
  assert.equal(stock.indexAtTime(times, 30), 2.5);
  assert.equal(stock.indexAtTime(times, -10), -1);
  assert.equal(stock.indexAtTime(times, 60), 4);
  for (const index of [-1, 0, 0.5, 2.5, 3, 4]) {
    near(stock.indexAtTime(times, stock.timeAtIndex(times, index)), index, `round trip ${index}`);
  }
  assert.equal(stock.indexAtTime([5], 100), 0);
});

test("fibLevels and measureRange", () => {
  const levels = stock.fibLevels(100, 200);
  assert.equal(levels[0].price, 100);
  assert.equal(levels[levels.length - 1].price, 200);
  near(levels.find((l) => l.ratio === 0.5).price, 150, "half");
  const times = [0, 1, 2, 3, 4].map((n) => n * 86_400_000);
  const m = stock.measureRange(times, { time: times[1], price: 100 }, { time: times[4], price: 90 });
  near(m.percent, -0.1, "percent");
  assert.equal(m.bars, 3);
  assert.equal(stock.durationDays(m.duration), 3);
  near(stock.distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3, "distance");
  near(stock.distanceToSegment({ x: 14, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5, "past the end");
});
