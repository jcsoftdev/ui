import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineDataGrid, type GridColumn, type UiDataGrid } from "../src/data-grid/data-grid.ts";
import { frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineDataGrid();
});

afterEach(() => {
  document.body.innerHTML = "";
});

interface Item {
  id: string;
  name: string;
  qty: number;
  price: number;
  city: string;
  due: Date;
  on: boolean;
}

const items = (n = 12): Item[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    name: `Item ${i + 1}`,
    qty: (i + 1) * 10,
    price: i + 1,
    city: ["Lima", "Cusco"][i % 2] as string,
    due: new Date(2024, 0, 1 + i),
    on: false,
  }));

const columns = (): GridColumn<Item>[] => [
  { id: "name", header: "Name", width: 130, editable: true },
  { id: "qty", header: "Qty", type: "number", width: 90, editable: true },
  { id: "price", header: "Price", type: "number", width: 90, editable: true },
  { id: "city", header: "City", width: 100, editable: true, options: ["Lima", "Cusco"] },
  { id: "due", header: "Due", type: "date", width: 120, editable: true },
  { id: "on", header: "On", type: "boolean", width: 70, editable: true },
  { id: "locked", header: "Locked", width: 90, accessor: () => "fixed" },
];

const FEATURES = "editable range-selection clipboard fill-handle history";

const grid = async (
  attrs = FEATURES,
  rows: Item[] = items(),
  cols: GridColumn<Item>[] = columns(),
): Promise<UiDataGrid> => {
  const host = mount(
    `<div style="width:760px"><ui-data-grid label="Items" style="--ui-data-grid-height:360px" ${attrs}></ui-data-grid></div>`,
  );
  const el = host.querySelector("ui-data-grid") as UiDataGrid;
  el.columns = cols;
  el.rows = rows;
  el.rowKey = "id";
  await frame();
  await frame();
  // The feature chunks load on demand; the first paint after they arrive is what tests need.
  await wait(60);
  await frame();
  return el;
};

const cell = (el: UiDataGrid, row: string, col: string) => {
  const found = el.getCellElement(row, col);
  if (!found) throw new Error(`cell ${row}/${col} is not mounted`);
  return found;
};
const focus = async (el: UiDataGrid, row: string, col: string) => {
  el.focusCell(row, col);
  await vi.waitFor(() => expect(document.activeElement).toBe(cell(el, row, col)));
};
const text = (el: UiDataGrid, row: string, col: string) => cell(el, row, col).textContent;
const boxes = (el: UiDataGrid) =>
  [
    ...el.querySelectorAll<HTMLElement>('[data-layer="range"]:not([hidden]) [data-ui-part="box"]'),
  ].filter((box) => !box.hidden);
type Entry = { name: string; detail: any };
const events = (el: UiDataGrid, ...names: string[]) => {
  const log: { name: string; detail: any }[] = [];
  for (const name of names)
    el.addEventListener(name, (event) => log.push({ name, detail: (event as CustomEvent).detail }));
  return log;
};
const paste = (target: Element, data: string) => {
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", data);
  const event = new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};
const copy = (target: Element) => {
  const clipboardData = new DataTransfer();
  const event = new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return { event, text: clipboardData.getData("text/plain") };
};
const shiftArrow = (key: string, times = 1) =>
  userEvent.keyboard(`{Shift>}${`{${key}}`.repeat(times)}{/Shift}`);
const mod = navigator.platform.includes("Mac") ? "Meta" : "Control";

describe("lazy loading", () => {
  const loaded = (name: string) =>
    performance
      .getEntriesByType("resource")
      .some((e) => new RegExp(`data-grid/${name}\\.ts`).test(e.name));

  it("fetches a feature chunk only for the attribute that asks for it", async () => {
    await grid("");
    for (const name of ["history", "range", "clipboard", "fill"]) expect(loaded(name)).toBe(false);
    document.body.innerHTML = "";
    await grid("history");
    expect(loaded("history")).toBe(true);
    for (const name of ["range", "clipboard", "fill"]) expect(loaded(name)).toBe(false);
    const el = document.querySelector("ui-data-grid") as UiDataGrid;
    el.setAttribute("clipboard", "");
    await vi.waitFor(() => expect(loaded("clipboard")).toBe(true));
    expect(loaded("range")).toBe(false);
  });
});

