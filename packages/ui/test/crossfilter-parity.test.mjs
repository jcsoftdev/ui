// Pure crossfilter engine: filters, grouped counts that exclude the dimension's own filter, bins.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/charts/crossfilter/crossfilter-engine.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const sales = [
  { barber: "Luis", service: "Corte", total: 35 },
  { barber: "Luis", service: "Barba", total: 25 },
  { barber: "Ana", service: "Corte", total: 40 },
  { barber: "Ana", service: "Fade", total: 45 },
  { barber: "Marco", service: "Corte", total: 35 },
  { barber: "Marco", service: "Barba", total: 55 },
];
const dims = { barber: (s) => s.barber, service: (s) => s.service, total: (s) => s.total };

test("set filters keep records whose value is in the set; no filters keeps everything", () => {
  assert.equal(lib.filterRecords(sales, dims, lib.NO_FILTERS).length, 6);
  const filters = lib.toggleValue(lib.NO_FILTERS, "barber", "Luis");
  assert.equal(lib.filterRecords(sales, dims, filters).length, 2);
  const two = lib.toggleValue(filters, "barber", "Ana");
  assert.equal(lib.filterRecords(sales, dims, two).length, 4);
});

test("toggling the last value off clears the dimension", () => {
  const on = lib.toggleValue(lib.NO_FILTERS, "barber", "Luis");
  const off = lib.toggleValue(on, "barber", "Luis");
  assert.deepEqual(off, {});
  assert.equal(lib.activeFilterCount(off), 0);
});

test("filters on different dimensions intersect", () => {
  let filters = lib.toggleValue(lib.NO_FILTERS, "barber", "Marco");
  filters = lib.toggleValue(filters, "service", "Corte");
  assert.deepEqual(lib.filterRecords(sales, dims, filters), [sales[4]]);
});

test("groups exclude the dimension's own filter (crossfilter semantics)", () => {
  const filters = lib.toggleValue(
    lib.toggleValue(lib.NO_FILTERS, "barber", "Luis"),
    "service",
    "Corte",
  );
  const byBarber = lib.groupRecords(sales, dims, filters, "barber");
  // barber's own filter is ignored: every barber that sold a Corte still shows its count.
  assert.deepEqual(
    byBarber.map((g) => [g.key, g.count]),
    [
      ["Luis", 1],
      ["Ana", 1],
      ["Marco", 1],
    ],
  );
  const byService = lib.groupRecords(sales, dims, filters, "service");
  assert.deepEqual(
    byService.map((g) => [g.key, g.count]),
    [
      ["Corte", 1],
      ["Barba", 1],
    ],
  );
});

test("groups sum a measure and report requested keys even when empty", () => {
  const groups = lib.groupRecords(sales, dims, lib.NO_FILTERS, "barber", {
    value: (s) => s.total,
    keys: ["Marco", "Ana", "Julio"],
  });
  assert.deepEqual(
    groups.map((g) => [g.key, g.count, g.sum]),
    [
      ["Marco", 2, 90],
      ["Ana", 2, 85],
      ["Julio", 0, 0],
    ],
  );
});

test("range filters are inclusive and ignore non numbers", () => {
  const filters = lib.setRangeFilter(lib.NO_FILTERS, "total", [55, 35]);
  assert.deepEqual(filters.total, { kind: "range", min: 35, max: 55 });
  assert.equal(lib.filterRecords(sales, dims, filters).length, 5);
  assert.equal(lib.matchesFilter({ kind: "range", min: 0, max: 1 }, "abc"), false);
  assert.deepEqual(lib.setRangeFilter(filters, "total", null), {});
});

test("bin index: half open bins, the last one closed, outside is -1", () => {
  const edges = [0, 10, 20, 30];
  assert.equal(lib.binIndex(edges, 0), 0);
  assert.equal(lib.binIndex(edges, 9.99), 0);
  assert.equal(lib.binIndex(edges, 10), 1);
  assert.equal(lib.binIndex(edges, 30), 2);
  assert.equal(lib.binIndex(edges, 31), -1);
  assert.equal(lib.binIndex(edges, -1), -1);
  assert.deepEqual(lib.evenEdges(0, 100, 4), [0, 25, 50, 75, 100]);
});

test("bins count the context of the other filters", () => {
  const edges = [20, 40, 60];
  assert.deepEqual(lib.binRecords(sales, dims, lib.NO_FILTERS, "total", edges), [3, 3]);
  const filters = lib.toggleValue(lib.NO_FILTERS, "barber", "Ana");
  assert.deepEqual(lib.binRecords(sales, dims, filters, "total", edges), [0, 2]);
  // Its own filter is excluded.
  const own = lib.setRangeFilter(lib.NO_FILTERS, "total", [20, 39]);
  assert.deepEqual(lib.binRecords(sales, dims, own, "total", edges), [3, 3]);
});

test("a bin selection round trips to a range filter and back", () => {
  const edges = [0, 10, 20, 30, 40];
  const [min, max] = lib.rangeOfBins(edges, 1, 2);
  assert.equal(min, 10);
  assert.ok(max < 30 && max > 29.99);
  assert.deepEqual(lib.binsInRange(edges, min, max), [1, 2]);
  assert.equal(lib.rangeOfBins(edges, 3, 3)[1], 40);
  assert.deepEqual(lib.binsInRange(edges, 100, 200), null);
  const filters = lib.setRangeFilter(lib.NO_FILTERS, "x", [min, max]);
  assert.equal(lib.isSelected(filters, "x", 25), true);
  assert.equal(lib.isSelected(filters, "x", 35), false);
  assert.equal(lib.isSelected(filters, "other", 1), true);
});
