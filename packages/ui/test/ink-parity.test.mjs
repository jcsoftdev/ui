// Pure math of the ruler and ink annotations: measures, smoothing, axis map, undo history.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/charts/core/ink.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);

test("measure: deltas, slope and percent of the start", () => {
  const m = lib.measureSegment({ x: 2, y: 100 }, { x: 6, y: 130 });
  assert.equal(m.dx, 4);
  assert.equal(m.dy, 30);
  near(m.slope, 7.5);
  near(m.percent, 30);
  const down = lib.measureSegment({ x: 0, y: 200 }, { x: 0, y: 150 });
  assert.equal(down.slope, null);
  near(down.percent, -25);
  assert.equal(lib.measureSegment({ x: 0, y: 0 }, { x: 1, y: 5 }).percent, null);
});

test("durations pick the largest unit and signed numbers keep their sign", () => {
  assert.equal(lib.formatDuration(3 * 86_400_000), "3 d");
  assert.equal(lib.formatDuration(90 * 60_000), "1.5 h");
  assert.equal(lib.formatDuration(-45 * 60_000), "-45 min");
  assert.equal(lib.formatDuration(500), "500 ms");
  assert.equal(lib.signed(4), "+4");
  assert.equal(lib.signed(-2.5), "-2.5");
  assert.equal(lib.signed(0), "0");
  assert.equal(
    lib.signed(12, (v) => `S/ ${v}`),
    "+S/ 12",
  );
});

test("thinning drops close points but keeps the ends", () => {
  const points = [0, 1, 2, 10, 11, 20].map((x) => ({ x, y: 0 }));
  assert.deepEqual(
    lib.thinPoints(points, 5).map((p) => p.x),
    [0, 10, 20],
  );
  assert.equal(lib.thinPoints(points.slice(0, 2), 50).length, 2);
});

test("smoothing keeps the ends and softens the middle", () => {
  const zigzag = [0, 10, 0, 10, 0].map((y, x) => ({ x, y }));
  const smooth = lib.smoothPoints(zigzag, 1);
  assert.equal(smooth[0].y, 0);
  assert.equal(smooth[4].y, 0);
  near(smooth[1].y, 10 / 3 + 0, 1e-9);
  assert.ok(smooth[2].y > 0 && smooth[2].y < 10);
});

test("spline path passes through every point, one point is a dot, two a segment", () => {
  assert.equal(lib.smoothPath([]), "");
  assert.equal(lib.smoothPath([{ x: 3, y: 4 }]), "M3,4h0");
  const path = lib.smoothPath([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
  ]);
  assert.ok(path.startsWith("M0,0C"));
  assert.ok(path.includes(" 10,0C"));
  assert.ok(path.endsWith(" 20,10"));
  const two = lib.smoothPath([
    { x: 0, y: 0 },
    { x: 9, y: 9 },
  ]);
  assert.equal(two.match(/C/g).length, 1);
});

test("axis map is piecewise linear, invertible and extrapolates", () => {
  const map = lib.createAxisMap([10, 30, 70], [0, 1, 2]);
  near(map.toPixel(0.5), 20);
  near(map.toPixel(1.5), 50);
  near(map.fromPixel(50), 1.5);
  near(map.toPixel(3), 110);
  near(map.fromPixel(0), -0.5);
  for (const v of [0, 0.3, 1, 1.9, 2]) near(map.fromPixel(map.toPixel(v)), v, 1e-9);
  const single = lib.createAxisMap([40], [7]);
  assert.equal(single.toPixel(100), 40);
  assert.equal(single.fromPixel(0), 7);
});

test("history: add, undo, redo, a new item drops the redo stack, clear empties", () => {
  const ruler = (id) => ({ kind: "ruler", id, a: { x: 0, y: 0 }, b: { x: 1, y: 1 } });
  let state = lib.EMPTY_INK;
  state = lib.inkReducer(state, { type: "add", item: ruler(1) });
  state = lib.inkReducer(state, { type: "add", item: ruler(2) });
  state = lib.inkReducer(state, { type: "undo" });
  assert.deepEqual(
    state.items.map((i) => i.id),
    [1],
  );
  assert.deepEqual(
    state.redo.map((i) => i.id),
    [2],
  );
  state = lib.inkReducer(state, { type: "redo" });
  assert.deepEqual(
    state.items.map((i) => i.id),
    [1, 2],
  );
  state = lib.inkReducer(state, { type: "undo" });
  state = lib.inkReducer(state, { type: "add", item: ruler(3) });
  assert.deepEqual(state.redo, []);
  assert.equal(lib.inkReducer(lib.EMPTY_INK, { type: "undo" }), lib.EMPTY_INK);
  assert.equal(lib.inkReducer(state, { type: "clear" }), lib.EMPTY_INK);
});