describe("batched writes", () => {
  it("writes a batch with one cellschange and no per-cell events", async () => {
    const el = await grid("editable");
    const log = events(el, "beforecellchange", "cellchange", "beforecellschange", "cellschange");
    const result = await el.changeCells(
      [
        { rowKey: "r0", columnId: "name", value: "A" },
        { rowKey: "r1", columnId: "name", value: "B" },
        { rowKey: "r1", columnId: "locked", value: "x" },
        { rowKey: "nope", columnId: "name", value: "x" },
      ],
      { source: "paste" },
    );
    expect(result.applied).toHaveLength(2);
    expect(result.rejected).toHaveLength(2);
    expect(log.map((e) => e.name)).toEqual(["beforecellschange", "cellschange"]);
    expect(log[1]?.detail.source).toBe("paste");
    expect(log[1]?.detail.changes.map((c: any) => [c.rowKey, c.oldValue, c.value])).toEqual([
      ["r0", "Item 1", "A"],
      ["r1", "Item 2", "B"],
    ]);
    await frame();
    expect(text(el, "r0", "name")).toBe("A");
    expect(text(el, "r1", "name")).toBe("B");
  });

  it("invalidates the view once for a batch and re-sorts when a sorted column changes", async () => {
    const el = await grid("editable");
    el.setSort([{ id: "qty", direction: "asc" }]);
    await frame();
    await el.changeCells(
      [
        { rowKey: "r0", columnId: "qty", value: 1000 },
        { rowKey: "r1", columnId: "qty", value: 999 },
      ],
      { source: "api" },
    );
    await frame();
    await frame();
    expect(el.viewRows.at(-1)?.key).toBe("r0");
    expect(el.viewRows.at(-2)?.key).toBe("r1");
  });

  it("fires the per-cell events, with the source, for a one-cell batch", async () => {
    const el = await grid("editable");
    const log = events(el, "beforecellchange", "cellchange", "cellschange");
    expect(el.changeCell("r0", "name", "Z")).toBe(true);
    expect(log.map((e) => e.name)).toEqual(["beforecellchange", "cellchange", "cellschange"]);
    expect(log.every((e) => e.detail.source === "edit" || e.detail.changes?.length === 1)).toBe(
      true,
    );
    expect(log[0]?.detail.source).toBe("edit");
  });

  it("cancels the whole batch from beforecellschange", async () => {
    const el = await grid("editable");
    el.addEventListener("beforecellschange", (event) => event.preventDefault());
    const log = events(el, "cellschange");
    const result = await el.changeCells([
      { rowKey: "r0", columnId: "name", value: "A" },
      { rowKey: "r1", columnId: "name", value: "B" },
    ]);
    expect(result.cancelled).toBe(true);
    expect(el.rows[0].name).toBe("Item 1");
    expect(log).toHaveLength(0);
  });

  it("emit mode: reports the batch and never touches the rows", async () => {
    const el = await grid("editable edit-mode=emit");
    const log = events(el, "cellschange");
    await el.changeCells([
      { rowKey: "r0", columnId: "name", value: "A" },
      { rowKey: "r1", columnId: "name", value: "B" },
    ]);
    expect(log).toHaveLength(1);
    expect(el.rows[0].name).toBe("Item 1");
  });
});

