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

interface Person {
  id: string;
  name: string;
  age: number;
  city: string;
}

const CITIES = ["Lima", "Cusco", "Piura", "Tacna"];
const people = (n: number, offset = 0): Person[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + offset}`,
    name: `Person ${String(i + offset).padStart(4, "0")}`,
    age: 20 + ((i * 7) % 50),
    city: CITIES[(i * 3) % CITIES.length] as string,
  }));

const peopleColumns = (): GridColumn<Person>[] => [
  { id: "name", header: "Name", width: 160 },
  { id: "age", header: "Age", type: "number", width: 90 },
  { id: "city", header: "City", width: 120 },
];

const grid = async (
  attrs = "",
  setup?: (el: UiDataGrid) => void,
  { width = 700, height = 320, dir = "ltr" } = {},
) => {
  const host = mount(
    `<div dir="${dir}" style="width:${width}px"><ui-data-grid label="People" style="--ui-data-grid-height:${height}px" ${attrs}></ui-data-grid></div>`,
  );
  const el = host.querySelector("ui-data-grid") as UiDataGrid;
  if (setup) setup(el);
  else {
    el.columns = peopleColumns();
    el.rows = people(50);
    el.rowKey = "id";
  }
  await frame();
  await frame();
  return el;
};

const cells = (el: Element) => [...el.querySelectorAll<HTMLElement>("[role=gridcell]")];
const bodyRows = (el: Element) => [
  ...el.querySelectorAll<HTMLElement>("[data-ui-part=body] > [role=row]"),
];
const headers = (el: Element) => [...el.querySelectorAll<HTMLElement>("[role=columnheader]")];
const header = (el: Element, id: string) =>
  el.querySelector<HTMLElement>(`[role=columnheader][data-col="${id}"]`)!;
const cell = (el: Element, key: string, col: string) =>
  (el as UiDataGrid).getCellElement(key, col)!;
/** The inner element that carries role=grid and the grid ARIA. */
const gridEl = (el: Element) => el.querySelector<HTMLElement>("[role=grid]")!;
const viewport = (el: Element) => el.querySelector<HTMLElement>("[data-ui-part=viewport]")!;
const text = (node: Element | null) => node?.textContent ?? "";
const active = () => document.activeElement as HTMLElement;
const tabStops = (el: Element) => el.querySelectorAll("[tabindex='0']").length;

/** 100 000 rows by 200 columns without 20 million values: cells compute from the row index. */
const huge = (el: UiDataGrid) => {
  el.columns = Array.from({ length: 200 }, (_, j) => ({
    id: `c${j}`,
    header: `Col ${j}`,
    width: 100,
    accessor: (row: { i: number }) => row.i * (j + 1),
    type: "number" as const,
  }));
  el.rows = Array.from({ length: 100_000 }, (_, i) => ({ i }));
  el.rowKey = (row: { i: number }) => `r${row.i}`;
};

/** Drags a header onto another with pointer events. */
const dragHeader = async (el: UiDataGrid, id: string, toId: string) => {
  await vi.waitFor(() => expect(header(el, id)).toBeTruthy());
  await wait(30);
  const from = header(el, id).getBoundingClientRect();
  const to = header(el, toId).getBoundingClientRect();
  const y = from.top + from.height / 2;
  const down = new PointerEvent("pointerdown", {
    bubbles: true,
    clientX: from.left + from.width / 2,
    clientY: y,
    pointerId: 2,
    button: 0,
    pointerType: "mouse",
  });
  header(el, id).dispatchEvent(down);
  const at = (type: string, clientX: number) =>
    window.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX,
        clientY: y,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  at("pointermove", to.left + to.width / 2 + (to.left > from.left ? 20 : -20));
  at("pointerup", to.left + to.width / 2 + (to.left > from.left ? 20 : -20));
  await frame();
};

describe("ui-data-grid", () => {
  it("is a grid with full counts and a window of rows, columns and indices under virtual scroll", async () => {
    const el = await grid('locale="es-PE"', huge, { width: 800, height: 400 });
    expect(el.getAttribute("role")).toBeNull();
    expect(gridEl(el).getAttribute("aria-label")).toBe("People");
    expect(gridEl(el).getAttribute("aria-rowcount")).toBe("100001");
    expect(gridEl(el).getAttribute("aria-colcount")).toBe("200");
    expect(bodyRows(el).length).toBeLessThan(40);
    expect(headers(el).length).toBeLessThan(20);
    expect(cells(el).length).toBeLessThan(600);
    expect(bodyRows(el)[0]?.getAttribute("aria-rowindex")).toBe("2");
    expect(header(el, "c0").getAttribute("aria-colindex")).toBe("1");

    const scroller = viewport(el);
    scroller.scrollTop = 40 * 50_000;
    scroller.scrollLeft = 100 * 120;
    await frame();
    await frame();
    const indices = bodyRows(el).map((row) => Number(row.getAttribute("aria-rowindex")));
    expect(indices[0]).toBeGreaterThan(49_900);
    expect(indices.at(-1)).toBeLessThan(50_100);
    expect(indices.every((n, i) => i === 0 || n === (indices[i - 1] as number) + 1)).toBe(true);
    const first = bodyRows(el)[10]?.querySelector<HTMLElement>("[role=gridcell]") as HTMLElement;
    const col = Number(first.getAttribute("aria-colindex"));
    expect(col).toBeGreaterThan(100);
    expect(first.dataset.col).toBe(`c${col - 1}`);
    const row = Number(first.parentElement?.parentElement?.getAttribute("aria-rowindex")) - 2;
    expect(first.textContent).toBe(String(row * col).replace(/\B(?=(\d{3})+(?!\d))/g, " "));
    expect(gridEl(el).getAttribute("aria-rowcount")).toBe("100001");
  });

  describe("keyboard (APG grid)", () => {
    it("has one tab stop and moves with arrows, Home, End and paging", async () => {
      const el = await grid("", undefined, { height: 200 });
      expect(tabStops(el)).toBe(1);
      expect(header(el, "name").tabIndex).toBe(0);
      header(el, "name").focus();
      await userEvent.keyboard("{ArrowDown}");
      expect(active()).toBe(cell(el, "p0", "name"));
      await userEvent.keyboard("{ArrowRight}{ArrowRight}");
      expect(active()).toBe(cell(el, "p0", "city"));
      await userEvent.keyboard("{ArrowRight}");
      expect(active()).toBe(cell(el, "p0", "city"));
      await userEvent.keyboard("{Home}");
      expect(active()).toBe(cell(el, "p0", "name"));
      await userEvent.keyboard("{End}");
      expect(active()).toBe(cell(el, "p0", "city"));
      await userEvent.keyboard("{PageDown}");
      const moved = active().parentElement?.parentElement?.getAttribute("aria-rowindex") as string;
      expect(Number(moved)).toBeGreaterThan(3);
      expect(tabStops(el)).toBe(1);
      expect(active().tabIndex).toBe(0);
      await userEvent.keyboard("{Control>}{End}{/Control}");
      expect(active()).toBe(cell(el, "p49", "city"));
      expect(viewport(el).scrollTop).toBeGreaterThan(0);
      const before = viewport(el).scrollTop;
      await userEvent.keyboard("{Control>}{Home}{/Control}");
      expect(active()).toBe(header(el, "name"));
      // The header is sticky: focusing it never moves the body.
      expect(viewport(el).scrollTop).toBe(before);
    });

    it("keeps the focused cell mounted when it scrolls out of the window", async () => {
      const el = await grid("", undefined, { height: 200 });
      header(el, "name").focus();
      await userEvent.keyboard("{ArrowDown}");
      const focused = active();
      viewport(el).scrollTop = 40 * 40;
      await frame();
      await frame();
      expect(focused.isConnected).toBe(true);
      expect(active()).toBe(focused);
      expect(tabStops(el)).toBe(1);
    });

    it("reaches far cells of a huge grid", async () => {
      const el = await grid("", huge, { width: 800, height: 400 });
      header(el, "c0").focus();
      await userEvent.keyboard("{Control>}{End}{/Control}");
      expect(active().dataset.col).toBe("c199");
      expect(active().getAttribute("aria-colindex")).toBe("200");
      expect(active().parentElement?.parentElement?.getAttribute("aria-rowindex")).toBe("100001");
      expect(bodyRows(el).length).toBeLessThan(45);
    });

    it("flips the horizontal arrows in right-to-left", async () => {
      const el = await grid("", undefined, { dir: "rtl" });
      header(el, "name").focus();
      await userEvent.keyboard("{ArrowLeft}");
      expect(active()).toBe(header(el, "age"));
      await userEvent.keyboard("{ArrowRight}");
      expect(active()).toBe(header(el, "name"));
      expect(header(el, "name").getBoundingClientRect().left).toBeGreaterThan(
        header(el, "city").getBoundingClientRect().left,
      );
    });
  });

  describe("columns", () => {
    it("sorts with aria-sort, by click and key, with Shift for multi-column", async () => {
      const el = await grid();
      const onSort = vi.fn();
      el.addEventListener("sortchange", (e) => onSort((e as CustomEvent).detail));
      expect(header(el, "age").hasAttribute("aria-sort")).toBe(false);
      header(el, "age").click();
      await frame();
      expect(header(el, "age").getAttribute("aria-sort")).toBe("ascending");
      expect(text(bodyRows(el)[0]?.querySelector("[data-col=age]") ?? null)).toBe("20");
      header(el, "age").focus();
      await userEvent.keyboard("{Enter}");
      await frame();
      expect(header(el, "age").getAttribute("aria-sort")).toBe("descending");
      expect(text(bodyRows(el)[0]?.querySelector("[data-col=age]") ?? null)).toBe("69");
      await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
      await userEvent.keyboard("{ArrowRight}{ArrowRight}{Shift>}{Enter}{/Shift}");
      await frame();
      expect(header(el, "city").getAttribute("aria-sort")).toBe("ascending");
      expect(onSort).toHaveBeenCalled();
      expect(el.sort.map((r) => r.id)).toContain("city");
    });

    it("pins columns to the start and end, sticky while the rest scrolls", async () => {
      const el = await grid('pinned-left="name" pinned-right="city"', (g) => {
        g.columns = Array.from({ length: 12 }, (_, j) => ({
          id: j === 0 ? "name" : j === 11 ? "city" : `c${j}`,
          header: `Col ${j}`,
          width: 140,
          accessor: (r: { i: number }) => r.i + j,
        }));
        g.rows = Array.from({ length: 30 }, (_, i) => ({ i }));
      });
      const gridBox = () => el.getBoundingClientRect();
      const name = () => header(el, "name").getBoundingClientRect();
      const city = () => header(el, "city").getBoundingClientRect();
      expect(el.hasAttribute("data-pin-start")).toBe(true);
      const startBefore = name().left - gridBox().left;
      const endBefore = gridBox().right - city().right;
      viewport(el).scrollLeft = 300;
      await frame();
      await frame();
      expect(Math.abs(name().left - gridBox().left - startBefore)).toBeLessThan(2);
      expect(Math.abs(gridBox().right - city().right - endBefore)).toBeLessThan(2);
      expect(header(el, "c1")).toBeTruthy();
      expect(el.hasAttribute("data-scrolled-start")).toBe(true);
      el.pinColumn("c3", "left");
      await frame();
      expect(el.pinned.left).toEqual(["name", "c3"]);
    });

    it("resizes by keyboard and by pointer, honouring min and max", async () => {
      const el = await grid("", (g) => {
        g.columns = [
          { id: "name", header: "Name", width: 160, minWidth: 100, maxWidth: 220, grow: 0 },
          { id: "age", header: "Age", width: 90, grow: 0 },
        ];
        g.rows = people(5);
      });
      const onResize = vi.fn();
      el.addEventListener("columnresize", (e) => onResize((e as CustomEvent).detail));
      header(el, "name").focus();
      const before = header(el, "name").getBoundingClientRect().width;
      await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
      await frame();
      expect(header(el, "name").getBoundingClientRect().width).toBe(before + 16);
      for (let i = 0; i < 8; i += 1) await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
      await frame();
      expect(header(el, "name").getBoundingClientRect().width).toBe(220);

      const handle = header(el, "name").querySelector<HTMLElement>("[data-ui-part=handle]")!;
      const box = handle.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const fire = (type: string, clientX: number) =>
        handle.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX,
            clientY: y,
            pointerId: 1,
            button: 0,
            pointerType: "mouse",
          }),
        );
      fire("pointerdown", x);
      fire("pointermove", x - 60);
      await frame();
      await frame();
      fire("pointerup", x - 60);
      await frame();
      expect(header(el, "name").getBoundingClientRect().width).toBe(160);
      expect(onResize).toHaveBeenLastCalledWith({ id: "name", width: 160 });
      expect(header(el, "age").hasAttribute("aria-sort")).toBe(false);
    });

    it("reorders by keyboard inside a zone and refuses to leave it", async () => {
      const el = await grid('reorderable pinned-left="name"');
      const onMove = vi.fn();
      el.addEventListener("columnmove", (e) => onMove((e as CustomEvent).detail));
      header(el, "age").focus();
      await userEvent.keyboard("{Control>}{Shift>}{ArrowRight}{/Shift}{/Control}");
      await frame();
      expect(el.layout.order).toEqual(["name", "city", "age"]);
      expect(onMove).toHaveBeenCalledTimes(1);
      expect(active()).toBe(header(el, "age"));
      await userEvent.keyboard("{Control>}{Shift>}{ArrowRight}{/Shift}{/Control}");
      expect(el.layout.order).toEqual(["name", "city", "age"]);
      el.moveColumn("age", -1);
      el.moveColumn("age", -1);
      expect(el.layout.order).toEqual(["name", "age", "city"]);
    });

    it("reorders by pointer drag (rtl aware) and does not sort afterwards", async () => {
      const ltr = await grid("reorderable", undefined, { width: 380 });
      await dragHeader(ltr, "name", "city");
      expect(ltr.layout.order).toEqual(["age", "city", "name"]);
      expect(ltr.sort).toEqual([]);
      document.body.innerHTML = "";
      const rtl = await grid("reorderable", undefined, { dir: "rtl", width: 380 });
      await dragHeader(rtl, "name", "city");
      expect(rtl.layout.order).toEqual(["age", "city", "name"]);
    });
  });

  describe("selection", () => {
    it("selects rows with the checkbox column, Shift ranges and select all", async () => {
      const el = await grid('selection="multi"');
      const onChange = vi.fn();
      el.addEventListener("selectionchange", (e) => onChange((e as CustomEvent).detail.keys));
      expect(gridEl(el).getAttribute("aria-multiselectable")).toBe("true");
      expect(gridEl(el).getAttribute("aria-colcount")).toBe("4");
      const check = (key: string) => cell(el, key, "__select")!.querySelector("input")!;
      check("p1").click();
      await frame();
      expect(bodyRows(el)[1]?.getAttribute("aria-selected")).toBe("true");
      check("p4").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
      await frame();
      expect(el.selectedKeys.sort()).toEqual(["p1", "p2", "p3", "p4"]);
      header(el, "__select").querySelector("input")!.click();
      await frame();
      expect(el.selectedKeys.length).toBe(50);
      header(el, "__select").querySelector("input")!.click();
      await frame();
      expect(el.selectedKeys).toEqual([]);
      cell(el, "p2", "name")!.focus();
      await userEvent.keyboard(" ");
      expect(el.selectedKeys).toEqual(["p2"]);
      await userEvent.keyboard("{Control>}a{/Control}");
      expect(el.selectedKeys.length).toBe(50);
      expect(onChange).toHaveBeenCalled();
    });

    it("single mode keeps one row, and a row click replaces the selection", async () => {
      const el = await grid('selection="single"');
      cell(el, "p1", "name")!.click();
      cell(el, "p3", "name")!.click();
      await frame();
      expect(el.selectedKeys).toEqual(["p3"]);
      expect(el.querySelectorAll("[aria-selected=true]").length).toBe(1);
      const none = await grid();
      cell(none, "p1", "name")!.click();
      expect(none.selectedKeys).toEqual([]);
      expect(none.querySelector("[aria-selected]")).toBeNull();
    });

    it("scrolling never selects; a tap (pointer events plus click) does", async () => {
      const el = await grid('selection="single"', undefined, { height: 200 });
      const target = cell(el, "p1", "name")!;
      const box = target.getBoundingClientRect();
      const touch = (type: string, y: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: box.left + 10,
            clientY: y,
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
          }),
        );
      touch("pointerdown", box.top + 10);
      touch("pointermove", box.top - 40);
      viewport(el).scrollTop = 80;
      touch("pointercancel", box.top - 40);
      await frame();
      expect(el.selectedKeys).toEqual([]);
      touch("pointerdown", box.top + 10);
      touch("pointerup", box.top + 10);
      target.click();
      expect(el.selectedKeys).toEqual(["p1"]);
    });
  });

  describe("data API", () => {
    it("renders strings as text and never as HTML", async () => {
      const payload = '<img src=x onerror="window.__xss = 1"><b>bold</b>';
      const w = window as unknown as { __xss?: number };
      w.__xss = undefined;
      const el = await grid("", (g) => {
        g.columns = [
          { id: "a", header: payload, width: 220 },
          { id: "b", header: "Rendered", width: 220, cell: ({ row }) => `${row.a}!` },
          {
            id: "c",
            header: "Node",
            width: 160,
            cell: ({ row }) =>
              Object.assign(document.createElement("em"), { textContent: row.a.length }),
          },
        ];
        g.rows = [{ id: "1", a: payload }];
        g.rowKey = "id";
      });
      await wait(50);
      expect(el.querySelector("img, b")).toBeNull();
      expect(w.__xss).toBeUndefined();
      expect(text(el.querySelector("[data-col=a][role=gridcell]"))).toBe(payload);
      expect(text(el.querySelector("[data-col=b][role=gridcell]"))).toBe(`${payload}!`);
      expect(text(header(el, "a").querySelector("[data-ui-part=label]"))).toBe(payload);
      expect(el.querySelector("[data-col=c] em")).toBeTruthy();
    });

    it("creates the custom element named by cellTag, ignoring names that are not custom elements", async () => {
      class Badge extends HTMLElement {
        value: unknown;
        formatted = "";
        set row(_: unknown) {
          this.textContent = `badge:${this.formatted}`;
        }
      }
      customElements.define("x-badge", Badge);
      const el = await grid("", (g) => {
        g.columns = [
          { id: "city", header: "City", width: 160, cellTag: "x-badge" },
          { id: "name", header: "Name", width: 160, cellTag: "script" },
        ];
        g.rows = people(3);
        g.rowKey = "id";
      });
      expect(el.querySelector("[data-col=city] x-badge")).toBeTruthy();
      expect(el.querySelector("script")).toBeNull();
      expect(text(el.querySelector("[data-col=name][role=gridcell]"))).toBe("Person 0000");
    });

    it("upgrades properties assigned before the element is defined", async () => {
      const tag = "acme-data-grid";
      const el = document.createElement(tag) as UiDataGrid;
      el.columns = peopleColumns();
      el.rows = people(4);
      document.body.append(el);
      expect(el.hasAttribute("role")).toBe(false);
      expect(defineDataGrid({ prefix: "acme" })).toBe(tag);
      await frame();
      await frame();
      expect(gridEl(el).getAttribute("aria-rowcount")).toBe("5");
      expect(el.querySelectorAll("[role=gridcell]").length).toBe(12);
    });

    it("keeps focus on the same row across data updates and sorting", async () => {
      const el = await grid("", undefined, { height: 200 });
      cell(el, "p3", "age")!.focus();
      await frame();
      const same = active();
      el.rows = people(50).map((p) => ({ ...p, name: `${p.name} v2` }));
      await frame();
      await frame();
      expect(active()).toBe(same);
      expect(
        text(active().parentElement?.parentElement?.querySelector("[data-col=name]") ?? null),
      ).toBe("Person 0003 v2");
      el.rows = [{ id: "new", name: "Newcomer", age: 1, city: "Lima" }, ...people(50)];
      await frame();
      await frame();
      expect(active().dataset.col).toBe("age");
      expect(active().parentElement?.parentElement?.getAttribute("aria-rowindex")).toBe("6");
      expect(active().tabIndex).toBe(0);
      el.setSort([{ id: "age", direction: "desc" }]);
      await frame();
      await frame();
      expect(el.contains(document.activeElement)).toBe(true);
      expect(active().tabIndex).toBe(0);
      expect(tabStops(el)).toBe(1);
    });
  });

  describe("column menu (loaded on demand)", () => {
    it("opens from the keyboard, sorts, pins and returns focus", async () => {
      const el = await grid("column-menu");
      header(el, "age").focus();
      await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
      await vi.waitFor(() => expect(el.querySelector("[role=menu]")).toBeTruthy());
      const items = [...el.querySelectorAll<HTMLElement>("[role=menuitem]")];
      expect(items.map((i) => i.textContent)).toContain("Pin to start");
      expect(items[0]?.getBoundingClientRect().height).toBeGreaterThanOrEqual(30);
      await userEvent.keyboard("{ArrowDown}{Enter}");
      await frame();
      expect(el.sort).toEqual([{ id: "age", direction: "desc" }]);
      await vi.waitFor(() => expect(el.querySelector("[role=menu]")).toBeNull());
      expect(active()).toBe(header(el, "age"));
      el.querySelector<HTMLElement>("[data-col=city] [data-ui-part=menu-button]")!.click();
      await vi.waitFor(() => expect(el.querySelector("[role=menu]")).toBeTruthy());
      [...el.querySelectorAll<HTMLElement>("[role=menuitem]")]
        .find((i) => i.textContent === "Pin to end")!
        .click();
      await frame();
      expect(el.pinned.right).toEqual(["city"]);
    });
  });

  describe("performance on 100 000 x 200", () => {
    it("reuses rows and cells, and a scroll inside the window touches no DOM", async () => {
      const el = await grid("", huge, { width: 900, height: 480 });
      const rowsBefore = new Set(bodyRows(el));
      const mutations: MutationRecord[] = [];
      const watcher = new MutationObserver((records) => mutations.push(...records));
      watcher.observe(el, { childList: true, subtree: true });
      viewport(el).scrollTop = 2;
      await frame();
      await frame();
      watcher.takeRecords();
      expect(mutations.length).toBe(0);
      watcher.disconnect();
      const seen = new Set<Element>(rowsBefore);
      for (let i = 1; i <= 200; i += 1) {
        viewport(el).scrollTop = i * 300;
        viewport(el).scrollLeft = i * 70;
        await frame();
        for (const row of bodyRows(el)) seen.add(row);
      }
      // 200 scroll steps across 200 x 300 px of rows: pooling keeps the element count bounded.
      expect(seen.size).toBeLessThan(rowsBefore.size * 2 + 10);
      expect(el.querySelectorAll("*").length).toBeLessThan(3000);
    });

    it("spends little script time per scroll step (window shifts included)", async () => {
      const el = await grid("", huge, { width: 1100, height: 600 });
      const scroller = viewport(el);
      const costs: number[] = [];
      for (let i = 1; i <= 300; i += 1) {
        scroller.scrollTop = i * 83;
        scroller.scrollLeft = i * 61;
        const start = performance.now();
        scroller.dispatchEvent(new Event("scroll"));
        costs.push(performance.now() - start);
        if (i % 10 === 0) await frame();
      }
      costs.sort((a, b) => a - b);
      const median = costs[150] as number;
      const p95 = costs[285] as number;
      console.info(
        `d1 scroll script cost 100k x 200: median ${median.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`,
      );
      expect(median).toBeLessThan(4);
      expect(p95).toBeLessThan(12);
    });

    it("renders a scroll frame within budget (rAF timing)", async () => {
      const el = await grid("", huge, { width: 1100, height: 600 });
      const scroller = viewport(el);
      const times: number[] = [];
      let last = performance.now();
      await new Promise<void>((resolve) => {
        let n = 0;
        const tick = (now: number) => {
          times.push(now - last);
          last = now;
          scroller.scrollTop += 83;
          scroller.scrollLeft += 61;
          n += 1;
          if (n < 150) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      const sorted = [...times.slice(5)].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] as number;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] as number;
      console.info(
        `d1 scroll frame 100k x 200: median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`,
      );
      expect(median).toBeLessThan(20);
      expect(p95).toBeLessThan(50);
    });
  });

  describe("review fixes", () => {
    const wide = (el: UiDataGrid) => {
      el.columns = ["a", "b", "c", "d"].map((id) => ({ id, header: id.toUpperCase(), width: 300 }));
      el.rows = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, a: i, b: i, c: i, d: i }));
      el.rowKey = "id";
    };
    const violations = async (root: Element) =>
      (
        await axe.run(root, {
          // Contrast needs the page theme; "region" is about the page, not the component.
          rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
        })
      ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

    it("passes axe: the grid owns only rows; status, menu and empty message are siblings", async () => {
      const el = await grid('selection="multi" pinned-left="name" column-menu');
      expect(await violations(el)).toEqual([]);
      for (const child of gridEl(el).querySelectorAll("*")) {
        const role = child.getAttribute("role");
        expect(role === "status" || role === "menu").toBe(false);
      }
      expect(gridEl(el).querySelector("[data-ui-part=empty]")).toBeNull();
      header(el, "age").focus();
      await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
      await vi.waitFor(() => expect(el.querySelector("[role=menu]")).toBeTruthy());
      expect(gridEl(el).contains(el.querySelector("[role=menu]"))).toBe(false);
      expect(await violations(document.body)).toEqual([]);
      document.body.innerHTML = "";
      const empty = await grid("", (g) => {
        g.columns = peopleColumns();
        g.rows = [];
      });
      expect(text(empty.querySelector("[data-ui-part=empty]"))).toBe("No rows");
      expect(gridEl(empty).contains(empty.querySelector("[data-ui-part=empty]"))).toBe(false);
      expect(await violations(empty)).toEqual([]);
    });

    it("caps pinned zones: a pin that leaves no room to scroll is refused and announced", async () => {
      const el = await grid("", wide, { width: 700 });
      expect(el.pinColumn("a", "left")).toBe(true);
      expect(el.pinColumn("b", "left")).toBe(false);
      expect(el.pinColumn("d", "right")).toBe(false);
      await frame();
      await frame();
      expect(el.pinned).toEqual({ left: ["a"], right: [] });
      expect(text(el.querySelector("[role=status]"))).toContain("cannot be pinned");
      expect(el.hasAttribute("data-pin-overflow")).toBe(false);
      expect(el.pinColumn("a", null)).toBe(true);
    });

    it("scrolls pins that arrive overflowing and never focuses a hidden cell", async () => {
      const over = await grid('pinned-left="a,b,c"', wide, { width: 700 });
      expect(over.hasAttribute("data-pin-overflow")).toBe(true);
      expect(getComputedStyle(over.querySelector('[data-zone="start"]') as Element).position).toBe(
        "relative",
      );
      const shown = (el: UiDataGrid, id: string) => {
        const box = (el.getCellElement("r1", id) as HTMLElement).getBoundingClientRect();
        const view = viewport(el).getBoundingClientRect();
        return box.left >= view.left - 1 && box.right <= view.right + 1;
      };
      for (const [col, id] of [
        [2, "c"],
        [3, "d"],
        [0, "a"],
      ] as const) {
        over.focusCell(2, col);
        await frame();
        expect(shown(over, id)).toBe(true);
      }
      document.body.innerHTML = "";
      const el = await grid("", wide, { width: 700 });
      el.pinColumn("a", "left");
      await frame();
      const zone = el.querySelector('[data-zone="start"]') as HTMLElement;
      for (const [col, id] of [
        [3, "d"],
        [1, "b"],
      ] as const) {
        el.focusCell(2, col);
        await frame();
        const box = (el.getCellElement("r1", id) as HTMLElement).getBoundingClientRect();
        expect(box.left).toBeGreaterThanOrEqual(zone.getBoundingClientRect().right - 1);
      }
    });

    it("reorders at a zone boundary: lands before the next column of the zone", async () => {
      const el = await grid('reorderable pinned-left="name"', undefined, { width: 380 });
      await dragHeader(el, "city", "age");
      expect(el.layout.order).toEqual(["name", "city", "age"]);
    });

    it("renames repeated row keys so no row is dropped, and warns", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const el = await grid('selection="multi"', (g) => {
        g.columns = [{ id: "name", header: "Name" }];
        g.rows = [
          { id: "x", name: "A" },
          { id: "x", name: "B" },
          { id: "y", name: "C" },
          { id: "x", name: "D" },
        ];
        g.rowKey = "id";
      });
      expect(gridEl(el).getAttribute("aria-rowcount")).toBe("5");
      expect(bodyRows(el).map((row) => text(row.querySelector("[data-col=name]")))).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
      expect(text(el.getCellElement("x#2", "name"))).toBe("B");
      expect(text(el.getCellElement("x#3", "name"))).toBe("D");
      cell(el, "x#2", "name").click();
      await frame();
      expect(el.selectedKeys).toEqual(["x#2"]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("repeated row key"));
      warn.mockRestore();
    });

    it("focusing the header row leaves scrollTop alone, by position or by key", async () => {
      const el = await grid("", (g) => {
        g.columns = peopleColumns();
        g.rows = people(200);
        g.rowKey = "id";
      });
      viewport(el).scrollTop = 800;
      await frame();
      el.focusCell(0, 1);
      expect(active()).toBe(header(el, "age"));
      el.focusCell(null, "city");
      expect(active()).toBe(header(el, "city"));
      expect(viewport(el).scrollTop).toBe(800);
    });

    it("focuses by row key and column id", async () => {
      const el = await grid("", (g) => {
        g.columns = peopleColumns();
        g.rows = people(200);
        g.rowKey = "id";
      });
      el.focusCell("p120", "city");
      await frame();
      expect(active()).toBe(cell(el, "p120", "city"));
      el.focusCell("nope", "city");
      el.focusCell("p3", "nope");
      expect(active()).toBe(cell(el, "p120", "city"));
    });

    it("selection and resize move nothing but their own attributes (no refill, same nodes)", async () => {
      const fills = vi.fn();
      const el = await grid('selection="multi"', (g) => {
        g.columns = [
          {
            id: "name",
            header: "Name",
            width: 160,
            cell: (c) => {
              fills();
              return String(c.value);
            },
          },
          { id: "age", header: "Age", type: "number", width: 90 },
        ];
        g.rows = people(50);
        g.rowKey = "id";
      });
      const nodes = [...cells(el), ...bodyRows(el)];
      expect(fills).toHaveBeenCalled();
      fills.mockClear();

      cell(el, "p1", "name").click();
      cell(el, "p3", "age").click();
      await frame();
      await frame();
      expect(bodyRows(el)[3]?.getAttribute("aria-selected")).toBe("true");
      expect(fills).not.toHaveBeenCalled();

      el.selectedKeys = ["p2", "p4"];
      await frame();
      expect(bodyRows(el)[2]?.getAttribute("aria-selected")).toBe("true");
      expect((cell(el, "p2", "__select").querySelector("input") as HTMLInputElement).checked).toBe(
        true,
      );
      expect(fills).not.toHaveBeenCalled();

      el.resizeColumn("name", 220);
      await frame();
      await frame();
      expect(header(el, "name").getBoundingClientRect().width).toBe(220);
      expect(cell(el, "p1", "name").getBoundingClientRect().width).toBe(220);
      expect(fills).not.toHaveBeenCalled();

      // A pointer resize runs a geometry pass per frame and fills nothing.
      const handle = header(el, "name").querySelector("[data-ui-part=handle]") as HTMLElement;
      const from = handle.getBoundingClientRect();
      const x = from.left + from.width / 2;
      const y = from.top + from.height / 2;
      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
        }),
      );
      for (const dx of [10, 20, 30]) {
        handle.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: x + dx,
            clientY: y,
            pointerId: 1,
            pointerType: "mouse",
          }),
        );
        await frame();
        await frame();
        expect(fills).not.toHaveBeenCalled();
      }
      handle.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: x + 30,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      await frame();
      expect(header(el, "name").getBoundingClientRect().width).toBe(250);
      expect(fills).not.toHaveBeenCalled();
      expect(cells(el).every((c) => nodes.includes(c))).toBe(true);
      expect(bodyRows(el).every((r) => nodes.includes(r))).toBe(true);
    });

    it("refreshRows refills only those rows; an editing cell is exempt and stays mounted", async () => {
      const fills = vi.fn();
      const data = people(300);
      const el = await grid("", (g) => {
        g.columns = [
          {
            id: "name",
            header: "Name",
            cell: (c) => {
              fills(c.rowId);
              return String(c.value);
            },
          },
        ];
        g.rows = data;
        g.rowKey = "id";
      });
      fills.mockClear();
      (data[2] as Person).name = "Changed";
      (data[3] as Person).name = "Other";
      el.refreshRows(["p2", "p999"]);
      await frame();
      expect(fills.mock.calls).toEqual([["p2"]]);
      expect(text(cell(el, "p2", "name"))).toBe("Changed");
      expect(text(cell(el, "p3", "name"))).not.toBe("Other");

      el.setEditingCell("p1", "name");
      (data[1] as Person).name = "Mid edit";
      el.refresh();
      await frame();
      await frame();
      expect(text(cell(el, "p1", "name"))).not.toBe("Mid edit");
      expect(text(cell(el, "p4", "name"))).toBe("Person 0004");
      viewport(el).scrollTop = 40 * 200;
      await frame();
      await frame();
      expect(el.getCellElement("p1", "name")).toBeTruthy();
      viewport(el).scrollTop = 0;
      await frame();
      el.setEditingCell(null);
      await frame();
      await frame();
      expect(text(cell(el, "p1", "name"))).toBe("Mid edit");
    });

    it("fires cancelable beforecelledit and beforecellchange hooks for D2", async () => {
      const el = await grid("", (g) => {
        g.columns = peopleColumns();
        g.rows = people(5);
        g.rowKey = "id";
      });
      const edit = vi.fn((e: Event) => e.preventDefault());
      const activate = vi.fn();
      el.addEventListener("beforecelledit", edit);
      el.addEventListener("cellactivate", activate);
      cell(el, "p1", "name").focus();
      await userEvent.keyboard("{Enter}");
      expect(edit).toHaveBeenCalledTimes(1);
      expect(activate).not.toHaveBeenCalled();
      await userEvent.keyboard("{F2}");
      expect(edit).toHaveBeenCalledTimes(2);

      const before = vi.fn((e: Event) => e.preventDefault());
      el.addEventListener("beforecellchange", before);
      expect(el.changeCell("p1", "name", "Nope")).toBe(false);
      expect(before.mock.calls[0]?.[0]).toMatchObject({
        detail: { rowKey: "p1", columnId: "name", oldValue: "Person 0001", value: "Nope" },
      });
      expect(text(cell(el, "p1", "name"))).toBe("Person 0001");
      el.removeEventListener("beforecellchange", before);
      expect(el.changeCell("p1", "name", "Yes")).toBe(true);
      await frame();
      expect(text(cell(el, "p1", "name"))).toBe("Yes");
    });

    it("keeps controls in a cell out of the tab order until Enter / F2 enters it", async () => {
      const el = await grid("", (g) => {
        g.columns = [
          {
            id: "name",
            header: "Name",
            cell: () => {
              const wrap = document.createElement("span");
              wrap.innerHTML =
                '<button type="button">Go</button><input aria-label="Note" value="">';
              return wrap;
            },
          },
          { id: "age", header: "Age" },
        ];
        g.rows = people(5);
        g.rowKey = "id";
      });
      const controls = [
        ...el.querySelectorAll<HTMLElement>("[role=gridcell] button, [role=gridcell] input"),
      ];
      expect(controls.length).toBeGreaterThan(0);
      expect(controls.every((c) => c.tabIndex === -1)).toBe(true);
      expect(tabStops(el)).toBe(1);
      cell(el, "p1", "name").focus();
      await userEvent.keyboard("{Enter}");
      expect(active().localName).toBe("button");
      expect(cell(el, "p1", "name").querySelector("input")?.tabIndex).toBe(0);
      await userEvent.keyboard("{Tab}");
      expect(active().localName).toBe("input");
      await userEvent.keyboard("ab{ArrowLeft}{ArrowDown}");
      expect(active().localName).toBe("input");
      expect((active() as HTMLInputElement).value).toBe("ab");
      await userEvent.keyboard("{Escape}");
      expect(active()).toBe(cell(el, "p1", "name"));
      expect(cell(el, "p1", "name").querySelector("input")?.tabIndex).toBe(-1);
      await userEvent.keyboard("{F2}");
      expect(active().localName).toBe("button");
      await userEvent.keyboard("{F2}");
      expect(active()).toBe(cell(el, "p1", "name"));
      await userEvent.keyboard("{ArrowDown}");
      expect(active()).toBe(cell(el, "p2", "name"));
    });

    it("lets a column that grew past the default cap keep its width on a resize", async () => {
      const el = await grid("", undefined, { width: 1600 });
      const grown = header(el, "name").getBoundingClientRect().width;
      expect(grown).toBeGreaterThan(640);
      header(el, "name").focus();
      await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
      expect(header(el, "name").getBoundingClientRect().width).toBe(Math.round(grown) - 16);
    });

    it("formats and sorts by locale: property, attribute, [lang], then the browser", async () => {
      const mk = (attrs: string) =>
        grid(attrs, (g) => {
          g.columns = [
            { id: "n", header: "N", type: "number" },
            { id: "d", header: "D", type: "date" },
            { id: "ok", header: "Ok", type: "boolean" },
            { id: "w", header: "W" },
          ];
          g.rows = [
            { n: 1234567.5, d: new Date(2024, 1, 29), ok: true, w: "ñu" },
            { n: 2, d: new Date(2024, 1, 29), ok: false, w: "nz" },
            { n: 3, d: null, ok: true, w: "oz" },
          ];
        });
      const col = (el: UiDataGrid, id: string) =>
        bodyRows(el).map((row) => text(row.querySelector(`[data-col=${id}]`)));
      const pe = await mk('locale="es-PE"');
      expect(col(pe, "n")[0]).toBe("1 234 567.5");
      expect(col(pe, "d")[0]).toMatch(/feb/i);
      expect(col(pe, "ok")).toEqual(["Yes", "No", "Yes"]);
      pe.locale = "en-US";
      await frame();
      await frame();
      expect(col(pe, "n")[0]).toBe("1,234,567.5");
      expect(col(pe, "d")[0]).toMatch(/Feb/);
      pe.labels = { yes: "Sí", no: "No" };
      await frame();
      await frame();
      expect(col(pe, "ok")).toEqual(["Sí", "No", "Sí"]);
      document.body.innerHTML = "";

      const el = await mk("");
      el.parentElement?.setAttribute("lang", "de-DE");
      el.refresh();
      await frame();
      await frame();
      expect(el.locale).toBe("de-DE");
      expect(col(el, "n")[0]).toBe("1.234.567,5");
      el.parentElement?.removeAttribute("lang");
      el.refresh();
      await frame();
      await frame();
      expect(el.locale).toBe(document.documentElement.lang || navigator.language);

      el.setSort([{ id: "w", direction: "asc" }]);
      el.locale = "es";
      await frame();
      await frame();
      expect(col(el, "w")).toEqual(["nz", "ñu", "oz"]);
      el.locale = "en";
      await frame();
      await frame();
      expect(col(el, "w")).toEqual(["ñu", "nz", "oz"]);
    });

    it("puts aria-sort on the primary sorted header only", async () => {
      const el = await grid();
      el.setSort([
        { id: "age", direction: "asc" },
        { id: "name", direction: "desc" },
      ]);
      await frame();
      await frame();
      expect(header(el, "age").getAttribute("aria-sort")).toBe("ascending");
      expect(header(el, "name").hasAttribute("aria-sort")).toBe(false);
      expect(header(el, "name").dataset.sort).toBe("descending");
      expect(header(el, "city").hasAttribute("aria-sort")).toBe(false);
    });

    it("scrolls the focused row into view after a sort", async () => {
      const el = await grid("", (g) => {
        g.columns = peopleColumns();
        g.rows = people(300);
        g.rowKey = "id";
      });
      el.focusCell("p10", "name");
      await frame();
      el.setSort([{ id: "name", direction: "desc" }]);
      await frame();
      await frame();
      await frame();
      const box = cell(el, "p10", "name").getBoundingClientRect();
      const view = viewport(el).getBoundingClientRect();
      expect(box.top).toBeGreaterThanOrEqual(view.top);
      expect(box.bottom).toBeLessThanOrEqual(view.bottom + 1);
      expect(active()).toBe(cell(el, "p10", "name"));
    });

    it("persists only the widths the user changed, with a version, and adds new columns in place", async () => {
      localStorage.removeItem("dg-test");
      const el = await grid('storage-key="dg-test"');
      el.resizeColumn("age", 150);
      el.moveColumn("city", -1);
      const stored = JSON.parse(localStorage.getItem("dg-test") as string);
      expect(stored.v).toBe(1);
      expect(stored.widths).toEqual({ age: 150 });
      expect(stored.order).toEqual(["name", "city", "age"]);
      document.body.innerHTML = "";
      const again = await grid('storage-key="dg-test"', (g) => {
        g.columns = [
          { id: "name", header: "Name", width: 160 },
          { id: "extra", header: "Extra" },
          { id: "age", header: "Age", type: "number", width: 90 },
          { id: "city", header: "City", width: 120 },
        ];
        g.rows = people(5);
        g.rowKey = "id";
      });
      expect(again.layout.order).toEqual(["name", "extra", "city", "age"]);
      expect(again.layout.widths.age).toBe(150);
      localStorage.removeItem("dg-test");
    });

    it("follows label removal and storage-key changes after connect", async () => {
      localStorage.setItem("dg-key-b", JSON.stringify({ v: 1, order: ["city", "age", "name"] }));
      const el = await grid("");
      expect(gridEl(el).getAttribute("aria-label")).toBe("People");
      el.removeAttribute("label");
      expect(gridEl(el).hasAttribute("aria-label")).toBe(false);
      el.setAttribute("label", "Clients");
      expect(gridEl(el).getAttribute("aria-label")).toBe("Clients");
      el.setAttribute("storage-key", "dg-key-b");
      await frame();
      await frame();
      expect(el.layout.order).toEqual(["city", "age", "name"]);
      expect(header(el, "city").getAttribute("aria-colindex")).toBe("1");
      localStorage.removeItem("dg-key-b");
    });

    it("rejects the reserved checkbox id and reserved custom element names", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const el = await grid("", (g) => {
        g.columns = [
          { id: "__select", header: "Mine" },
          { id: "name", header: "Name", cellTag: "font-face" },
        ];
        g.rows = people(3);
        g.rowKey = "id";
      });
      expect(el.columns.map((c) => c.id)).toEqual(["name"]);
      expect(warn).toHaveBeenCalled();
      expect(el.querySelector("font-face")).toBeNull();
      expect(text(cell(el, "p1", "name"))).toBe("Person 0001");
      warn.mockRestore();
    });
  });
});
