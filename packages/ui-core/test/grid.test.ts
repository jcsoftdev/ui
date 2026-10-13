import { describe, expect, it } from "vitest";
import * as columns from "../src/grid/columns.ts";
import * as keyboard from "../src/grid/keyboard.ts";
import * as model from "../src/grid/model.ts";
import * as pin from "../src/grid/pin.ts";
import * as resize from "../src/grid/resize.ts";
import * as select from "../src/grid/select.ts";
import * as sort from "../src/grid/sort.ts";
import * as view from "../src/grid/view.ts";
import * as virtual from "../src/grid/virtual.ts";
import { dropIndex } from "../src/sortable.ts";
import { computeVirtualWindow } from "../src/virtual-list.ts";

// The React kit's data-grid modules, loaded without typing them: their types reach the whole
// component tree, which this package does not typecheck.
// biome-ignore lint/suspicious/noExplicitAny: untyped on purpose, see above.
const react = (import.meta as any).glob("../../ui/src/containers/data-grid/{model,virtual}.ts", {
  eager: true,
  // biome-ignore lint/suspicious/noExplicitAny: untyped on purpose, see above.
}) as Record<string, any>;
// biome-ignore lint/suspicious/noExplicitAny: untyped on purpose, see above.
const reactModel: any = react["../../ui/src/containers/data-grid/model.ts"];
// biome-ignore lint/suspicious/noExplicitAny: untyped on purpose, see above.
const reactVirtual: any = react["../../ui/src/containers/data-grid/virtual.ts"];

interface Row {
  id: string;
  name: string | null;
  qty: number | null;
  price: number;
  when: Date | string | null;
  ok: boolean;
}

const rows: Row[] = [
  { id: "a", name: "Zeta", qty: 3, price: 1234.5, when: new Date(2024, 1, 29), ok: true },
  { id: "b", name: "alfa", qty: 10, price: 99, when: "2023-12-01", ok: false },
  { id: "c", name: null, qty: 2, price: 0, when: null, ok: true },
  { id: "d", name: "Álamo", qty: null, price: 1e6, when: new Date(2025, 0, 1), ok: false },
  { id: "e", name: "alfa", qty: 10, price: 5, when: new Date(2022, 5, 5), ok: true },
  { id: "f", name: "Item 10", qty: 1, price: 7, when: "2024-02-29", ok: false },
  { id: "g", name: "Item 2", qty: 1, price: 7.123, when: "bad", ok: true },
];

const cols: model.GridColumn<Row>[] = [
  { id: "name", header: "Nombre" },
  { id: "qty", header: "Cantidad", type: "number" },
  { id: "price", header: "Precio", type: "currency", maxWidth: 140 },
  { id: "when", header: "Fecha", type: "date" },
  { id: "ok", header: "Ok", type: "boolean", grow: 2 },
  { id: "calc", header: "Calc", accessor: (r) => (r.qty ?? 0) * r.price, width: 90, minWidth: 80 },
];
// The React column needs an explicit accessor; the other shared fields are identical.
const rcols = cols.map((c) => ({ ...c, accessor: c.accessor ?? c.id }));
// The React kit is es-PE and says Si / No; parity holds when the locale and labels are those.
const PE = { locale: "es-PE", labels: { yes: "Sí", no: "No" } };

