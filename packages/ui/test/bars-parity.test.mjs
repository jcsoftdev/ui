// Pure logic behind the bar family: floating/grouped/reversed bar geometry, patterns,
// category groups, bar race interpolation and bullet bands.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

// axes.tsx renders JSX; the layout only needs two of its pure helpers.
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
    plugins: [axesStub],
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const lib = await load([
  "core/cartesian/layout.ts",
  "core/cartesian/category-groups.ts",
  "core/patterns.ts",
  "bar-chart/bar-race.ts",
  "bullet-chart/bullet-layout.ts",
]);

const format = (value) => String(value);
const series = (extra) => ({
  id: "a",
  name: "A",
  kind: "column",
  axis: "left",
  color: "red",
  dashed: false,
  format,
  data: [10, 20],
  ...extra,
});

function layout(seriesList, extra = {}) {
  return lib.computeLayout({
    width: 400,
    height: 300,
    categories: ["x", "y"],
    series: seriesList,
    orientation: "vertical",
    stack: "none",
    curve: "linear",
    dataLabels: false,
    barRadius: 6,
    xScale: "auto",
    xLabel: String,
    yAxis: {},
    rightAxis: {},
    annotations: [],
    ...extra,
  });
}

test("floating bars span from..to, not from zero", () => {
  const out = layout([series({ data: [30, 50], from: [10, 20] })], { yAxis: { min: 0, max: 60 } });
  const bar = out.geometry[0].bars[0];
  const scale = out.valueScale;
  assert.ok(Math.abs(bar.y - scale.map(30)) < 0.01);
  assert.ok(Math.abs(bar.y + bar.height - scale.map(10)) < 0.01);
  assert.equal(out.layers.size, 0, "floating series never stack");
});

test("stack groups sit side by side and pile within their group", () => {
  const list = [
    series({ id: "a", stackGroup: "g1", data: [5, 5] }),
    series({ id: "b", stackGroup: "g1", data: [5, 5] }),
    series({ id: "c", stackGroup: "g2", data: [8, 8] }),
  ];
  const out = layout(list, { stack: "normal" });
  const [a, b, c] = out.geometry.map((item) => item.bars[0]);
  assert.equal(a.x, b.x, "same group shares a column");
  assert.ok(c.x > a.x, "the second group is next to it");
  assert.ok(b.y < a.y, "second layer rides on the first");
});

test("a reversed value axis hangs bars from the top", () => {
  const normal = layout([series()]);
  const flipped = layout([series()], { yAxis: { reversed: true } });
  const n = normal.geometry[0].bars[1];
  const f = flipped.geometry[0].bars[1];
  assert.ok(
    Math.abs(n.y + n.height - normal.innerHeight) < 0.01,
    "normal bars stand on the bottom",
  );
  assert.ok(Math.abs(f.y) < 0.01, "reversed bars start at the top");
  assert.ok(f.height > 0);
  assert.equal(f.negative, true, "the value end points down on screen");
});

test("category group spans cover their categories", () => {
  const positions = [50, 150, 250, 350];
  const spans = lib.categoryGroupSpans(
    [
      { label: "A", count: 2 },
      { label: "B", count: 2 },
      { label: "C", count: 3 },
    ],
    positions,
    100,
  );
  assert.equal(spans.length, 2, "groups past the data are dropped");
  assert.deepEqual([spans[0].from, spans[0].to], [0, 200]);
  assert.deepEqual([spans[1].from, spans[1].to], [200, 400]);
  assert.equal(spans[1].center, 300);
});

test("patterns resolve to tiles and safe ids", () => {
  for (const name of lib.PATTERN_NAMES) {
    const tile = lib.resolvePattern(name);
    assert.ok(tile.size > 0 && tile.shapes.length > 0, name);
  }
  assert.equal(lib.resolvePattern({ size: 500, shapes: [] }).size, 48);
  assert.equal(lib.patternId("a:b", "x y"), "ab-p-xy");
  assert.equal(lib.patternFill("p1"), "url(#p1)");
  assert.equal(lib.patternAt(lib.PATTERN_NAMES.length), lib.PATTERN_NAMES[0]);
});

test("bar race ranks and interpolates between frames", () => {
  assert.deepEqual(lib.ranksOf([5, 9, 5]), [1, 0, 2], "ties keep entity order");
  const frames = [
    { label: "1", values: [10, 20] },
    { label: "2", values: [30, 20] },
  ];
  const start = lib.raceItems(frames, 0);
  assert.deepEqual(
    start.map((item) => item.rank),
    [1, 0],
  );
  const end = lib.raceItems(frames, 1);
  assert.deepEqual(
    end.map((item) => item.rank),
    [0, 1],
  );
  const mid = lib.raceItems(frames, 0.5);
  assert.equal(mid[0].value, 20);
  assert.equal(mid[0].rank, 0.5);
  assert.deepEqual(
    lib.raceItems(frames, 99).map((item) => item.value),
    [30, 20],
    "clamped",
  );
  assert.equal(lib.visibleMax(end, 1), 30);
});

test("bullet bands, domain and level", () => {
  assert.deepEqual(
    lib.bulletBands([100, 60, 85, -1]).map((band) => [band.from, band.to]),
    [
      [0, 60],
      [60, 85],
      [85, 100],
    ],
  );
  assert.equal(lib.bulletMax({ actual: 120, target: 90, ranges: [60, 100] }), 120);
  assert.equal(lib.bulletMax({ actual: 0 }), 1);
  assert.equal(lib.bulletLevel(70, [60, 85, 100]), 1);
  assert.equal(lib.bulletLevel(500, [60, 85, 100]), 2);
  assert.equal(lib.bulletLevel(5, undefined), -1);
  assert.ok(lib.bandOpacity(0, 3) > lib.bandOpacity(2, 3));
});
