// Pure helpers of the range and flow charts: waterfall running totals, stream offsets,
// timeline lane assignment and slope label spreading.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

const bundle = await build({
  stdin: {
    contents: [
      "waterfall-chart/waterfall-layout.js",
      "stream-graph/stream-layout.js",
      "timeline-chart/timeline-lanes.js",
      "slope-chart/label-layout.js",
    ]
      .map((file) => `export * from ${JSON.stringify(join(charts, file.replace(".js", ".ts")))};`)
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

const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, message ?? `${actual} != ${expected}`);

test("waterfall keeps running totals through deltas, subtotals and the closing total", () => {
  const layout = lib.waterfallLayout([
    { label: "Apertura", value: 300, type: "start" },
    { label: "Ventas", value: 1200 },
    { label: "Gastos", value: -420 },
    { label: "Subtotal", type: "subtotal" },
    { label: "Adelantos", value: -350 },
    { label: "Cierre", type: "total" },
  ]);
  const [open, sales, spend, sub, advance, closing] = layout.bars;
  assert.deepEqual([open.from, open.to, open.kind], [0, 300, "start"]);
  assert.deepEqual([sales.from, sales.to, sales.kind], [300, 1500, "increase"]);
  assert.deepEqual([spend.from, spend.to, spend.kind], [1500, 1080, "decrease"]);
  assert.deepEqual([sub.from, sub.to, sub.value, sub.kind], [0, 1080, 1080, "subtotal"]);
  assert.deepEqual([advance.from, advance.to], [1080, 730]);
  assert.deepEqual([closing.from, closing.to, closing.value, closing.kind], [0, 730, 730, "total"]);
  assert.equal(layout.final, 730);
  assert.deepEqual([layout.min, layout.max], [0, 1500]);
});

test("waterfall includes negative running totals in its range", () => {
  const layout = lib.waterfallLayout([
    { label: "Ventas", value: 100, type: "start" },
    { label: "Costos", value: -250 },
    { label: "Resultado", type: "total" },
  ]);
  assert.equal(layout.final, -150);
  assert.deepEqual([layout.min, layout.max], [-150, 100]);
  assert.deepEqual(lib.waterfallLayout([]).bars, []);
});

const stackData = [
  [3, 5, 4, 2],
  [2, 2, 6, 8],
  [1, 4, 1, 3],
];

test("stream layouts stack contiguously and keep every thickness", () => {
  for (const offset of ["wiggle", "silhouette", "zero"]) {
    const { layers, order } = lib.streamLayout(stackData, offset, "inside-out");
    assert.deepEqual([...order].sort(), [0, 1, 2], `${offset}: order is a permutation`);
    for (let i = 0; i < 4; i += 1) {
      for (const [k, layer] of layers.entries()) {
        close(layer.y1[i] - layer.y0[i], stackData[k][i], `${offset} thickness`);
      }
      const sorted = order.map((k) => layers[k]);
      for (let s = 1; s < sorted.length; s += 1)
        close(sorted[s].y0[i], sorted[s - 1].y1[i], `${offset} contiguous`);
    }
  }
});

test("silhouette is symmetric, zero starts at 0, expand fills 0..1, wiggle is centered", () => {
  const sil = lib.streamLayout(stackData, "silhouette", "none");
  const totals = [6, 11, 11, 13];
  totals.forEach((total, i) => {
    close(sil.layers[0].y0[i], -total / 2);
    close(sil.layers[2].y1[i], total / 2);
  });
  const zero = lib.streamLayout(stackData, "zero", "none");
  assert.deepEqual(zero.layers[0].y0, [0, 0, 0, 0]);
  const expand = lib.streamLayout(stackData, "expand", "none");
  for (let i = 0; i < 4; i += 1) close(expand.layers[2].y1[i], 1);
  const wiggle = lib.streamLayout(stackData, "wiggle", "none");
  const centers = totals.map((total, i) => wiggle.layers[0].y0[i] + total / 2);
  close(centers.reduce((a, b) => a + b, 0) / 4, 0);
});

test("stream order: ascending sorts by total, inside-out puts late peaks apart", () => {
  assert.deepEqual(
    lib.streamOrder(
      [
        [9, 9],
        [1, 1],
        [4, 4],
      ],
      "ascending",
    ),
    [1, 2, 0],
  );
  assert.deepEqual(lib.streamOrder([[1], [2]], "none"), [0, 1]);
  const order = lib.streamOrder(
    [
      [9, 1, 1],
      [1, 9, 1],
      [1, 1, 9],
    ],
    "inside-out",
  );
  assert.deepEqual([...order].sort(), [0, 1, 2]);
});

test("timeline lanes pack overlaps and let touching bars share a lane", () => {
  const { lanes, count } = lib.assignLanes([
    { start: 9, end: 10 },
    { start: 9.5, end: 11 },
    { start: 10, end: 11 },
    { start: 10.5, end: 12 },
    { start: 12, end: 13 },
  ]);
  assert.equal(count, 3);
  assert.deepEqual(lanes, [0, 1, 0, 2, 0]);
  assert.deepEqual(lib.assignLanes([]), { lanes: [], count: 0 });
  assert.equal(
    lib.assignLanes([
      { start: 1, end: 5 },
      { start: 2, end: 6 },
      { start: 3, end: 7 },
    ]).count,
    3,
  );
});

test("slope labels keep their order and a minimum gap inside the bounds", () => {
  const input = [50, 52, 53, 100, 51];
  const out = lib.spreadSlopeLabels(input, 16, 0, 200);
  const sorted = input.map((v, i) => [v, out[i]]).sort((a, b) => a[0] - b[0] || 0);
  for (let i = 1; i < sorted.length; i += 1)
    assert.ok(sorted[i][1] - sorted[i - 1][1] >= 16 - 0.05);
  for (const y of out) assert.ok(y >= 0 && y <= 200);
  assert.equal(out[3], 100);
  assert.deepEqual(lib.spreadSlopeLabels([10, 90], 16, 0, 200), [10, 90]);
  const squeezed = lib.spreadSlopeLabels([5, 5, 5, 5], 20, 0, 30);
  assert.deepEqual(squeezed, [0, 10, 20, 30]);
  assert.deepEqual(lib.spreadSlopeLabels([], 16, 0, 10), []);
});