describe("data-grid core parity with the React kit", () => {
  it("reads and formats cells the same", () => {
    for (const row of rows)
      for (let i = 0; i < cols.length; i += 1) {
        const c = cols[i] as model.GridColumn<Row>;
        const r = rcols[i];
        const value = model.getCellValue(row, c);
        expect(value).toEqual(reactModel.getCellValue(row, r));
        expect(model.formatCellValue(value, c, PE)).toBe(reactModel.formatCellValue(value, r));
        expect(model.columnAlign(c)).toBe(reactModel.columnAlign(r));
      }
  });

  it("sorts the same, stable, with empty values last", () => {
    const rules: sort.SortRule[][] = [
      [{ id: "name", direction: "asc" }],
      [{ id: "name", direction: "desc" }],
      [
        { id: "qty", direction: "desc" },
        { id: "name", direction: "asc" },
      ],
      [{ id: "when", direction: "asc" }],
      [
        { id: "ok", direction: "asc" },
        { id: "price", direction: "desc" },
      ],
      [
        { id: "calc", direction: "desc" },
        { id: "nope", direction: "asc" },
      ],
    ];
    for (const rule of rules)
      expect(sort.sortRows(rows, cols, rule, "es-PE").map((r) => r.id)).toEqual(
        reactModel.sortRows(rows, rcols, rule).map((r: Row) => r.id),
      );
    const values = [1, "b", null, "a10", "a2", true, new Date(0), "", undefined, 0];
    for (const a of values)
      for (const b of values)
        expect(Math.sign(sort.compareValues(a as never, b as never, "es-PE"))).toBe(
          Math.sign(reactModel.compareValues(a as never, b as never)),
        );
  });

  it("toggles sort rules the same", () => {
    let mine: sort.SortRule[] = [];
    let theirs: sort.SortRule[] = [];
    const steps: Array<[string, boolean]> = [
      ["a", false],
      ["a", false],
      ["a", false],
      ["a", true],
      ["b", true],
      ["b", true],
      ["b", true],
      ["a", false],
      ["c", true],
      ["c", false],
    ];
    for (const [id, additive] of steps) {
      mine = sort.toggleSort(mine, id, additive);
      theirs = reactModel.toggleSort(theirs, id, additive);
      expect(mine).toEqual(theirs);
    }
  });

  it("sizes columns the same", () => {
    for (let i = 0; i < cols.length; i += 1) {
      const c = cols[i] as model.GridColumn<Row>;
      const r = rcols[i];
      expect(columns.defaultWidth(c)).toBe(reactModel.defaultWidth(r));
      expect(columns.headerFitWidth(c)).toBe(reactModel.headerFitWidth(r));
      expect(columns.growWeight(c)).toBe(reactModel.growWeight(r));
      for (const w of [0, 59.6, 100, 700])
        expect(columns.clampWidth(w, c)).toBe(reactModel.clampWidth(w, r));
    }
    const widths = Object.fromEntries(cols.map((c) => [c.id, columns.defaultWidth(c)]));
    for (const available of [300, 900, 1400, 3000])
      for (const reserved of [0, 40])
        expect(columns.fillColumnWidths(cols, widths, available, reserved)).toEqual(
          reactModel.fillColumnWidths(rcols, widths, available, reserved),
        );
    const resized = { ...widths, name: 333 };
    expect(columns.fillColumnWidths(cols, resized, 2000)).toEqual(
      reactModel.fillColumnWidths(rcols, resized, 2000),
    );
  });

  it("moves columns and reconciles layouts the same", () => {
    const order = ["a", "b", "c", "d"];
    for (const id of order)
      for (const delta of [-2, -1, 1, 2])
        expect(columns.moveColumn(order, id, delta)).toEqual(
          reactModel.moveColumn(order, id, delta),
        );
    for (const id of order)
      for (const target of [...order, "z"])
        for (const place of ["before", "after"] as const)
          expect(columns.moveColumnTo(order, id, target, place)).toEqual(
            reactModel.moveColumnTo(order, id, target, place),
          );
    const fallback = {
      order: cols.map((c) => c.id),
      hidden: [],
      widths: Object.fromEntries(cols.map((c) => [c.id, columns.defaultWidth(c)])),
      pinned: { left: [], right: [] },
    };
    const stored = JSON.stringify({
      order: ["calc", "ghost", "name"],
      hidden: ["ok", "ghost"],
      widths: { name: 9999, qty: 10, ghost: 5 },
      pinned: { left: ["calc", "ghost"], right: ["calc", "qty"] },
    });
    const mine = columns.reconcileLayout(cols, columns.parseStoredLayout(stored), fallback);
    const theirs = reactModel.reconcileLayout(
      rcols,
      reactModel.parseStoredLayout(stored),
      fallback,
    );
    // Only the order differs on purpose: a column missing from the stored layout keeps its code
    // position instead of going to the end.
    expect({ ...mine, order: [] }).toEqual({ ...theirs, order: [] });
    expect(mine.order).toEqual(["calc", "name", "qty", "price", "when", "ok"]);
    expect(columns.parseStoredLayout("[1]")).toBeNull();
  });

  it("windows rows and reveals cells the same", () => {
    for (const scrollTop of [0, 37, 4000, 39_990_000, 1e9])
      for (const overscan of [0, 6]) {
        const input = { count: 1e6, rowHeight: 40, viewportHeight: 600, scrollTop, overscan };
        expect(computeVirtualWindow(input)).toEqual(reactVirtual.computeVirtualWindow(input));
      }
    for (const scroll of [0, 150, 900])
      for (const left of [0, 200, 700, 1500])
        expect(virtual.scrollInlineToReveal(left, 120, 800, scroll, 80, 60)).toBe(
          reactVirtual.scrollLeftToReveal(left, 120, 800, scroll, 80, 60),
        );
  });

  it("ranges selection the same", () => {
    const ids = ["a", "b", "c", "d", "e"];
    for (const anchor of [null, "a", "d", "zz"])
      for (const target of ["a", "c", "e", "zz"])
        expect(select.rangeBetween(ids, anchor, target)).toEqual(
          reactModel.rangeBetween(ids, anchor, target),
        );
  });
});

