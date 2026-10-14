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

interface Line {
  id: string;
  a: number | string;
  b: number | string;
  c: number | string;
}

const lines = (): Line[] => [
  { id: "r0", a: 1, b: 2, c: "=A1+B1" },
  { id: "r1", a: 10, b: 20, c: "=A2+B2" },
  { id: "r2", a: 100, b: 200, c: "=SUM(A1:B3)" },
  { id: "r3", a: 5, b: 6, c: 0 },
];

const columns = (): GridColumn<Line>[] => [
  { id: "a", header: "A", type: "number", width: 110, editable: true },
  { id: "b", header: "B", type: "number", width: 110, editable: true },
  { id: "c", header: "C", type: "number", width: 110, editable: true },
];

const grid = async (attrs: string, rows: Line[] = lines()): Promise<UiDataGrid> => {
  const host = mount(
    `<div style="width:420px"><ui-data-grid label="Sheet" style="--ui-data-grid-height:320px" editable ${attrs}></ui-data-grid></div>`,
  );
  const el = host.querySelector("ui-data-grid") as UiDataGrid;
  el.columns = columns();
  el.rows = rows;
  el.rowKey = "id";
  await frame();
  await frame();
  await wait(80);
  await frame();
  return el;
};

const cell = (el: UiDataGrid, row: string, col: string) => {
  const found = el.getCellElement(row, col);
  if (!found) throw new Error(`cell ${row}/${col} is not mounted`);
  return found;
};
const text = (el: UiDataGrid, row: string, col: string) => cell(el, row, col).textContent;
const focus = async (el: UiDataGrid, row: string, col: string) => {
  el.focusCell(row, col);
  await vi.waitFor(() => expect(document.activeElement).toBe(cell(el, row, col)));
};
const events = (el: UiDataGrid, ...names: string[]) => {
  // biome-ignore lint/suspicious/noExplicitAny: event details are checked field by field.
  const log: { name: string; detail: any }[] = [];
  for (const name of names)
    el.addEventListener(name, (event) => log.push({ name, detail: (event as CustomEvent).detail }));
  return log;
};
const shiftArrow = (key: string, times = 1) =>
  userEvent.keyboard(`{Shift>}${`{${key}}`.repeat(times)}{/Shift}`);
const mod = navigator.platform.includes("Mac") ? "Meta" : "Control";

