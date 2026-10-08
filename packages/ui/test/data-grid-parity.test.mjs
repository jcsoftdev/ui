// Pure logic added to DataGrid: set filter, rows, tree, range, pivot, data source, filter builder.
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

const dir = "../src/containers/data-grid/";
const model = await load(`${dir}model.ts`);
const rowsLib = await load(`${dir}rows.ts`);
const tree = await load(`${dir}tree.ts`);
const range = await load(`${dir}range.ts`);
const pivot = await load(`${dir}pivot.ts`);
const source = await load(`${dir}data-source.ts`);
const fb = await load(`${dir}filter-builder.ts`);
const groups = await load(`${dir}column-groups.ts`);
const virtual = await load(`${dir}virtual.ts`);

const columns = [
  { id: "cliente", header: "Cliente", accessor: "cliente" },
  { id: "barbero", header: "Barbero", accessor: "barbero" },
  { id: "servicio", header: "Servicio", accessor: "servicio" },
  { id: "total", header: "Total", accessor: "total", type: "currency", aggregate: "sum" },
  { id: "fecha", header: "Fecha", accessor: "fecha", type: "date" },
  { id: "pagado", header: "Pagado", accessor: "pagado", type: "boolean" },
];

const ventas = [
  {
    cliente: "Álvaro",
    barbero: "Luis",
    servicio: "Corte",
    total: 35,
    fecha: new Date(2026, 9, 6),
    pagado: true,
  },
  {
    cliente: "Bruno",
    barbero: "Ana",
    servicio: "Barba",
    total: 25,
    fecha: new Date(2026, 9, 7),
    pagado: false,
  },
  {
    cliente: "César",
    barbero: "Luis",
    servicio: "Barba",
    total: 25,
    fecha: new Date(2026, 9, 8),
    pagado: true,
  },
  {
    cliente: "Diego",
    barbero: "Ana",
    servicio: "Corte",
    total: 35,
    fecha: new Date(2026, 9, 9),
    pagado: true,
  },
  {
    cliente: "Eduardo",
    barbero: "Ana",
    servicio: "Corte",
    total: 45,
    fecha: new Date(2026, 9, 9),
    pagado: true,
  },
];

// ---- set filter ----------------------------------------------------------------------------

test("set filter: unchecking leaves the rest, checking everything clears it, none matches nothing", () => {
  const options = ["Ana", "Luis", "Marco"];
  let filter = model.toggleSetValues(options, undefined, ["Luis"], false);
  assert.deepEqual(filter, { kind: "select", values: ["Ana", "Marco"] });
  assert.deepEqual([...model.checkedSetValues(options, filter)], ["Ana", "Marco"]);
  filter = model.toggleSetValues(options, filter, ["Luis"], true);
  assert.equal(filter, undefined);
  filter = model.toggleSetValues(options, undefined, options, false);
  assert.deepEqual(filter, { kind: "select", values: [model.SET_NONE] });
  assert.equal(model.isFilterActive(filter), true);
  assert.deepEqual(model.filterRows(ventas, columns, { barbero: filter }), []);
});

test("set filter search narrows the options and select all applies to what is visible", () => {
  const options = ["Barba", "Corte", "Corte niño", "Tinte"];
  const visible = model.searchOptions(options, "cor");
  assert.deepEqual(visible, ["Corte", "Corte niño"]);
  const filter = model.toggleSetValues(options, undefined, visible, false);
  assert.deepEqual(filter, { kind: "select", values: ["Barba", "Tinte"] });
  assert.deepEqual(model.searchOptions(options, "  "), options);
});

test("boolean columns filter by Sí / No", () => {
  assert.equal(model.filterKindOf(columns[5]), "select");
  assert.deepEqual(model.distinctValues(ventas, columns[5]), ["No", "Sí"]);
  const rows = model.filterRows(ventas, columns, { pagado: { kind: "select", values: ["No"] } });
  assert.deepEqual(
    rows.map((r) => r.cliente),
    ["Bruno"],
  );
});

// ---- pinned rows, details and reorder ------------------------------------------------------

const data = (key) => ({ kind: "data", key, depth: 0, row: { key } });