describe("column window", () => {
  const widths = Array.from({ length: 200 }, () => 100);
  const offsets = columns.columnOffsets(widths);

  it("finds the visible columns with overscan, clamped to the zone", () => {
    expect(offsets[200]).toBe(20_000);
    expect(virtual.computeColumnWindow(offsets, 0, 450, 0)).toEqual({ start: 0, end: 5 });
    expect(virtual.computeColumnWindow(offsets, 0, 450, 2)).toEqual({ start: 0, end: 7 });
    expect(virtual.computeColumnWindow(offsets, 10_050, 10_450, 0)).toEqual({
      start: 100,
      end: 105,
    });
    expect(virtual.computeColumnWindow(offsets, 19_900, 30_000, 3)).toEqual({
      start: 196,
      end: 200,
    });
    expect(virtual.computeColumnWindow(offsets, -300, 120, 0)).toEqual({ start: 0, end: 2 });
    expect(virtual.computeColumnWindow(offsets, 30_000, 31_000, 2)).toEqual({ start: 0, end: 0 });
    expect(virtual.computeColumnWindow([0], 0, 100)).toEqual({ start: 0, end: 0 });
  });

  it("handles variable widths", () => {
    const o = columns.columnOffsets([50, 200, 30, 400, 10]);
    expect(virtual.computeColumnWindow(o, 260, 300, 0)).toEqual({ start: 2, end: 4 });
  });
});

