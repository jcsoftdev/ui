import { describe, expect, it, vi } from "vitest";
import { buildExportTable, exportCsv, neutralizeFormula, toXlsxSheet } from "../src/grid/export.ts";
import { compileFilter, createFold, MAX_FILTER_DEPTH, sanitizeFilter } from "../src/grid/filter.ts";
import { aggregate, createGroupStage, groupKey } from "../src/grid/group.ts";
import type { GridColumn } from "../src/grid/model.ts";
import { buildPivot, PIVOT_TOTAL_ID, pivotColumns, pivotFooter } from "../src/grid/pivot.ts";
import { compareValues } from "../src/grid/sort.ts";
import { buildView } from "../src/grid/view.ts";
import { toTime } from "../src/internal/grid-values.ts";

const text = <T>(id: string): GridColumn<T> => ({ id, header: id });

describe("date-only strings are local days (any TZ)", () => {
  it("toTime and compareValues read yyyy-mm-dd as local midnight", () => {
    const t = new Date(toTime("2024-02-29") as number);
    expect([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours()]).toEqual([2024, 1, 29, 0]);
    expect(compareValues("2024-02-29", new Date(2024, 1, 29))).toBe(0);
    expect(toTime("2024-02-29T10:00:00")).toBe(new Date(2024, 1, 29, 10).getTime());
    expect(toTime("nope")).toBeNull();
  });

  it("dateRange and `between` match the same local day, bounds in any order", () => {
    const rows = [{ w: "2024-02-29" }, { w: "2024-03-01" }, { w: "2024-02-28" }];
    const cols: GridColumn<(typeof rows)[number]>[] = [{ id: "w", header: "w", type: "date" }];
    const range = compileFilter({
      rows,
      columns: cols,
      filters: { w: { kind: "dateRange", from: "2024-02-29", to: "2024-02-29" } },
    });
    expect(rows.filter((_, i) => range.test(i)).map((r) => r.w)).toEqual(["2024-02-29"]);
    const between = (a: string, b: string) =>
      compileFilter({
        rows,
        columns: cols,
        advanced: {
          type: "group",
          id: "g",
          logic: "and",
          children: [
            { type: "condition", id: "c", columnId: "w", operator: "between", value: a, value2: b },
          ],
        },
      });
    const fwd = between("2024-02-28", "2024-02-29");
    const rev = between("2024-02-29", "2024-02-28");
    expect(rows.filter((_, i) => rev.test(i))).toEqual(rows.filter((_, i) => fwd.test(i)));
    expect(rows.filter((_, i) => fwd.test(i))).toHaveLength(2);
  });
});

describe("export keeps every row unless told otherwise", () => {
  const rows = [
    { id: "a", g: "x", v: 1 },
    { id: "b", g: "y", v: 2 },
    { id: "c", g: "x", v: 3 },
  ];
  const cols: GridColumn<(typeof rows)[number]>[] = [
    { id: "g", header: "G" },
    { id: "v", header: "V", type: "number" },
  ];
  const keys = rows.map((r) => r.id);
  const view = buildView({
    keys,
    sort: (idx) => idx.sort((p, q) => (rows[q]?.v ?? 0) - (rows[p]?.v ?? 0)),
    group: createGroupStage({
      rows,
      columns: cols,
      groupBy: ["g"],
      collapsed: new Set([groupKey(["g:x"])]),
    }),
  });

  it("groups: omit exports collapsed groups' rows in sorted order", () => {
    expect(view.count).toBe(3);
    const lines = exportCsv({ view, rows, columns: cols }).split("\r\n");
    expect(lines.slice(1)).toEqual(["x,3", "y,2", "x,1"]);
  });

  it("groups: rows follows the screen, and selected limits the rows", () => {
    const shown = buildExportTable({ view, rows, columns: cols, groups: "rows" });
    expect(shown.rows.map((r) => r.kind)).toEqual(["group", "group", "data"]);
    const picked = exportCsv({ view, rows, columns: cols, selected: new Set(["c", "b"]) });
    expect(picked.split("\r\n").slice(1)).toEqual(["x,3", "y,2"]);
  });
});

