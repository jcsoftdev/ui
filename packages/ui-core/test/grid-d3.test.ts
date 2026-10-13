import { describe, expect, it } from "vitest";
import { exportCsv, exportTsv, exportXlsx, neutralizeFormula } from "../src/grid/export.ts";
import {
  compileFilter,
  dayBounds,
  type FilterGroup,
  type FilterNode,
  toggleSetValues,
} from "../src/grid/filter.ts";
import { aggregate, createGroupStage, groupKey } from "../src/grid/group.ts";
import type { GridColumn } from "../src/grid/model.ts";
import { buildPivot, pivotColumns, pivotFooter } from "../src/grid/pivot.ts";
import { sortRows } from "../src/grid/sort.ts";
import { buildView, uniqueKeys } from "../src/grid/view.ts";

// The React kit's grid logic, loaded by path at runtime so the strict typecheck never follows it.
// biome-ignore lint/suspicious/noExplicitAny: untyped on purpose.
const react = (import.meta as any).glob(
  "../../ui/src/containers/data-grid/{model,filter-builder,pivot}.ts",
  { eager: true },
  // biome-ignore lint/suspicious/noExplicitAny: untyped on purpose.
) as Record<string, any>;
const R = (name: string) => react[`../../ui/src/containers/data-grid/${name}.ts`];

interface Row {
  id: string;
  name: string | null;
  city: string;
  qty: number | null;
  price: number;
  when: Date | string | null;
  ok: boolean;
}

const rows: Row[] = [
  {
    id: "a",
    name: "Zeta",
    city: "Lima",
    qty: 3,
    price: 1234.5,
    when: new Date(2024, 1, 29),
    ok: true,
  },
  { id: "b", name: "alfa", city: "Cusco", qty: 10, price: 99, when: "2023-12-01", ok: false },
  { id: "c", name: null, city: "Lima", qty: 2, price: 0, when: null, ok: true },
  {
    id: "d",
    name: "Álamo",
    city: "Lima",
    qty: null,
    price: 1e6,
    when: new Date(2025, 0, 1),
    ok: false,
  },
  { id: "e", name: "alfa", city: "Cusco", qty: 10, price: 5, when: new Date(2022, 5, 5), ok: true },
  { id: "f", name: "Item 10", city: "Arequipa", qty: 1, price: 7, when: "2024-02-29", ok: false },
  { id: "g", name: "peluquería", city: "Arequipa", qty: 1, price: 7.123, when: "bad", ok: true },
];
const cols: GridColumn<Row>[] = [
  { id: "name", header: "Nombre" },
  { id: "city", header: "Ciudad" },
  { id: "qty", header: "Cantidad", type: "number" },
  { id: "price", header: "Precio", type: "currency" },
  { id: "when", header: "Fecha", type: "date" },
  { id: "ok", header: "Ok", type: "boolean" },
];
const rcols = cols.map((c) => ({ ...c, accessor: c.id }));
const PE = { locale: "es-PE", labels: { yes: "Sí", no: "No" } };
const ids = (list: Row[]) => list.map((r) => r.id);
const pass = (test: (i: number) => boolean) => rows.filter((_, i) => test(i));

