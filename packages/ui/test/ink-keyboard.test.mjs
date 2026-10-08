// Pure keyboard side of the ruler and pen: crosshair steps inside the window and point collection.
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

const index = { x: [0, 20], y: [0, 100], xKind: "index" };
const time = { x: [0, 5000], y: [100, 0], xKind: "time" };

test("the crosshair starts in the middle; index axes land on a whole category", () => {
  assert.deepEqual(lib.startCursor(index), { x: 10, y: 50 });
  assert.deepEqual(lib.startCursor({ ...index, x: [0, 7] }), { x: 4, y: 50 });
  assert.deepEqual(lib.startCursor(time), { x: 2500, y: 50 });
});

test("arrows step one category (or a fiftieth of the window) and shift goes five times as far", () => {
  const at = { x: 10, y: 50 };
  assert.equal(lib.moveCursor(at, "ArrowRight", false, index).x, 11);
  assert.equal(lib.moveCursor(at, "ArrowLeft", true, index).x, 5);
  assert.equal(lib.moveCursor(at, "ArrowUp", false, index).y, 52);
  assert.equal(lib.moveCursor(at, "ArrowDown", true, index).y, 40);
  assert.equal(lib.moveCursor({ x: 100, y: 50 }, "ArrowRight", false, time).x, 200);
});

test("the crosshair never leaves the window, even with a reversed value window", () => {
  assert.equal(lib.moveCursor({ x: 20, y: 100 }, "ArrowRight", true, index).x, 20);
  assert.equal(lib.moveCursor({ x: 0, y: 0 }, "ArrowDown", true, index).y, 0);
  assert.equal(lib.moveCursor({ x: 0, y: 100 }, "ArrowUp", false, time).y, 100);
});

test("ruler: the first key sets a point, the second commits the pair; same point waits", () => {
  const a = { x: 2, y: 10 };
  const b = { x: 6, y: 30 };
  assert.deepEqual(lib.cursorAction("ruler", " ", [], a), { type: "pending", points: [a] });
  assert.deepEqual(lib.cursorAction("ruler", "Enter", [a], b), { type: "commit", points: [a, b] });
  assert.deepEqual(lib.cursorAction("ruler", " ", [a], a), { type: "pending", points: [a] });
});

test("pen: space adds vertices, enter finishes with the cursor as the last one", () => {
  const a = { x: 1, y: 1 };
  const b = { x: 2, y: 3 };
  const c = { x: 4, y: 2 };
  assert.deepEqual(lib.cursorAction("ink", " ", [a], b), { type: "pending", points: [a, b] });
  assert.deepEqual(lib.cursorAction("ink", "Enter", [a, b], c), {
    type: "commit",
    points: [a, b, c],
  });
  assert.deepEqual(lib.cursorAction("ink", "Enter", [a, b], b), { type: "commit", points: [a, b] });
  assert.equal(lib.cursorAction("ink", "Enter", [], a).type, "pending");
  assert.equal(lib.cursorAction("ink", "Escape", [a, b], c).type, "cancel");
});

// Horizontal bars: categories run top to bottom (y pixels), values left to right (x pixels).
const hbars = {
  horizontal: true,
  width: 400,
  height: 200,
  xKind: "index",
  // 4 categories, band centers at 25, 75, 125, 175 px
  toX: (value) => 25 + value * 50,
  fromX: (pixel) => (pixel - 25) / 50,
  // values 0..100 across 400 px
  toY: (value) => value * 4,
  fromY: (pixel) => pixel / 4,
};

test("horizontal plot: a data point maps to x by value and y by category, and back", () => {
  const pixel = lib.plotToPixel(hbars, { x: 2, y: 50 });
  assert.deepEqual(pixel, { x: 200, y: 125 });
  assert.deepEqual(lib.pixelToPlot(hbars, pixel), { x: 2, y: 50 });
  assert.deepEqual(lib.pixelToPlot(hbars, { x: 999, y: -20 }), { x: -0.5, y: 100 });
  const vertical = { ...hbars, horizontal: false, width: 200, height: 400 };
  const flipped = {
    ...vertical,
    toX: (value) => value * 50,
    fromX: (pixel) => pixel / 50,
    toY: (value) => 400 - value * 4,
    fromY: (pixel) => (400 - pixel) / 4,
  };
  assert.deepEqual(lib.plotToPixel(flipped, { x: 2, y: 50 }), { x: 100, y: 200 });
});

test("horizontal plot: the cursor window spans categories on x and values on y", () => {
  const domain = lib.plotDomain(hbars);
  assert.deepEqual(domain.x, [-0.5, 3.5]);
  assert.deepEqual(domain.y, [0, 100]);
  assert.deepEqual(lib.startCursor(domain), { x: 2, y: 50 });
});

test("horizontal plot: left and right move the value, up and down the category", () => {
  const domain = lib.plotDomain(hbars);
  const at = { x: 1, y: 50 };
  assert.equal(lib.moveCursor(at, "ArrowRight", false, domain, true).y, 52);
  assert.equal(lib.moveCursor(at, "ArrowLeft", true, domain, true).y, 40);
  assert.equal(lib.moveCursor(at, "ArrowDown", false, domain, true).x, 2);
  assert.equal(lib.moveCursor(at, "ArrowUp", false, domain, true).x, 0);
  assert.equal(lib.moveCursor({ x: 3, y: 100 }, "ArrowRight", true, domain, true).y, 100);
  assert.equal(lib.moveCursor({ x: 3, y: 100 }, "ArrowDown", true, domain, true).x, 3.5);
});

test("horizontal ruler: the value change is in value units, the distance in categories", () => {
  const a = lib.pixelToPlot(hbars, { x: 80, y: 25 });
  const b = lib.pixelToPlot(hbars, { x: 280, y: 125 });
  const measure = lib.measureSegment(a, b);
  assert.equal(measure.dy, 50);
  assert.equal(measure.dx, 2);
  assert.equal(measure.percent, 250);
});