describe("keyboard navigation (APG grid)", () => {
  const base = { rowCount: 100, colCount: 8, pageSize: 10, rtl: false, mod: false };
  const go = (key: string, row: number, col: number, extra: Partial<keyboard.NavigateInput> = {}) =>
    keyboard.navigate({ ...base, key, pos: { row, col }, ...extra });

  it("moves with arrows and never wraps", () => {
    expect(go("ArrowRight", 3, 2)).toEqual({ row: 3, col: 3 });
    expect(go("ArrowRight", 3, 7)).toEqual({ row: 3, col: 7 });
    expect(go("ArrowLeft", 3, 0)).toEqual({ row: 3, col: 0 });
    expect(go("ArrowDown", 100, 1)).toEqual({ row: 100, col: 1 });
    expect(go("ArrowUp", 1, 1)).toEqual({ row: 0, col: 1 });
    expect(go("ArrowUp", 0, 1)).toEqual({ row: 0, col: 1 });
  });

  it("flips left and right in rtl", () => {
    expect(go("ArrowRight", 3, 2, { rtl: true })).toEqual({ row: 3, col: 1 });
    expect(go("ArrowLeft", 3, 2, { rtl: true })).toEqual({ row: 3, col: 3 });
  });

  it("goes to row and grid ends and pages", () => {
    expect(go("Home", 5, 4)).toEqual({ row: 5, col: 0 });
    expect(go("End", 5, 4)).toEqual({ row: 5, col: 7 });
    expect(go("Home", 5, 4, { mod: true })).toEqual({ row: 0, col: 0 });
    expect(go("End", 5, 4, { mod: true })).toEqual({ row: 100, col: 7 });
    expect(go("PageDown", 5, 4)).toEqual({ row: 15, col: 4 });
    expect(go("PageDown", 95, 4)).toEqual({ row: 100, col: 4 });
    expect(go("PageUp", 5, 4)).toEqual({ row: 1, col: 4 });
    expect(go("PageUp", 0, 4)).toEqual({ row: 0, col: 4 });
    expect(go("a", 1, 1)).toBeNull();
  });

  it("maps header keys", () => {
    const k = (key: string, o: Partial<keyboard.HeaderKey> = {}) =>
      keyboard.headerAction({ key, shift: false, alt: false, mod: false, ...o }, false);
    expect(k("Enter")).toEqual({ type: "sort", additive: false });
    expect(k(" ", { shift: true })).toEqual({ type: "sort", additive: true });
    expect(k("ArrowRight", { shift: true })).toEqual({ type: "resize", direction: 1 });
    expect(k("ArrowLeft", { shift: true, mod: true })).toEqual({ type: "move", direction: -1 });
    expect(k("ArrowDown", { alt: true })).toEqual({ type: "menu" });
    expect(k("ArrowRight")).toBeNull();
    expect(
      keyboard.headerAction({ key: "ArrowRight", shift: true, alt: false, mod: false }, true),
    ).toEqual({ type: "resize", direction: -1 });
  });
});

describe("selection", () => {
  const keys = ["a", "b", "c", "d", "e"];
  const rowsApi: select.SelectionRows = {
    count: keys.length,
    indexOf: (k) => keys.indexOf(k),
    keyAt: (i) => keys[i] as string,
  };

  it("toggles, ranges and clears like the React kit", () => {
    let s = select.toggleRow(select.EMPTY_SELECTION, "b", "multi", rowsApi);
    expect([...s.keys]).toEqual(["b"]);
    s = select.toggleRow(s, "d", "multi", rowsApi, true);
    expect([...s.keys].sort()).toEqual(["b", "c", "d"]);
    s = select.toggleRow(s, "c", "multi", rowsApi, true);
    expect([...s.keys]).toEqual(["b"]);
    expect(select.selectionLevel(s, rowsApi)).toBe("some");
    s = select.toggleAll(s, "multi", rowsApi);
    expect(select.selectionLevel(s, rowsApi)).toBe("all");
    s = select.toggleAll(s, "multi", rowsApi);
    expect(s.keys.size).toBe(0);
  });

  it("keeps one row in single mode and ignores none", () => {
    let s = select.toggleRow(select.EMPTY_SELECTION, "a", "single", rowsApi);
    s = select.toggleRow(s, "c", "single", rowsApi);
    expect([...s.keys]).toEqual(["c"]);
    expect(select.toggleRow(s, "c", "single", rowsApi).keys.size).toBe(0);
    expect(select.toggleRow(s, "a", "none", rowsApi)).toBe(s);
    expect(select.toggleAll(s, "single", rowsApi)).toBe(s);
  });

  it("presses rows: replace, add, extend", () => {
    let s = select.pressRow(select.EMPTY_SELECTION, "b", "multi", rowsApi);
    s = select.pressRow(s, "d", "multi", rowsApi, { range: true });
    expect([...s.keys].sort()).toEqual(["b", "c", "d"]);
    s = select.pressRow(s, "a", "multi", rowsApi, { additive: true });
    expect([...s.keys].sort()).toEqual(["a", "b", "c", "d"]);
    s = select.pressRow(s, "e", "multi", rowsApi);
    expect([...s.keys]).toEqual(["e"]);
  });
});

