// Pure helpers behind DataGrid: sort, filter, group, aggregate, CSV and virtualization math.
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

const model = await load("../src/containers/data-grid/model.ts");
const virtual = await load("../src/containers/data-grid/virtual.ts");

const columns = [
  { id: "cliente", header: "Cliente", accessor: "cliente" },
  { id: "barbero", header: "Barbero", accessor: "barbero" },
  { id: "total", header: "Total", accessor: "total", type: "currency", aggregate: "sum" },
  { id: "fecha", header: "Fecha", accessor: "fecha", type: "date" },
  { id: "estado", header: "Estado", accessor: "estado", type: "status" },
];

const rows = [
  { cliente: "Álvaro", barbero: "Luis", total: 35, fecha: new Date(2026, 9, 6), estado: "Pagado" },
  { cliente: "Bruno", barbero: "Ana", total: 50, fecha: new Date(2026, 9, 7), estado: "Pendiente" },
  { cliente: "César", barbero: "Luis", total: null, fecha: new Date(2026, 9, 8), estado: "Pagado" },
  { cliente: "Diego", barbero: "Ana", total: 20, fecha: new Date(2026, 9, 9), estado: "Anulado" },
];
const names = (list) => list.map((row) => row.cliente);

test("toggleSort cycles asc, desc, off and Shift adds secondary rules", () => {
  let sort = model.toggleSort([], "total", false);
  assert.deepEqual(sort, [{ id: "total", direction: "asc" }]);
  sort = model.toggleSort(sort, "total", false);
  assert.deepEqual(sort, [{ id: "total", direction: "desc" }]);
  assert.deepEqual(model.toggleSort(sort, "total", false), []);
  sort = model.toggleSort([{ id: "barbero", direction: "asc" }], "total", true);
  assert.deepEqual(sort, [
    { id: "barbero", direction: "asc" },
    { id: "total", direction: "asc" },
  ]);
  assert.deepEqual(model.toggleSort(sort, "barbero", false), [{ id: "barbero", direction: "asc" }]);
});

test("sortRows is stable, multi-column, and keeps empty values last in both directions", () => {
  const asc = model.sortRows(rows, columns, [{ id: "total", direction: "asc" }]);
  assert.deepEqual(names(asc), ["Diego", "Álvaro", "Bruno", "César"]);
  const desc = model.sortRows(rows, columns, [{ id: "total", direction: "desc" }]);
  assert.deepEqual(names(desc), ["Bruno", "Álvaro", "Diego", "César"]);
  const multi = model.sortRows(rows, columns, [
    { id: "barbero", direction: "asc" },
    { id: "total", direction: "desc" },
  ]);
  assert.deepEqual(names(multi), ["Bruno", "Diego", "Álvaro", "César"]);
  const accents = model.sortRows(rows, columns, [{ id: "cliente", direction: "asc" }]);
  assert.deepEqual(names(accents), ["Álvaro", "Bruno", "César", "Diego"]);
});

test("filters: text ignores accents, ranges, date ranges inclusive by day, select values", () => {
  const by = (filters, search) => names(model.filterRows(rows, columns, filters, search));
  assert.deepEqual(by({ cliente: { kind: "text", query: "cesar" } }), ["César"]);
  assert.deepEqual(by({ total: { kind: "range", min: 30, max: 50 } }), ["Álvaro", "Bruno"]);
  assert.deepEqual(by({ total: { kind: "range", min: null, max: null } }).length, 4);
  assert.deepEqual(by({ fecha: { kind: "dateRange", from: "2026-10-07", to: "2026-10-08" } }), [
    "Bruno",
    "César",
  ]);
  assert.deepEqual(by({ estado: { kind: "select", values: ["Pagado", "Anulado"] } }), [
    "Álvaro",
    "César",
    "Diego",
  ]);
  assert.deepEqual(by({}, "luis paga"), ["Álvaro", "César"]);
  assert.deepEqual(by({}, "S/ 50"), ["Bruno"]);
  assert.equal(model.countActiveFilters({ a: { kind: "text", query: " " } }), 0);
  assert.deepEqual(model.distinctValues(rows, columns[4]), ["Anulado", "Pagado", "Pendiente"]);
});

