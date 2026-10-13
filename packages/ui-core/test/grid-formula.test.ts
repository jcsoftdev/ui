import { describe, expect, it } from "vitest";
import * as f from "../src/grid/formula.ts";
import type { CellValue } from "../src/grid/model.ts";

// The React grid is the reference; it is loaded by path so this file does not type-check it.
// biome-ignore lint/suspicious/noExplicitAny: the reference modules are untyped here.
const load = (name: string): Promise<any> =>
  import(
    /* @vite-ignore */ new URL(`../../ui/src/containers/data-grid/${name}.ts`, import.meta.url).href
  );
const react = await load("formula");
const sheetReact = await load("formula-sheet");

const make = (data: CellValue[][]) => {
  const read = (r: number, c: number): CellValue => data[r]?.[c] ?? null;
  const cols = Math.max(...data.map((row) => row.length));
  return { rows: data.length, cols, read, data };
};
const value = (sheet: f.FormulaSheet, a: string): f.FormulaValue => {
  const ref = f.parseAddress(a);
  if (!ref) throw new Error(a);
  return f.sheetValue(sheet, ref.r, ref.c);
};
// biome-ignore lint/suspicious/noExplicitAny: error values come from two implementations.
const shown = (v: any) => (v && typeof v === "object" && "code" in v ? v.code : v);

describe("addresses", () => {
  it("converts column labels both ways", () => {
    for (const n of [0, 1, 25, 26, 27, 51, 52, 701, 702, 703]) {
      expect(f.columnIndex(f.columnLabel(n))).toBe(n);
      expect(f.columnLabel(n)).toBe(react.columnLabel(n));
    }
    expect(f.cellAddress(0, 0)).toBe("A1");
    expect(f.cellAddress(9, 27)).toBe("AB10");
  });
  it("parses addresses with and without anchors", () => {
    expect(f.parseAddress("B3")).toMatchObject({ r: 2, c: 1 });
    expect(f.parseAddress("$B$3")).toMatchObject({ r: 2, c: 1 });
    expect(f.parseAddress("nope")).toBeNull();
  });
});

describe("evaluation", () => {
  const sheet = f.buildSheet(
    make([
      [1, 2, 3, "=A1+B1*C1"],
      [10, 20, 30, "=SUM(A1:C2)"],
      [4, "x", null, "=AVG(A2:C2)"],
      ["=MIN(A1:A3)", "=MAX(A1:A3)", "=COUNT(A1:C3)", "=IF(A1>0,10,20)"],
    ]),
  );
  it("keeps operator precedence and parentheses", () => {
    expect(value(sheet, "D1")).toBe(7);
    const s = f.buildSheet(make([["=(1+2)*3", "=2+3*4", "=-(2+1)", "=10/4", "=1/0"]]));
    expect(value(s, "A1")).toBe(9);
    expect(value(s, "B1")).toBe(14);
    expect(value(s, "C1")).toBe(-3);
    expect(value(s, "D1")).toBe(2.5);
    expect(shown(value(s, "E1"))).toBe("#DIV/0!");
  });
  it("sums, averages and counts ranges, skipping text", () => {
    expect(value(sheet, "D2")).toBe(66);
    expect(value(sheet, "D3")).toBe(20);
    expect(value(sheet, "A4")).toBe(1);
    expect(value(sheet, "B4")).toBe(10);
    expect(value(sheet, "D4")).toBe(10);
  });
  it("reports unknown names, bad syntax and out-of-range refs", () => {
    const s = f.buildSheet(make([["=FOO(1)", "=1+", "=Z99", "=SUM(", "text"]]));
    expect(shown(value(s, "A1"))).toBe("#NAME?");
    expect(shown(value(s, "B1"))).toBe("#ERROR!");
    expect(shown(value(s, "C1"))).toBe("#REF!");
    expect(shown(value(s, "D1"))).toBe("#ERROR!");
    expect(f.displayValue(s, 0, 4)).toBeUndefined();
    expect(f.displayValue(s, 0, 2)).toBe("#REF!");
  });
  it("detects cycles and propagates them", () => {
    const s = f.buildSheet(make([["=B1", "=A1", "=A1+1", "=SUM(D1)"]]));
    expect(shown(value(s, "A1"))).toBe("#CYCLE!");
    expect(shown(value(s, "B1"))).toBe("#CYCLE!");
    expect(shown(value(s, "C1"))).toBe("#CYCLE!");
    expect(shown(value(s, "D1"))).toBe("#CYCLE!");
  });
  it("matches the React evaluator on golden formulas", () => {
    const data: CellValue[][] = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      ["=A1+B2", "=SUM(A1:D2)/COUNT(A1:D2)", "=IF(A2>B2,1,0)", "=MAX(A1:D2)-MIN(A1:D2)"],
      ["=C3*2", "=(A1+B1)*(C1-D1)", "=A1/0", "=SUM(A1:A2,C1:C2)"],
    ];
    const mine = f.buildSheet(make(data));
    const theirs = sheetReact.buildSheet(make(data));
    for (let r = 2; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const a = shown(f.sheetValue(mine, r, c));
        const b = shown(sheetReact.sheetValue(theirs, r, c) as f.FormulaValue);
        expect(a).toEqual(b);
      }
    }
  });
});

