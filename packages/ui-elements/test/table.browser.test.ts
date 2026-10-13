import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineTable, type UiTable } from "../src/table/table.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineTable();
});

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

const html = (attrs = "", width = 420) => `<ui-table ${attrs} style="width:${width}px">
  <table>
    <caption>Clients</caption>
    <thead><tr>
      <th scope="col" data-column-id="name" pinnable>Name</th>
      <th scope="col" data-column-id="city" pinnable>City</th>
      <th scope="col" data-column-id="spend" pinnable data-align="end">Spend</th>
      <th scope="col" data-column-id="since" style="min-width:300px">Since</th>
    </tr></thead>
    <tbody>
      <tr><td data-column-id="name"><a data-row-link href="#ana">Ana</a></td><td data-column-id="city">Lima</td><td data-column-id="spend" data-align="end">120</td><td data-column-id="since">2024</td></tr>
      <tr><td data-column-id="name">Beto</td><td data-column-id="city">Cusco</td><td data-column-id="spend" data-align="end">80</td><td data-column-id="since">2025</td></tr>
    </tbody>
  </table></ui-table>`;

const table = (attrs?: string, width?: number) =>
  mount(html(attrs, width)).firstElementChild as UiTable;
const cell = (el: Element, id: string, row = "td") =>
  el.querySelector<HTMLElement>(`${row}[data-column-id=${id}]`)!;
const settled = () => new Promise((resolve) => setTimeout(resolve, 60));

