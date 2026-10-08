// Pure helpers added for distribution, scatter, heatmap and trellis parity.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const points = await load("../src/charts/core/distribution/points.ts");

test("jitterValues is deterministic and bounded by the reach", () => {
  const values = [10, 12, 12, 15, 40, null, Number.NaN];
  const a = points.jitterValues(values, 7, 6);
  const b = points.jitterValues(values, 7, 6);
  assert.deepEqual(a, b);
  assert.equal(a.length, 5);
  for (const item of a) assert.ok(Math.abs(item.offset) <= 6);
  const other = points.jitterValues(values, 8, 6);
  assert.notDeepEqual(a, other);
});

test("jitterValues follows a per-value reach", () => {
  const out = points.jitterValues([1, 2, 3], 3, (value) => (value === 2 ? 0 : 10));
  assert.equal(Math.abs(out[1].offset), 0);
  assert.ok(Math.abs(out[0].offset) <= 10);
});

test("groupSeed separates groups", () => {
  assert.notEqual(points.groupSeed(1, 0, 0), points.groupSeed(1, 1, 0));
  assert.notEqual(points.groupSeed(1, 0, 0), points.groupSeed(1, 0, 1));
});

const stack = await load("../src/charts/core/distribution/dot-stack.ts");

test("packDots keeps every dot inside the lane and above the baseline", () => {
  const dots = stack.packDots(23, 40, 3, 1);
  assert.equal(dots.length, 23);
  for (const dot of dots) {
    assert.ok(dot.x - 3 >= -1e-9 && dot.x + 3 <= 40 + 1e-9);
    assert.ok(dot.y >= 3);
  }
});

test("packDots never overlaps two dots", () => {
  const dots = stack.packDots(30, 36, 2.5, 1);
  for (let i = 0; i < dots.length; i += 1) {
    for (let j = i + 1; j < dots.length; j += 1) {
      const d = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
      assert.ok(d >= 5 - 1e-9, `dots ${i} and ${j} overlap`);
    }
  }
});

test("explodeBins shares one radius that fits the fullest bin", () => {
  const { radius, stacks } = stack.explodeBins(
    [
      { count: 2, width: 30, height: 30 },
      { count: 40, width: 30, height: 40 },
    ],
    { maxRadius: 6, minRadius: 1.5 },
  );
  assert.ok(radius < 6 && radius >= 1.5);
  assert.deepEqual(
    stacks.map((s) => s.length),
    [2, 40],
  );
  const top = Math.max(...stacks[1].map((dot) => dot.y + radius));
  assert.ok(top <= 40 + 1e-9);
});

test("fitRadius falls back to the minimum when nothing fits", () => {
  assert.equal(stack.fitRadius({ count: 500, width: 10, height: 10 }, { minRadius: 1.5 }), 1.5);
});