describe("history", () => {
  it("undoes and redoes an edit with the keyboard and reports historychange", async () => {
    const el = await grid();
    const log = events(el, "historychange");
    await focus(el, "r0", "name");
    expect(el.canUndo).toBe(false);
    el.changeCell("r0", "name", "Edited");
    await frame();
    expect(el.canUndo).toBe(true);
    expect(log.at(-1)?.detail).toMatchObject({ canUndo: true, canRedo: false, undoCount: 1 });
    await userEvent.keyboard(`{${mod}>}z{/${mod}}`);
    await frame();
    expect(text(el, "r0", "name")).toBe("Item 1");
    expect(el.canRedo).toBe(true);
    await userEvent.keyboard(`{${mod}>}{Shift>}z{/Shift}{/${mod}}`);
    await frame();
    expect(text(el, "r0", "name")).toBe("Edited");
    await userEvent.keyboard("{Control>}z{/Control}");
    await frame();
    await userEvent.keyboard("{Control>}y{/Control}");
    await frame();
    expect(text(el, "r0", "name")).toBe("Edited");
  });

  it("undoes a paste as one step and redoes it as one step", async () => {
    const el = await grid();
    await focus(el, "r0", "qty");
    paste(document.activeElement as Element, "1\t2\n3\t4\n5\t6");
    await frame();
    expect(text(el, "r2", "price")).toBe("6");
    const undone = events(el, "cellschange");
    el.undo();
    await frame();
    expect(undone).toHaveLength(1);
    expect(undone[0]?.detail.source).toBe("undo");
    expect(undone[0]?.detail.changes).toHaveLength(6);
    expect(text(el, "r0", "qty")).toBe("10");
    expect(text(el, "r2", "price")).toBe("3");
    expect(el.canUndo).toBe(false);
    el.redo();
    await frame();
    expect(text(el, "r2", "price")).toBe("6");
  });

  it("honours history-depth and ignores everything when the attribute is off", async () => {
    const el = await grid(`${FEATURES} history-depth=2`);
    for (const value of ["a", "b", "c"]) el.changeCell("r0", "name", value);
    expect(el.undo()).toBe(true);
    expect(el.undo()).toBe(true);
    expect(el.undo()).toBe(false);
    expect(el.rows[0].name).toBe("a");
    el.removeAttribute("history");
    expect(el.undo()).toBe(false);
  });

  it("emit mode: records what it emitted and undo emits the inverse", async () => {
    const el = await grid(`${FEATURES} edit-mode=emit`);
    // The consumer applies every change it receives, as an emit-mode grid expects.
    el.addEventListener("cellschange", (event) => {
      for (const change of (event as CustomEvent).detail.changes)
        change.row[change.columnId] = change.value;
    });
    const log = events(el, "cellschange");
    await el.changeCells([{ rowKey: "r0", columnId: "name", value: "New" }], { source: "edit" });
    expect(el.canUndo).toBe(true);
    expect(el.undo()).toBe(true);
    const undo = log.at(-1)?.detail;
    expect(undo.source).toBe("undo");
    expect(undo.changes[0]).toMatchObject({ rowKey: "r0", columnId: "name", value: "Item 1" });
    expect(el.rows[0].name).toBe("Item 1");
  });

  it("emit mode: skips a step whose cells do not hold the value it expects", async () => {
    const el = await grid(`${FEATURES} edit-mode=emit`);
    const log = events(el, "cellschange");
    await el.changeCells([{ rowKey: "r0", columnId: "name", value: "New" }], { source: "edit" });
    // The consumer ignored the change, so there is nothing for the undo to take back.
    expect(el.undo()).toBe(false);
    expect(log).toHaveLength(1);
    expect(el.canUndo).toBe(false);
  });

  it("forgets its steps when rows are replaced from outside", async () => {
    const el = await grid();
    el.changeCell("r0", "name", "Edited");
    expect(el.canUndo).toBe(true);
    el.rows = items();
    expect(el.undo()).toBe(false);
    expect(el.canUndo).toBe(false);
    expect(el.rows[0].name).toBe("Item 1");
  });

  it("leaves a cell that changed behind its back and reports a partial undo", async () => {
    const el = await grid();
    el.changeCell("r0", "name", "Edited");
    el.changeCell("r1", "name", "Edited too");
    await el.changeCells(
      [
        { rowKey: "r2", columnId: "name", value: "p" },
        { rowKey: "r3", columnId: "name", value: "q" },
      ],
      { source: "paste" },
    );
    el.rows[3].name = "elsewhere";
    expect(el.undo()).toBe(false);
    expect(el.rows[2].name).toBe("Item 3");
    expect(el.rows[3].name).toBe("elsewhere");
    expect(el.undo()).toBe(true);
    expect(el.rows[1].name).toBe("Item 2");
  });

  it("turns off with history-depth=0 and caps a huge depth", async () => {
    const el = await grid(`${FEATURES} history-depth=0`);
    el.changeCell("r0", "name", "x");
    expect(el.canUndo).toBe(false);
    expect(el.undo()).toBe(false);
    const big = await grid(`${FEATURES} history-depth=99999999`);
    for (let i = 0; i < 3; i += 1) big.changeCell("r0", "name", `v${i}`);
    expect(big.canUndo).toBe(true);
  });

  it("records writes from code only with history-api", async () => {
    const el = await grid();
    await el.changeCells([{ rowKey: "r0", columnId: "name", value: "api" }]);
    expect(el.canUndo).toBe(false);
    const opted = await grid(`${FEATURES} history-api`);
    await opted.changeCells([{ rowKey: "r0", columnId: "name", value: "api" }]);
    expect(opted.canUndo).toBe(true);
  });

  it("leaves Ctrl+Z to a text editor that is open", async () => {
    const el = await grid();
    el.changeCell("r0", "qty", 5);
    await focus(el, "r1", "name");
    await userEvent.keyboard("x");
    await vi.waitFor(() => expect(el.querySelector("[data-ui-part=editor]")).not.toBeNull());
    await userEvent.keyboard(`{${mod}>}z{/${mod}}`);
    await frame();
    expect(el.rows[0].qty).toBe(5);
  });
});

