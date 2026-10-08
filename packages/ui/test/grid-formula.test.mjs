// Pure logic behind spreadsheet formulas in DataGrid: parser, evaluator, sheet and recalculation.
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

const f = await load("../src/containers/data-grid/formula.ts");
const sheetLib = await load("../src/containers/data-grid/formula-sheet.ts");

/** Builds a sheet from an array of rows and returns a reader of displayed values. */
function sheetOf(table) {
  const rows = table.length;
  const cols = Math.max(...table.map((line) => line.length));
  const sheet = sheetLib.buildSheet({ rows, cols, read: (r, c) => table[r]?.[c] });
  return sheet;
}
const show = (sheet, address) => {
  const ref = f.parseAddress(address);
  return sheetLib.displayValue(sheet, ref.r, ref.c) ?? sheetLib.sheetValue(sheet, ref.r, ref.c);
};
/** Evaluates one formula typed in an otherwise empty 10 x 10 sheet filled with `cells`. */
function calc(text, cells = {}) {
  const table = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => null));
  for (const [address, value] of Object.entries(cells)) {
    const ref = f.parseAddress(address);
    table[ref.r][ref.c] = value;
  }
  table[9][9] = text;
  return show(sheetOf(table), "J10");
}

test("column labels and addresses round trip", () => {
  assert.equal(f.columnLabel(0), "A");
  assert.equal(f.columnLabel(25), "Z");
  assert.equal(f.columnLabel(26), "AA");
  assert.equal(f.columnLabel(701), "ZZ");
  assert.equal(f.columnIndex("AA"), 26);
  assert.equal(f.columnIndex("a"), 0);
  assert.equal(f.columnIndex("A1"), -1);
  assert.equal(f.cellAddress(2, 1), "B3");
  assert.deepEqual(f.parseAddress("$C$4"), { r: 3, c: 2, absR: true, absC: true });
  assert.deepEqual(f.parseAddress("R2C3"), { r: 1, c: 2, absR: true, absC: true });
  assert.equal(f.parseAddress("A0"), null);
  assert.equal(f.parseAddress("SUM"), null);
});

test("arithmetic follows spreadsheet precedence", () => {
  assert.equal(calc("=1+2*3"), 7);
  assert.equal(calc("=(1+2)*3"), 9);
  assert.equal(calc("=2^3^2"), 64);
  assert.equal(calc("=-2^2"), 4);
  assert.equal(calc("=10-4-3"), 3);
  assert.equal(calc("=8/4/2"), 1);
  assert.equal(calc("=0.1+0.2"), 0.3);
  assert.equal(calc("=1e3+1"), 1001);
  assert.equal(calc("=--5"), 5);
});

test("strings, concatenation and comparisons", () => {
  assert.equal(calc('="a"&"b"&1'), "ab1");
  assert.equal(calc('="di ""hola"""'), 'di "hola"');
  assert.equal(calc('="ABC"="abc"'), true);
  assert.equal(calc("=2<3"), true);
  assert.equal(calc("=2<>2"), false);
  assert.equal(calc("=3>=3"), true);
  assert.equal(calc('="a"<"b"'), true);
  assert.equal(calc('="a">5'), true);
  assert.equal(calc("=1+1=2"), true);
  assert.equal(calc("=1&2+3"), "15");
});

test("references read cells by column letter and row number, relative to the data", () => {
  const cells = { A1: 10, B1: 5, A2: 3 };
  assert.equal(calc("=A1+B1", cells), 15);
  assert.equal(calc("=$A$1*A2", cells), 30);
  assert.equal(calc("=R1C1+R2C1", cells), 13);
  assert.equal(calc("=A5", cells), 0);
  assert.equal(calc('=A5&"x"', cells), "x");
});

test("ranges feed SUM, AVERAGE, MIN, MAX and COUNT; text and blanks are ignored", () => {
  const cells = { A1: 4, A2: 6, A3: "texto", A4: null, A5: 10, B1: true };
  assert.equal(calc("=SUM(A1:A5)", cells), 20);
  assert.equal(calc("=AVERAGE(A1:A5)", cells), Number((20 / 3).toPrecision(15)));
  assert.equal(calc("=MIN(A1:A5)", cells), 4);
  assert.equal(calc("=MAX(A1:A5, 50)", cells), 50);
  assert.equal(calc("=COUNT(A1:A5)", cells), 3);
  assert.equal(calc("=SUM(A1:A2, 1, B1:B1)", cells), 11);
  assert.equal(calc("=SUM(B2:C3)"), 0);
  assert.equal(calc("=MIN(B2:C3)"), 0);
  assert.equal(calc("=sum(a1:a2)", cells), 10);
  assert.equal(calc("=SUM(C1:A2)", { A1: 1, B1: 2, C1: 3, A2: 4 }), 10);
});