describe("pivot ids cannot collide or poison", () => {
  it("handles data values total, __proto__ and constructor", () => {
    const data = [
      { r: "a", k: "total", v: 1 },
      { r: "a", k: "__proto__", v: 2 },
      { r: "b", k: "constructor", v: 4 },
    ];
    const cols: GridColumn<(typeof data)[number]>[] = [
      { id: "r", header: "r" },
      { id: "k", header: "k" },
      { id: "v", header: "v", type: "number" },
    ];
    const config = { rows: ["r"], column: "k", value: "v", aggregate: "sum" as const };
    const result = buildPivot(data, cols, config);
    const pc = pivotColumns(cols, config, result, "Total");
    const ids = pc.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rowA = result.rows.find((r) => r.labels.r === "a");
    const byHeader = (h: string) =>
      pc.find((c) => c.header === h)?.accessor as (r: unknown) => unknown;
    expect(byHeader("total")(rowA)).toBe(1);
    expect(byHeader("__proto__")(rowA)).toBe(2);
    expect(byHeader("Total")(rowA)).toBe(3);
    expect(pivotFooter(result)[PIVOT_TOTAL_ID]).toBe(7);
    expect(({} as Record<string, unknown>).total).toBeUndefined();
    expect(Object.getPrototypeOf(rowA?.values)).toBeNull();
  });

  it("falls back to the default cap for NaN and counts the overflow without accumulating", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ r: "a", k: `k${i}`, v: 1 }));
    const cols: GridColumn<(typeof data)[number]>[] = [text("r"), text("k"), text("v")];
    const base = { rows: ["r"], column: "k", value: "v", aggregate: "count" as const };
    expect(buildPivot(data, cols, { ...base, maxColumns: Number.NaN }).keys).toHaveLength(12);
    const capped = buildPivot(data, cols, { ...base, maxColumns: 2 });
    expect(capped.keys).toHaveLength(2);
    expect(capped.overflow).toBe(10);
    expect(capped.grandTotal).toBe(12);
  });
});

describe("saved filter state never crashes compileFilter", () => {
  const rows = [{ n: "alfa", q: 1 }];
  const cols: GridColumn<(typeof rows)[number]>[] = [
    { id: "n", header: "n" },
    { id: "q", header: "q", type: "number" },
  ];

  it("drops malformed, cyclic and too deep nodes", () => {
    const cyclic: { type: string; id: string; logic: string; children: unknown[] } = {
      type: "group",
      id: "g",
      logic: "and",
      children: [],
    };
    cyclic.children.push(cyclic, {
      type: "condition",
      id: "c",
      columnId: "n",
      operator: "contains",
      value: "alf",
    });
    let deep: unknown = {
      type: "condition",
      id: "c",
      columnId: "n",
      operator: "contains",
      value: "x",
    };
    for (let i = 0; i < 100; i += 1)
      deep = { type: "group", id: `g${i}`, logic: "or", children: [deep] };
    const bad: unknown[] = [
      null,
      "x",
      { type: "group", id: "g", logic: "and" },
      { type: "group", id: "g", logic: "and", children: [null, 4, {}] },
      { type: "group", id: "g", logic: "xor", children: [] },
      { type: "condition", id: "c", columnId: "n", operator: "in", values: "notarray" },
      { type: "condition", id: "c", columnId: 7, operator: "contains", value: "a" },
      { type: "condition", id: "c", columnId: "n", operator: "bogus", value: "a" },
      deep,
    ];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const advanced of bad) {
      const f = compileFilter({ rows, columns: cols, advanced: advanced as never });
      expect(f.test(0)).toBe(true);
    }
    const f = compileFilter({ rows, columns: cols, advanced: cyclic as never });
    expect(f.active).toBe(true);
    expect(f.test(0)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(sanitizeFilter(deep).advanced).toBeUndefined();
    expect(MAX_FILTER_DEPTH).toBe(32);
  });

  it("guards header filters with missing query, values or kind", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = compileFilter({
      rows,
      columns: cols,
      filters: {
        n: { kind: "text" } as never,
        q: { kind: "select", values: "x" } as never,
        z: 4 as never,
      },
    });
    expect(f.active).toBe(false);
    expect(f.test(0)).toBe(true);
    warn.mockRestore();
  });
});