describe("range selection", () => {
  it("extends with Shift + arrows, draws one overlay, and reports stats", async () => {
    const el = await grid();
    const log = events(el, "rangechange");
    await focus(el, "r0", "qty");
    await shiftArrow("ArrowDown", 2);
    await shiftArrow("ArrowRight");
    await vi.waitFor(() => expect(log.at(-1)?.detail.cells).toBe(6));
    expect(document.activeElement).toBe(cell(el, "r0", "qty"));
    const [box] = boxes(el);
    expect(boxes(el)).toHaveLength(1);
    const a = cell(el, "r0", "qty").getBoundingClientRect();
    const b = cell(el, "r2", "price").getBoundingClientRect();
    const r = (box as HTMLElement).getBoundingClientRect();
    expect(Math.abs(r.left - a.left)).toBeLessThan(2);
    expect(Math.abs(r.right - b.right)).toBeLessThan(2);
    expect(Math.abs(r.top - a.top)).toBeLessThan(2);
    expect(Math.abs(r.bottom - b.bottom)).toBeLessThan(2);
    const { stats } = (log.at(-1) as Entry).detail;
    expect(stats).toMatchObject({
      count: 6,
      numeric: 6,
      sum: 10 + 20 + 30 + 1 + 2 + 3,
      min: 1,
      max: 30,
    });
    expect(stats.avg).toBe(11);
    expect(log.at(-1)?.detail.anchor).toEqual({ rowKey: "r0", columnId: "qty" });
  });

  it("announces the count and numeric stats politely", async () => {
    const el = await grid();
    await focus(el, "r0", "qty");
    await shiftArrow("ArrowDown", 1);
    await vi.waitFor(
      () =>
        expect(el.querySelector("[data-ui-part=status]")?.textContent).toBe(
          "2 cells selected, sum 30, average 15",
        ),
      { timeout: 2000 },
    );
    expect(el.querySelector("[data-ui-part=status]")?.getAttribute("aria-live")).toBe("polite");
  });

  it("selects all data cells with Ctrl+A and clears with Escape or a plain arrow", async () => {
    const el = await grid();
    const log = events(el, "rangechange");
    await focus(el, "r1", "name");
    await userEvent.keyboard(`{${mod}>}a{/${mod}}`);
    await vi.waitFor(() => expect(log.at(-1)?.detail.cells).toBe(12 * 7));
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(boxes(el)).toHaveLength(0));
    await shiftArrow("ArrowRight");
    await vi.waitFor(() => expect(boxes(el)).toHaveLength(1));
    await userEvent.keyboard("{ArrowDown}");
    await vi.waitFor(() => expect(boxes(el)).toHaveLength(0));
  });

  it("does not disturb type-to-edit: a printable key still opens the editor", async () => {
    const el = await grid();
    await focus(el, "r0", "name");
    await shiftArrow("ArrowRight");
    await userEvent.keyboard("Q");
    await vi.waitFor(() =>
      expect(el.querySelector<HTMLInputElement>("[data-ui-part=editor]")?.value).toBe("Q"),
    );
    expect(boxes(el)).toHaveLength(0);
  });

  it("extends with Shift + click and drags with the pointer", async () => {
    const el = await grid();
    const log = events(el, "rangechange");
    await focus(el, "r1", "qty");
    const target = cell(el, "r3", "price");
    await userEvent.keyboard("{Shift>}");
    await userEvent.click(target);
    await userEvent.keyboard("{/Shift}");
    await vi.waitFor(() => expect(log.at(-1)?.detail.cells).toBe(6));
    // Drag from r4/name to r6/qty with synthetic pointer events (coalesced to a frame).
    const from = cell(el, "r4", "name");
    const to = cell(el, "r6", "qty").getBoundingClientRect();
    const f = from.getBoundingClientRect();
    from.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: f.left + 5,
        clientY: f.top + 5,
      }),
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: to.left + 5, clientY: to.top + 5 }),
    );
    await vi.waitFor(() =>
      expect(log.at(-1)?.detail.from).toEqual({ rowKey: "r4", columnId: "name" }),
    );
    expect(log.at(-1)?.detail.cells).toBe(6);
    expect(log.at(-1)?.detail.to).toEqual({ rowKey: "r6", columnId: "qty" });
    window.dispatchEvent(new PointerEvent("pointerup"));
    expect(el.hasAttribute("data-ranging")).toBe(false);
  });

  it("keeps the range on the same cells while columns are pinned and the overlay spans zones", async () => {
    const el = await grid(`${FEATURES} pinned-left=name`);
    await focus(el, "r0", "name");
    await shiftArrow("ArrowRight", 2);
    await shiftArrow("ArrowDown");
    await vi.waitFor(() => expect(boxes(el)).toHaveLength(2));
  });

  it("a grid without range-selection fetches no range chunk and keeps Shift + arrows as plain moves", async () => {
    const el = await grid("editable");
    await focus(el, "r0", "qty");
    await shiftArrow("ArrowDown");
    await frame();
    expect(el.querySelector('[data-layer="range"]')).toBeNull();
    expect(document.activeElement).toBe(cell(el, "r1", "qty"));
  });
});