test("IF is lazy, ROUND rounds half away from zero, ABS and CONCAT", () => {
  assert.equal(calc('=IF(A1>5,"alto","bajo")', { A1: 9 }), "alto");
  assert.equal(calc('=IF(A1>5,"alto","bajo")', { A1: 1 }), "bajo");
  assert.equal(calc("=IF(1>2,1)"), false);
  assert.equal(calc("=IF(1,5,1/0)"), 5);
  assert.equal(calc("=ROUND(2.5)"), 3);
  assert.equal(calc("=ROUND(-2.5)"), -3);
  assert.equal(calc("=ROUND(1.005,2)"), 1.01);
  assert.equal(calc("=ROUND(1234.567,-2)"), 1200);
  assert.equal(calc("=ABS(-4.5)"), 4.5);
  assert.equal(calc('=CONCAT("a",1,TRUE,A1:A2)', { A1: "x", A2: 2 }), "a1TRUEx2");
  assert.equal(calc("=SUM(1,IF(TRUE,2,3))"), 3);
});

test("errors: #REF!, #DIV/0!, #NAME?, #VALUE! and syntax problems", () => {
  assert.equal(calc("=A99"), "#REF!");
  assert.equal(calc("=SUM(A1:Z99)"), "#REF!");
  assert.equal(calc("=1/0"), "#DIV/0!");
  assert.equal(calc("=AVERAGE(A1:A2)"), "#DIV/0!");
  assert.equal(calc("=NOPE(1)"), "#NAME?");
  assert.equal(calc("=foo+1"), "#NAME?");
  assert.equal(calc('="a"+1'), "#VALUE!");
  assert.equal(calc("=A1:A2"), "#VALUE!");
  assert.equal(calc("=1+"), "#ERROR!");
  assert.equal(calc("=(1+2"), "#ERROR!");
  assert.equal(calc('="abierto'), "#ERROR!");
  assert.equal(calc("=SUM(1,)"), "#ERROR!");
  assert.equal(calc("=3 4"), "#ERROR!");
});

test("errors propagate through operators, functions and references", () => {
  assert.equal(calc("=1/0+1"), "#DIV/0!");
  assert.equal(calc("=SUM(A1,2)", { A1: "=1/0" }), "#DIV/0!");
  assert.equal(calc("=SUM(A1:A2)", { A1: 1, A2: "=NOPE()" }), "#NAME?");
  assert.equal(calc("=A1&A2", { A1: "=1/0", A2: "x" }), "#DIV/0!");
  assert.equal(calc("=IF(1/0,1,2)"), "#DIV/0!");
});

test("numeric text counts as a number in arithmetic", () => {
  assert.equal(calc("=A1*2", { A1: "21" }), 42);
  assert.equal(calc('=A1+""', { A1: 1 }), "#VALUE!");
});

test("a sheet recalculates dependents in order, whatever the cell order", () => {
  const sheet = sheetOf([
    ["=B1+1", "=C1*2", 5],
    ["=SUM(A1:C1)", null, null],
  ]);
  assert.equal(show(sheet, "C1"), 5);
  assert.equal(show(sheet, "B1"), 10);
  assert.equal(show(sheet, "A1"), 11);
  assert.equal(show(sheet, "A2"), 26);
});

test("dates read as ISO text inside formulas", () => {
  const sheet = sheetOf([[new Date(2026, 9, 6), '=A1&""', '=A1<"2026-10-08"']]);
  assert.equal(show(sheet, "B1"), "2026-10-06");
  assert.equal(show(sheet, "C1"), true);
});