describe("grid/filter parity with the React kit", () => {
  it("header filters match filterRows", () => {
    const cases: Record<string, unknown>[] = [
      { name: { kind: "text", query: "ALFA" } },
      { name: { kind: "text", query: "peluqueria" } },
      { qty: { kind: "range", min: 2, max: 10 } },
      { price: { kind: "range", min: 100 } },
      { when: { kind: "dateRange", from: "2023-01-01", to: "2024-02-29" } },
      { ok: { kind: "select", values: ["Sí"] } },
      { city: { kind: "select", values: ["Lima", "Cusco"] }, qty: { kind: "range", max: 5 } },
      { city: { kind: "select", values: ["\u0000none"] } },
    ];
    for (const filters of cases) {
      const mine = compileFilter({ rows, columns: cols, filters: filters as never, ...PE });
      expect(ids(pass(mine.test))).toEqual(ids(R("model").filterRows(rows, rcols, filters)));
    }
  });

  it("quick search matches the React search words", () => {
    for (const search of ["alfa cusco", "PELUQUERIA", "lima 3", "sí", "  ", "1 234", "zzz"]) {
      const mine = compileFilter({ rows, columns: cols, search, ...PE });
      expect(ids(pass(mine.test))).toEqual(ids(R("model").filterRows(rows, rcols, {}, search)));
    }
  });

  it("advanced AND / OR trees match applyAdvancedFilter", () => {
    const c = (columnId: string, operator: string, value = "", value2?: string): FilterNode => ({
      type: "condition",
      id: `${columnId}${operator}${value}`,
      columnId,
      operator: operator as never,
      value,
      value2,
    });
    const trees: FilterGroup[] = [
      {
        type: "group",
        id: "g",
        logic: "and",
        children: [c("name", "contains", "alf"), c("qty", "gte", "10")],
      },
      {
        type: "group",
        id: "g",
        logic: "or",
        children: [c("name", "startsWith", "ite"), c("price", "between", "5", "100")],
      },
      {
        type: "group",
        id: "g",
        logic: "and",
        children: [
          c("when", "after", "2023-12-01"),
          {
            type: "group",
            id: "h",
            logic: "or",
            children: [c("ok", "equals", "sí"), c("city", "endsWith", "co")],
          },
        ],
      },
      {
        type: "group",
        id: "g",
        logic: "and",
        children: [c("name", "isEmpty"), c("when", "between", "2022-06-05", "2022-06-05")],
      },
      {
        type: "group",
        id: "g",
        logic: "or",
        children: [
          c("qty", "notEquals", "10"),
          c("when", "equals", "2024-02-29"),
          c("name", "notContains", "a"),
        ],
      },
      {
        type: "group",
        id: "g",
        logic: "and",
        children: [c("qty", "gt", ""), c("nope", "equals", "x")],
      },
    ];
    for (const advanced of trees) {
      const mine = compileFilter({ rows, columns: cols, advanced, ...PE });
      expect(ids(pass(mine.test))).toEqual(
        ids(R("filter-builder").applyAdvancedFilter(rows, rcols, advanced)),
      );
    }
  });
});

describe("grid/filter edge cases", () => {
  const one = (extra: Partial<Parameters<typeof compileFilter<Row>>[0]>) =>
    compileFilter({ rows, columns: cols, ...extra });

  it("folds accents and case for the locale", () => {
    const f = one({ search: "ALAMO" });
    expect(ids(pass(f.test))).toEqual(["d"]);
    const trRows = [{ n: "ISPARTA" }, { n: "ısparta" }];
    const tr = compileFilter({
      rows: trRows,
      columns: [{ id: "n", header: "n" }],
      search: "ısparta",
      locale: "tr",
    });
    expect(trRows.filter((_, i) => tr.test(i))).toHaveLength(2);
  });

  it("handles nulls, NaN and mixed types without matching them", () => {
    const f = one({
      advanced: {
        type: "group",
        id: "g",
        logic: "and",
        children: [{ type: "condition", id: "c", columnId: "qty", operator: "lt", value: "100" }],
      },
    });
    expect(ids(pass(f.test))).not.toContain("d");
    const mixed = [{ v: "abc" }, { v: Number.NaN }, { v: 4 }, { v: "5" }, { v: null }];
    const g = compileFilter({
      rows: mixed,
      columns: [{ id: "v", header: "v", type: "number" }],
      filters: { v: { kind: "range", min: 4 } },
    });
    expect(mixed.filter((_, i) => g.test(i)).map((r) => r.v)).toEqual([4, "5"]);
  });

  it("matches a local day regardless of the time and DST", () => {
    const [start, end] = dayBounds("2024-03-10") as [number, number];
    expect(new Date(start).getDate()).toBe(10);
    expect(new Date(end).getDate()).toBe(10);
    expect(new Date(end + 1).getDate()).toBe(11);
    expect(dayBounds("2024-02-31")).toBeNull();
    const f = one({
      filters: { when: { kind: "dateRange", from: "2022-06-05", to: "2022-06-05" } },
    });
    expect(ids(pass(f.test))).toEqual(["e"]);
    const late = [{ w: new Date(2022, 5, 5, 23, 59, 59, 999) }, { w: new Date(2022, 5, 6) }];
    const g = compileFilter({
      rows: late,
      columns: [{ id: "w", header: "w", type: "date" }],
      filters: { w: { kind: "dateRange", from: "2022-06-05", to: "2022-06-05" } },
    });
    expect(late.filter((_, i) => g.test(i))).toHaveLength(1);
  });

  it("supports in / notIn, boolean and date `on`", () => {
    const set = one({
      advanced: {
        type: "group",
        id: "g",
        logic: "and",
        children: [
          { type: "condition", id: "c", columnId: "city", operator: "in", values: ["Lima"] },
        ],
      },
    });
    expect(ids(pass(set.test))).toEqual(["a", "c", "d"]);
    const bool = one({ filters: { ok: { kind: "boolean", value: false } } });
    expect(ids(pass(bool.test))).toEqual(["b", "d", "f"]);
    const on = one({
      advanced: {
        type: "group",
        id: "g",
        logic: "and",
        children: [
          {
            type: "condition",
            id: "c",
            columnId: "when",
            operator: "on",
            value: new Date(2024, 1, 29, 18),
          },
        ],
      },
    });
    expect(ids(pass(on.test))).toEqual(["a"]);
  });

  it("reports inactive filters and toggles set values", () => {
    expect(one({}).active).toBe(false);
    expect(toggleSetValues(["a", "b"], undefined, ["a"], false)).toEqual({
      kind: "select",
      values: ["b"],
    });
    expect(
      toggleSetValues(["a", "b"], { kind: "select", values: ["b"] }, ["a"], true),
    ).toBeUndefined();
  });
});

