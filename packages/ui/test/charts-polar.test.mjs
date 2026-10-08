// Pure polar helpers: angle math, arc paths, label collision avoidance, funnel geometry.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const core = join(here, "../src/charts/core");

const bundle = await build({
  stdin: {
    contents: `export * from ${JSON.stringify(join(core, "polar.ts"))};`,
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

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);

test("polarPoint: 0 is 12 o'clock and angles grow clockwise", () => {
  const top = lib.polarPoint(100, 100, 50, 0);
  near(top.x, 100);
  near(top.y, 50);
  const right = lib.polarPoint(100, 100, 50, Math.PI / 2);
  near(right.x, 150);
  near(right.y, 100);
});

test("angleOf inverts polarPoint and normalizeAngle wraps", () => {
  const point = lib.polarPoint(0, 0, 10, 4);
  near(lib.angleOf(0, 0, point.x, point.y), 4);
  near(lib.normalizeAngle(-Math.PI / 2), (3 * Math.PI) / 2);
  near(lib.normalizeAngle(lib.TAU * 3 + 1), 1);
});

test("slotAt centres each slot on its spoke", () => {
  assert.equal(lib.slotAt(0, 4), 0);
  assert.equal(lib.slotAt(Math.PI / 2 + 0.1, 4), 1);
  assert.equal(lib.slotAt(-0.1, 4), 0);
  assert.equal(lib.slotAt(lib.TAU - 0.2, 4), 0);
  assert.equal(lib.slotAt(Math.PI, 4), 2);
});

test("sliceAngles splits proportionally and honours the gap", () => {
  const slices = lib.sliceAngles([1, 1, 2], { padAngle: 0.1 });
  near(slices[0].fraction, 0.25);
  near(slices[2].fraction, 0.5);
  near(slices[0].end - slices[0].start, lib.TAU * 0.25 - 0.1);
  near(slices[1].start - slices[0].end, 0.1);
  near(slices[2].end, lib.TAU - 0.05);
});

test("sliceAngles: zeros and negatives are empty, a lone full slice has no gap", () => {
  const slices = lib.sliceAngles([0, -3, 5], { padAngle: 0.2 });
  assert.equal(slices[0].fraction, 0);
  assert.equal(slices[1].fraction, 0);
  near(slices[2].end - slices[2].start, lib.TAU);
  const semi = lib.sliceAngles([1, 1], { startAngle: -Math.PI / 2, endAngle: Math.PI / 2 });
  near(semi[0].end, 0);
});

test("arcPath: sharp wedge, rounded corners and degenerate input", () => {
  const base = { cx: 0, cy: 0, innerRadius: 50, outerRadius: 100, startAngle: 0, endAngle: 1 };
  const sharp = lib.arcPath(base);
  assert.ok(sharp.startsWith("M") && sharp.endsWith("Z"));
  assert.equal((sharp.match(/A/g) ?? []).length, 2);
  const rounded = lib.arcPath({ ...base, cornerRadius: 8 });
  assert.equal((rounded.match(/A/g) ?? []).length, 6);
  assert.equal(lib.arcPath({ ...base, endAngle: 0 }), "");
  const full = lib.arcPath({ ...base, endAngle: lib.TAU });
  assert.equal((full.match(/Z/g) ?? []).length, 2);
});

test("arcPath: a huge corner radius is clamped, never NaN", () => {
  const path = lib.arcPath({
    cx: 0,
    cy: 0,
    innerRadius: 60,
    outerRadius: 70,
    startAngle: 0,
    endAngle: 0.05,
    cornerRadius: 40,
  });
  assert.ok(path.length > 0);
  assert.ok(!path.includes("NaN"));
});

test("arcLine builds an open arc and splits past a half turn", () => {
  const quarter = lib.arcLine(0, 0, 10, 0, Math.PI / 2);
  assert.equal((quarter.match(/A/g) ?? []).length, 1);
  assert.ok(!quarter.includes("Z"));
  const threeQuarters = lib.arcLine(0, 0, 10, 0, (3 * Math.PI) / 2);
  assert.equal((threeQuarters.match(/A/g) ?? []).length, 2);
  assert.equal(lib.arcLine(0, 0, 10, 1, 1), "");
});

test("spreadLabels pushes overlapping labels apart and keeps the order", () => {
  const ys = lib.spreadLabels(
    [
      { y: 50, height: 20 },
      { y: 52, height: 20 },
      { y: 54, height: 20 },
    ],
    0,
    200,
    2,
  );
  assert.ok(ys[1] - ys[0] >= 22 - 1e-9);
  assert.ok(ys[2] - ys[1] >= 22 - 1e-9);
});

test("spreadLabels stays inside the bounds and maps back to input order", () => {
  const ys = lib.spreadLabels(
    [
      { y: 195, height: 20 },
      { y: 5, height: 20 },
      { y: 190, height: 20 },
    ],
    0,
    200,
    2,
  );
  assert.ok(ys[1] >= 10 - 1e-9);
  assert.ok(Math.max(...ys) <= 190 + 1e-9);
  assert.ok(ys[2] < ys[0]);
  const tooTall = lib.spreadLabels(
    [
      { y: 10, height: 60 },
      { y: 12, height: 60 },
    ],
    0,
    80,
    0,
  );
  assert.ok(tooTall[0] < tooTall[1]);
});

test("funnelStages: continuous outline, shares and conversion", () => {
  const stages = lib.funnelStages([1000, 400, 200, 100], { length: 400, thickness: 200 });
  assert.equal(stages[0].widthFrom, 200);
  near(stages[0].widthTo, stages[1].widthFrom);
  near(stages[1].widthTo, stages[2].widthFrom);
  near(stages[3].widthTo, stages[3].widthFrom * 0.72);
  assert.equal(stages[0].conversion, null);
  near(stages[1].conversion, 0.4);
  near(stages[2].ofFirst, 0.2);
  near(stages[1].from, 100);
});

test("funnelStages: pyramid tapers to a point, gaps shrink stages, zeros are safe", () => {
  const pyramid = lib.funnelStages([10, 5], {
    length: 100,
    thickness: 50,
    gap: 10,
    variant: "pyramid",
  });
  assert.equal(pyramid[1].widthTo, 0);
  near(pyramid[0].to - pyramid[0].from, 45);
  near(pyramid[1].from, 55);
  const zeros = lib.funnelStages([0, 0], { length: 100, thickness: 50 });
  assert.equal(zeros[0].widthFrom, 0);
  assert.equal(zeros[1].conversion, 0);
});