describe("quick search", () => {
  it("folds Turkish İ/I with the locale first, and ß as ss", () => {
    const tr = createFold("tr");
    expect(tr("İstanbul")).toBe(tr("istanbul"));
    expect(tr("ISPARTA")).toBe("ısparta");
    const rows = [{ n: "İstanbul" }, { n: "Straße" }];
    const f = (search: string, locale: string) =>
      compileFilter({ rows, columns: [text("n")], search, locale });
    expect(f("istanbul", "tr").test(0)).toBe(true);
    expect(f("strasse", "en").test(1)).toBe(true);
  });

  it("is fast over 6 columns x 1M rows, in en and es-PE", () => {
    const n = 1_000_000;
    const big = Array.from({ length: n }, (_, i) => ({
      a: `item ${i}`,
      b: `city${i % 90}`,
      c: i % 1000,
      d: i * 1.5,
      e: i % 2 === 0,
      f: `x${i % 7}`,
    }));
    const cols: GridColumn<(typeof big)[number]>[] = [
      { id: "a", header: "a" },
      { id: "b", header: "b" },
      { id: "c", header: "c", type: "number" },
      { id: "d", header: "d" },
      { id: "e", header: "e", type: "boolean" },
      { id: "f", header: "f" },
    ];
    const times: Record<string, number> = {};
    for (const locale of ["en", "es-PE"]) {
      const f = compileFilter({ rows: big, columns: cols, search: "city7 x3", locale });
      const start = performance.now();
      let hits = 0;
      for (let i = 0; i < n; i += 1) if (f.test(i)) hits += 1;
      times[locale] = Math.round(performance.now() - start);
      expect(hits).toBeGreaterThan(0);
    }
    process.stdout.write(`quick search 6 cols x 1M rows (ms): ${JSON.stringify(times)}\n`);
    for (const ms of Object.values(times)) expect(ms).toBeLessThan(2000);
  }, 60_000);
});

describe("filter details", () => {
  it("reads typed numbers in the locale, and NaN is empty", () => {
    const rows = [{ q: 1234.5 }, { q: Number.NaN }, { q: 3 }];
    const cols: GridColumn<(typeof rows)[number]>[] = [{ id: "q", header: "q", type: "number" }];
    const cond = (operator: string, value?: string) => ({
      type: "group" as const,
      id: "g",
      logic: "and" as const,
      children: [
        { type: "condition" as const, id: "c", columnId: "q", operator: operator as never, value },
      ],
    });
    const es = compileFilter({
      rows,
      columns: cols,
      advanced: cond("gt", "1.234,4"),
      locale: "de",
    });
    expect(rows.filter((_, i) => es.test(i)).map((r) => r.q)).toEqual([1234.5]);
    const empty = compileFilter({ rows, columns: cols, advanced: cond("isEmpty") });
    expect(rows.filter((_, i) => empty.test(i))).toHaveLength(1);
  });

  it("countDistinct normalises like the other keys", () => {
    expect(
      aggregate(
        [1, "1", new Date(2024, 0, 1), new Date(2024, 0, 1, 5), Number.NaN],
        "countDistinct",
      ),
    ).toBe(2);
    expect(aggregate([Number.NaN, 1], "count")).toBe(1);
  });
});

