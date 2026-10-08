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
  const m = stock.measureRange(
    times,
    { time: times[1], price: 100 },
    { time: times[4], price: 90 },
  );
  near(m.percent, -0.1, "percent");
  assert.equal(m.bars, 3);
  assert.equal(stock.durationDays(m.duration), 3);
  near(stock.distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3, "distance");
  near(
    stock.distanceToSegment({ x: 14, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    5,
    "past the end",
  );
});

const maps = await load(["maps/geo/routes.ts", "hex-tile-map/hex-layout.ts"]);

test("greatCircle: ends are kept, the equator is a straight run and the antimeridian splits", () => {
  const pieces = maps.greatCircle([0, 0], [90, 0], 4);
  assert.equal(pieces.length, 1);
  assert.deepEqual(pieces[0][0], [0, 0]);
  assert.deepEqual(pieces[0][4], [90, 0]);
  near(pieces[0][2][0], 45, "mid lon");
  near(pieces[0][2][1], 0, "mid lat");
  // Madrid -> Tokyo bows north of both cities.
  const [route] = maps.greatCircle([-3.7, 40.4], [139.7, 35.7], 20);
  assert.ok(Math.max(...route.map((p) => p[1])) > 45);
  // Lima -> Sydney crosses the 180th meridian: two pieces, no jump inside a piece.
  const split = maps.greatCircle([-77, -12], [151, -34], 60);
  assert.ok(split.length >= 1);
  for (const piece of split) {
    for (let i = 1; i < piece.length; i += 1)
      assert.ok(Math.abs(piece[i][0] - piece[i - 1][0]) <= 180);
  }
  near(maps.greatCircleDistance([0, 0], [0, 90]), 90, "quarter");
  assert.deepEqual(maps.greatCircle([10, 10], [10, 10], 3).length, 1);
});

test("route arcs bulge to the left of the travel direction and paths are well formed", () => {
  const [cx, cy] = maps.routeControl([0, 100], [100, 100], 0.25);
  near(cx, 50, "control x");
  near(cy, 75, "control y (up on screen)");
  assert.deepEqual(maps.routeControl([0, 0], [10, 0], 0), [5, 0]);
  assert.equal(maps.routeArcPath([0, 0], [10, 0], 0), "M0.0,0.0Q5.0,0.0 10.0,0.0");
  assert.equal(
    maps.routePolylinePath([
      [
        [0, 0],
        [1, 1],
      ],
      [[5, 5]],
    ]),
    "M0.0,0.0L1.0,1.0",
  );
});

test("Peru hex layout: 25 unique cells and ids, one connected body", () => {
  const tiles = maps.PERU_HEX_TILES;
  assert.equal(tiles.length, 25);
  assert.equal(new Set(tiles.map((t) => t.id)).size, 25);
  assert.equal(
    new Set(tiles.map((t) => `${t.row}:${t.col}`)).size,
    25,
    "no two tiles share a cell",
  );
  assert.ok(tiles.every((t) => /^PE-[A-Z]{3}$/.test(t.id) && t.code.length === 3));
  const seen = new Set([tiles[0].id]);
  const queue = [tiles[0]];
  while (queue.length) {
    const tile = queue.pop();
    for (const id of maps.hexNeighbors(tile, tiles)) {
      if (!seen.has(id)) {
        seen.add(id);
        queue.push(tiles.find((t) => t.id === id));
      }
    }
  }
  assert.equal(seen.size, 25, "every tile touches the rest");
  const lima = tiles.find((t) => t.id === "PE-LIM");
  const callao = tiles.find((t) => t.id === "PE-CAL");
  assert.ok(maps.hexNeighbors(lima, tiles).includes("PE-CAL"));
  assert.ok(maps.hexNeighbors(callao, tiles).includes("PE-LIM"));
});

test("layoutHexGrid fits the box, centers it and hit-testing finds the tile", () => {
  const tiles = maps.PERU_HEX_TILES;
  for (const [w, h] of [
    [320, 400],
    [800, 300],
    [500, 500],
  ]) {
    const grid = maps.layoutHexGrid(tiles, w, h);
    assert.ok(grid.size > 0);
    assert.ok(grid.width <= w + 1e-6 && grid.height <= h + 1e-6, `${w}x${h} fits`);
    for (const [x, y] of grid.centers) {
      assert.ok(x - grid.size * 0.86 >= -1e-6 && x + grid.size * 0.86 <= w + 1e-6);
      assert.ok(y - grid.size >= -1e-6 && y + grid.size <= h + 1e-6);
    }
    assert.ok(Math.abs(grid.offsetX + grid.width / 2 - w / 2) < 1e-6);
    tiles.forEach((_, index) => {
      const [x, y] = grid.centers[index];
      assert.equal(maps.hexAt(grid.centers, grid.size, x, y), index);
    });
    assert.equal(maps.hexAt(grid.centers, grid.size, -50, -50), -1);
  }
  assert.equal(maps.layoutHexGrid([], 100, 100).size, 0);
  assert.equal(maps.hexPoints(0, 0, 10).split(" ").length, 6);
});
