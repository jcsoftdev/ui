import { describe, expect, it } from "vitest";
import {
  copyText,
  formatTSV,
  parsePasted,
  parseTSV,
  planPaste,
  planWrites,
  validateSync,
} from "../src/grid/clipboard.ts";
import * as fill from "../src/grid/fill.ts";
import * as history from "../src/grid/history.ts";
import type { GridColumn } from "../src/grid/model.ts";
import { extendFocus, rangeBounds, rangeStats } from "../src/grid/range.ts";

// The React grid is the reference; it is loaded by path so this file does not type-check it.
// biome-ignore lint/suspicious/noExplicitAny: the reference modules are untyped here.
const load = (name: string): Promise<any> =>
  import(
    /* @vite-ignore */ new URL(`../../ui/src/containers/data-grid/${name}.ts`, import.meta.url).href
  );
const reactFill = await load("fill-series");
const reactEdit = await load("grid-edit");
const reactHistory = await load("history");
const reactRange = await load("range");

describe("parseTSV", () => {
  it("matches the React parser on spreadsheet text", () => {
    for (const text of [
      "a\tb\nc\td",
      "a\tb\r\nc\td\r\n",
      "x",
      "",
      "a\t\tb",
      '"a\tb"\tc',
      '"he said ""hi"""\n1',
    ]) {
      expect(parseTSV(text)).toEqual(text === "" ? [] : reactEdit.parseTSV(text));
    }
  });
  it("keeps tabs, quotes and line breaks inside quoted cells", () => {
    expect(parseTSV('"a\tb"\t"line1\nline2"\n"q""uote"\tz')).toEqual([
      ["a\tb", "line1\nline2"],
      ['q"uote', "z"],
    ]);
  });
  it("reads CRLF and lone CR rows, and ignores one trailing break", () => {
    expect(parseTSV("1\t2\r\n3\t4\r\n")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(parseTSV("1\r2")).toEqual([["1"], ["2"]]);
    expect(parseTSV("1\n\n")).toEqual([["1"], [""]]);
  });
  it("keeps an empty quoted cell", () => {
    expect(parseTSV('""')).toEqual([[""]]);
    expect(parseTSV('a\t""')).toEqual([["a", ""]]);
  });
  it("round-trips through formatTSV", () => {
    const cells = [
      ["a", "b\tc"],
      ['q"', "x\ny"],
    ];
    const text = formatTSV({ r0: 0, r1: 1, c0: 0, c1: 1 }, (r, c) => cells[r]?.[c] ?? null);
    expect(parseTSV(text)).toEqual(cells);
  });
  it("leaves out rows and columns that are not data", () => {
    const text = formatTSV({ r0: 0, r1: 2, c0: 0, c1: 2 }, (r, c) =>
      r === 1 || c === 0 ? null : `${r}${c}`,
    );
    expect(text).toBe("01\t02\n21\t22");
  });
});

describe("planPaste", () => {
  it("lands from the origin and counts what the grid edge cuts off", () => {
    const plan = planPaste(
      [
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      { r: 2, c: 1 },
      { maxR: 2, maxC: 2 },
    );
    expect(plan.targets).toEqual([
      { r: 2, c: 1, text: "a" },
      { r: 2, c: 2, text: "b" },
    ]);
    expect(plan.clipped).toBe(4);
  });
  it("fills a selection with a single value", () => {
    const plan = planPaste(
      [["x"]],
      { r: 0, c: 0 },
      { maxR: 9, maxC: 9 },
      { r0: 0, r1: 1, c0: 0, c1: 1 },
    );
    expect(plan.targets).toHaveLength(4);
    expect(plan.clipped).toBe(0);
  });
  it("matches the React plan", () => {
    const table = [
      ["1", "2"],
      ["3", "4"],
    ];
    const mine = planPaste(table, { r: 1, c: 1 }, { maxR: 2, maxC: 5 }).targets;
    expect(mine).toEqual(reactEdit.planPaste(table, { r: 1, c: 1 }, { maxR: 2, maxC: 5 }));
  });
});

interface Item {
  n: number | null;
  s: string;
  d: Date | null;
  ok: boolean;
}
const messages = {
  yes: "Sí",
  no: "No",
  invalidNumber: "num",
  invalidDate: "date",
  invalidValue: "val",
};
const col = (extra: Partial<GridColumn<Item>>): GridColumn<Item> => ({
  id: "x",
  header: "X",
  ...extra,
});
const item: Item = { n: 1, s: "a", d: null, ok: false };

describe("parsePasted", () => {
  it("reads numbers in the grid's locale, not a fixed one", () => {
    const n = col({ type: "number" });
    expect(parsePasted(n, "1.234,5", item, 1, "de-DE", messages)).toEqual({
      ok: true,
      value: 1234.5,
    });
    expect(parsePasted(n, "1,234.5", item, 1, "en", messages)).toEqual({ ok: true, value: 1234.5 });
    expect(parsePasted(n, "abc", item, 1, "en", messages)).toEqual({ ok: false, message: "num" });
    expect(parsePasted(n, "", item, 1, "en", messages)).toEqual({ ok: true, value: null });
  });
  it("reads dates in the locale and keeps a date-only string a string", () => {
    const d = col({ type: "date" });
    const r = parsePasted(d, "05/03/2024", item, "2020-01-01", "es-PE", messages);
    expect(r).toEqual({ ok: true, value: "2024-03-05" });
    expect(parsePasted(d, "31/02/2024", item, null, "es-PE", messages).ok).toBe(false);
  });
  it("reads selects by label or value and booleans by yes / no", () => {
    const sel = col({ options: [{ value: 1, label: "Uno" }, 2] });
    expect(parsePasted(sel, "uno", item, null, "en", messages)).toEqual({ ok: true, value: 1 });
    expect(parsePasted(sel, "2", item, null, "en", messages)).toEqual({ ok: true, value: 2 });
    expect(parsePasted(sel, "tres", item, null, "en", messages).ok).toBe(false);
    const b = col({ type: "boolean" });
    expect(parsePasted(b, "Sí", item, false, "en", messages)).toEqual({ ok: true, value: true });
    expect(parsePasted(b, "FALSE", item, true, "en", messages)).toEqual({ ok: true, value: false });
    expect(parsePasted(b, "maybe", item, true, "en", messages).ok).toBe(false);
  });
  it("uses the column's parse", () => {
    const c = col({ parse: (t) => (t === "!" ? { error: "no bang" } : t.toUpperCase()) });
    expect(parsePasted(c, "ab", item, "", "en", messages)).toEqual({ ok: true, value: "AB" });
    expect(parsePasted(c, "!", item, "", "en", messages)).toEqual({
      ok: false,
      message: "no bang",
    });
  });
});

describe("copyText", () => {
  it("writes what the editor would show, so a paste in the same locale round-trips", () => {
    expect(copyText(col({ type: "number" }), 1234.5, "de-DE")).toBe("1234,5");
    expect(copyText(col({ type: "number" }), 1234.5, "en")).toBe("1234.5");
    expect(copyText(col({ type: "date" }), new Date(2024, 2, 5), "es-PE")).toBe("05/03/2024");
    expect(copyText(col({ options: [{ value: 1, label: "Uno" }] }), 1, "en")).toBe("Uno");
    expect(copyText(col({ type: "boolean" }), true, "en")).toBe("true");
    expect(copyText(col({}), null, "en")).toBe("");
  });
});

describe("validateSync", () => {
  it("enforces synchronous validators and reports asynchronous ones as unvalidated", () => {
    expect(validateSync(col({ validate: (v) => (v === 1 ? "bad" : null) }), 1, item)).toEqual({
      message: "bad",
      unvalidated: false,
    });
    let signal: AbortSignal | undefined;
    const async = col({
      validate: async (_v, _r, s) => {
        signal = s;
        return "never seen";
      },
    });
    expect(validateSync(async, 1, item)).toEqual({ message: null, unvalidated: true });
    expect(signal?.aborted).toBe(true);
    expect(
      validateSync(
        col({
          validate: () => {
            throw new Error("boom");
          },
        }),
        1,
        item,
      ).message,
    ).toBe("boom");
  });
});

describe("planWrites", () => {
  const columns = [col({ id: "n", type: "number" }), col({ id: "s" }), col({ id: "ro" })];
  const rows = [
    { n: 1, s: "a", ro: "r" },
    { n: 2, s: "b", ro: "r" },
  ];
  const cellAt = (r: number, c: number) => {
    const column = columns[c];
    const row = rows[r];
    if (!column || !row) return null;
    return {
      rowKey: `k${r}`,
      columnId: column.id,
      column: column as GridColumn<unknown>,
      row,
      current: (row as Record<string, unknown>)[column.id] as never,
      editable: column.id !== "ro",
    };
  };
  it("skips read-only, invalid and unchanged cells and reports them", () => {
    const targets = [
      { r: 0, c: 0, text: "5" },
      { r: 0, c: 1, text: "a" },
      { r: 0, c: 2, text: "z" },
      { r: 1, c: 0, text: "x" },
      { r: 5, c: 0, text: "7" },
    ];
    const plan = planWrites(targets, cellAt as never, { locale: "en", messages });
    expect(plan.changes).toEqual([{ rowKey: "k0", columnId: "n", value: 5 }]);
    expect(plan.unchanged).toBe(1);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["readonly", "invalid", "unavailable"]);
  });
});

describe("range", () => {
  it("orders the corners and extends with the keyboard, mirrored in rtl", () => {
    expect(rangeBounds({ r: 3, c: 1 }, { r: 1, c: 4 })).toEqual({ r0: 1, r1: 3, c0: 1, c1: 4 });
    const limits = { rows: 10, cols: 5, minC: 1, page: 4, rtl: false };
    expect(extendFocus({ r: 2, c: 2 }, "ArrowRight", false, limits)).toEqual({ r: 2, c: 3 });
    expect(extendFocus({ r: 2, c: 2 }, "ArrowRight", false, { ...limits, rtl: true })).toEqual({
      r: 2,
      c: 1,
    });
    expect(extendFocus({ r: 2, c: 2 }, "ArrowLeft", true, limits)).toEqual({ r: 2, c: 1 });
    expect(extendFocus({ r: 2, c: 2 }, "ArrowDown", true, limits)).toEqual({ r: 9, c: 2 });
    expect(extendFocus({ r: 2, c: 2 }, "PageDown", false, limits)).toEqual({ r: 6, c: 2 });
    expect(extendFocus({ r: 0, c: 1 }, "ArrowUp", false, limits)).toEqual({ r: 0, c: 1 });
    expect(extendFocus({ r: 2, c: 2 }, "a", false, limits)).toBeNull();
  });
  it("computes the same statistics as React", () => {
    const values = [
      [1, 2, "x"],
      [3.5, null, true],
      [undefined, "", 10],
    ] as const;
    const at = (r: number, c: number) => values[r]?.[c] as never;
    const b = { r0: 0, r1: 2, c0: 0, c1: 2 };
    expect(rangeStats(b, at)).toEqual(
      // biome-ignore lint/suspicious/noExplicitAny: React module is untyped here.
      (reactRange as any).rangeStats(b, at),
    );
    expect(rangeStats(b, at)).toMatchObject({
      count: 6,
      numeric: 4,
      sum: 16.5,
      avg: 4.125,
      min: 1,
      max: 10,
    });
  });
});

describe("fill parity with React", () => {
  const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);
  const cases: unknown[][] = [
    [1, 2, 3],
    [10, 20, 30],
    [5],
    ["Silla 1", "Silla 2"],
    ["Silla 3"],
    ["a", "b"],
    ["001", "002"],
    [D(2024, 1, 1), D(2024, 2, 1)],
    [D(2024, 1, 31), D(2024, 2, 29)],
    [D(2024, 3, 1), D(2024, 3, 8)],
    [1, 2, 4],
    [1, null, 3],
    ["=A1", "=A2"],
  ];
  it.each(cases)("continues %j like the React kit", (...source) => {
    for (const backward of [false, true]) {
      const options = { backward };
      expect(fill.seriesFill(source as never, 4, options)).toEqual(
        reactFill.seriesFill(source as never, 4, options),
      );
    }
  });
  it("detects date steps and honours the mode", () => {
    const monthly = [D(2024, 1, 1), D(2024, 2, 1)];
    expect(fill.dateStep(monthly)).toEqual({ unit: "months", amount: 1, endOfMonth: false });
    expect(fill.dateStep(monthly, "day")).toEqual({ unit: "days", amount: 31 });
    const out = fill.seriesFill(monthly, 2, { dateStep: "month" });
    expect(out).toEqual([{ value: D(2024, 3, 1) }, { value: D(2024, 4, 1) }]);
  });
  it("extends the range along the dominant axis and builds lanes", () => {
    const base = { r0: 1, r1: 2, c0: 1, c1: 2 };
    const extent = fill.handleExtent(base, { r: 6, c: 3 }, { maxR: 9, maxC: 9 });
    expect(extent).toEqual({ direction: "down", bounds: { r0: 1, r1: 6, c0: 1, c1: 2 } });
    expect(fill.handleExtent(base, { r: 2, c: 2 }, { maxR: 9, maxC: 9 })).toBeNull();
    const lanes = fill.fillLanes(base, extent as never);
    expect(lanes).toHaveLength(2);
    expect(lanes[0]?.targets).toHaveLength(4);
    expect(lanes).toEqual(reactFill.fillLanes(base, extent as never));
  });
});