test("aggregates skip empty values; count counts non-empty", () => {
  const totals = rows.map((row) => row.total);
  assert.equal(model.aggregateValues(totals, "sum"), 105);
  assert.equal(model.aggregateValues(totals, "avg"), 35);
  assert.equal(model.aggregateValues(totals, "count"), 3);
  assert.equal(model.aggregateValues(totals, "min"), 20);
  assert.equal(model.aggregateValues(totals, "max"), 50);
  assert.equal(model.aggregateValues([null, undefined], "sum"), null);
});

test("buildDisplayRows nests groups with counts and aggregates, honours collapse and sort", () => {
  const key = (row) => row.cliente;
  const display = model.buildDisplayRows(rows, columns, ["barbero"], new Set(), key);
  assert.deepEqual(
    display.map((row) => (row.kind === "group" ? `G:${row.label}:${row.count}` : row.key)),
    ["G:Ana:2", "Bruno", "Diego", "G:Luis:2", "Álvaro", "César"],
  );
  assert.equal(display[0].aggregates.total, 70);
  assert.equal(display[3].aggregates.total, 35);
  assert.equal(display[1].depth, 1);

  const collapsed = new Set([display[0].key]);
  const folded = model.buildDisplayRows(rows, columns, ["barbero"], collapsed, key);
  assert.deepEqual(
    folded.map((row) => row.key),
    [display[0].key, display[3].key, "Álvaro", "César"],
  );
  assert.equal(folded[0].collapsed, true);

  const desc = model.buildDisplayRows(rows, columns, ["barbero"], new Set(), key, [
    { id: "barbero", direction: "desc" },
  ]);
  assert.equal(desc[0].label, "Luis");

  const nested = model.buildDisplayRows(rows, columns, ["barbero", "estado"], new Set(), key);
  assert.deepEqual(
    nested.filter((row) => row.kind === "group").map((row) => `${row.depth}:${row.label}`),
    ["0:Ana", "1:Anulado", "1:Pendiente", "0:Luis", "1:Pagado"],
  );
});

test("rangeBetween selects inclusively in display order either direction", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(model.rangeBetween(ids, "d", "b"), ["b", "c", "d"]);
  assert.deepEqual(model.rangeBetween(ids, null, "c"), ["c"]);
});

test("toCSV quotes special fields, keeps raw numbers and ISO dates", () => {
  const csv = model.toCSV(
    [{ cliente: 'Luis "El Rey", Jr.', total: 1234.5, fecha: new Date(2026, 9, 6) }],
    [columns[0], columns[2], columns[3]],
  );
  assert.equal(csv, 'Cliente,Total,Fecha\r\n"Luis ""El Rey"", Jr.",1234.5,2026-10-06');
  assert.ok(model.toCSV([], columns, { bom: true }).startsWith("﻿"));
});