describe("pin, resize and sort helpers", () => {
  it("arranges zones and ignores hidden or unknown pins", () => {
    const a = pin.arrangeColumns(["a", "b", "c", "d", "e"], ["c"], {
      left: ["d", "zz"],
      right: ["a", "c"],
    });
    expect(a.start).toEqual(["d"]);
    expect(a.end).toEqual(["a"]);
    expect(a.center).toEqual(["b", "e"]);
    expect(a.ids).toEqual(["d", "b", "e", "a"]);
    expect(a.zoneOf.get("b")).toBe("center");
    expect(pin.pinInsets({ a: 100, d: 60 }, a)).toEqual({
      d: { side: "left", offset: 0, edge: true },
      a: { side: "right", offset: 0, edge: true },
    });
  });

  it("resizes by pointer and key per zone and direction", () => {
    const col: model.GridColumn<Row> = { id: "x", header: "x", minWidth: 80, maxWidth: 300 };
    const w = (dx: number, rtl: boolean, zone: pin.GridZone) =>
      resize.widthFromPointer(200, dx, { rtl, zone }, col);
    expect(w(30, false, "center")).toBe(230);
    expect(w(30, true, "center")).toBe(170);
    expect(w(30, false, "end")).toBe(170);
    expect(w(30, true, "end")).toBe(230);
    expect(w(-500, false, "center")).toBe(80);
    expect(w(500, false, "center")).toBe(300);
    expect(resize.widthFromKey(200, 1, "center", col)).toBe(216);
    expect(resize.widthFromKey(200, 1, "end", col)).toBe(184);
  });

  it("sets aria-sort and round-trips the sort attribute", () => {
    const rules: sort.SortRule[] = [
      { id: "a", direction: "desc" },
      { id: "b", direction: "asc" },
    ];
    expect(sort.ariaSort(rules, "a")).toBe("descending");
    expect(sort.ariaSort(rules, "b")).toBe("ascending");
    expect(sort.ariaSort(rules, "c")).toBeUndefined();
    expect(sort.parseSort(sort.formatSort(rules))).toEqual(rules);
    expect(sort.parseSort("a:up,,b,a:desc,a:asc")).toEqual([
      { id: "b", direction: "asc" },
      { id: "a", direction: "desc" },
    ]);
  });
});

