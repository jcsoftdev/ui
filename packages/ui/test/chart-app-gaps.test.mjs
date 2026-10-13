import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

const axesStub = {
  name: "axes-stub",
  setup(b) {
    b.onResolve({ filter: /\/axes\.js$/ }, () => ({ path: "axes-stub", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      loader: "js",
      contents: `
        export const estimateTextWidth = (t, f = 11) => t.length * f * 0.58;
        export const thinTicks = (ticks) => [...ticks];`,
    }));
  },
};

const bundle = await build({
  stdin: {
    contents: ["core/cartesian/layout.ts", "core/types.ts", "donut-chart/slice-labels.ts"]
      .map((file) => `export * from ${JSON.stringify(join(charts, file))};`)
      .join("\n"),
    resolveDir: charts,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
  plugins: [axesStub],
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const series = (data) => ({
  id: "a",
  name: "A",
  kind: "column",
  axis: "left",
  color: "red",
  dashed: false,
  format: String,
  data,
});

const input = (categories, extra = {}) => ({
  width: 600,
  height: 300,
  categories,
  series: [series(categories.map((_, i) => 100 + i * 37))],
  orientation: "vertical",
  stack: "none",
  curve: "linear",
  dataLabels: false,
  barRadius: 4,
  xScale: "auto",
  xLabel: String,
  yAxis: {},
  rightAxis: {},
  annotations: [],
  ...extra,
});

test("resolveAxisBound keeps numbers, calls functions and falls back to the data", () => {
  assert.equal(lib.resolveAxisBound(undefined, 7), 7);
  assert.equal(lib.resolveAxisBound(10, 7), 10);
  assert.equal(
    lib.resolveAxisBound((max) => Math.ceil(max / 400) * 400, 1010),
    1200,
  );
});

test("axis max function rounds the value domain up", () => {
  const layout = lib.computeLayout(
    input(["a", "b", "c", "d"], { yAxis: { max: (m) => Math.ceil(m / 400) * 400 } }),
  );
  assert.equal(layout.valueScale.domain[1], 400);
  const data = lib.computeLayout(
    input(
      Array.from({ length: 30 }, (_, i) => `${i}`),
      {
        yAxis: { max: (m) => Math.ceil(m / 400) * 400 },
      },
    ),
  );
  assert.equal(data.valueScale.domain[1] % 400, 0);
  assert.ok(data.valueScale.domain[1] >= 100 + 29 * 37);
});

test("axis min function receives the data minimum", () => {
  const base = input(["a", "b", "c"], { yAxis: { min: (m) => m - 50, max: (m) => m + 10 } });
  const layout = lib.computeLayout({ ...base, series: [{ ...base.series[0], kind: "line" }] });
  assert.equal(layout.valueScale.domain[0], 50);
});

test("categoryTickEvery picks every n-th label or those a predicate accepts", () => {
  const categories = Array.from({ length: 12 }, (_, i) => `d${i}`);
  const every = lib.computeLayout(input(categories, { categoryTickEvery: 5 }));
  assert.deepEqual(
    every.categoryTicks.map((tick) => tick.label),
    ["d0", "d5", "d10"],
  );
  const picked = lib.computeLayout(
    input(categories, {
      categoryTickEvery: (index, label) => index % 5 === 0 || label === "d11",
    }),
  );
  assert.deepEqual(
    picked.categoryTicks.map((tick) => tick.label),
    ["d0", "d5", "d10", "d11"],
  );
});

test("pickCategoryTicks treats a step below 1 as every label", () => {
  const ticks = ["a", "b", "c"].map((label, key) => ({ key, position: key, label }));
  assert.equal(lib.pickCategoryTicks(ticks, 0).length, 3);
});

test("fitSliceLabel places a label inside a wide slice and skips a thin one", () => {
  const wide = lib.fitSliceLabel({
    inner: 60,
    radius: 120,
    start: 0,
    end: Math.PI / 2,
    chars: 3,
    fontSize: 11,
  });
  assert.ok(wide);
  assert.ok(Math.hypot(wide.x, wide.y) > 60 && Math.hypot(wide.x, wide.y) < 120);
  const thin = lib.fitSliceLabel({
    inner: 60,
    radius: 120,
    start: 0,
    end: 0.05,
    chars: 3,
    fontSize: 11,
  });
  assert.equal(thin, null);
});

test("fitSliceLabel needs more room for a longer label", () => {
  const base = { inner: 70, radius: 110, start: 1, end: 1.3, fontSize: 11 };
  assert.ok(lib.fitSliceLabel({ ...base, chars: 3 }));
  assert.equal(lib.fitSliceLabel({ ...base, chars: 14 }), null);
});