describe("clipboard", () => {
  it("copies the range as TSV in the editor's format", async () => {
    const el = await grid(`${FEATURES} locale=de-DE`);
    await focus(el, "r0", "name");
    await shiftArrow("ArrowRight", 1);
    await shiftArrow("ArrowDown", 1);
    await vi.waitFor(() => expect(boxes(el)).toHaveLength(1));
    const done = copy(document.activeElement as Element);
    expect(done.event.defaultPrevented).toBe(true);
    expect(done.text).toBe("Item 1\t10\nItem 2\t20");
    el.changeCell("r0", "price", 1234.5);
    await focus(el, "r0", "price");
    expect(copy(document.activeElement as Element).text).toBe("1234,5");
  });

  it("quotes cells that hold tabs, quotes or line breaks", async () => {
    const el = await grid();
    el.changeCell("r0", "name", 'a\tb "q"\nc');
    await focus(el, "r0", "name");
    expect(copy(document.activeElement as Element).text).toBe('"a\tb ""q""\nc"');
  });

  it("pastes a block from the active cell as one batch, parsing with the column's rules", async () => {
    const el = await grid(`${FEATURES} edit-mode=emit locale=de-DE`);
    const log = events(el, "cellschange", "cellspaste");
    await focus(el, "r0", "name");
    paste(document.activeElement as Element, "Foo\t1.234,5\nBar\tabc\n\tx");
    expect(log.map((e) => e.name)).toEqual(["cellschange", "cellspaste"]);
    const { changes, source } = (log[0] as Entry).detail;
    expect(source).toBe("paste");
    expect(changes.map((c: any) => [c.rowKey, c.columnId, c.value])).toEqual([
      ["r0", "name", "Foo"],
      ["r0", "qty", 1234.5],
      ["r1", "name", "Bar"],
      ["r2", "name", ""],
    ]);
    const report = log[1]?.detail;
    expect(report.applied).toBe(4);
    expect(report.skipped.map((s: any) => [s.rowKey, s.columnId, s.reason])).toEqual([
      ["r1", "qty", "invalid"],
      ["r2", "qty", "invalid"],
    ]);
    expect(report.skipped[0].message).toBeTruthy();
  });

  it("skips read-only cells and clips at the last row and column, reporting both", async () => {
    const el = await grid(FEATURES, items(3));
    const log = events(el, "cellspaste");
    await focus(el, "r1", "on");
    paste(document.activeElement as Element, "true\tx\ty\n1\t2\t3\n4\t5\t6\n7\t8\t9");
    const report = log[0]?.detail;
    // r1..r2 x [on, locked]: the locked column is read-only; the rest falls off the grid.
    expect(
      report.skipped.some((s: any) => s.columnId === "locked" && s.reason === "readonly"),
    ).toBe(true);
    expect(report.clipped).toBe(8);
    expect(el.rows[1].on).toBe(true);
  });

  it("runs synchronous validators on paste and reports asynchronous ones unvalidated", async () => {
    const cols = columns();
    cols[0] = { ...cols[0], validate: (v) => (v === "bad" ? "no bad" : null) } as GridColumn<Item>;
    cols[1] = {
      ...cols[1],
      validate: async () => "async would refuse",
    } as GridColumn<Item>;
    const el = await grid(FEATURES, items(), cols);
    const log = events(el, "cellspaste");
    await focus(el, "r0", "name");
    paste(document.activeElement as Element, "bad\t5\nok\t6");
    const report = log[0]?.detail;
    expect(report.skipped).toEqual([
      { rowKey: "r0", columnId: "name", reason: "invalid", message: "no bad" },
    ]);
    expect(report.unvalidated).toEqual([
      { rowKey: "r0", columnId: "qty" },
      { rowKey: "r1", columnId: "qty" },
    ]);
    expect(el.rows[0].qty).toBe(5);
    expect(el.rows[1].name).toBe("ok");
  });

  it("fills a selection with a single pasted value and selects the block", async () => {
    const el = await grid();
    const log = events(el, "cellschange", "rangechange");
    await focus(el, "r0", "qty");
    await shiftArrow("ArrowDown", 2);
    await vi.waitFor(() => expect(boxes(el)).toHaveLength(1));
    paste(document.activeElement as Element, "7");
    expect(log.find((e) => e.name === "cellschange")?.detail.changes).toHaveLength(3);
    expect(el.rows.slice(0, 3).map((r) => r.qty)).toEqual([7, 7, 7]);
  });

  it("leaves paste inside an open editor to the browser", async () => {
    const el = await grid();
    await focus(el, "r0", "name");
    await userEvent.keyboard("x");
    await vi.waitFor(() => expect(el.querySelector("[data-ui-part=editor]")).not.toBeNull());
    const log = events(el, "cellschange");
    const done = paste(el.querySelector("[data-ui-part=editor]") as Element, "zzz");
    expect(done.defaultPrevented).toBe(false);
    expect(log).toHaveLength(0);
  });

  it("a real Ctrl+C / Ctrl+V on a focused cell reaches the handlers", async () => {
    const el = await grid();
    const seen: string[] = [];
    el.addEventListener("copy", () => seen.push("copy"));
    el.addEventListener("paste", () => seen.push("paste"));
    await focus(el, "r0", "name");
    await userEvent.keyboard(`{${mod}>}c{/${mod}}`);
    await userEvent.keyboard(`{${mod}>}v{/${mod}}`);
    expect(seen).toContain("copy");
  });
});