describe("formulas", () => {
  it("shows the result and keeps the text for the editor", async () => {
    const el = await grid("formulas");
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("3"));
    expect(text(el, "r1", "c")).toBe("30");
    expect(text(el, "r2", "c")).toBe("333");
    expect(el.rows[0].c).toBe("=A1+B1");
    await el.editCell("r0", "c");
    const editor = cell(el, "r0", "c").querySelector("input") as HTMLInputElement;
    expect(editor.value).toBe("=A1+B1");
  });

  it("stores a typed formula as text, without parsing it as a number", async () => {
    const el = await grid("formulas");
    const log = events(el, "cellschange");
    await el.editCell("r3", "c");
    const editor = cell(el, "r3", "c").querySelector("input") as HTMLInputElement;
    editor.value = "=A4*2";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(log).toHaveLength(1));
    expect(el.rows[3].c).toBe("=A4*2");
    await vi.waitFor(() => expect(text(el, "r3", "c")).toBe("10"));
  });

  it("recalculates what depends on a changed cell, and only that", async () => {
    const el = await grid("formulas");
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("3"));
    el.changeCell("r0", "a", 10);
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("12"));
    // =SUM(A1:B3) reads A1
    expect(text(el, "r2", "c")).toBe("342");
    expect(text(el, "r1", "c")).toBe("30");
  });

  it("reports cycles and errors as marked cells", async () => {
    const el = await grid("formulas");
    el.changeCells(
      [
        { rowKey: "r0", columnId: "c", value: "=C2" },
        { rowKey: "r1", columnId: "c", value: "=C1" },
        { rowKey: "r3", columnId: "c", value: "=A4/0" },
      ],
      { source: "api" },
    );
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("#CYCLE!"));
    expect(text(el, "r1", "c")).toBe("#CYCLE!");
    expect(text(el, "r3", "c")).toBe("#DIV/0!");
    expect(cell(el, "r0", "c").hasAttribute("data-formula-error")).toBe(true);
    expect(cell(el, "r0", "c").title).toContain("#CYCLE!");
    el.changeCell("r0", "c", 7);
    await vi.waitFor(() =>
      expect(cell(el, "r0", "c").hasAttribute("data-formula-error")).toBe(false),
    );
  });

  it("keeps addresses on the data when the grid is sorted", async () => {
    const el = await grid("formulas");
    el.sort = [{ id: "a", direction: "desc" }];
    await frame();
    await frame();
    // A1 is still the first data row, not the first row on screen.
    expect(text(el, "r0", "c")).toBe("3");
    expect(text(el, "r2", "c")).toBe("333");
    const order = [...el.querySelectorAll("[role=row][data-key]")].map(
      (r) => (r as HTMLElement).dataset.key,
    );
    expect(order.slice(0, 2)).toEqual(["r2", "r1"]);
  });

  it("sorts on the result, not on the text", async () => {
    const el = await grid("formulas");
    el.sort = [{ id: "c", direction: "desc" }];
    await frame();
    await frame();
    const order = [...el.querySelectorAll("[role=row][data-key]")].map(
      (r) => (r as HTMLElement).dataset.key,
    );
    expect(order.slice(0, 3)).toEqual(["r2", "r1", "r0"]);
  });

  it("re-sorts when a formula moves a sorted row", async () => {
    const el = await grid("formulas");
    el.sort = [{ id: "c", direction: "asc" }];
    await frame();
    el.changeCell("r0", "a", 1000);
    await frame();
    await frame();
    const order = [...el.querySelectorAll("[role=row][data-key]")].map(
      (r) => (r as HTMLElement).dataset.key,
    );
    expect(order[0]).toBe("r3");
    expect(order.indexOf("r0")).toBeGreaterThan(order.indexOf("r1"));
  });

  it("is rebuilt when rows are replaced", async () => {
    const el = await grid("formulas");
    el.rows = [{ id: "x", a: 4, b: 5, c: "=A1*B1" }];
    await vi.waitFor(() => expect(text(el, "x", "c")).toBe("20"));
  });
});

describe("formulas with fill and paste", () => {
  it("moves relative references as a formula is filled down", async () => {
    const el = await grid("formulas range-selection fill-handle history");
    const log = events(el, "cellsfill", "cellschange");
    await focus(el, "r0", "c");
    await shiftArrow("ArrowDown", 1);
    await userEvent.keyboard(`{Control>}d{/Control}`);
    await vi.waitFor(() => expect(log.some((e) => e.name === "cellsfill")).toBe(true));
    // Ctrl+D copies the first row of the range down: r1 gets C1's formula shifted one row.
    expect(el.rows[1].c).toBe("=A2+B2");
  });

  it("fills a formula several rows with shifted references", async () => {
    const rows = lines();
    (rows[1] as Line).c = 0;
    (rows[2] as Line).c = 0;
    const el = await grid("formulas range-selection fill-handle", rows);
    await focus(el, "r0", "c");
    await shiftArrow("ArrowDown", 2);
    await userEvent.keyboard(`{Control>}d{/Control}`);
    await vi.waitFor(() => expect(el.rows[2].c).toBe("=A3+B3"));
    expect(el.rows[1].c).toBe("=A2+B2");
    await vi.waitFor(() => expect(text(el, "r1", "c")).toBe("30"));
  });

  it("stores pasted formula text as typed and shows the result", async () => {
    const el = await grid("formulas range-selection clipboard");
    await focus(el, "r3", "c");
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "=A4+B4");
    cell(el, "r3", "c").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(el.rows[3].c).toBe("=A4+B4"));
    await vi.waitFor(() => expect(text(el, "r3", "c")).toBe("11"));
  });

  it("copies results, not formula text", async () => {
    const el = await grid("formulas range-selection clipboard");
    await focus(el, "r0", "c");
    const clipboardData = new DataTransfer();
    cell(el, "r0", "c").dispatchEvent(
      new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true }),
    );
    expect(clipboardData.getData("text/plain")).toBe("3");
  });

  it("undoes a formula edit as one step", async () => {
    const el = await grid("formulas history");
    el.changeCell("r0", "a", 50);
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("52"));
    el.undo();
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("3"));
    el.redo();
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("52"));
  });
});