describe("shiftFormula", () => {
  it("moves relative references and keeps anchored ones", () => {
    expect(f.shiftFormula("=A1+$B$2+A$3+$C4", 1, 1)).toBe(
      react.shiftFormula("=A1+$B$2+A$3+$C4", 1, 1),
    );
    expect(f.shiftFormula("=A1+B1", 2, 0)).toBe("=A3+B3");
    expect(f.shiftFormula("=SUM(A1:A3)", 0, 1)).toBe("=SUM(B1:B3)");
  });
  it("turns a shift off the sheet into #REF!", () => {
    expect(f.shiftFormula("=A1", -1, 0)).toContain("#REF!");
  });
});

describe("recalculation", () => {
  it("updateCell and updateCells match a rebuild", () => {
    const data: CellValue[][] = [
      [1, 2, "=A1+B1", "=C1*2"],
      [3, 4, "=A2+B2", "=SUM(C1:C2)"],
    ];
    const base = make(data);
    let sheet = f.buildSheet(base);
    data[0]![0] = 10;
    sheet = f.updateCells(sheet, [[0, 0]]);
    expect(value(sheet, "C1")).toBe(12);
    expect(value(sheet, "D1")).toBe(24);
    expect(value(sheet, "D2")).toBe(19);
    data[1]![2] = "=A1";
    data[0]![1] = "=A2";
    sheet = f.updateCells(sheet, [
      [1, 2],
      [0, 1],
    ]);
    const fresh = f.buildSheet(make(data));
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 4; c++)
        expect(shown(f.sheetValue(sheet, r, c))).toEqual(shown(f.sheetValue(fresh, r, c)));
    // a formula replaced by a plain value stops being a formula
    data[0]![2] = 5;
    sheet = f.updateCells(sheet, [[0, 2]]);
    expect(f.displayValue(sheet, 0, 2)).toBeUndefined();
    expect(value(sheet, "D1")).toBe(10);
  });
  it("reports the cells a formula reads", () => {
    const s = f.buildSheet(make([[1, 2, "=SUM(A1:B1)"]]));
    expect(f.precedentsOf(s, 0, 2)).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });
});