const sources = (v: ReturnType<typeof buildView>) =>
  Array.from({ length: v.count }, (_, i) => v.row(i));

describe("grid/group parity with the React kit", () => {
  const aggregates = { qty: "sum", price: "avg" } as const;
  const rAgg = rcols.map((c) => ({
    ...c,
    aggregate: c.id === "qty" ? "sum" : c.id === "price" ? "avg" : undefined,
  }));

  for (const groupBy of [["city"], ["city", "ok"], ["ok", "city"]]) {
    for (const collapsed of [new Set<string>(), new Set([JSON.stringify(["city:Lima"])])]) {
      it(`groups by ${groupBy.join(">")} (${collapsed.size} collapsed)`, () => {
        const expected = R("model").buildDisplayRows(
          rows,
          rAgg,
          groupBy,
          collapsed,
          (r: Row) => r.id,
        );
        const { keys } = uniqueKeys(rows.length, (i) => (rows[i] as Row).id);
        const stage = createGroupStage({
          rows,
          columns: cols,
          groupBy,
          aggregates,
          collapsed,
          ...PE,
        });
        const view = buildView({ keys, group: stage });
        const mine = sources(view);
        expect(mine.map((r) => r.key)).toEqual(expected.map((r: { key: string }) => r.key));
        expect(mine.map((r) => r.depth)).toEqual(expected.map((r: { depth: number }) => r.depth));
        expected.forEach(
          (
            e: {
              kind: string;
              label?: string;
              count?: number;
              aggregates?: Record<string, number | null>;
              collapsed?: boolean;
            },
            i: number,
          ) => {
            const m = mine[i];
            expect(m?.kind).toBe(e.kind);
            if (e.kind !== "group") return;
            expect(m?.group?.label).toBe(e.label);
            expect(m?.group?.count).toBe(e.count);
            expect(m?.group?.expanded).toBe(!e.collapsed);
            expect(m?.group?.aggregates).toEqual(e.aggregates);
          },
        );
      });
    }
  }

  it("orders groups by the sort rule and sorts within groups through the view", () => {
    const sort = [{ id: "city", direction: "desc" as const }];
    const expected = R("model").buildDisplayRows(
      rows,
      rAgg,
      ["city"],
      new Set(),
      (r: Row) => r.id,
      sort,
    );
    const { keys } = uniqueKeys(rows.length, (i) => (rows[i] as Row).id);
    const byQty = [{ id: "qty", direction: "asc" as const }];
    const view = buildView({
      keys,
      sort: (idx) =>
        sortRows(
          idx,
          [
            {
              id: "qty",
              header: "q",
              type: "number",
              accessor: (i: unknown) => (rows[i as number] as Row).qty,
            } as never,
          ],
          byQty,
        ).slice(),
      group: createGroupStage({ rows, columns: cols, groupBy: ["city"], sort, ...PE }),
    });
    const mine = sources(view);
    expect(mine.filter((r) => r.kind === "group").map((r) => r.key)).toEqual(
      expected
        .filter((r: { kind: string }) => r.kind === "group")
        .map((r: { key: string }) => r.key),
    );
    const lima = mine.filter((r) => r.kind === "data" && ["a", "c", "d"].includes(r.key));
    expect(lima.map((r) => r.key)).toEqual(["c", "a", "d"]);
  });
});