test("cycles are #CYCLE! for every cell on the loop and for what reads them", () => {
  const sheet = sheetOf([
    ["=B1", "=A1", "=A1+1", "=D1", 7],
    ["=A2+1", null, null, null, null],
  ]);
  assert.equal(show(sheet, "A1"), "#CYCLE!");
  assert.equal(show(sheet, "B1"), "#CYCLE!");
  assert.equal(show(sheet, "C1"), "#CYCLE!");
  assert.equal(show(sheet, "D1"), "#CYCLE!");
  assert.equal(show(sheet, "A2"), "#CYCLE!");
  assert.equal(show(sheet, "E1"), 7);
});

test("a cycle hidden in an untaken IF branch is still a cycle", () => {
  const sheet = sheetOf([["=IF(TRUE,1,B1)", "=A1"]]);
  assert.equal(show(sheet, "A1"), "#CYCLE!");
  assert.equal(show(sheet, "B1"), "#CYCLE!");
});

test("long dependency chains do not overflow the stack", () => {
  const n = 20000;
  const table = Array.from({ length: n }, (_, i) => [i === 0 ? 1 : `=A${i}+1`]);
  const sheet = sheetOf(table);
  assert.equal(sheetLib.sheetValue(sheet, n - 1, 0), n);
});

test("updateCell recalculates only dependents and keeps the old sheet intact", () => {
  const table = [[1, "=A1*2", "=B1+A1", 100]];
  const sheet = sheetOf(table);
  const next = sheetLib.updateCell(sheet, 0, 0, 10);
  assert.equal(show(next, "B1"), 20);
  assert.equal(show(next, "C1"), 30);
  assert.equal(show(sheet, "B1"), 2);
  assert.deepEqual([...sheetLib.dirtyCells(sheet, 0)].sort(), [0, 1, 2]);
  assert.equal(sheetLib.dirtyCells(sheet, 3).size, 1);
});

test("updateCell can create a formula, replace it with a value and break a cycle", () => {
  let sheet = sheetOf([[1, 2, 3]]);
  sheet = sheetLib.updateCell(sheet, 0, 2, "=A1+B1");
  assert.equal(show(sheet, "C1"), 3);
  sheet = sheetLib.updateCell(sheet, 0, 0, "=C1");
  assert.equal(show(sheet, "A1"), "#CYCLE!");
  assert.equal(show(sheet, "C1"), "#CYCLE!");
  sheet = sheetLib.updateCell(sheet, 0, 0, 5);
  assert.equal(show(sheet, "A1"), 5);
  assert.equal(show(sheet, "C1"), 7);
  sheet = sheetLib.updateCell(sheet, 0, 2, 9);
  assert.equal(show(sheet, "C1"), 9);
  assert.equal(sheet.formulas.size, 0);
  assert.deepEqual(sheetLib.precedentsOf(sheetOf([[1, "=A1+A1"]]), 0, 1), [[0, 0]]);
});

test("the parse cache is reused between builds", () => {
  const cache = new Map();
  const read = (r, c) => (c === 0 ? 4 : "=A1*A1");
  sheetLib.buildSheet({ rows: 1, cols: 2, read, cache });
  assert.equal(cache.size, 1);
  assert.equal(cache.get("=A1*A1").error, null);
});

test("shiftFormula moves relative references and keeps $ ones", () => {
  assert.equal(f.shiftFormula("=A1+B2", 1, 0), "=A2+B3");
  assert.equal(f.shiftFormula("=$A$1+B2", 2, 1), "=$A$1+C4");
  assert.equal(f.shiftFormula("=SUM(A1:A3)*2", 0, 1), "=SUM(B1:B3)*2");
  assert.equal(f.shiftFormula("=A$1+$B2", 3, 3), "=D$1+$B5");
  assert.equal(f.shiftFormula("=A1", -1, 0), "=#REF!");
  assert.equal(f.shiftFormula('=CONCAT("A1",A1)', 1, 0), '=CONCAT("A1",A2)');
  assert.equal(f.shiftFormula("= A1 + B1", 0, 1), "= B1 + C1");
  assert.equal(f.shiftFormula("=R1C1+A1", 1, 1), "=R1C1+B2");
});

test("FORMULA_FUNCTIONS lists the supported functions", () => {
  assert.deepEqual(
    [...f.FORMULA_FUNCTIONS].sort(),
    ["ABS", "AVERAGE", "CONCAT", "COUNT", "IF", "MAX", "MIN", "ROUND", "SUM"].sort(),
  );
});
