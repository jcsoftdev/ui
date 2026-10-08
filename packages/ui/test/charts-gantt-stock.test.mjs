// Pure helpers behind GanttChart (date scale, dependency routing, rollups) and StockChart (indicators).
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

const bundle = await build({
  stdin: {
    contents: ["core/indicators.ts", "core/gantt.ts", "core/time-range.ts"]
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
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const close = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, `${label}: length`);
  expected.forEach((value, i) => {
    if (value == null) assert.equal(actual[i], null, `${label}[${i}]`);
    else assert.ok(Math.abs(actual[i] - value) < 1e-9, `${label}[${i}]: ${actual[i]} != ${value}`);
  });
};

test("SMA averages full windows and restarts after a gap", () => {
  close(lib.sma([1, 2, 3, 4, 5, 6], 3), [null, null, 2, 3, 4, 5], "sma");
  close(lib.sma([1, 2, null, 4, 6, 8], 2), [null, 1.5, null, null, 5, 7], "sma gap");
});

test("EMA is seeded with the SMA and smooths with 2 / (period + 1)", () => {
  // k = 0.5: seed (2 + 4 + 6) / 3 = 4; 10*.5 + 4*.5 = 7; 4*.5 + 7*.5 = 5.5; 13*.5 + 5.5*.5 = 9.25
  close(lib.ema([2, 4, 6, 10, 4, 13], 3), [null, null, 4, 7, 5.5, 9.25], "ema");
  // Leading nulls (another indicator warming up) are skipped before seeding.
  close(lib.ema([null, null, 1, 3, 5], 2), [null, null, null, 2, 4], "ema nulls");
});

test("Bollinger bands are the SMA ± k population deviations", () => {
  const { middle, upper, lower } = lib.bollinger([1, 2, 3, 5], 3, 2);
  const sd1 = Math.sqrt(2 / 3); // window 1 2 3
  const sd2 = Math.sqrt(((2 - 10 / 3) ** 2 + (3 - 10 / 3) ** 2 + (5 - 10 / 3) ** 2) / 3);
  close(middle, [null, null, 2, 10 / 3], "middle");
  close(upper, [null, null, 2 + 2 * sd1, 10 / 3 + 2 * sd2], "upper");
  close(lower, [null, null, 2 - 2 * sd1, 10 / 3 - 2 * sd2], "lower");
});

test("RSI uses Wilder smoothing", () => {
  // Changes +1 +1 -1 +1 +1. First averages: gain 2/3, loss 1/3 -> RS 2 -> 66.67.
  // Then gain (2/3*2 + 1)/3 = 7/9, loss (1/3*2)/3 = 2/9 -> RS 3.5 -> 77.78.
  // Then gain 23/27, loss 4/27 -> RS 5.75 -> 85.19.
  close(
    lib.rsi([1, 2, 3, 2, 3, 4], 3),
    [null, null, null, 100 - 100 / 3, 100 - 100 / 4.5, 100 - 100 / 6.75],
    "rsi",
  );
  close(lib.rsi([1, 2, 3, 4], 2), [null, null, 100, 100], "rsi without losses");
});

test("MACD is fast EMA minus slow EMA, with an EMA signal and histogram", () => {
  const values = [2, 4, 6, 10, 4, 13, 9];
  const fast = lib.ema(values, 2);
  const slow = lib.ema(values, 3);
  // ema2: seed 3, then 6*2/3 + 3/3 = 5, 10*2/3 + 5/3 = 25/3, 4*2/3 + 25/9 = 49/9, ...
  close(fast.slice(0, 5), [null, 3, 5, 25 / 3, 49 / 9], "ema2");
  const out = lib.macd(values, 2, 3, 2);
  // MACD from index 2: 5 - 4 = 1, 25/3 - 7 = 4/3, 49/9 - 5.5 = -1/18.
  close(out.macd.slice(0, 5), [null, null, 1, 4 / 3, -1 / 18], "macd");
  // Signal ema2 of the MACD: seed (1 + 4/3) / 2 = 7/6, then -1/18*2/3 + 7/18 = 19/54.
  close(out.signal.slice(0, 5), [null, null, null, 7 / 6, 19 / 54], "signal");
  close(out.histogram.slice(0, 5), [null, null, null, 4 / 3 - 7 / 6, -1 / 18 - 19 / 54], "hist");
  out.macd.forEach((value, i) => {
    if (value != null) assert.ok(Math.abs(value - (fast[i] - slow[i])) < 1e-12);
  });
});

test("VWAP is anchored and weighted by volume; rebase is relative to the base point", () => {
  const bars = [
    { high: 3, low: 1, close: 2, volume: 10 },
    { high: 6, low: 2, close: 4, volume: 30 },
    { high: 5, low: 5, close: 5, volume: 0 },
  ];
  close(lib.vwap(bars), [2, 3.5, 3.5], "vwap");
  close(lib.vwap(bars, 1), [null, 4, 4], "anchored vwap");
  close(lib.rebase([50, 55, null, 40], 0), [0, 0.1, null, -0.2], "rebase");
});

test("range presets resolve to the first point inside the calendar window", () => {
  const dates = Array.from({ length: 60 }, (_, i) => new Date(2026, 7, 1 + i)); // 1 ago - 29 sep
  assert.deepEqual(lib.rangeWindow(dates, { unit: "week", count: 1 }), [52, 59]);
  assert.deepEqual(lib.rangeWindow(dates, { unit: "month", count: 1 }), [28, 59]);
  assert.deepEqual(lib.rangeWindow(dates, { unit: "all" }), [0, 59]);
  assert.deepEqual(lib.rangeWindow(dates, { unit: "year", count: 1 }), [0, 59]);
  // 31 mar minus one month clamps to 28 feb.
  assert.equal(+lib.shiftDate(new Date(2026, 2, 31), "month", 1), +new Date(2026, 1, 28));
});

test("gantt scale maps dates linearly and stretches to fill its pane", () => {
  const domain = [+new Date(2026, 9, 5), +new Date(2026, 9, 12)];
  const scale = lib.ganttScale(domain, "day");
  assert.equal(scale.width, 7 * 40);
  assert.ok(Math.abs(scale.x(+new Date(2026, 9, 7, 12)) - 100) < 1e-9);
  assert.ok(Math.abs(scale.invert(100) - +new Date(2026, 9, 7, 12)) < 1);
  const stretched = lib.ganttScale(domain, "day", 700);
  assert.equal(stretched.width, 700);
  assert.equal(stretched.x(domain[1]), 700);
  // Day zoom pads to whole weeks starting on Monday.
  const padded = lib.ganttDomain([+new Date(2026, 9, 7), +new Date(2026, 9, 20)], "day");
  assert.deepEqual(padded, [+new Date(2026, 9, 5), +new Date(2026, 9, 26)]);
  const header = lib.ganttHeader(scale, "day");
  assert.equal(header.bottom.length, 7);
  assert.equal(header.top.length, 1);
  assert.deepEqual(lib.nonWorkingSpans(domain, [1, 2, 3, 4, 5]), [
    [+new Date(2026, 9, 10), +new Date(2026, 9, 12)],
  ]);
});

test("finish-to-start links step down when there is room, and wrap back when not", () => {
  const forward = lib.routeDependency(
    { x: 100, y: 18 },
    { x: 160, y: 54 },
    { gap: 10, rowHeight: 36 },
  );
  assert.deepEqual(forward, [
    { x: 100, y: 18 },
    { x: 110, y: 18 },
    { x: 110, y: 54 },
    { x: 160, y: 54 },
  ]);
  const backward = lib.routeDependency(
    { x: 100, y: 18 },
    { x: 80, y: 90 },
    { gap: 10, rowHeight: 36 },
  );
  assert.deepEqual(backward, [
    { x: 100, y: 18 },
    { x: 110, y: 18 },
    { x: 110, y: 36 },
    { x: 70, y: 36 },
    { x: 70, y: 90 },
    { x: 80, y: 90 },
  ]);
  for (const route of [forward, backward]) {
    for (let i = 1; i < route.length; i += 1) {
      const a = route[i - 1];
      const b = route[i];
      assert.ok(a.x === b.x || a.y === b.y, "every segment is horizontal or vertical");
    }
  }
});

test("task rows roll up parent dates and duration-weighted progress, and hide collapsed children", () => {
  const day = (d) => new Date(2026, 9, d);
  const tasks = [
    { id: "obra", start: day(1), end: day(1) },
    { id: "a", parentId: "obra", start: day(5), end: day(7), progress: 1 },
    { id: "b", parentId: "obra", start: day(6), end: day(12), progress: 0.5 },
    { id: "hito", start: day(12), end: day(12) },
  ];
  const rows = lib.ganttRows(tasks);
  assert.deepEqual(
    rows.map((row) => [row.task.id, row.depth, row.parent]),
    [
      ["obra", 0, true],
      ["a", 1, false],
      ["b", 1, false],
      ["hito", 0, false],
    ],
  );
  assert.equal(rows[0].start, +day(5));
  assert.equal(rows[0].end, +day(12));
  assert.ok(Math.abs(rows[0].progress - (2 * 1 + 6 * 0.5) / 8) < 1e-9);
  const folded = lib.ganttRows(tasks, new Set(["obra"]));
  assert.deepEqual(
    folded.map((row) => row.task.id),
    ["obra", "hito"],
  );
  assert.equal(folded[0].collapsed, true);
});
