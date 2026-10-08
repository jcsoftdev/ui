// Pure logic behind integrated charts of DataGrid: cell range to chart series.
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

const chart = await load("../src/containers/data-grid/chart-range.ts");

const cell = (value, text = String(value ?? "")) => ({ value, text });

test("a text column names the categories and numeric columns become series", () => {
  const data = chart.rangeToChart({
    headers: ["Barbero", "Cortes", "Ingresos"],
    columnIds: ["barbero", "cortes", "ingresos"],
    cells: [
      [cell("Luis"), cell(40), cell(1400)],
      [cell("Ana"), cell(32), cell(1180)],
      [cell("Marco"), cell(null), cell(950.5)],
    ],
  });
  assert.deepEqual(data.categories, ["Luis", "Ana", "Marco"]);
  assert.equal(data.categoryHeader, "Barbero");
  assert.deepEqual(
    data.series.map((s) => [s.id, s.name, s.data]),
    [
      ["cortes", "Cortes", [40, 32, null]],
      ["ingresos", "Ingresos", [1400, 1180, 950.5]],
    ],
  );
});

test("the category column can be anywhere in the range and dates use their shown text", () => {
  const data = chart.rangeToChart({
    headers: ["Total", "Fecha"],
    columnIds: ["total", "fecha"],
    cells: [
      [cell(35), cell(new Date(2026, 9, 6), "6 oct 2026")],
      [cell(50), cell(new Date(2026, 9, 7), "7 oct 2026")],
    ],
  });
  assert.deepEqual(data.categories, ["6 oct 2026", "7 oct 2026"]);
  assert.equal(data.series.length, 1);
});

test("without a text column the categories are numbered rows", () => {
  const data = chart.rangeToChart({
    headers: ["A", "B"],
    columnIds: ["a", "b"],
    cells: [
      [cell(1), cell(2)],
      [cell(3), cell(4)],
    ],
    rowLabel: (n) => `Fila ${n}`,
  });
  assert.deepEqual(data.categories, ["Fila 1", "Fila 2"]);
  assert.equal(data.categoryHeader, null);
  assert.equal(data.series.length, 2);
});

test("rows and columns that are not data cells are skipped, and nothing numeric gives null", () => {
  const data = chart.rangeToChart({
    headers: ["Sel", "Cliente", "Total"],
    columnIds: ["__select", "cliente", "total"],
    cells: [
      [null, cell("Álvaro"), cell(35)],
      [null, null, null],
      [null, cell("Bruno"), cell(50)],
    ],
  });
  assert.deepEqual(data.categories, ["Álvaro", "Bruno"]);
  assert.deepEqual(
    data.series.map((s) => s.id),
    ["total"],
  );
  assert.equal(
    chart.rangeToChart({
      headers: ["Cliente"],
      columnIds: ["cliente"],
      cells: [[cell("Álvaro")], [cell("Bruno")]],
    }),
    null,
  );
  assert.equal(chart.rangeToChart({ headers: [], columnIds: [], cells: [] }), null);
});

test("a mostly numeric column with a stray error text is still a series", () => {
  const data = chart.rangeToChart({
    headers: ["Concepto", "Valor"],
    columnIds: ["concepto", "valor"],
    cells: [
      [cell("a"), cell(1)],
      [cell("b"), cell(2)],
      [cell("c"), cell("#DIV/0!")],
    ],
  });
  assert.deepEqual(data.series[0].data, [1, 2, null]);
});

test("pieSlices keeps positive values largest first and groups the smallest as Otros", () => {
  const data = {
    categories: ["a", "b", "c", "d", "e", "f"],
    categoryHeader: "x",
    series: [{ id: "s", name: "S", data: [5, 0, 30, null, 20, 10] }],
  };
  assert.deepEqual(
    chart.pieSlices(data).map((s) => [s.name, s.value]),
    [
      ["c", 30],
      ["e", 20],
      ["f", 10],
      ["a", 5],
    ],
  );
  const grouped = chart.pieSlices(data, 0, 3, "Resto");
  assert.deepEqual(
    grouped.map((s) => [s.name, s.value]),
    [
      ["c", 30],
      ["e", 20],
      ["Resto", 15],
    ],
  );
  assert.deepEqual(chart.pieSlices(data, 4), []);
});

test("availableKinds hides the charts the data cannot fill", () => {
  const base = { categoryHeader: null, series: [{ id: "s", name: "S", data: [3, 4] }] };
  assert.deepEqual(chart.availableKinds({ ...base, categories: ["a", "b"] }), [
    "bar",
    "line",
    "area",
    "pie",
  ]);
  assert.deepEqual(
    chart.availableKinds({
      categories: ["a"],
      categoryHeader: null,
      series: [{ id: "s", name: "S", data: [3] }],
    }),
    ["bar"],
  );
  assert.deepEqual(
    chart.availableKinds({
      categories: ["a", "b"],
      categoryHeader: null,
      series: [{ id: "s", name: "S", data: [-3, 4] }],
    }),
    ["bar", "line", "area"],
  );
});