describe("group keys and rows", () => {
  const rows = [
    { id: "r1", g: "x" },
    { id: "r2", g: new Date(2024, 0, 2) },
  ];
  const cols: GridColumn<(typeof rows)[number]>[] = [
    { id: "g", header: "g", accessor: (r) => r.g as never },
  ];

  it("cannot collide with a data key and does not depend on the locale", () => {
    const stageOf = (locale: string) =>
      createGroupStage({ rows, columns: cols, groupBy: ["g"], locale });
    const a = buildView({ keys: ["g:x", "r2"], group: stageOf("en") });
    const b = buildView({ keys: ["g:x", "r2"], group: stageOf("es-PE") });
    const keysOf = (v: typeof a) => Array.from({ length: v.count }, (_, i) => v.keyAt(i));
    expect(keysOf(a)).toEqual(keysOf(b));
    expect(new Set(keysOf(a)).size).toBe(a.count);
    expect(keysOf(a)).toContain(groupKey(["g:2024-01-02"]));
  });

  it("reuses the data rows it receives", () => {
    const input = [{ kind: "data" as const, key: "r1", source: 0, depth: 0 }];
    const out = createGroupStage({ rows, columns: cols, groupBy: ["g"] })(input);
    expect(out[1]).toBe(input[0]);
    expect(out[1]?.depth).toBe(1);
  });
});

describe("CSV neutralization", () => {
  it("keeps negative numbers and formatted currency, neutralizes the rest", () => {
    expect(neutralizeFormula("-S/ 1 234.50", true)).toBe("-S/ 1 234.50");
    expect(neutralizeFormula("-1.234,50", true)).toBe("-1.234,50");
    expect(neutralizeFormula("-$1,234.50", true)).toBe("-$1,234.50");
    for (const bad of [
      "-abc",
      "=1+1",
      "+cmd",
      "@SUM(1)",
      "\tx",
      "\rx",
      "  =1",
      "＝1",
      "＋1",
      "－1",
      "＠x",
    ])
      expect(neutralizeFormula(bad, true).startsWith("'")).toBe(true);
    expect(neutralizeFormula("-abc", false)).toBe("'-abc");
    expect(neutralizeFormula("-5", false)).toBe("'-5");
  });

  it("exports negative numbers untouched in every mode", () => {
    const rows = [{ p: -1234.5, t: -1e-7, s: "-abc" }];
    const cols: GridColumn<(typeof rows)[number]>[] = [
      { id: "p", header: "P", type: "currency" },
      { id: "t", header: "T", type: "number" },
      { id: "s", header: "S" },
    ];
    const view = buildView({ keys: ["1"] });
    const auto = exportCsv({ view, rows, columns: cols, locale: "es-PE" }).split("\r\n")[1];
    expect(auto).toBe("-1234.5,-1e-7,'-abc");
    const shown = exportCsv({
      view,
      rows,
      columns: cols,
      values: "formatted",
      locale: "es-PE",
    }).split("\r\n")[1] as string;
    expect(shown.startsWith("-")).toBe(true);
    expect(shown.split(",").slice(0, 2).join(",")).not.toContain("'");
  });
});

describe("xlsx", () => {
  it("turns date strings of date columns into date cells", () => {
    const rows = [{ d: "2024-02-29" }, { d: "not a date" }];
    const cols: GridColumn<(typeof rows)[number]>[] = [{ id: "d", header: "D", type: "date" }];
    const view = buildView({ keys: ["1", "2"] });
    const sheet = toXlsxSheet(buildExportTable({ view, rows, columns: cols }), {
      view,
      rows,
      columns: cols,
    });
    const first = sheet.rows[0]?.[0];
    expect(first).toBeInstanceOf(Date);
    expect((first as Date).getDate()).toBe(29);
    expect(sheet.rows[1]?.[0]).toBe("not a date");
    expect(sheet.columns[0]?.format).toBe("date");
  });
});
