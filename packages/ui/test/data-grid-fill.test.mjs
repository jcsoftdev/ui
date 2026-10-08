// Pure fill handle: how far a drag extends a range and which values series detection writes.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/containers/data-grid/fill-series.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const values = (results) =>
  results.map((item) => ("value" in item ? item.value : `copy${item.from}`));
const limits = { maxR: 50, maxC: 8 };
const base = { r0: 2, r1: 3, c0: 1, c1: 2 };

test("handle extent: the larger overshoot picks the axis, inside the range does nothing", () => {
  assert.equal(lib.handleExtent(base, { r: 3, c: 2 }, limits), null);
  assert.equal(lib.handleExtent(base, { r: 1, c: 0 }, limits), null);
  assert.deepEqual(lib.handleExtent(base, { r: 7, c: 3 }, limits), {
    direction: "down",
    bounds: { r0: 2, r1: 7, c0: 1, c1: 2 },
  });
  assert.deepEqual(lib.handleExtent(base, { r: 4, c: 6 }, limits), {
    direction: "right",
    bounds: { r0: 2, r1: 3, c0: 1, c1: 6 },
  });
  assert.equal(lib.handleExtent(base, { r: 99, c: 2 }, limits).bounds.r1, 50);
});

test("lanes: one per column going down, one per row going right", () => {
  const down = lib.fillLanes(base, lib.handleExtent(base, { r: 5, c: 2 }, limits));
  assert.equal(down.length, 2);
  assert.deepEqual(down[0].source, [
    { r: 2, c: 1 },
    { r: 3, c: 1 },
  ]);
  assert.deepEqual(down[0].targets, [
    { r: 4, c: 1 },
    { r: 5, c: 1 },
  ]);
  const right = lib.fillLanes(base, lib.handleExtent(base, { r: 3, c: 4 }, limits));
  assert.equal(right.length, 2);
  assert.deepEqual(right[1].targets, [
    { r: 3, c: 3 },
    { r: 3, c: 4 },
  ]);
});

test("numbers: a constant step continues, a lone number or an irregular run copies", () => {
  assert.deepEqual(values(lib.seriesFill([1, 2, 3], 3)), [4, 5, 6]);
  assert.deepEqual(values(lib.seriesFill([10, 20], 2)), [30, 40]);
  assert.deepEqual(values(lib.seriesFill([5, 3], 3)), [1, -1, -3]);
  assert.deepEqual(values(lib.seriesFill([0.1, 0.2, 0.3], 1)), [0.4]);
  assert.deepEqual(values(lib.seriesFill([7], 3)), ["copy0", "copy0", "copy0"]);
  assert.deepEqual(values(lib.seriesFill([1, 2, 4], 4)), ["copy0", "copy1", "copy2", "copy0"]);
});

test("text with a trailing number counts up and keeps zero padding", () => {
  assert.deepEqual(values(lib.seriesFill(["Silla 1"], 2)), ["Silla 2", "Silla 3"]);
  assert.deepEqual(values(lib.seriesFill(["Silla 2", "Silla 4"], 2)), ["Silla 6", "Silla 8"]);
  assert.deepEqual(values(lib.seriesFill(["Turno 08"], 2)), ["Turno 09", "Turno 10"]);
  assert.deepEqual(values(lib.seriesFill(["Silla 1", "Sala 2"], 2)), ["copy0", "copy1"]);
  assert.deepEqual(values(lib.seriesFill(["Corte", "Barba"], 3)), ["copy0", "copy1", "copy0"]);
});

test("dates: daily, weekly, monthly and end-of-month series; a lone date copies", () => {
  const iso = (date) => date.toISOString().slice(0, 10);
  const day = (y, m, d) => new Date(y, m - 1, d, 12);
  const out = (source, count) =>
    lib
      .seriesFill(source, count)
      .map((item) => iso(new Date(item.value.getTime() - item.value.getTimezoneOffset() * 60000)));
  assert.deepEqual(out([day(2026, 9, 1), day(2026, 9, 2)], 2), ["2026-09-03", "2026-09-04"]);
  assert.deepEqual(out([day(2026, 9, 1), day(2026, 9, 8)], 2), ["2026-09-15", "2026-09-22"]);
  assert.deepEqual(out([day(2026, 1, 1), day(2026, 2, 1)], 3), [
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
  ]);
  assert.deepEqual(out([day(2026, 1, 31), day(2026, 2, 28)], 2), ["2026-03-31", "2026-04-30"]);
  assert.deepEqual(out([day(2026, 1, 15), day(2027, 1, 15)], 1), ["2028-01-15"]);
  assert.deepEqual(values(lib.seriesFill([day(2026, 9, 1)], 2)), ["copy0", "copy0"]);
  assert.deepEqual(values(lib.seriesFill([day(2026, 9, 1), day(2026, 9, 2), day(2026, 9, 5)], 1)), [
    "copy0",
  ]);
});

test("formulas and blanks are always copied so the grid can shift references", () => {
  assert.deepEqual(values(lib.seriesFill(["=A1+1", "=A2+1"], 2)), ["copy0", "copy1"]);
  assert.deepEqual(values(lib.seriesFill([1, "", 3], 2)), ["copy0", "copy1"]);
  assert.deepEqual(lib.seriesFill([1, 2], 0), []);
});