describe("ui-table", () => {
  it("is a real table: caption, scoped headers and cells in the AX tree", async () => {
    const el = table();
    expect(await ax("table", "Clients")).toBeTruthy();
    expect(await ax("columnheader")).toBeTruthy();
    expect(await ax("cell", "Lima")).toBeTruthy();
    expect(getComputedStyle(el).overflowX).toBe("auto");
    expect(el.scrollWidth).toBeGreaterThan(el.clientWidth);
  });

  it("stretches a row link over the whole row", async () => {
    const el = table();
    const link = el.querySelector("a[data-row-link]")!;
    const row = link.closest("tr")!;
    const before = getComputedStyle(link, "::before");
    expect(before.position).toBe("absolute");
    expect(getComputedStyle(row).position).toBe("relative");
    expect(row.getBoundingClientRect().width).toBeGreaterThan(link.getBoundingClientRect().width);
  });

  it("pinnable headers get left, right and unpin buttons with state", async () => {
    const el = table();
    await vi.waitFor(() => expect(el.querySelectorAll("[data-pin]")).toHaveLength(6));
    const name = cell(el, "name", "th");
    const buttons = Array.from(name.querySelectorAll<HTMLButtonElement>("button"));
    expect(
      buttons.map((b) => [b.getAttribute("aria-label"), b.getAttribute("aria-pressed")]),
    ).toEqual([
      ["Fijar a la izquierda", "false"],
      ["Fijar a la derecha", "false"],
    ]);
    expect(cell(el, "since", "th").querySelector("button")).toBeNull();
    expect(await ax("button", "Fijar a la izquierda")).toBeTruthy();
  });

  it("pins a column to the left: sticky with an offset, shadow when scrolled, unpin restores", async () => {
    const el = table();
    const changes: unknown[] = [];
    el.addEventListener("pinchange", (event) => changes.push((event as CustomEvent).detail));
    await vi.waitFor(() => expect(el.querySelector("[data-pin=left]")).toBeTruthy());
    await userEvent.click(cell(el, "name", "th").querySelector("[data-pin=left]")!);
    expect(changes).toEqual([{ left: ["name"], right: [] }]);
    for (const c of [cell(el, "name", "th"), cell(el, "name")]) {
      expect(c.dataset.pinned).toBe("left");
      expect(getComputedStyle(c).position).toBe("sticky");
      expect(c.style.left).toBe("0px");
    }
    const unpin = cell(el, "name", "th").querySelector("button")!;
    expect(unpin.getAttribute("aria-label")).toBe("Desfijar");
    expect(unpin.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(unpin);

    expect(cell(el, "name").hasAttribute("data-pin-shadow")).toBe(false);
    el.scrollLeft = 80;
    await vi.waitFor(() => expect(cell(el, "name").hasAttribute("data-pin-shadow")).toBe(true));
    expect(getComputedStyle(cell(el, "name")).boxShadow).not.toBe("none");
    const pinned = cell(el, "name").getBoundingClientRect().left;
    expect(Math.round(pinned)).toBe(Math.round(el.getBoundingClientRect().left));

    await userEvent.click(unpin);
    expect(changes.at(-1)).toEqual({ left: [], right: [] });
    expect(cell(el, "name").hasAttribute("data-pinned")).toBe(false);
    expect(cell(el, "name").style.left).toBe("");
  });

  it("stacks several left pins and pins right columns from the right edge", async () => {
    const el = table();
    await vi.waitFor(() => expect(el.querySelector("[data-pin=left]")).toBeTruthy());
    el.pin("name", "left");
    el.pin("city", "left");
    el.pin("spend", "right");
    const nameWidth = cell(el, "name", "th").getBoundingClientRect().width;
    expect(Number.parseFloat(cell(el, "city").style.left)).toBeCloseTo(nameWidth, 2);
    expect(cell(el, "spend").style.right).toBe("0px");
    expect(cell(el, "spend").dataset.pinned).toBe("right");
    expect(el.pinnedColumns).toEqual({ left: ["name", "city"], right: ["spend"] });
  });

  it("pinned-left / pinned-right are controlled: the table reports and waits for you", async () => {
    const el = table('pinned-left="city"');
    const changes: unknown[] = [];
    el.addEventListener("pinchange", (event) => changes.push((event as CustomEvent).detail));
    await vi.waitFor(() => expect(cell(el, "city").dataset.pinned).toBe("left"));
    el.pin("name", "left");
    expect(changes).toEqual([{ left: ["name", "city"], right: [] }]);
    expect(cell(el, "name").hasAttribute("data-pinned")).toBe(false);
    el.setAttribute("pinned-left", "name city");
    await vi.waitFor(() => expect(cell(el, "name").dataset.pinned).toBe("left"));
    expect(cell(el, "city").style.left).not.toBe("0px");
  });

  it("remembers pins in localStorage under pin-storage-key and ignores unknown ids", async () => {
    localStorage.setItem("pins-test", JSON.stringify({ left: ["city", "ghost"], right: [] }));
    const el = table('pin-storage-key="pins-test"');
    await vi.waitFor(() => expect(cell(el, "city").dataset.pinned).toBe("left"));
    el.pin("spend", "right");
    expect(JSON.parse(localStorage.getItem("pins-test")!)).toEqual({
      left: ["city"],
      right: ["spend"],
    });
    document.body.innerHTML = "";
    const again = table('pin-storage-key="pins-test"');
    await vi.waitFor(() => expect(cell(again, "spend").dataset.pinned).toBe("right"));
  });

  it("re-measures when a column resizes, and labels are configurable", async () => {
    const el = table('pinned-left="name" pinned-right="spend" label-unpin="Unpin"');
    await vi.waitFor(() => expect(cell(el, "name").dataset.pinned).toBe("left"));
    expect(cell(el, "name", "th").querySelector("button")!.getAttribute("aria-label")).toBe(
      "Unpin",
    );
    el.setAttribute("pinned-left", "name city");
    el.querySelector<HTMLElement>("th[data-column-id=name]")!.style.minWidth = "200px";
    await settled();
    await vi.waitFor(() =>
      expect(cell(el, "city").style.left).toBe(
        `${cell(el, "name", "th").getBoundingClientRect().width}px`,
      ),
    );
  });
});