test("pinned rows are pulled out in pin order and a side toggles", () => {
  let pinned = rowsLib.togglePinnedRow(rowsLib.NO_PINNED_ROWS, "c", "top");
  pinned = rowsLib.togglePinnedRow(pinned, "a", "top");
  pinned = rowsLib.togglePinnedRow(pinned, "e", "bottom");
  const split = rowsLib.splitPinnedRows(["a", "b", "c", "d", "e"].map(data), pinned);
  assert.deepEqual(
    split.top.map((r) => r.key),
    ["c", "a"],
  );
  assert.deepEqual(
    split.middle.map((r) => r.key),
    ["b", "d"],
  );
  assert.deepEqual(
    split.bottom.map((r) => r.key),
    ["e"],
  );
  pinned = rowsLib.togglePinnedRow(pinned, "a", "bottom");
  assert.deepEqual(pinned, { top: ["c"], bottom: ["e", "a"] });
  assert.equal(rowsLib.pinnedSideOf(pinned, "a"), "bottom");
  pinned = rowsLib.togglePinnedRow(pinned, "a", "bottom");
  assert.equal(rowsLib.pinnedSideOf(pinned, "a"), null);
  const missing = rowsLib.splitPinnedRows(["a"].map(data), { top: ["zz"], bottom: [] });
  assert.equal(missing.top.length, 0);
});

test("detail rows follow their expanded data row", () => {
  const out = rowsLib.insertDetailRows(["a", "b", "c"].map(data), new Set(["b"]), () => 120);
  assert.deepEqual(
    out.map((r) => r.key),
    ["a", "b", "b::detail", "c"],
  );
  assert.equal(out[2].height, 120);
  assert.equal(out[2].rowKey, "b");
});