describe("aggregates", () => {
  it("matches the React aggregateValues for the shared kinds", () => {
    const values = [3, "4", null, 10, "x", undefined, new Date(5)];
    for (const kind of ["sum", "avg", "min", "max", "count"] as const)
      expect(aggregate(values, kind)).toBe(R("model").aggregateValues(values, kind));
    expect(aggregate([], "sum")).toBeNull();
  });

  it("adds countDistinct, first, last and custom functions", () => {
    const values = ["a", "b", "a", null, "c"];
    expect(aggregate(values, "countDistinct")).toBe(3);
    expect(aggregate(values, "first")).toBe("a");
    expect(aggregate(values, "last")).toBe("c");
    expect(aggregate([null], "first")).toBeNull();
    expect(aggregate([1, 2, 6], (v) => (v as number[]).length * 10)).toBe(30);
  });

  it("keeps empty input groups and an empty groupBy harmless", () => {
    const stage = createGroupStage({ rows: [] as Row[], columns: cols, groupBy: ["city"] });
    expect(stage([])).toEqual([]);
    const none = createGroupStage({ rows, columns: cols, groupBy: ["nope"] });
    const input = [{ kind: "data" as const, key: "a", source: 0, depth: 0 }];
    expect(none(input)).toBe(input);
    expect(groupKey(["a:1"])).toBe('["a:1"]');
  });
});

describe("grid/pivot parity with the React kit", () => {
  for (const aggregateKind of ["sum", "avg", "count", "min", "max"] as const) {
    it(`pivots with ${aggregateKind}`, () => {
      const config = {
        rows: ["city"],
        column: "ok",
        value: "price",
        aggregate: aggregateKind,
        ...PE,
      };
      const expected = R("pivot").buildPivot(rows, rcols, config);
      const mine = buildPivot(rows, cols, config);
      expect(mine.keys).toEqual(expected.keys);
      expect(mine.rows).toEqual(expected.rows);
      expect(mine.totals).toEqual(expected.totals);
      expect(mine.grandTotal).toEqual(expected.grandTotal);
      expect(pivotFooter(mine)).toEqual(R("pivot").pivotFooter(expected));
      const mc = pivotColumns(cols, config, mine, "Total");
      const rc = R("pivot").pivotColumns(rcols, config, expected, "Total");
      expect(mc.map((c) => [c.id, c.header, c.type, c.width])).toEqual(
        rc.map((c: { id: string; header: string; type: string; width: number }) => [
          c.id,
          c.header,
          c.type,
          c.width,
        ]),
      );
      const sample = mine.rows[0];
      if (sample)
        expect(mc.map((c) => (c.accessor as (r: unknown) => unknown)(sample))).toEqual(
          rc.map((c: { accessor: (r: unknown) => unknown }) => c.accessor(sample)),
        );
    });
  }

  it("reports missing combinations, multi-level rows and the column cap", () => {
    const wide = Array.from({ length: 30 }, (_, i) => ({
      g: i % 2 ? "x" : "y",
      k: `k${String(i).padStart(2, "0")}`,
      v: i,
    }));
    const wc: GridColumn<(typeof wide)[number]>[] = [
      { id: "g", header: "g" },
      { id: "k", header: "k" },
      { id: "v", header: "v", type: "number" },
    ];
    const r = buildPivot(wide, wc, {
      rows: ["g"],
      column: "k",
      value: "v",
      aggregate: "sum",
      maxColumns: 10,
    });
    expect(r.keys).toHaveLength(10);
    expect(r.overflow).toBe(20);
    expect(r.rows[1]?.values.k01).toBeNull();
    expect(r.grandTotal).toBe(435);
    const two = buildPivot(rows, cols, {
      rows: ["city", "ok"],
      column: "name",
      value: "qty",
      aggregate: "sum",
    });
    expect(two.rows.length).toBeGreaterThan(3);
  });
});