describe("formula bar", () => {
  const bar = (el: UiDataGrid) => el.querySelector<HTMLElement>('[data-ui-part="formula-bar"]');
  const field = (el: UiDataGrid) =>
    el.querySelector<HTMLInputElement>('[data-ui-part="formula-input"]') as HTMLInputElement;

  it("shows the address and the stored text of the focused cell", async () => {
    const el = await grid("formulas formula-bar");
    await vi.waitFor(() => expect(bar(el)).not.toBeNull());
    expect(bar(el)?.getAttribute("role")).toBe("group");
    expect(bar(el)?.closest("[role=grid]")).toBeNull();
    await focus(el, "r1", "c");
    await vi.waitFor(() => expect(field(el).value).toBe("=A2+B2"));
    expect(bar(el)?.querySelector('[data-ui-part="formula-address"]')?.textContent).toBe("C2");
  });

  it("commits with Enter and reverts with Escape", async () => {
    const el = await grid("formulas formula-bar");
    await vi.waitFor(() => expect(bar(el)).not.toBeNull());
    await focus(el, "r3", "a");
    await vi.waitFor(() => expect(field(el).value).toBe("5"));
    field(el).focus();
    field(el).value = "=B4*10";
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(el.rows[3].a).toBe("=B4*10"));
    await vi.waitFor(() => expect(text(el, "r3", "a")).toBe("60"));
    expect(document.activeElement).toBe(cell(el, "r3", "a"));
    field(el).focus();
    field(el).value = "123";
    await userEvent.keyboard("{Escape}");
    expect(field(el).value).toBe("=B4*10");
    expect(el.rows[3].a).toBe("=B4*10");
  });

  it("parses plain text like the editor and refuses what does not parse", async () => {
    const el = await grid("formulas formula-bar");
    await vi.waitFor(() => expect(bar(el)).not.toBeNull());
    await focus(el, "r3", "b");
    field(el).focus();
    field(el).value = "abc";
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() =>
      expect(bar(el)?.querySelector('[data-ui-part="formula-error"]')?.textContent).not.toBe(""),
    );
    expect(field(el).getAttribute("aria-invalid")).toBe("true");
    expect(el.rows[3].b).toBe(6);
    field(el).value = "42";
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(el.rows[3].b).toBe(42));
  });

  it("can be turned off again", async () => {
    const el = await grid("formulas formula-bar");
    await vi.waitFor(() => expect(bar(el)).not.toBeNull());
    el.removeAttribute("formula-bar");
    await vi.waitFor(() => expect(bar(el)).toBeNull());
    expect(el.hasAttribute("data-formula-bar")).toBe(false);
  });

  it("passes axe with the bar and a formula error showing", async () => {
    const el = await grid("formulas formula-bar range-selection");
    await vi.waitFor(() => expect(bar(el)).not.toBeNull());
    el.changeCell("r3", "c", "=A4/0");
    await focus(el, "r3", "c");
    await shiftArrow("ArrowUp", 1);
    await vi.waitFor(() => expect(text(el, "r3", "c")).toBe("#DIV/0!"));
    await wait(350);
    const results = await axe.run(el, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`),
    ).toEqual([]);
  });
});

describe("row creation", () => {
  const ids = (el: UiDataGrid) => el.rows.map((r) => r.id);

  it("appends the created row and reports it", async () => {
    const el = await grid("editable-rows");
    el.createRow = () => ({ id: "n1", a: 0, b: 0, c: 0 });
    const log = events(el, "beforerowschange", "rowschange");
    expect(el.addRow()).toBe(true);
    expect(ids(el)).toEqual(["r0", "r1", "r2", "r3", "n1"]);
    expect(log.map((e) => e.name)).toEqual(["beforerowschange", "rowschange"]);
    expect(log[1]?.detail).toMatchObject({
      type: "add",
      source: "edit",
      rows: [{ rowId: "n1", index: 4 }],
    });
    await vi.waitFor(() => expect(el.getCellElement("n1", "a")).not.toBeNull());
  });

  it("does not touch the array the consumer passed", async () => {
    const rows = lines();
    const el = await grid("editable-rows", rows);
    el.addRows([{ row: { id: "n2", a: 1, b: 1, c: 1 }, index: 1 }]);
    expect(rows).toHaveLength(4);
    expect(ids(el)).toEqual(["r0", "n2", "r1", "r2", "r3"]);
  });

  it("can be cancelled", async () => {
    const el = await grid("editable-rows");
    el.addEventListener("beforerowschange", (e) => e.preventDefault());
    expect(el.addRows([{ row: { id: "n3", a: 1, b: 1, c: 1 } }])).toBe(false);
    expect(el.rows).toHaveLength(4);
  });

  it("returns false with no createRow and without the attribute", async () => {
    const el = await grid("editable-rows");
    expect(el.addRow()).toBe(false);
    const plain = await grid("");
    expect(plain.addRow).toBeUndefined();
  });

  it("removes rows by key and drops them from the selection", async () => {
    const el = await grid("editable-rows selection=multi");
    el.selectedKeys = ["r1", "r2"];
    const log = events(el, "rowschange");
    expect(el.removeRows()).toBe(true);
    expect(ids(el)).toEqual(["r0", "r3"]);
    expect(el.selectedKeys).toEqual([]);
    expect(log[0]?.detail.rows.map((r: { rowId: string }) => r.rowId)).toEqual(["r1", "r2"]);
  });

  it("only reports in emit mode", async () => {
    const el = await grid("editable-rows edit-mode=emit");
    const log = events(el, "rowschange");
    el.removeRows(["r0"]);
    expect(log).toHaveLength(1);
    expect(el.rows).toHaveLength(4);
    el.addRows([{ row: { id: "n4", a: 1, b: 1, c: 1 } }]);
    expect(el.rows).toHaveLength(4);
    expect(log[1]?.detail.type).toBe("add");
  });

  it("undoes and redoes an add and a remove as one step each", async () => {
    const el = await grid("editable-rows history");
    el.addRows([{ row: { id: "n5", a: 1, b: 1, c: 1 } }, { row: { id: "n6", a: 2, b: 2, c: 2 } }]);
    expect(ids(el)).toEqual(["r0", "r1", "r2", "r3", "n5", "n6"]);
    el.removeRows(["r1"]);
    expect(ids(el)).toEqual(["r0", "r2", "r3", "n5", "n6"]);
    el.undo();
    await vi.waitFor(() => expect(ids(el)).toEqual(["r0", "r1", "r2", "r3", "n5", "n6"]));
    el.undo();
    await vi.waitFor(() => expect(ids(el)).toEqual(["r0", "r1", "r2", "r3"]));
    expect(el.canUndo).toBe(false);
    el.redo();
    await vi.waitFor(() => expect(ids(el)).toEqual(["r0", "r1", "r2", "r3", "n5", "n6"]));
  });

  it("keeps formulas right after rows are added", async () => {
    const el = await grid("editable-rows formulas");
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("3"));
    el.addRows([{ row: { id: "n7", a: 1, b: 1, c: "=A5+B5" } }]);
    await vi.waitFor(() => expect(text(el, "n7", "c")).toBe("2"));
    expect(text(el, "r2", "c")).toBe("333");
  });
});

describe("review fixes", () => {
  const ids = (el: UiDataGrid) => el.rows.map((r) => r.id);
  const refRows = (): Line[] => [
    { id: "r0", a: 1, b: 0, c: 0 },
    { id: "r1", a: 2, b: 0, c: 0 },
    { id: "r2", a: 3, b: 0, c: "=A2+A3" },
    { id: "r3", a: 4, b: 0, c: "=SUM(A1:A4)" },
  ];

  it("rewrites formulas when rows are inserted, and undoes a removal exactly", async () => {
    const el = await grid("editable-rows formulas history", refRows());
    await vi.waitFor(() => expect(text(el, "r2", "c")).toBe("5"));
    const log = events(el, "rowschange");
    el.addRows([{ row: { id: "n", a: 100, b: 0, c: 0 }, index: 1 }]);
    await vi.waitFor(() => expect(text(el, "r2", "c")).toBe("5"));
    expect(el.rows[3].c).toBe("=A3+A4");
    expect(el.rows[4].c).toBe("=SUM(A1:A5)");
    expect(log[0]?.detail.rewrites).toHaveLength(2);
    el.removeRows(["n"]);
    await vi.waitFor(() => expect(el.rows[2].c).toBe("=A2+A3"));
    // remove the row a formula reads: it becomes #REF!, and the range shrinks
    el.removeRows(["r1"]);
    await vi.waitFor(() => expect(el.rows[1].c).toBe("=#REF!+A2"));
    expect(el.rows[2].c).toBe("=SUM(A1:A3)");
    await vi.waitFor(() => expect(text(el, "r2", "c")).toBe("#REF!"));
    el.undo();
    await vi.waitFor(() => expect(ids(el)).toEqual(["r0", "r1", "r2", "r3"]));
    expect(el.rows[2].c).toBe("=A2+A3");
    expect(el.rows[3].c).toBe("=SUM(A1:A4)");
    await vi.waitFor(() => expect(text(el, "r2", "c")).toBe("5"));
  });

  it("only reports the rewrites in emit mode and prunes the selection", async () => {
    const el = await grid("editable-rows formulas edit-mode=emit", refRows());
    el.selectedKeys = ["r1"];
    const log = events(el, "rowschange");
    el.removeRows(["r1"]);
    expect(el.selectedKeys).toEqual([]);
    expect(ids(el)).toEqual(["r0", "r1", "r2", "r3"]);
    expect(log[0]?.detail.rewrites.map((x: { value: string }) => x.value)).toEqual([
      "=#REF!+A2",
      "=SUM(A1:A3)",
    ]);
  });

  it("does not advance the history when an undo of a row step is refused", async () => {
    const el = await grid("editable-rows history", refRows());
    el.removeRows(["r1"]);
    expect(el.canUndo).toBe(true);
    const refuse = (event: Event) => {
      if ((event as CustomEvent).detail.source === "undo") event.preventDefault();
    };
    el.addEventListener("beforerowschange", refuse);
    expect(el.undo()).toBe(false);
    expect(el.canUndo).toBe(true);
    expect(el.canRedo).toBe(false);
    el.removeEventListener("beforerowschange", refuse);
    expect(el.undo()).toBe(true);
    await vi.waitFor(() => expect(ids(el)).toEqual(["r0", "r1", "r2", "r3"]));
  });

  it("copies formulas beside the results and pastes them shifted", async () => {
    const el = await grid("formulas range-selection clipboard");
    await focus(el, "r0", "c");
    const clipboardData = new DataTransfer();
    cell(el, "r0", "c").dispatchEvent(
      new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true }),
    );
    expect(clipboardData.getData("text/plain")).toBe("3");
    expect(clipboardData.getData("text/html")).toContain("data-f");
    await focus(el, "r3", "c");
    cell(el, "r3", "c").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(el.rows[3].c).toBe("=A4+B4"));
    await vi.waitFor(() => expect(text(el, "r3", "c")).toBe("11"));
  });

  it("ignores the formulas of a table that does not match the text", async () => {
    const el = await grid("formulas range-selection clipboard");
    await focus(el, "r3", "c");
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "7");
    clipboardData.setData(
      "text/html",
      '<table data-ui-grid><tr><td data-f="=A1" data-r="0" data-c="0">8</td></tr></table>',
    );
    cell(el, "r3", "c").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(el.rows[3].c).toBe(7));
  });

  it("shows #VALUE! when a result does not fit a number column", async () => {
    const el = await grid("formulas", [
      { id: "r0", a: 1, b: 2, c: '="x"&A1' },
      { id: "r1", a: 1, b: 2, c: "=A1+B1" },
    ]);
    await vi.waitFor(() => expect(text(el, "r1", "c")).toBe("3"));
    expect(text(el, "r0", "c")).toBe("#VALUE!");
  });

  it("marks only formula cells as errors and keeps a consumer title", async () => {
    const el = await grid("formulas", [
      { id: "r0", a: "#DIV/0!" as never, b: 2, c: "=1/0" },
      { id: "r1", a: 1, b: 2, c: 0 },
    ]);
    await vi.waitFor(() => expect(text(el, "r0", "c")).toBe("#DIV/0!"));
    expect(cell(el, "r0", "c").hasAttribute("data-formula-error")).toBe(true);
    expect(cell(el, "r0", "a").hasAttribute("data-formula-error")).toBe(false);
  });

  it("pastes 200k lines without overflowing the stack", async () => {
    const el = await grid("range-selection clipboard");
    await focus(el, "r0", "a");
    const log = events(el, "cellspaste");
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "1\t2\n".repeat(200_000));
    cell(el, "r0", "a").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(log).toHaveLength(1));
    expect(log[0]?.detail.clipped).toBeGreaterThan(0);
  });

  it("shows a date in the formula bar the way the editor reads it", async () => {
    const el = await grid("formulas formula-bar");
    el.columns = [...columns(), { id: "d", header: "D", type: "date", width: 110, editable: true }];
    el.rows = [{ id: "r0", a: 1, b: 2, c: 3, d: new Date(2024, 2, 5) }];
    await frame();
    await wait(80);
    await focus(el, "r0", "d");
    const input = el.querySelector<HTMLInputElement>(
      '[data-ui-part="formula-input"]',
    ) as HTMLInputElement;
    await vi.waitFor(() => expect(input.value).not.toBe(""));
    expect(input.value).not.toContain("GMT");
    expect(input.value).toMatch(/2024|24/);
  });

  it("commits the formula bar on blur and describes the field by the address", async () => {
    const el = await grid("formulas formula-bar");
    await vi.waitFor(() =>
      expect(el.querySelector('[data-ui-part="formula-input"]')).not.toBeNull(),
    );
    await focus(el, "r3", "c");
    const input = el.querySelector<HTMLInputElement>(
      '[data-ui-part="formula-input"]',
    ) as HTMLInputElement;
    const address = el.querySelector('[data-ui-part="formula-address"]') as HTMLElement;
    expect(input.getAttribute("aria-describedby")).toBe(address.id);
    expect(input.getAttribute("aria-label")).not.toBe(
      el.querySelector('[data-ui-part="formula-bar"]')?.getAttribute("aria-label"),
    );
    input.focus();
    input.value = "=A4*2";
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await vi.waitFor(() => expect(el.rows[3].c).toBe("=A4*2"));
  });
});

void mod;