describe("grid locale and persisted layout", () => {
  const price: model.GridColumn<Row> = { id: "price", header: "Price", type: "currency" };
  const qty: model.GridColumn<Row> = { id: "qty", header: "Qty", type: "number" };

  it("formats by locale and uses the NBSP grouping only for es-PE", () => {
    expect(model.formatCellValue(1234567.5, qty, { locale: "es-PE" })).toBe(
      "1\u00a0234\u00a0567.5",
    );
    expect(model.formatCellValue(1234567.5, qty, { locale: "en-US" })).toBe("1,234,567.5");
    expect(model.formatCellValue(1234567.5, qty, { locale: "de-DE" })).toBe("1.234.567,5");
    expect(model.formatCellValue(5, price, { locale: "en-US" })).toContain("5.00");
    expect(model.formatCellValue(true, qty)).toBe("Yes");
    expect(model.formatCellValue(false, qty, { labels: { no: "Nope" } })).toBe("Nope");
    const date = new Date(2024, 1, 29);
    expect(model.formatCellValue(date, qty, { locale: "en-US" })).toMatch(/Feb/);
    expect(model.formatCellValue(date, qty, { locale: "es-PE" })).toMatch(/feb/i);
    expect(model.formatCellValue(1, qty, { locale: "not a locale" })).toBe("1");
  });

  it("sorts text with the collator of the locale", () => {
    const tied = ["ñu", "nz", "oz"];
    expect(tied.sort((a, b) => sort.compareValues(a, b, "es"))).toEqual(["nz", "ñu", "oz"]);
    expect(["ä", "z", "a"].sort((a, b) => sort.compareValues(a, b, "sv"))).toEqual(["a", "z", "ä"]);
  });

  it("lets a column without maxWidth keep a width it grew to", () => {
    const text: model.GridColumn<Row> = { id: "name", header: "Name" };
    expect(columns.clampWidth(900, text)).toBe(columns.MAX_COLUMN_WIDTH);
    expect(columns.clampWidth(900, text, 1200)).toBe(900);
    expect(columns.clampWidth(2000, text, 1200)).toBe(1200);
    expect(resize.widthFromKey(1000, -1, "center", text)).toBe(984);
    expect(resize.widthFromKey(1000, 1, "center", text)).toBe(1000);
    expect(resize.widthFromPointer(1000, -50, { rtl: false, zone: "center" }, text)).toBe(950);
  });

  it("persists only widths the user changed, with a version, and validates fields", () => {
    const layout = {
      order: ["name", "qty"],
      hidden: [],
      widths: { name: columns.defaultWidth(cols[0] as model.GridColumn<Row>), qty: 222 },
      pinned: { left: ["name"], right: [] },
    };
    const json = JSON.parse(columns.serializeLayout(layout, cols));
    expect(json.v).toBe(columns.LAYOUT_VERSION);
    expect(json.widths).toEqual({ qty: 222 });
    expect(columns.parseStoredLayout(JSON.stringify({ v: 99, order: ["a"] }))).toBeNull();
    expect(
      columns.parseStoredLayout(
        JSON.stringify({
          order: ["a", 3, null],
          hidden: "x",
          widths: { a: "wide", b: -4, c: 120 },
          pinned: { left: ["a", 1], right: 5 },
        }),
      ),
    ).toEqual({ order: ["a"], widths: { c: 120 }, pinned: { left: ["a"], right: [] } });
  });

  it("inserts a column added later after the one before it in code", () => {
    const fallback = {
      order: cols.map((c) => c.id),
      hidden: [],
      widths: {},
      pinned: { left: [], right: [] },
    };
    const next = columns.reconcileLayout(cols, { order: ["calc", "name", "ok"] }, fallback);
    expect(next.order).toEqual(["calc", "name", "qty", "price", "when", "ok"]);
    expect(columns.reconcileLayout(cols, { order: ["qty"] }, fallback).order[0]).toBe("name");
  });
});

describe("grid view", () => {
  it("makes repeated keys unique without dropping rows, the same way every time", () => {
    const source = ["a", "b", "a", "a", "a#2", "c"];
    const first = view.uniqueKeys(source.length, (i) => source[i] as string);
    expect(first.keys).toEqual(["a", "b", "a#2", "a#3", "a#2#2", "c"]);
    expect(new Set(first.keys).size).toBe(source.length);
    expect(first.duplicates).toEqual(["a", "a", "a#2"]);
    expect(view.uniqueKeys(source.length, (i) => source[i] as string).keys).toEqual(first.keys);
  });

  it("runs filter, then sort, then group, and maps keys and positions", () => {
    const keys = ["k0", "k1", "k2", "k3", "k4"];
    const identity = view.buildView({ keys });
    expect([identity.count, identity.sourceAt(3), identity.keyAt(3), identity.kind(3)]).toEqual([
      5,
      3,
      "k3",
      "data",
    ]);
    const piped = view.buildView({
      keys,
      filter: (i) => i !== 2,
      sort: (indices) => [...indices].reverse(),
      group: (indices) => indices,
    });
    expect(piped.count).toBe(4);
    expect([0, 1, 2, 3].map((v) => piped.sourceAt(v))).toEqual([4, 3, 1, 0]);
    expect(piped.keyAt(0)).toBe("k4");
    expect(piped.indexOfKey("k1")).toBe(2);
    expect(piped.indexOfKey("k2")).toBe(-1);
    expect(view.buildView({ keys: [] }).count).toBe(0);
  });
});

describe("sortable horizontal drop index", () => {
  it("counts midpoints before the pointer, mirrored in right-to-left", () => {
    const mids = [50, 150, 250];
    expect(dropIndex(mids, 10)).toBe(0);
    expect(dropIndex(mids, 200)).toBe(2);
    expect(dropIndex(mids, 300)).toBe(3);
    expect(dropIndex(mids, 300, true)).toBe(0);
    expect(dropIndex(mids, 100, true)).toBe(2);
  });
});
