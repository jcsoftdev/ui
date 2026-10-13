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

describe("ui-data-grid", () => {
  it("is a grid with full counts and a window of rows, columns and indices under virtual scroll", async () => {
    const el = await grid("", huge, { width: 800, height: 400 });
    expect(el.getAttribute("role")).toBe("grid");
    expect(el.getAttribute("aria-label")).toBe("People");
    expect(el.getAttribute("aria-rowcount")).toBe("100001");
    expect(el.getAttribute("aria-colcount")).toBe("200");
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
    expect(el.getAttribute("aria-rowcount")).toBe("100001");
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
      await userEvent.keyboard("{Control>}{Home}{/Control}");
      expect(active()).toBe(header(el, "name"));
      expect(viewport(el).scrollTop).toBe(0);
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
      expect(header(el, "age").getAttribute("aria-sort")).toBe("none");
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
      expect(header(el, "age").getAttribute("aria-sort")).toBe("none");
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
      expect(el.getAttribute("aria-multiselectable")).toBe("true");
      expect(el.getAttribute("aria-colcount")).toBe("4");
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
      expect(el.getAttribute("aria-rowcount")).toBe("5");
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
});
