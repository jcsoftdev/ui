// Pure step picking of the Scrolly container.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/containers/scrolly/scrolly-logic.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const rects = [
  { top: 0, bottom: 100 },
  { top: 100, bottom: 250 },
  { top: 300, bottom: 400 },
];

test("the active step is the one under the trigger line", () => {
  assert.equal(lib.pickActiveStep(rects, 50), 0);
  assert.equal(lib.pickActiveStep(rects, 100), 1);
  assert.equal(lib.pickActiveStep(rects, 249), 1);
  assert.equal(lib.pickActiveStep(rects, 350), 2);
});

test("in a gap the previous step stays; before the first and after the last are clamped", () => {
  assert.equal(lib.pickActiveStep(rects, 270), 1);
  assert.equal(lib.pickActiveStep(rects, -500), 0);
  assert.equal(lib.pickActiveStep(rects, 9000), 2);
  assert.equal(lib.pickActiveStep([], 10), -1);
});

test("trigger line and root margin follow the offset and clamp it", () => {
  assert.equal(lib.triggerLine(100, 800, 0.5), 500);
  assert.equal(lib.triggerLine(0, 800, 2), 800);
  assert.equal(lib.triggerLine(0, 800, -1), 0);
  assert.equal(lib.lineRootMargin(0.5), "-50% 0px -50% 0px");
  assert.equal(lib.lineRootMargin(0.25), "-25% 0px -75% 0px");
});

test("step progress goes from 0 at the top edge to 1 at the bottom edge", () => {
  assert.equal(lib.stepProgress({ top: 100, bottom: 300 }, 100), 0);
  assert.equal(lib.stepProgress({ top: 100, bottom: 300 }, 200), 0.5);
  assert.equal(lib.stepProgress({ top: 100, bottom: 300 }, 999), 1);
  assert.equal(lib.stepProgress({ top: 100, bottom: 100 }, 50), 0);
});
