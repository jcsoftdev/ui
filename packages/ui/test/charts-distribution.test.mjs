// Pure statistics behind the distribution charts: quantiles, box summaries,
// kernel density, binning, regression and the beeswarm layout.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "../src/charts/core/distribution/stats.ts");

const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≈ ${expected}`);

test("quantiles interpolate between ranks (type 7)", () => {
  const sorted = [1, 2, 3, 4];
  close(lib.quantileSorted(sorted, 0.5), 2.5);
  close(lib.quantileSorted(sorted, 0.25), 1.75);
  close(lib.quantileSorted(sorted, 0.75), 3.25);
  assert.equal(lib.quantileSorted(sorted, 0), 1);
  assert.equal(lib.quantileSorted(sorted, 1), 4);
  assert.equal(lib.quantile([9, null, 3, Number.NaN, 6], 0.5), 6);
  assert.ok(Number.isNaN(lib.quantileSorted([], 0.5)));
  assert.equal(lib.quantileSorted([7], 0.9), 7);
});

test("box stats find Tukey whiskers and outliers", () => {
  const stats = lib.boxStats([22, 25, 28, 30, 31, 33, 35, 38, 40, 95, 2]);
  assert.equal(stats.count, 11);
  assert.equal(stats.median, 31);
  close(stats.q1, 26.5);
  close(stats.q3, 36.5);
  assert.equal(stats.lowerWhisker, 22);
  assert.equal(stats.upperWhisker, 40);
  assert.deepEqual(stats.outliers, [2, 95]);
  close(stats.mean, 379 / 11);
  assert.equal(lib.boxStats([]), null);
  const reach = lib.boxStats([1, 2, 3, 100], Number.POSITIVE_INFINITY);
  assert.equal(reach.upperWhisker, 100);
  assert.deepEqual(reach.outliers, []);
});

test("sample standard deviation and Silverman bandwidth", () => {
  close(lib.standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
  const values = [2, 4, 4, 4, 5, 5, 7, 9];
  const sd = Math.sqrt(32 / 7);
  const iqr = (lib.quantile(values, 0.75) - lib.quantile(values, 0.25)) / 1.34;
  close(lib.silvermanBandwidth(values), 0.9 * Math.min(sd, iqr) * 8 ** -0.2);
  assert.ok(lib.silvermanBandwidth([5, 5, 5]) > 0, "constant data still gets a bandwidth");
});

test("Gaussian KDE integrates to one and peaks at the mode", () => {
  const values = [10, 12, 12, 13, 14, 14, 14, 15, 16, 20];
  const curve = lib.gaussianKde(values, { points: 400 });
  assert.equal(curve.length, 400);
  const step = curve[1].value - curve[0].value;
  const area = curve.reduce((sum, point) => sum + point.density * step, 0);
  close(area, 1, 0.01);
  const peak = curve.reduce((best, point) => (point.density > best.density ? point : best));
  assert.ok(Math.abs(peak.value - 14) < 1.5, `peak near 14, got ${peak.value}`);
  const single = lib.gaussianKde([0], { bandwidth: 1, extent: [0, 0], points: 2 });
  close(single[0].density, lib.normalPdf(0));
  assert.deepEqual(lib.gaussianKde([]), []);
});

test("bin rules: Sturges, Freedman–Diaconis and nice edges", () => {
  assert.equal(lib.sturgesBinCount(100), 8);
  assert.equal(lib.sturgesBinCount(1), 1);
  close(lib.freedmanDiaconisWidth([1, 2, 3, 4, 5, 6, 7, 8]), (2 * 3.5) / 2);
  const edges = lib.binEdges([3, 7, 12, 18, 21, 29], { bins: 6 });
  assert.deepEqual(edges, [0, 5, 10, 15, 20, 25, 30]);
  assert.deepEqual(lib.binEdges([10, 11], { binWidth: 0.5 }), [10, 10.5, 11]);
});

test("histogram counts every value once, last bin closed", () => {
  const values = [0, 1, 2, 2, 3, 4, 5, 9, 10];
  const result = lib.histogram(values, { binWidth: 5 });
  assert.deepEqual(
    result.bins.map((bin) => [bin.x0, bin.x1, bin.count]),
    [
      [0, 5, 6],
      [5, 10, 3],
    ],
  );
  assert.equal(result.total, values.length);
  assert.equal(result.width, 5);
  const auto = lib.histogram(Array.from({ length: 200 }, (_, i) => (i * 37) % 101));
  assert.equal(auto.total, 200);
  const constant = lib.histogram([4, 4, 4]);
  assert.equal(constant.total, 3);
  assert.equal(constant.bins.length, 1);
});

test("least squares recovers a line and its fit", () => {
  const points = [1, 2, 3, 4, 5].map((x) => ({ x, y: 3 * x + 2 }));
  const fit = lib.linearRegression(points);
  close(fit.slope, 3);
  close(fit.intercept, 2);
  close(fit.r2, 1);
  close(fit.predict(10), 32);
  assert.equal(lib.linearRegression([{ x: 1, y: 1 }]), null);
  assert.equal(
    lib.linearRegression([
      { x: 2, y: 1 },
      { x: 2, y: 5 },
    ]),
    null,
  );
});

test("seeded random is deterministic and in [0, 1)", () => {
  const a = lib.seededRandom(42);
  const b = lib.seededRandom(42);
  const first = Array.from({ length: 50 }, () => a());
  assert.deepEqual(
    first,
    Array.from({ length: 50 }, () => b()),
  );
  assert.ok(first.every((value) => value >= 0 && value < 1));
});

test("beeswarm packs circles without overlap and close to the axis", () => {
  const random = lib.seededRandom(7);
  const items = Array.from({ length: 160 }, () => ({
    position: Math.round(random() * 300),
    radius: 3 + random() * 4,
  }));
  const gap = 1;
  const offsets = lib.beeswarm(items, { gap });
  assert.equal(offsets.length, items.length);
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const dx = items[i].position - items[j].position;
      const dy = offsets[i] - offsets[j];
      const min = items[i].radius + items[j].radius + gap;
      assert.ok(Math.hypot(dx, dy) >= min - 1e-6, `circles ${i} and ${j} overlap`);
    }
  }
  const spread = lib.beeswarm([0, 100, 200].map((position) => ({ position, radius: 5 })));
  assert.deepEqual(spread, [0, 0, 0], "isolated circles stay on the axis");
  const stack = lib.beeswarm(
    [0, 0, 0].map((position) => ({ position, radius: 5 })),
    { gap: 0, side: "positive" },
  );
  assert.deepEqual(stack, [0, 10, 20], "one-sided swarm grows away from the axis");
});
