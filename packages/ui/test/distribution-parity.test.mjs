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