describe("grid/export", () => {
  const { keys } = uniqueKeys(rows.length, (i) => (rows[i] as Row).id);
  const grouped = buildView({
    keys,
    group: createGroupStage({
      rows,
      columns: cols,
      groupBy: ["city"],
      aggregates: { qty: "sum" },
      ...PE,
    }),
  });
  const flat = buildView({ keys });

  const parse = (text: string, sep = ","): string[][] => {
    const out: string[][] = [];
    let row: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i] as string;
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) {
        row.push(cur);
        cur = "";
      } else if (ch === "\r") {
        // skip, newline follows
      } else if (ch === "\n") {
        row.push(cur);
        out.push(row);
        row = [];
        cur = "";
      } else cur += ch;
    }
    row.push(cur);
    out.push(row);
    return out;
  };

  it("matches the React toCSV for what is shown", () => {
    const expected = R("model").toCSV(rows, rcols, { bom: true });
    const mine = exportCsv({
      view: flat,
      rows,
      columns: cols,
      bom: true,
      neutralize: false,
      ...PE,
    });
    expect(mine).toBe(expected);
  });

  it("round-trips CSV and TSV, quoting what needs it", () => {
    const tricky = [
      { id: "1", t: 'say "hi", ok' },
      { id: "2", t: "line\nbreak" },
      { id: "3", t: " pad " },
    ];
    const tc: GridColumn<(typeof tricky)[number]>[] = [
      { id: "id", header: "Id" },
      { id: "t", header: "T" },
    ];
    const view = buildView({ keys: ["1", "2", "3"] });
    const csv = exportCsv({ view, rows: tricky, columns: tc });
    expect(
      parse(csv)
        .slice(1)
        .map((r) => r[1]),
    ).toEqual(tricky.map((r) => r.t));
    const tsv = exportTsv({ view, rows: tricky, columns: tc });
    expect(
      parse(tsv, "\t")
        .slice(1)
        .map((r) => r[1]),
    ).toEqual(tricky.map((r) => r.t));
  });

  it("neutralizes formulas by default and keeps numbers", () => {
    expect(["=1+1", "+1", "-1", "@x", "\tx", "\rx", "ok"].map((s) => neutralizeFormula(s))).toEqual(
      ["'=1+1", "'+1", "'-1", "'@x", "'\tx", "'\rx", "ok"],
    );
    const hostile = [{ id: "1", t: '=HYPERLINK("x")', n: -5 }];
    const hc: GridColumn<(typeof hostile)[number]>[] = [
      { id: "t", header: "=bad" },
      { id: "n", header: "N", type: "number" },
    ];
    const view = buildView({ keys: ["1"] });
    const lines = exportCsv({ view, rows: hostile, columns: hc }).split("\r\n");
    expect(lines[0]).toBe("'=bad,N");
    expect(lines[1]).toBe(
      '\'=HYPERLINK(""x""),-5'.replace(/^'=HYP/, "\"'=HYP").replace(/\),-5$/, ')",-5'),
    );
    expect(
      exportCsv({ view, rows: hostile, columns: hc, neutralize: false }).split("\r\n")[0],
    ).toBe("=bad,N");
  });

  it("follows the view order, visible columns and group rows", () => {
    const sub = [cols[1] as GridColumn<Row>, cols[2] as GridColumn<Row>];
    const text = exportCsv({ view: grouped, rows, columns: sub, groups: "rows", ...PE });
    const lines = parse(text);
    expect(lines[0]).toEqual(["Ciudad", "Cantidad"]);
    expect(lines[1]).toEqual(["Arequipa", "2"]);
    expect(lines).toHaveLength(1 + grouped.count);
    expect(exportCsv({ view: grouped, rows, columns: sub, ...PE }).split("\r\n")).toHaveLength(
      1 + rows.length,
    );
    const raw = exportCsv({
      view: flat,
      rows,
      columns: [cols[5] as GridColumn<Row>],
      values: "raw",
    });
    expect(raw.split("\r\n").slice(1, 3)).toEqual(["true", "false"]);
  });

  it("writes an xlsx with outline levels, loading the writer lazily", async () => {
    const bytes = await exportXlsx({
      view: grouped,
      rows,
      columns: cols,
      groups: "rows",
      sheetName: "Rows",
      ...PE,
    });
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const plain = await exportXlsx({ view: flat, rows, columns: cols, ...PE });
    expect(plain.length).toBeGreaterThan(200);
    const reader = await import("node:zlib");
    expect(reader).toBeDefined();
    const asText = new TextDecoder("latin1").decode(bytes);
    expect(asText).toContain("worksheets/sheet1.xml");
    expect(asText).toContain('outlineLevel="1"');
  });
});

describe("performance smoke", () => {
  it("filters and groups 1M rows within a loose budget", () => {
    const n = 1_000_000;
    const big = Array.from({ length: n }, (_, i) => ({
      id: i,
      g: `g${i % 500}`,
      v: i % 1000,
      t: `item ${i}`,
    }));
    const bc: GridColumn<(typeof big)[number]>[] = [
      { id: "g", header: "g" },
      { id: "v", header: "v", type: "number" },
      { id: "t", header: "t" },
    ];
    const start = performance.now();
    const f = compileFilter({
      rows: big,
      columns: bc,
      filters: { v: { kind: "range", min: 100, max: 899 } },
      advanced: {
        type: "group",
        id: "g",
        logic: "and",
        children: [
          { type: "condition", id: "c", columnId: "g", operator: "startsWith", value: "g1" },
        ],
      },
    });
    const keys = new Array<string>(n);
    for (let i = 0; i < n; i += 1) keys[i] = String(i);
    const view = buildView({
      keys,
      filter: f.test,
      group: createGroupStage({ rows: big, columns: bc, groupBy: ["g"], aggregates: { v: "sum" } }),
    });
    const elapsed = performance.now() - start;
    expect(view.dataCount).toBeGreaterThan(100_000);
    expect(elapsed).toBeLessThan(20_000);
  }, 60_000);
});