describe("review fixes", () => {
  const evalText = (text: string) => {
    const s = f.buildSheet(make([[text]]));
    return shown(f.sheetValue(s, 0, 0));
  };
  it("survives deep nesting, long chains and long comparisons without a stack overflow", () => {
    expect(evalText(`=${"SUM(".repeat(500)}1${")".repeat(500)}`)).toBe("#ERROR!");
    expect(evalText(`=${Array(10000).fill("1").join("+")}`)).toBe("#ERROR!");
    expect(evalText(`=${Array(10000).fill("1").join("=")}`)).toBe("#ERROR!");
    expect(evalText(`=${"(".repeat(5000)}1${")".repeat(5000)}`)).toBe("#ERROR!");
    expect(evalText("=SUM(1,2)+3")).toBe(6);
  });
  it("one failing formula does not break the others", () => {
    const deep = `=${"SUM(".repeat(500)}1${")".repeat(500)}`;
    const s = f.buildSheet(make([[1, deep, "=A1+1"]]));
    expect(shown(f.sheetValue(s, 0, 1))).toBe("#ERROR!");
    expect(f.sheetValue(s, 0, 2)).toBe(2);
  });
  it("MIN, MAX and SUM read 200k-cell ranges", () => {
    const n = 200_000;
    const data: CellValue[][] = Array.from({ length: n }, (_, i) => [i + 1]);
    data[0]![1] = `=MIN(A1:A${n})`;
    data[0]![2] = `=MAX(A1:A${n})`;
    data[0]![3] = `=SUM(A1:A${n})`;
    const s = f.buildSheet({ rows: n, cols: 4, read: (r, c) => data[r]?.[c] ?? null });
    expect(f.sheetValue(s, 0, 1)).toBe(1);
    expect(f.sheetValue(s, 0, 2)).toBe(n);
    expect(f.sheetValue(s, 0, 3)).toBe((n * (n + 1)) / 2);
  });
  it("a huge range costs no memory per cell", () => {
    const rows = 100_000;
    const heads: CellValue[] = Array.from({ length: 5 }, () => "=SUM(A1:Z100000)");
    const s = f.buildSheet({
      rows,
      cols: 26,
      read: (r, c) => (r === 0 && c < 5 ? heads[c]! : r === 0 ? null : null),
    });
    // formulas sit inside their own range: cycle, but it terminates and stores no per-cell graph
    expect(s.dependents.size).toBe(0);
    expect(s.formulas.size).toBe(5);
    expect(shown(f.sheetValue(s, 0, 0))).toBe("#CYCLE!");
  });
  it("1000 sums over one range recalculate fast after an edit", () => {
    const n = 10_000;
    const data: CellValue[][] = Array.from({ length: n }, (_, i) => [i % 7, null]);
    for (let i = 0; i < 1000; i++) data[i]![1] = "=SUM(A$1:A$10000)";
    const s = f.buildSheet({ rows: n, cols: 2, read: (r, c) => data[r]?.[c] ?? null });
    const total = data.reduce((a, row) => a + (row[0] as number), 0);
    expect(f.sheetValue(s, 999, 1)).toBe(total);
    data[5]![0] = 1000;
    const t = performance.now();
    f.updateCells(s, [[5, 0]]);
    expect(performance.now() - t).toBeLessThan(100);
    expect(f.sheetValue(s, 999, 1)).toBe(total - (5 % 7) + 1000);
  });
  it("only real numbers parse, and overflow is #NUM!", () => {
    expect(evalText('="0x10"+1')).toBe("#VALUE!");
    expect(evalText('="1e3"+1')).toBe(1001);
    expect(evalText("=10^1000")).toBe("#NUM!");
    expect(evalText("=0^-1")).toBe("#NUM!");
  });
  it("unknown names that match Object.prototype are #NAME?", () => {
    expect(evalText("=constructor(1)")).toBe("#NAME?");
    expect(evalText("=__proto__(1)")).toBe("#NAME?");
    expect(evalText("=toString(1)")).toBe("#NAME?");
  });
  it("shiftFormula writes a #REF! that parses back to #REF!", () => {
    const text = f.shiftFormula("=A1+B2", -1, 0);
    expect(text).toBe("=#REF!+B1");
    expect(evalText(text)).toBe("#REF!");
  });
  it("rewrites references when rows are inserted or removed", () => {
    const ins = { kind: "insert", at: 2, count: 1 } as const;
    expect(f.adjustRows("=A1+A3+$B$5", ins)).toBe("=A1+A4+$B$6");
    expect(f.adjustRows("=SUM(A1:A5)", ins)).toBe("=SUM(A1:A6)");
    expect(f.adjustRows("=SUM(A3:A5)", ins)).toBe("=SUM(A4:A6)");
    const rem = { kind: "remove", at: 1, count: 2 } as const;
    expect(f.adjustRows("=A1+A2+A4", rem)).toBe("=A1+#REF!+A2");
    expect(f.adjustRows("=SUM(A1:A5)", rem)).toBe("=SUM(A1:A3)");
    expect(f.adjustRows("=SUM(A2:A3)", rem)).toBe("=SUM(#REF!)");
    expect(f.adjustRows("=SUM(A2:A5)", rem)).toBe("=SUM(A2:A3)");
    expect(f.adjustRows('="A9"&A9', rem)).toBe('="A9"&A7');
  });
  it("dirtyCells follows ranges and chains", () => {
    const s = f.buildSheet(
      make([
        [1, "=A1*2", "=SUM(B1:B1)"],
        [2, null, null],
      ]),
    );
    expect([...f.dirtyCells(s, [0])].sort()).toEqual([1, 2]);
    expect(f.dirtyCells(s, [3]).size).toBe(0);
  });
});