test("column layout helpers move, clamp and reconcile stored layouts", () => {
  assert.deepEqual(model.moveColumn(["a", "b", "c"], "a", 1), ["b", "a", "c"]);
  assert.deepEqual(model.moveColumn(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(model.moveColumnTo(["a", "b", "c"], "c", "a", "before"), ["c", "a", "b"]);
  assert.deepEqual(model.moveColumnTo(["a", "b", "c"], "a", "c", "after"), ["b", "c", "a"]);
  assert.equal(model.clampWidth(10, { id: "x", minWidth: 80 }), 80);
  assert.equal(model.clampWidth(9999, { id: "x" }), model.MAX_COLUMN_WIDTH);
  const fallback = { order: ["cliente"], hidden: [], widths: {}, pinned: { left: [], right: [] } };
  const layout = model.reconcileLayout(
    columns,
    {
      order: ["total", "gone", "cliente"],
      hidden: ["gone", "fecha"],
      widths: { total: 5 },
      pinned: { left: ["cliente"], right: ["cliente", "estado"] },
    },
    fallback,
  );
  assert.deepEqual(layout.order, ["total", "cliente", "barbero", "fecha", "estado"]);
  assert.deepEqual(layout.hidden, ["fecha"]);
  assert.equal(layout.widths.total, model.MIN_COLUMN_WIDTH);
  assert.deepEqual(layout.pinned, { left: ["cliente"], right: ["estado"] });
  assert.equal(model.parseStoredLayout("{oops"), null);
});

test("virtual window renders the visible rows plus overscan and sizes the spacers", () => {
  const win = virtual.computeVirtualWindow({
    count: 10000,
    rowHeight: 40,
    viewportHeight: 400,
    scrollTop: 4000,
    overscan: 5,
  });
  assert.equal(win.start, 95);
  assert.equal(win.end, 116);
  assert.equal(win.padTop, 95 * 40);
  assert.equal(win.padBottom, (10000 - 116) * 40);
  assert.equal(win.padTop + (win.end - win.start) * 40 + win.padBottom, win.totalHeight);

  const bottom = virtual.computeVirtualWindow({
    count: 10000,
    rowHeight: 40,
    viewportHeight: 400,
    scrollTop: 1e9,
    overscan: 5,
  });
  assert.equal(bottom.end, 10000);
  assert.equal(bottom.padBottom, 0);

  const empty = virtual.computeVirtualWindow({
    count: 0,
    rowHeight: 40,
    viewportHeight: 400,
    scrollTop: 0,
  });
  assert.deepEqual([empty.start, empty.end, empty.totalHeight], [0, 0, 0]);
});

test("reveal math scrolls the least needed, vertically and around pinned columns", () => {
  assert.equal(virtual.scrollTopToReveal(5, 40, 400, 0), 0);
  assert.equal(virtual.scrollTopToReveal(20, 40, 400, 0), 440);
  assert.equal(virtual.scrollTopToReveal(2, 40, 400, 400), 80);
  assert.equal(virtual.pageStep(40, 400), 9);
  assert.equal(virtual.scrollLeftToReveal(300, 100, 500, 0, 200, 0), 0);
  assert.equal(virtual.scrollLeftToReveal(250, 100, 500, 100, 200, 0), 50);
  assert.equal(virtual.scrollLeftToReveal(600, 100, 500, 0, 0, 120), 320);
  assert.equal(virtual.pageCount(0, 25), 1);
  assert.equal(virtual.pageCount(51, 25), 3);
});

test("a column never starts narrower than its header label", () => {
  const narrow = { id: "barbero", header: "Barbero", width: 90 };
  assert.ok(model.defaultWidth(narrow) >= model.headerFitWidth(narrow));
  const wide = { id: "cliente", header: "Cliente", width: 220 };
  assert.equal(model.defaultWidth(wide), 220);
});

test("fillColumnWidths gives the leftover to flexible columns, never shrinks, respects resized and max", () => {
  const cols = [
    { id: "a", header: "A", accessor: "a", width: 200 },
    { id: "b", header: "B", accessor: "b", type: "number", width: 100 },
    { id: "c", header: "C", accessor: "c", width: 200, grow: 3 },
  ];
  const base = Object.fromEntries(cols.map((c) => [c.id, model.defaultWidth(c)]));
  const sum = (w) => Object.values(w).reduce((x, y) => x + y, 0);

  const filled = model.fillColumnWidths(cols, base, 1000);
  assert.equal(sum(filled), 1000);
  assert.equal(filled.b, base.b);
  assert.ok(filled.c - base.c > filled.a - base.a);

  assert.deepEqual(model.fillColumnWidths(cols, base, 300), base);

  const resized = model.fillColumnWidths(cols, { ...base, a: base.a + 37 }, 1000);
  assert.equal(resized.a, base.a + 37);
  assert.equal(sum(resized), 1000);

  const capped = model.fillColumnWidths([{ ...cols[0], maxWidth: 250 }, cols[2]], base, 1000);
  assert.equal(capped.a, 250);
  assert.equal(capped.a + capped.c, 1000);

  assert.deepEqual(model.fillColumnWidths([cols[1]], base, 1000), base);
  assert.equal(sum(model.fillColumnWidths(cols, base, 1000, 44)), 956);
});