test("row reorder moves by step and next to a target", () => {
  assert.deepEqual(rowsLib.moveRowBy(["a", "b", "c"], "a", 1), ["b", "a", "c"]);
  assert.deepEqual(rowsLib.moveRowBy(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(rowsLib.moveRowTo(["a", "b", "c", "d"], "d", "b", "before"), [
    "a",
    "d",
    "b",
    "c",
  ]);
});

// ---- tree ----------------------------------------------------------------------------------

const nodes = [
  { id: "n", parent: null, nombre: "Norte", total: 0 },
  { id: "n1", parent: "n", nombre: "Miraflores", total: 0 },
  { id: "n1a", parent: "n1", nombre: "Luis", total: 100 },
  { id: "n1b", parent: "n1", nombre: "Ana", total: 60 },
  { id: "n2", parent: "n", nombre: "San Isidro", total: 40 },
  { id: "s", parent: null, nombre: "Sur", total: 10 },
];
const treeColumns = [
  { id: "nombre", header: "Nombre", accessor: "nombre" },
  { id: "total", header: "Total", accessor: "total", type: "number", aggregate: "sum" },
];
const treeOptions = { getKey: (r) => r.id, getParentId: (r) => r.parent };

test("tree rows flatten depth first, collapse and aggregate the leaves below", () => {
  const open = tree.buildTreeRows(nodes, treeColumns, {
    ...treeOptions,
    expanded: new Set(["n", "n1"]),
  });
  assert.deepEqual(
    open.rows.map((r) => `${r.depth}:${r.key}`),
    ["0:n", "1:n1", "2:n1a", "2:n1b", "1:n2", "0:s"],
  );
  assert.equal(open.rows[0].tree.aggregates.total, 200);
  assert.equal(open.rows[1].tree.aggregates.total, 160);
  assert.equal(open.rows[0].tree.hasChildren, true);
  assert.equal(open.rows[2].tree.hasChildren, false);
  assert.deepEqual(
    open.leaves.map((r) => r.id),
    ["n1a", "n1b", "n2", "s"],
  );

  const closed = tree.buildTreeRows(nodes, treeColumns, { ...treeOptions, expanded: new Set() });
  assert.deepEqual(
    closed.rows.map((r) => r.key),
    ["n", "s"],
  );
  assert.equal(closed.rows[0].tree.aggregates.total, 200);

  const forced = tree.buildTreeRows(nodes, treeColumns, {
    ...treeOptions,
    expanded: new Set(),
    forceExpand: true,
  });
  assert.equal(forced.rows.length, 6);
});

test("tree keeps the ancestors of a match and survives cycles and orphans", () => {
  const match = nodes.filter((r) => r.id === "n1b");
  const kept = tree.withAncestors(nodes, match, treeOptions);
  assert.deepEqual(
    kept.map((r) => r.id),
    ["n", "n1", "n1b"],
  );
  const cyclic = [
    { id: "a", parent: "b" },
    { id: "b", parent: "a" },
    { id: "c", parent: "missing" },
  ];
  const result = tree.buildTreeRows(cyclic, [], { ...treeOptions, expanded: new Set(["a", "b"]) });
  assert.deepEqual(
    result.rows.map((r) => r.key),
    ["c"],
  );
});

// ---- range ---------------------------------------------------------------------------------

test("range bounds, membership and keyboard extension", () => {
  const r = { anchor: { r: 3, c: 2 }, focus: { r: 1, c: 4 } };
  assert.deepEqual(range.rangeBounds(r), { r0: 1, r1: 3, c0: 2, c1: 4 });
  assert.equal(range.inRange(r, 2, 3), true);
  assert.equal(range.inRange(r, 4, 3), false);
  assert.equal(range.inRange(null, 1, 1), false);
  const moved = range.extendRange(r, 5, -9, { minR: 1, maxR: 6, minC: 1, maxC: 8 });
  assert.deepEqual(moved, { anchor: { r: 3, c: 2 }, focus: { r: 6, c: 1 } });
});

test("range TSV skips non-data rows and columns and quotes tabs, quotes and line breaks", () => {
  const cells = {
    "1,0": null,
    "1,1": "Luis",
    "1,2": "35",
    "2,0": null,
    "2,1": 'Ana "A"',
    "2,2": "a\tb",
    "3,0": null,
    "3,1": null,
    "3,2": null,
  };
  const tsv = range.rangeToTSV(
    { r0: 1, r1: 3, c0: 0, c1: 2 },
    (r, c) => cells[`${r},${c}`] ?? null,
  );
  assert.equal(tsv, 'Luis\t35\n"Ana ""A"""\t"a\tb"');
});

test("range stats count values and aggregate only numbers", () => {
  const values = { "1,0": 10, "1,1": "x", "2,0": 20.5, "2,1": null, "3,0": 4, "3,1": "" };
  const stats = range.rangeStats({ r0: 1, r1: 3, c0: 0, c1: 1 }, (r, c) => values[`${r},${c}`]);
  assert.deepEqual(stats, { count: 4, numeric: 3, sum: 34.5, avg: 11.5, min: 4, max: 20.5 });
  const none = range.rangeStats({ r0: 1, r1: 1, c0: 1, c1: 1 }, () => "texto");
  assert.equal(none.sum, null);
  assert.equal(none.count, 1);
});

// ---- pivot ---------------------------------------------------------------------------------

test("pivot builds row x column aggregates with exact totals", () => {
  const config = { rows: ["barbero"], column: "servicio", value: "total", aggregate: "sum" };
  assert.equal(pivot.isPivotValid(config, columns), true);
  assert.equal(pivot.isPivotValid({ ...config, rows: [] }, columns), false);
  assert.equal(pivot.isPivotValid({ ...config, column: "nope" }, columns), false);
  const result = pivot.buildPivot(ventas, columns, config);
  assert.deepEqual(result.keys, ["Barba", "Corte"]);
  assert.deepEqual(
    result.rows.map((r) => r.labels.barbero),
    ["Ana", "Luis"],
  );
  assert.deepEqual(result.rows[0].values, { Barba: 25, Corte: 80 });
  assert.equal(result.rows[1].total, 60);
  assert.deepEqual(result.totals, { Barba: 50, Corte: 115 });
  assert.equal(result.grandTotal, 165);

  const avg = pivot.buildPivot(ventas, columns, { ...config, aggregate: "avg" });
  assert.equal(avg.rows[0].values.Corte, 40);
  assert.equal(avg.totals.Corte, (35 + 35 + 45) / 3);
  assert.equal(avg.rows[1].values.Barba, 25);
});

test("pivot with two row fields leaves empty combinations null and builds the grid columns", () => {
  const config = {
    rows: ["barbero", "servicio"],
    column: "pagado",
    value: "total",
    aggregate: "count",
  };
  const result = pivot.buildPivot(ventas, columns, config);
  assert.deepEqual(result.keys, ["No", "Sí"]);
  assert.equal(result.rows.length, 4);
  const barba = result.rows.find(
    (r) => r.labels.barbero === "Ana" && r.labels.servicio === "Barba",
  );
  assert.deepEqual(barba.values, { No: 1, Sí: 0 });
  const cols = pivot.pivotColumns(columns, config, result, "Total");
  assert.deepEqual(
    cols.map((c) => c.id),
    ["pivot-row:barbero", "pivot-row:servicio", "pivot:No", "pivot:Sí", pivot.PIVOT_TOTAL_ID],
  );
  assert.equal(cols[2].accessor(barba), 1);
  assert.equal(pivot.pivotFooter(result)[pivot.PIVOT_TOTAL_ID], 5);
});

// ---- data source ---------------------------------------------------------------------------

test("block cache maps rows to blocks, tracks status and clamps to the total", () => {
  const cache = new source.BlockCache(10, 3);
  assert.deepEqual(cache.blocksFor(5, 25), [0, 1, 2]);
  assert.deepEqual(cache.missing(0, 15), [0, 1]);
  cache.markLoading(0);
  assert.deepEqual(cache.missing(0, 15), [1]);
  assert.equal(cache.isLoading(0, 5), true);
  cache.setBlock(
    0,
    Array.from({ length: 10 }, (_, i) => `r${i}`),
    23,
  );
  assert.equal(cache.total, 23);
  assert.equal(cache.getRow(3), "r3");
  assert.equal(cache.getRow(12), undefined);
  assert.deepEqual(cache.blocksFor(0, 100), [0, 1, 2]);
  assert.deepEqual(cache.blocksFor(30, 40), []);
});

test("block cache evicts least recently used blocks but keeps the visible ones, errors retry on demand", () => {
  const cache = new source.BlockCache(2, 2);
  const rows = (n) => [`a${n}`, `b${n}`];
  cache.setBlock(0, rows(0), 20);
  cache.setBlock(1, rows(1), 20);
  cache.touch([0]);
  cache.setBlock(2, rows(2), 20);
  assert.deepEqual(cache.loadedBlocks().sort(), [0, 2]);
  assert.equal(cache.getRow(2), undefined);
  cache.setBlock(3, rows(3), 20, [0]);
  assert.deepEqual(cache.loadedBlocks().sort(), [0, 3]);

  cache.markError(5);
  assert.equal(cache.hasError(10, 12), true);
  assert.deepEqual(cache.missing(10, 12), []);
  cache.retry(10, 12);
  assert.deepEqual(cache.missing(10, 12), [5]);
  cache.clear();
  assert.equal(cache.total, null);
  assert.equal(cache.loadedBlocks().length, 0);
});

// ---- filter builder ------------------------------------------------------------------------

function condition(columnId, operator, value, value2) {
  return {
    type: "condition",
    id: `${columnId}-${operator}-${value}`,
    columnId,
    operator,
    value,
    value2,
  };
}
const group = (logic, ...children) => ({
  type: "group",
  id: `g-${logic}-${children.length}`,
  logic,
  children,
});
const names = (list) => list.map((r) => r.cliente);

test("operators depend on the column kind", () => {
  assert.ok(fb.operatorsFor(columns[0]).includes("contains"));
  assert.ok(fb.operatorsFor(columns[3]).includes("between"));
  assert.ok(fb.operatorsFor(columns[4]).includes("before"));
  assert.deepEqual(fb.operatorsFor(columns[5]), ["equals", "notEquals", "isEmpty", "isNotEmpty"]);
  assert.equal(fb.operatorNeedsValue("isEmpty"), false);
});

test("AND / OR groups of conditions filter rows and ignore incomplete conditions", () => {
  const and = group("and", condition("barbero", "equals", "Ana"), condition("total", "gt", "30"));
  assert.deepEqual(names(fb.applyAdvancedFilter(ventas, columns, and)), ["Diego", "Eduardo"]);

  const or = group("or", condition("cliente", "startsWith", "á"), condition("total", "lt", "26"));
  assert.deepEqual(names(fb.applyAdvancedFilter(ventas, columns, or)), [
    "Álvaro",
    "Bruno",
    "César",
  ]);

  const nested = group(
    "and",
    condition("servicio", "equals", "Corte"),
    group("or", condition("barbero", "equals", "Luis"), condition("total", "gte", "45")),
  );
  assert.deepEqual(names(fb.applyAdvancedFilter(ventas, columns, nested)), ["Álvaro", "Eduardo"]);

  const incomplete = group("and", condition("cliente", "contains", ""));
  assert.equal(fb.isNodeActive(incomplete), false);
  assert.equal(fb.applyAdvancedFilter(ventas, columns, incomplete).length, ventas.length);
  assert.equal(fb.countConditions(nested), 3);
});

test("number between, date comparisons and empty checks", () => {
  const between = group("and", condition("total", "between", "30", "40"));
  assert.deepEqual(names(fb.applyAdvancedFilter(ventas, columns, between)), ["Álvaro", "Diego"]);
  const reversed = group("and", condition("total", "between", "40", "30"));
  assert.equal(fb.applyAdvancedFilter(ventas, columns, reversed).length, 2);

  const onDay = group("and", condition("fecha", "equals", "2026-10-09"));
  assert.deepEqual(names(fb.applyAdvancedFilter(ventas, columns, onDay)), ["Diego", "Eduardo"]);
  const before = group("and", condition("fecha", "before", "2026-10-08"));
  assert.deepEqual(names(fb.applyAdvancedFilter(ventas, columns, before)), ["Álvaro", "Bruno"]);
  const span = group("and", condition("fecha", "between", "2026-10-07", "2026-10-08"));
  assert.deepEqual(names(fb.applyAdvancedFilter(ventas, columns, span)), ["Bruno", "César"]);

  const rows = [
    { cliente: "x", total: null },
    { cliente: "y", total: 5 },
  ];
  const empty = group("and", {
    type: "condition",
    id: "e",
    columnId: "total",
    operator: "isEmpty",
    value: "",
  });
  assert.deepEqual(names(fb.applyAdvancedFilter(rows, columns, empty)), ["x"]);
});

test("filter tree edits are immutable and describe reads back", () => {
  const root = fb.emptyGroup("and", "root");
  const a = condition("barbero", "equals", "Luis");
  const inner = { ...group("or"), id: "inner" };
  let next = fb.addChild(root, "root", a);
  next = fb.addChild(next, "root", inner);
  next = fb.addChild(next, "inner", condition("total", "gt", "30"));
  assert.equal(root.children.length, 0);
  assert.equal(next.children.length, 2);
  assert.equal(next.children[1].children.length, 1);
  next = fb.updateNode(next, "inner", (node) => ({ ...node, logic: "and" }));
  assert.equal(next.children[1].logic, "and");
  const words = { and: "Y", or: "O", operators: { equals: "es", gt: ">" } };
  assert.equal(fb.describeFilter(next, columns, words), "(Barbero es Luis Y Total > 30)");
  next = fb.removeNode(next, a.id);
  assert.equal(next.children.length, 1);
  next = fb.removeNode(next, "root");
  assert.equal(next.id, "root");
});

// ---- header groups and variable windows ----------------------------------------------------

test("column groups share a header across adjacent columns and stop at zone breaks", () => {
  const paths = [
    [],
    ["Cliente"],
    ["Cliente"],
    ["Importes", "Neto"],
    ["Importes", "Neto"],
    ["Importes", "IGV"],
  ];
  const levels = groups.buildHeaderGroups(paths);
  assert.equal(levels.length, 2);
  assert.deepEqual(levels[0], [
    { label: "", start: 0, span: 1 },
    { label: "Cliente", start: 1, span: 2 },
    { label: "Importes", start: 3, span: 3 },
  ]);
  assert.deepEqual(levels[1], [
    { label: "", start: 0, span: 1 },
    { label: "", start: 1, span: 2 },
    { label: "Neto", start: 3, span: 2 },
    { label: "IGV", start: 5, span: 1 },
  ]);
  const split = groups.buildHeaderGroups(paths, [2]);
  assert.deepEqual(split[0].slice(1, 3), [
    { label: "Cliente", start: 1, span: 1 },
    { label: "Cliente", start: 2, span: 1 },
  ]);
  assert.deepEqual(groups.buildHeaderGroups([[], []]), []);
  assert.deepEqual(groups.groupPathOf({ group: "A" }), ["A"]);
  assert.deepEqual(groups.groupPathOf({}), []);
});

test("variable window follows uneven heights and clamps at the ends", () => {
  const heights = [40, 40, 200, 40, 40, 40, 40];
  const top = virtual.computeVariableWindow({
    heights,
    viewportHeight: 100,
    scrollTop: 0,
    overscan: 0,
  });
  assert.equal(top.start, 0);
  assert.equal(top.end, 3);
  assert.equal(top.totalHeight, 440);
  assert.deepEqual(top.offsets.slice(0, 4), [0, 40, 80, 280]);
  const mid = virtual.computeVariableWindow({
    heights,
    viewportHeight: 100,
    scrollTop: 150,
    overscan: 0,
  });
  assert.equal(mid.start, 2);
  const end = virtual.computeVariableWindow({
    heights,
    viewportHeight: 100,
    scrollTop: 9999,
    overscan: 1,
  });
  assert.equal(end.end, 7);
  assert.equal(end.start, 3);
  assert.deepEqual(
    virtual.computeVariableWindow({ heights: [], viewportHeight: 100, scrollTop: 0 }).end,
    0,
  );
});

test("scrollTopToRevealSpan keeps a row clear of pinned rows", () => {
  assert.equal(virtual.scrollTopToRevealSpan(200, 40, 300, 0), 0);
  assert.equal(virtual.scrollTopToRevealSpan(320, 40, 300, 0), 60);
  assert.equal(virtual.scrollTopToRevealSpan(40, 40, 300, 100, 80), 0);
  assert.equal(virtual.scrollTopToRevealSpan(150, 40, 300, 100, 80), 70);
  assert.equal(virtual.scrollTopToRevealSpan(320, 40, 300, 0, 0, 80), 140);
  assert.equal(virtual.scrollTopToRevealSpan(100, 40, 300, 0, 40, 40), 0);
});
