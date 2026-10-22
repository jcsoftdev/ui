// slabSpread / slabPlacement are the pure core of the sign-in illustration.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/auth/auth-illustration/model.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const model = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test("spread by state and progress", () => {
  const cases = [
    ["idle", 0, 0.85],
    ["idle", 1, 0.85],
    ["typing", 0, 0.65],
    ["typing", 0.25, 0.5],
    ["typing", 0.5, 0.35],
    ["typing", 0.9, 0.35],
    ["password", 0.5, 0.22],
    ["password", 0.75, 0.135],
    ["password", 1, 0.05],
    ["password", 0, 0.22],
    ["error", 0.3, 1.35],
    ["success", 0.3, 0],
  ];
  for (const [state, progress, expected] of cases) {
    near(model.slabSpread(state, progress), expected);
  }
});

test("progress outside 0..1 or not a number is clamped", () => {
  near(model.slabSpread("typing", -3), 0.65);
  near(model.slabSpread("password", 7), 0.05);
  near(model.slabSpread("typing", Number.NaN), 0.65);
});

test("slab placement golden values", () => {
  assert.deepEqual(model.slabPlacement(0, 0, -1), { x: 277, y: 149, lift: 0 });
  assert.deepEqual(model.slabPlacement(1, 0, -1), { x: 363.6, y: 199, lift: 0 });
  assert.deepEqual(model.slabPlacement(2, 0, -1), { x: 277, y: 249, lift: 0 });
  assert.deepEqual(model.slabPlacement(0, 1, -1), { x: 157, y: 163, lift: 34 });
  assert.deepEqual(model.slabPlacement(1, 1, -1), { x: 467.6, y: 155, lift: 62 });
  assert.deepEqual(model.slabPlacement(2, 0.5, -1), { x: 284, y: 288, lift: 7 });
});

test("the active slab rises by 20 on top of its spread lift", () => {
  assert.equal(model.slabPlacement(1, 0, 1).lift, 20);
  assert.equal(model.slabPlacement(1, 0.5, 1).lift, 51);
  assert.equal(model.slabPlacement(0, 0.5, 1).lift, 17);
});

test("spark vectors are deterministic and spread around the centre", () => {
  const sparks = model.sparkVectors(12);
  assert.equal(sparks.length, 12);
  assert.deepEqual(sparks, model.sparkVectors(12));
  assert.deepEqual(sparks[0], { dx: 90, dy: 0 });
});
