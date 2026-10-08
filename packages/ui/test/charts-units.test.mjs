// Pure layout helpers of the unit charts: unit counts, cell allocation, grid fit and seat arcs.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "../src/charts/core/units.ts");

const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

test("unit counts split a value into full icons and a clipped remainder", () => {
  assert.deepEqual(lib.unitCount(23, 5), { full: 4, partial: 0.6, units: 5 });
  assert.deepEqual(lib.unitCount(20, 5), { full: 4, partial: 0, units: 4 });
  assert.deepEqual(lib.unitCount(0.3, 0.1), { full: 3, partial: 0, units: 3 });
  assert.deepEqual(lib.unitCount(-4, 1), { full: 0, partial: 0, units: 0 });
  assert.deepEqual(lib.unitCount(10, 0), { full: 0, partial: 0, units: 0 });
  assert.deepEqual(lib.unitFractions(23, 5), [1, 1, 1, 1, 0.6]);
  assert.deepEqual(lib.unitFractions(0, 5), []);
});

test("progress fractions fill stars exactly or by step", () => {
  assert.deepEqual(lib.progressFractions(4.5, 5, 5), [1, 1, 1, 1, 0.5]);
  assert.deepEqual(lib.progressFractions(4.3, 5, 5), [1, 1, 1, 1, 0.3]);
  assert.deepEqual(lib.progressFractions(3.74, 5, 5, 0.5), [1, 1, 1, 0.5, 0]);
  assert.deepEqual(lib.progressFractions(68, 100, 10), [1, 1, 1, 1, 1, 1, 0.8, 0, 0, 0]);
  assert.deepEqual(lib.progressFractions(9, 5, 5), [1, 1, 1, 1, 1]);
  assert.deepEqual(lib.progressFractions(-1, 5, 3), [0, 0, 0]);
});

test("largest remainder always adds up to the number of cells", () => {
  const counts = lib.largestRemainder([412, 268, 187, 96], 100);
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    100,
  );
  assert.deepEqual(counts, [43, 28, 19, 10]);
  assert.deepEqual(lib.largestRemainder([1, 1, 1], 10), [4, 3, 3]);
  assert.deepEqual(lib.largestRemainder([0, 0], 10), [0, 0]);
  assert.deepEqual(lib.largestRemainder([5, -2, 5], 3), [2, 0, 1]);
});

test("waffle counts leave the rest of a total empty", () => {
  assert.deepEqual(lib.waffleCounts([58, 17], 100, 120), [48, 14]);
  assert.deepEqual(lib.waffleCounts([58, 17], 100), [77, 23]);
  assert.deepEqual(lib.waffleCounts([58, 17], 100, 10), [77, 23]);
});

test("grid cells fill by rows or bottom-up by columns", () => {
  assert.deepEqual(lib.gridCell(13, 10, 10, "row"), { row: 1, column: 3 });
  assert.deepEqual(lib.gridCell(0, 10, 10, "column"), { row: 9, column: 0 });
  assert.deepEqual(lib.gridCell(13, 10, 10, "column"), { row: 6, column: 1 });
});

test("unit grid fit picks the largest units, then the widest layout", () => {
  const flow = (n) => (columns) => Math.ceil(n / columns);
  const fit = lib.fitUnitGrid({
    width: 300,
    height: 100,
    gap: 0,
    maxColumns: 12,
    rowsFor: flow(12),
  });
  assert.deepEqual(fit, { columns: 6, rows: 2, size: 50 });
  const capped = lib.fitUnitGrid({
    width: 600,
    height: 200,
    gap: 0,
    maxSize: 20,
    maxColumns: 12,
    rowsFor: flow(12),
  });
  assert.deepEqual(capped, { columns: 12, rows: 1, size: 20 });
  const fixed = lib.fitUnitGrid({
    width: 100,
    height: 100,
    gap: 0,
    maxColumns: 9,
    rowsFor: flow(9),
    columns: 3,
  });
  assert.deepEqual(fixed, { columns: 3, rows: 3, size: 100 / 3 });
});

test("parliament rows grow with the seat count", () => {
  assert.equal(lib.parliamentRows(0), 0);
  assert.equal(lib.parliamentRows(3), 1);
  assert.equal(lib.parliamentRows(24), 3);
  assert.equal(lib.parliamentRows(26), 4);
  assert.equal(lib.parliamentRows(130), 7);
  assert.ok(lib.parliamentRows(446) > lib.parliamentRows(130));
});

test("parliament layout places every seat on its arc, left to right", () => {
  for (const total of [1, 7, 26, 130, 446]) {
    const layout = lib.parliamentLayout(total);
    assert.equal(layout.seats.length, total);
    for (const seat of layout.seats) {
      const radius = Math.hypot(seat.x, seat.y);
      assert.ok(Math.abs(radius - layout.radii[seat.row]) < 1e-6);
      assert.ok(seat.y <= 1e-9, "seats stay on the upper half");
    }
    for (let i = 1; i < layout.seats.length; i += 1) {
      assert.ok(layout.seats[i - 1].angle >= layout.seats[i].angle);
    }
  }
  const single = lib.parliamentLayout(1);
  assert.deepEqual([single.seats[0].x, single.seats[0].y], [0, -1]);
});

test("parliament seats never overlap", () => {
  const layout = lib.parliamentLayout(130);
  const { seats, seatRadius } = layout;
  let closest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < seats.length; i += 1) {
    for (let j = i + 1; j < seats.length; j += 1) {
      closest = Math.min(closest, Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y));
    }
  }
  assert.ok(closest >= seatRadius * 2, `${closest} >= ${seatRadius * 2}`);
});

test("units are assigned to categories in order", () => {
  assert.deepEqual(lib.assignUnits([2, 0, 3]), [0, 0, 2, 2, 2]);
});