describe("fill", () => {
  const handle = (el: UiDataGrid) =>
    el.querySelector<HTMLElement>('[data-ui-part="fill-handle"]') as HTMLElement;

  const drag = async (el: UiDataGrid, toRow: string, toCol: string) => {
    const h = handle(el).getBoundingClientRect();
    handle(el).dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: h.left + 4,
        clientY: h.top + 4,
      }),
    );
    const to = cell(el, toRow, toCol).getBoundingClientRect();
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: to.left + 6, clientY: to.top + 6 }),
    );
    await frame();
    await frame();
    window.dispatchEvent(new PointerEvent("pointerup"));
    await frame();
  };

  it("shows a handle on the range and continues a series with one batch", async () => {
    const el = await grid();
    for (const row of el.rows.slice(2)) row.qty = 0;
    el.refresh();
    await frame();
    const log = events(el, "cellschange", "cellsfill");
    await focus(el, "r0", "qty");
    await shiftArrow("ArrowDown", 1);
    await vi.waitFor(() => expect(handle(el)).not.toBeNull());
    await drag(el, "r5", "qty");
    expect(log.filter((e) => e.name === "cellschange")).toHaveLength(1);
    expect(log[0]?.detail.source).toBe("fill");
    // 10, 20 continue 30, 40, 50, 60.
    expect(el.rows.slice(0, 6).map((r) => r.qty)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(log.find((e) => e.name === "cellsfill")?.detail).toMatchObject({
      direction: "down",
      applied: 4,
    });
  });

  it("copies when there is no series, fills right, and undoes as one step", async () => {
    const el = await grid();
    await focus(el, "r0", "name");
    await shiftArrow("ArrowDown", 0);
    el.changeCell("r0", "name", "Silla 3");
    el.changeCell("r1", "name", "Zeta");
    await focus(el, "r0", "name");
    await shiftArrow("ArrowDown", 1);
    await vi.waitFor(() => expect(handle(el)).not.toBeNull());
    await drag(el, "r4", "name");
    expect(el.rows.slice(0, 5).map((r) => r.name)).toEqual([
      "Silla 3",
      "Zeta",
      "Silla 3",
      "Zeta",
      "Silla 3",
    ]);
    el.undo();
    await frame();
    expect(el.rows.slice(0, 5).map((r) => r.name)).toEqual([
      "Silla 3",
      "Zeta",
      "Item 3",
      "Item 4",
      "Item 5",
    ]);
  });

  it("continues dates by day, and copies under date-step=month when there is no whole-month step", async () => {
    const dueFirst = columns().sort((x, y) => (x.id === "due" ? -1 : y.id === "due" ? 1 : 0));
    for (const [attrs, expected] of [
      [FEATURES, 3],
      [`${FEATURES} date-step=month`, 1],
    ] as const) {
      document.body.innerHTML = "";
      const rows = items();
      for (const row of rows.slice(2)) row.due = new Date(2030, 0, 1);
      const el = await grid(attrs, rows, dueFirst);
      await focus(el, "r0", "due");
      await shiftArrow("ArrowDown", 1);
      await vi.waitFor(() => expect(handle(el)).not.toBeNull());
      await drag(el, "r3", "due");
      expect(el.rows[2].due.getDate()).toBe(expected);
      expect(el.rows[3].due.getDate()).toBe(expected === 3 ? 4 : 2);
    }
  });

  it("Ctrl+D copies the first row down and Ctrl+R a lone cell from its neighbour", async () => {
    const el = await grid();
    const log = events(el, "cellsfill");
    await focus(el, "r0", "name");
    await shiftArrow("ArrowDown", 2);
    await userEvent.keyboard("{Control>}d{/Control}");
    await frame();
    expect(el.rows.slice(0, 3).map((r) => r.name)).toEqual(["Item 1", "Item 1", "Item 1"]);
    expect(log[0]?.detail.direction).toBe("down");
    await focus(el, "r5", "price");
    await userEvent.keyboard("{Control>}r{/Control}");
    await frame();
    expect(el.rows[5].price).toBe(60);
  });

  it("skips read-only targets and reports them", async () => {
    const el = await grid();
    const log = events(el, "cellsfill");
    await focus(el, "r0", "locked");
    await shiftArrow("ArrowDown", 2);
    await userEvent.keyboard("{Control>}d{/Control}");
    await frame();
    expect(log[0]?.detail.applied).toBe(0);
    expect(log[0]?.detail.skipped).toHaveLength(2);
  });
});

