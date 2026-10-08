// Pure rectangular brush: corners to rectangle, rectangle to per-axis filters, keyboard steps.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
async function load(entry) {
  const bundle = await build({
    entryPoints: [join(here, entry)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}
const brush = await load("../src/charts/core/distribution/brush.ts");
const engine = await load("../src/charts/crossfilter/crossfilter-engine.ts");

test("corners give a normalized rectangle whatever the drag direction", () => {
  const rect = brush.rectFromCorners({ x: 9, y: 80 }, { x: 3, y: 20 });
  assert.deepEqual(rect, { x0: 3, x1: 9, y0: 20, y1: 80 });
});

test("the rectangle filters x and y; both ranges drive the crossfilter engine", () => {
  const rect = { x0: 10, x1: 14, y0: 30, y1: 60 };
  const ranges = brush.rectToRanges(rect);
  assert.deepEqual(ranges, { x: [10, 14], y: [30, 60] });
  const sales = [
    { hora: 9, ticket: 40 },
    { hora: 11, ticket: 45 },
    { hora: 12, ticket: 80 },
    { hora: 13, ticket: 31 },
    { hora: 18, ticket: 50 },
  ];
  const dims = { hora: (s) => s.hora, ticket: (s) => s.ticket };
  let filters = engine.setRangeFilter(engine.NO_FILTERS, "hora", ranges.x);
  filters = engine.setRangeFilter(filters, "ticket", ranges.y);
  assert.deepEqual(
    engine.filterRecords(sales, dims, filters).map((s) => s.hora),
    [11, 13],
  );
});

test("filters rebuild the rectangle; an unfiltered axis stays unbounded until clamped", () => {
  assert.equal(brush.rangesToRect(null, null), null);
  const rect = brush.rangesToRect([10, 14], null);
  assert.equal(rect.y0, Number.NEGATIVE_INFINITY);
  assert.equal(rect.y1, Number.POSITIVE_INFINITY);
  assert.deepEqual(brush.rectToRanges(rect), { x: [10, 14], y: null });
  assert.deepEqual(brush.clampRect(rect, [9, 20], [0, 100]), { x0: 10, x1: 14, y0: 0, y1: 100 });
});

test("a drag shorter than the threshold is a click", () => {
  assert.equal(brush.isClick({ x: 10, y: 10 }, { x: 12, y: 13 }), true);
  assert.equal(brush.isClick({ x: 10, y: 10 }, { x: 30, y: 11 }), false);
});

test("contains is inclusive on every edge", () => {
  const rect = { x0: 1, x1: 2, y0: 1, y1: 2 };
  assert.equal(brush.rectContains(rect, 2, 1), true);
  assert.equal(brush.rectContains(rect, 2.01, 1), false);
});

test("keyboard: arrows move by 5 % of the domain and stop at the edges", () => {
  const start = brush.defaultBrush([0, 100], [0, 200]);
  assert.deepEqual(start, { x0: 25, x1: 75, y0: 50, y1: 150 });
  const right = brush.stepBrush(start, "ArrowRight", false, [0, 100], [0, 200]);
  assert.deepEqual([right.x0, right.x1], [30, 80]);
  const up = brush.stepBrush(start, "ArrowUp", false, [0, 100], [0, 200]);
  assert.deepEqual([up.y0, up.y1], [60, 160]);
  let edge = start;
  for (let i = 0; i < 20; i += 1)
    edge = brush.stepBrush(edge, "ArrowRight", false, [0, 100], [0, 200]);
  assert.deepEqual([edge.x0, edge.x1], [50, 100]);
});

test("keyboard: shift resizes (right/up grow, left/down shrink) and never collapses", () => {
  const start = { x0: 40, x1: 60, y0: 40, y1: 60 };
  const wider = brush.stepBrush(start, "ArrowRight", true, [0, 100], [0, 100]);
  assert.deepEqual([wider.x0, wider.x1], [40, 65]);
  const shorter = brush.stepBrush(start, "ArrowDown", true, [0, 100], [0, 100]);
  assert.deepEqual([shorter.y0, shorter.y1], [40, 55]);
  let thin = start;
  for (let i = 0; i < 20; i += 1)
    thin = brush.stepBrush(thin, "ArrowLeft", true, [0, 100], [0, 100]);
  assert.deepEqual([thin.x0, thin.x1], [40, 45]);
  let full = start;
  for (let i = 0; i < 20; i += 1)
    full = brush.stepBrush(full, "ArrowRight", true, [0, 100], [0, 100]);
  assert.equal(full.x1, 100);
});
