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

test("an error settles back to the password state once it has been held", () => {
  assert.equal(model.ERROR_HOLD_MS, 1100);
  assert.equal(model.shownState("error", false), "error");
  assert.equal(model.shownState("error", true), "password");
  for (const state of ["idle", "typing", "password", "success"]) {
    assert.equal(model.shownState(state, true), state);
  }
});

test("each keystroke picks the next piece and flips phase when a piece reacts again", () => {
  const step = 1 / (model.KEYSTROKES_PER_FIELD * 2);
  const ticks = [1, 2, 3, 4, 5, 6].map((n) => model.keystroke(n * step));
  assert.deepEqual(
    ticks.map((tick) => [tick.count, tick.target, tick.phase]),
    [
      [1, 1, 0],
      [2, 2, 0],
      [3, 0, 1],
      [4, 1, 1],
      [5, 2, 1],
      [6, 0, 0],
    ],
  );
  assert.deepEqual(model.keystroke(0), { count: 0, target: 0, phase: 0 });
  assert.equal(model.keystroke(5).count, model.KEYSTROKES_PER_FIELD * 2);
});

test("pointer offset is -1..1 from the box centre and clamped outside it", () => {
  const box = { left: 100, top: 50, width: 200, height: 100 };
  assert.deepEqual(model.pointerOffset({ x: 200, y: 100 }, box), { x: 0, y: 0 });
  assert.deepEqual(model.pointerOffset({ x: 300, y: 50 }, box), { x: 1, y: -1 });
  assert.deepEqual(model.pointerOffset({ x: 150, y: 125 }, box), { x: -0.5, y: 0.5 });
  assert.deepEqual(model.pointerOffset({ x: 2000, y: -900 }, box), { x: 1, y: -1 });
  assert.deepEqual(model.pointerOffset({ x: 5, y: 5 }, { left: 0, top: 0, width: 0, height: 0 }), {
    x: 0,
    y: 0,
  });
});

test("isometric box faces are closed paths centred on the origin", () => {
  assert.deepEqual(model.isoPoint(10, 0, 0), { x: 8.66, y: 5 });
  assert.deepEqual(model.isoPoint(0, 10, 4), { x: -8.66, y: 1 });
  const box = model.isoBox(100, 100, 20);
  assert.equal(box.top, "M0 -70L86.6 -20L0 30L-86.6 -20Z");
  assert.equal(box.left, "M-86.6 -20L0 30L0 50L-86.6 0Z");
  assert.equal(box.right, "M86.6 -20L0 30L0 50L86.6 0Z");
});

test("the stack keeps its foundation, gains books with progress and completes on success", () => {
  for (const count of model.STACK_COUNTS) {
    assert.equal(model.stackPlaced("idle", 0, count), 1);
    assert.equal(model.stackPlaced("password", 1, count), count);
    assert.equal(model.stackPlaced("success", 0, count), count);
    assert.equal(model.stackPlaced("typing", Number.NaN, count), 1);
  }
  assert.deepEqual(
    [0, 0.2, 0.25, 0.5, 0.74, 0.75, 1].map((p) => model.stackPlaced("typing", p, 5)),
    [1, 1, 2, 3, 3, 4, 5],
  );
});

test("each book rests on the books under it and the flag stands on the top one", () => {
  const slots = model.stackSlots();
  assert.equal(slots.length, model.STACK_BOOKS.length);
  assert.deepEqual(slots[0], { x: 0, y: 0 });
  const [first, second] = model.STACK_BOOKS;
  assert.deepEqual(slots[1], model.isoPoint(second.du, second.dv, first.h));
  const tops = model.STACK_COUNTS.map((count) => model.stackTop(count).y);
  assert.ok(tops[0] > tops[1] && tops[1] > tops[2], "a taller tower plants the flag higher");
  assert.deepEqual(model.stackTop(0), { x: 0, y: 0 });
});