describe("range accessibility and the copy hook", () => {
  it("marks the cells in the range and the grid as multiselectable", async () => {
    const el = await grid();
    await focus(el, "r0", "qty");
    await shiftArrow("ArrowDown", 1);
    await vi.waitFor(() =>
      expect(cell(el, "r1", "qty").getAttribute("aria-selected")).toBe("true"),
    );
    expect(cell(el, "r0", "qty").getAttribute("aria-selected")).toBe("true");
    expect(cell(el, "r2", "qty").getAttribute("aria-selected")).toBe("false");
    expect(el.querySelector("[role=grid]")?.getAttribute("aria-multiselectable")).toBe("true");
  });

  it("lets a listener rewrite or cancel what is copied", async () => {
    const el = await grid();
    await focus(el, "r0", "name");
    el.addEventListener("cellscopy", (event) => {
      const detail = (event as CustomEvent).detail;
      detail.text = detail.text.replace(/^(?=[=+\-@])/gm, "'");
    });
    el.changeCell("r0", "name", "=1+1");
    expect(copy(cell(el, "r0", "name")).text).toBe("'=1+1");
    const other = await grid();
    other.addEventListener("cellscopy", (event) => event.preventDefault());
    await focus(other, "r0", "name");
    const { event, text } = copy(cell(other, "r0", "name"));
    expect(text).toBe("");
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("accessibility", () => {
  it("passes axe with a range selected and the fill handle showing", async () => {
    const el = await grid();
    await focus(el, "r0", "qty");
    await shiftArrow("ArrowDown", 2);
    await vi.waitFor(() => expect(boxes(el)).toHaveLength(1));
    await wait(350);
    const results = await axe.run(el, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`),
    ).toEqual([]);
    expect(el.querySelector('[data-layer="range"]')?.getAttribute("aria-hidden")).toBe("true");
  });
});