describe("history", () => {
  const cells = (n: number) => ({
    kind: "cells" as const,
    source: "paste" as const,
    changes: Array.from({ length: n }, (_, i) => ({
      rowId: `r${i}`,
      columnId: "a",
      before: i,
      after: i + 10,
    })),
  });
  it("undoes and redoes a batch as one step, like React", () => {
    let mine = history.createHistory(3);
    let theirs = reactHistory.createHistory(3);
    for (const n of [2, 3, 1, 4]) {
      mine = history.pushCommand(mine, cells(n));
      theirs = reactHistory.pushCommand(theirs, cells(n));
    }
    expect(mine.past).toHaveLength(3);
    expect(mine).toEqual(theirs);
    const undo = history.undoCommand(mine);
    expect(undo?.apply).toEqual(reactHistory.undoCommand(theirs)?.apply);
    expect(undo?.apply).toMatchObject({
      changes: [
        { before: 10, after: 0 },
        { before: 11, after: 1 },
        { before: 12, after: 2 },
        { before: 13, after: 3 },
      ],
    });
    const redo = history.redoCommand(undo?.state as never);
    expect(redo?.apply).toEqual(cells(4));
    expect(history.canRedo(undo?.state as never)).toBe(true);
  });
  it("drops the redo branch on a new change and ignores no-ops", () => {
    let s = history.createHistory();
    s = history.pushCommand(s, cells(1));
    s = history.undoCommand(s)?.state as never;
    expect(history.canRedo(s)).toBe(true);
    expect(
      history.pushCommand(s, {
        kind: "cells",
        source: "edit",
        changes: [{ rowId: "r", columnId: "a", before: 1, after: 1 }],
      }),
    ).toBe(s);
    s = history.pushCommand(s, cells(2));
    expect(history.canRedo(s)).toBe(false);
  });
});
