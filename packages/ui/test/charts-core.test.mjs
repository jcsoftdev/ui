// Pure chart helpers: scales, ticks, formatters, stacking and paths.
// The TypeScript sources are bundled on the fly with esbuild (already a dev dependency).
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const core = join(here, "../src/charts/core");

const bundle = await build({
  stdin: {
    contents: ["scales/index.js", "format.js", "stack.js", "path.js"]
      .map((file) => `export * from ${JSON.stringify(join(core, file))};`)
      .join("\n"),
    resolveDir: core,
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

const NBSP = " ";

test("nice domain and ticks land on round numbers", () => {
  assert.deepEqual(lib.niceDomain(3, 97, 5), [0, 100]);
  assert.deepEqual(lib.linearTicks(0, 100, 5), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(lib.linearTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(lib.niceDomain(-38, 12, 5), [-40, 20]);
  assert.deepEqual(lib.niceDomain(5, 5), [0, 10]);
});

test("linear scale maps, inverts and flips for screen y", () => {
  const scale = lib.linearScale({ domain: [0, 1840], range: [200, 0], tickCount: 4 });
  assert.deepEqual(scale.domain, [0, 2000]);
  assert.equal(scale.map(1000), 100);
  assert.equal(scale.invert(50), 1500);
  assert.deepEqual(scale.ticks(), [0, 500, 1000, 1500, 2000]);
});

test("log scale spans whole decades", () => {
  const scale = lib.logScale({ domain: [3, 870], range: [0, 300] });
  assert.deepEqual(scale.domain, [1, 1000]);
  assert.equal(scale.map(10), 100);
  assert.deepEqual(scale.ticks(), [1, 10, 100, 1000]);
});

test("band and point scales place and find categories", () => {
  const band = lib.bandScale({ count: 4, range: [0, 400], paddingInner: 0.2, paddingOuter: 0.1 });
  assert.ok(Math.abs(band.step * (4 - 0.2 + 0.2) - 400) < 1e-9);
  assert.equal(band.indexAt(band.center(2)), 2);
  assert.equal(band.indexAt(-50), 0);
  assert.equal(band.indexAt(999), 3);
  const point = lib.pointScale({ count: 5, range: [0, 400] });
  assert.deepEqual([0, 1, 2, 3, 4].map(point.center), [0, 100, 200, 300, 400]);
  assert.equal(point.indexAt(160), 2);
});

test("time ticks align to the calendar with Spanish labels", () => {
  const start = new Date(2026, 8, 28).getTime(); // Monday
  const twoWeeks = lib.timeTicks(start, new Date(2026, 9, 11).getTime(), 14);
  assert.equal(twoWeeks[0].unit, "day");
  assert.equal(twoWeeks[0].label, "lun 28");
  const weeks = lib.timeTicks(start, new Date(2026, 10, 30).getTime(), 10);
  assert.equal(weeks[0].unit, "week");
  assert.ok(
    weeks.every((tick) => new Date(tick.value).getDay() === 1),
    "weekly ticks are Mondays",
  );
  const quarter = lib.timeTicks(new Date(2026, 6, 1).getTime(), new Date(2026, 9, 1).getTime(), 6);
  assert.equal(quarter[0].unit, "month");
  assert.deepEqual(
    quarter.map((tick) => tick.label),
    ["jul 2026", "ago", "set", "oct"],
  );
  assert.equal(lib.formatDate(new Date(2026, 9, 6)), "mar 6 oct 2026");
});

test("formatters follow the Peruvian conventions", () => {
  assert.equal(lib.formatCurrency(1234.5), `S/${NBSP}1${NBSP}234.50`);
  assert.equal(lib.formatCurrency(-80), `-S/${NBSP}80.00`);
  assert.equal(lib.formatNumber(12345.678), `12${NBSP}345.68`);
  assert.equal(lib.formatPercent(0.125), "12.5%");
  assert.equal(lib.formatPercent(45, { input: "whole", decimals: 0 }), "45%");
  assert.equal(lib.formatCompact(1234), `1,2${NBSP}mil`);
  assert.equal(lib.formatCompact(2_500_000), `2,5${NBSP}M`);
  assert.equal(lib.resolveFormat("integer")(41.6), "42");
  assert.equal(lib.resolveAxisFormat("currency")(12000), `S/${NBSP}12${NBSP}mil`);
  assert.equal(lib.resolveAxisFormat("currency")(1500), `S/${NBSP}1${NBSP}500`);
});

test("stacking piles positives up, negatives down and normalises percent", () => {
  const [a, b] = lib.stackLayers(
    [
      [10, -4, null],
      [5, 6, 3],
    ],
    "normal",
  );
  assert.deepEqual(a.y0, [0, 0, 0]);
  assert.deepEqual(a.y1, [10, -4, 0]);
  assert.deepEqual(b.y0, [10, 0, 0]);
  assert.deepEqual(b.y1, [15, 6, 3]);
  assert.deepEqual(a.values, [10, -4, null]);
  const [p, q] = lib.stackLayers(
    [
      [1, 3],
      [3, 1],
    ],
    "percent",
  );
  assert.deepEqual(p.y1, [0.25, 0.75]);
  assert.deepEqual(q.y1, [1, 1]);
});

test("monotone curve never overshoots a local extremum", () => {
  const points = [
    { x: 0, y: 10 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
    { x: 30, y: 12 },
  ];
  const tangents = lib.monotoneTangents(points);
  assert.equal(tangents[1], 0, "flat tangent at the valley");
  assert.ok(tangents[2] >= 0, "rising segment keeps a rising tangent");
});

test("paths split at gaps and round bars only at the value end", () => {
  const d = lib.linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }, null, { x: 3, y: 3 }, { x: 4, y: 2 }]);
  assert.equal(d.match(/M/g).length, 2);
  const area = lib.areaPath(
    [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ],
    [
      { x: 0, y: 20 },
      { x: 10, y: 20 },
    ],
  );
  assert.equal(area, "M0,0L10,5L10,20L0,20Z");
  const bar = lib.barPath(0, 0, 20, 50, 6, "top");
  assert.equal(bar.match(/A/g).length, 2);
  assert.ok(bar.startsWith("M6,0"));
  assert.equal(lib.barPath(0, 0, 20, 50, 6, "none").includes("A"), false);
});
