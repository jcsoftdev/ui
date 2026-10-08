// Pure centre-text fit math of DonutChart: the figure must stay inside the hole.
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

const { fitCenterText } = await load("../src/charts/donut-chart/center-fit.ts");

const corner = (fit, chars) => Math.hypot((chars * 0.62 * fit.valueSize) / 2, fit.block / 2);

test("a long currency value fits inside small and large holes", () => {
  for (const inner of [40, 55, 80, 120]) {
    const fit = fitCenterText(inner, "S/ 29 950.00".length, 13);
    assert.ok(corner(fit, 12) <= inner, `inner ${inner}: corner ${corner(fit, 12)}`);
  }
});

test("the caption disappears before the value overflows", () => {
  const fit = fitCenterText(28, 12, 13);
  assert.equal(fit.captionChars, 0);
});

test("short values keep a large font and the caption", () => {
  const fit = fitCenterText(100, 4, 12);
  assert.ok(fit.valueSize >= 30);
  assert.ok(fit.captionChars > 0);
});

test("the caption is never longer than the room", () => {
  const fit = fitCenterText(60, 6, 40);
  assert.ok(fit.captionChars <= 40);
  assert.ok(fit.captionChars * 0.58 * fit.captionSize <= 2 * 60);
});
