import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { UiTreeChart } from "../src/tree-chart/tree-chart.ts";
import { defineTreeChart } from "../src/tree-chart/tree-chart.ts";
import { frame, mount, wait } from "./setup.ts";

beforeAll(() => defineTreeChart());
/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
beforeEach(async () => {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
});
afterEach(() => {
  document.body.innerHTML = "";
});

const ORG = {
  name: "Ana Rojas",
  subtitle: "CEO",
  children: [
    {
      name: "Luis Paredes",
      subtitle: "Operations",
      badge: "Lima",
      children: [{ name: "Mia Torres" }, { name: "Noa Quispe" }],
    },
    {
      name: "Kevin Salas",
      subtitle: "Sales",
      children: [{ name: "Omar Diaz" }, { name: "Pia Leon" }, { name: "Quin Vega" }],
    },
    { name: "Rita Campos", subtitle: "Finance" },
  ],
};
const PRE_ORDER = [
  "Ana Rojas",
  "Luis Paredes",
  "Mia Torres",
  "Noa Quispe",
  "Kevin Salas",
  "Omar Diaz",
  "Pia Leon",
  "Quin Vega",
  "Rita Campos",
];

const settle = async () => {
  await frame();
  await frame();
  await wait(60);
};
const make = async (attrs = "", width = 1300, data: unknown = ORG) => {
  const host = mount(
    `<div style="width:${width}px"><ui-tree-chart id="t" locale="en-US" label="Org chart" height="420" fit="contain" animate="off" ${attrs}></ui-tree-chart></div>`,
  );
  const chart = host.querySelector("ui-tree-chart") as UiTreeChart;
  chart.data = data as never;
  await settle();
  return chart;
};
const cards = (c: Element) => [...c.querySelectorAll<SVGGElement>("[data-card]")];
const names = (c: Element) =>
  cards(c)
    .filter((card) => card.getAttribute("role") === "img")
    .map((card) => card.getAttribute("aria-label")?.split(". ")[0]);
const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
const center = (el: Element) => {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};
const pointer = (c: Element, type: string, clientX: number, clientY: number, kind = "mouse") =>
  drawingOf(c).dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerleave",
      cancelable: true,
      clientX,
      clientY,
      pointerType: kind,
      pointerId: 7,
      isPrimary: true,
    }),
  );
const awake = async (c: Element) => {
  pointer(c, "pointerenter", -1000, -1000);
  await wait(80);
};
const transform = (c: Element) => (c.querySelector("[data-stage]") as SVGElement).style.transform;
const events = (c: Element, type: string) => {
  const seen: unknown[] = [];
  c.addEventListener(type, (event) => seen.push((event as CustomEvent).detail));
  return seen;
};

describe("ui-tree-chart", () => {
  it("draws the visible nodes as marks in pre-order, each named by its place in the tree", async () => {
    const c = await make();
    expect(names(c)).toEqual(PRE_ORDER);
    const luis = cards(c)[1] as SVGElement;
    expect(luis.getAttribute("aria-label")).toBe(
      "Luis Paredes. Operations. Lima. Level 2. 1 of 3. Direct reports: 2. Total below: 2",
    );
    // One tab stop over the marks.
    expect(cards(c).filter((card) => card.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(c.querySelectorAll("[data-edge]")).toHaveLength(8);
    expect(c.querySelectorAll("[data-toggle]")).toHaveLength(3);
  });

  it("hovers one card at a time while the pointer sweeps across cards and the gutters between them", async () => {
    const c = await make();
    await awake(c);
    const seen: Array<number | null> = [];
    c.addEventListener("chart-hover", (e) => seen.push((e as CustomEvent).detail?.index ?? null));
    // Mia and Noa are 20px apart: the gutter belongs to the nearest card, so nothing blinks.
    const first = center(cards(c)[2] as Element);
    const last = center(cards(c)[3] as Element);
    for (let x = first.x; x <= last.x; x += 3) pointer(c, "pointermove", x, first.y);
    await settle();
    expect(seen).toEqual([2, 3]);
    expect(c.querySelectorAll("[data-card][data-path]")).toHaveLength(3); // Noa, Luis and the root
    // Far from every card (more than the gap): nothing.
    pointer(c, "pointermove", first.x, first.y + 90);
    expect(seen).toEqual([2, 3, null]);
  });

  it("walks the tree with the arrows by the direction, and keeps focus on a node that collapses", async () => {
    const c = await make();
    await userEvent.tab();
    await wait(100);
    const active = () => (document.activeElement as Element).getAttribute("data-id");
    const label = () =>
      (document.activeElement as Element).getAttribute("aria-label")?.split(". ")[0];
    expect(label()).toBe("Ana Rojas");
    await userEvent.keyboard("{ArrowDown}");
    expect(label()).toBe("Kevin Salas"); // the middle child
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(label()).toBe("Rita Campos"); // siblings stop at the end
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(label()).toBe("Luis Paredes");
    await userEvent.keyboard("{ArrowDown}");
    expect(label()).toBe("Mia Torres"); // of two children, the first
    await userEvent.keyboard("{Backspace}");
    expect(label()).toBe("Luis Paredes");
    await userEvent.keyboard("{ArrowUp}");
    expect(label()).toBe("Ana Rojas");
    await userEvent.keyboard("{End}");
    expect(label()).toBe("Rita Campos");
    await userEvent.keyboard("{Home}");
    expect(label()).toBe("Ana Rojas");
    const toggles = events(c, "toggle");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await settle();
    expect(toggles).toEqual([{ id: "root", expanded: false }]);
    expect(names(c)).toEqual(["Ana Rojas"]);
    expect(active()).toBe("root");
    expect(document.activeElement).toBe(cards(c)[0]);
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await settle();
    expect(names(c)).toEqual(PRE_ORDER);
    expect(document.activeElement).toBe(cards(c)[0]);
  });

  it("follows the direction: left to right makes Right the child and Down the next sibling", async () => {
    await make('direction="left"');
    await userEvent.tab();
    await wait(100);
    const label = () =>
      (document.activeElement as Element).getAttribute("aria-label")?.split(". ")[0];
    await userEvent.keyboard("{ArrowRight}");
    expect(label()).toBe("Kevin Salas");
    await userEvent.keyboard("{ArrowDown}");
    expect(label()).toBe("Rita Campos");
    await userEvent.keyboard("{ArrowLeft}");
    expect(label()).toBe("Ana Rojas");
  });

  it("a touch tap only toggles without selectable, as a click does, and never pins", async () => {
    const c = await make();
    await awake(c);
    const kevin = center(cards(c)[4] as Element);
    pointer(c, "pointerdown", kevin.x, kevin.y, "touch");
    pointer(c, "pointerup", kevin.x, kevin.y, "touch");
    expect(c.selected).toBeNull();
    expect((c as unknown as { hover: { pinned: boolean } | null }).hover?.pinned ?? false).toBe(
      false,
    );
  });

  it("with selectable a tap pins a node, a drag pans and never pins, and a press on a toggle expands or collapses", async () => {
    const c = await make("selectable");
    await awake(c);
    const kevin = center(cards(c)[4] as Element);
    pointer(c, "pointerdown", kevin.x, kevin.y, "touch");
    pointer(c, "pointerup", kevin.x, kevin.y, "touch");
    expect(c.selected).toBe(4);
    expect((c as unknown as { hover: { pinned: boolean } }).hover.pinned).toBe(true);
    pointer(c, "pointerdown", kevin.x, kevin.y, "touch");
    pointer(c, "pointerup", kevin.x, kevin.y, "touch");
    expect(c.selected).toBeNull();

    const before = transform(c);
    pointer(c, "pointerdown", kevin.x, kevin.y, "touch");
    pointer(c, "pointermove", kevin.x + 30, kevin.y + 20, "touch");
    pointer(c, "pointermove", kevin.x + 60, kevin.y + 40, "touch");
    pointer(c, "pointerup", kevin.x + 60, kevin.y + 40, "touch");
    expect(c.selected).toBeNull();
    expect(transform(c)).not.toBe(before);

    const toggles = events(c, "toggle");
    const toggle = c.querySelector('[data-toggle][data-id="root/Kevin Salas"]') as Element;
    const at = center(toggle);
    pointer(c, "pointerdown", at.x, at.y);
    pointer(c, "pointerup", at.x, at.y);
    toggle.dispatchEvent(
      new MouseEvent("click", { bubbles: true, detail: 1, clientX: at.x, clientY: at.y }),
    );
    await settle();
    expect(toggles).toEqual([{ id: "root/Kevin Salas", expanded: false }]);
    expect(names(c)).toEqual(
      PRE_ORDER.filter((n) => !["Omar Diaz", "Pia Leon", "Quin Vega"].includes(n)),
    );
    expect(c.selected).toBeNull();
    c.expand("root/Kevin Salas");
    await settle();
    expect(names(c)).toEqual(PRE_ORDER);
  });

  it("collapses from initial-depth, counts what hangs below, and folds leaf siblings into a group", async () => {
    const c = await make('initial-depth="1" show-counts');
    expect(names(c)).toEqual(["Ana Rojas", "Luis Paredes", "Kevin Salas", "Rita Campos"]);
    expect(c.querySelectorAll("[data-count]")).toHaveLength(3);
    const g = await make('group-leaves="3"');
    expect(names(g)).toContain("3 more");
    expect(names(g)).not.toContain("Omar Diaz");
  });

  it("lays out radial and dendrogram trees with chips", async () => {
    for (const layout of ["radial", "dendrogram"]) {
      const c = await make(`layout="${layout}"`, 700);
      expect(names(c)).toEqual(PRE_ORDER);
      expect(cards(c)[0]?.hasAttribute("data-chip")).toBe(true);
    }
  });

  it("fetches lazy children on expand with a spinner, and reports a failure", async () => {
    const data = {
      name: "Root",
      children: [
        { name: "Branch", lazy: true, childCount: 2 },
        { name: "Broken", lazy: true },
      ],
    };
    const c = await make("", 700, data);
    let resolve: (value: unknown[]) => void = () => {};
    c.loadChildren = (node) =>
      node.name === "Broken"
        ? Promise.reject(new Error("nope"))
        : new Promise((done) => {
            resolve = done as never;
          });
    const toggles = events(c, "toggle");
    const errors: Array<{ id: string }> = [];
    c.addEventListener("load-error", (e) => errors.push((e as CustomEvent).detail));
    c.expand("root/Branch");
    await settle();
    expect(c.querySelector("[data-spin]")).not.toBeNull();
    resolve([{ name: "Leaf A" }, { name: "Leaf B" }]);
    await settle();
    await wait(450);
    expect(names(c)).toEqual(["Root", "Branch", "Leaf A", "Leaf B", "Broken"]);
    expect(toggles).toEqual([{ id: "root/Branch", expanded: true }]);
    c.expand("root/Broken");
    await settle();
    expect(errors.map((e) => e.id)).toEqual(["root/Broken"]);
  });

  it("glides between layouts with a stable set of marks, so a hover never blinks", async () => {
    const host = mount(
      `<div style="width:1300px"><ui-tree-chart label="Org" height="420" fit="contain" locale="en-US"></ui-tree-chart></div>`,
    );
    const c = host.querySelector("ui-tree-chart") as UiTreeChart;
    c.data = ORG as never;
    await settle();
    await awake(c);
    const luis = center(cards(c)[1] as Element);
    pointer(c, "pointermove", luis.x, luis.y);
    const seen: Array<number | null> = [];
    c.addEventListener("chart-hover", (e) => seen.push((e as CustomEvent).detail?.index ?? null));
    const live = () => c.querySelectorAll("[data-node]:not([aria-hidden]) [data-card]").length;
    c.collapse("root/Kevin Salas");
    await frame();
    await frame();
    // Mid-transition the three folding nodes are still drawn, but the marks are already the final six.
    await wait(120);
    expect(live()).toBe(6);
    expect(c.querySelectorAll("[data-node]").length).toBe(9);
    await wait(450);
    expect(c.querySelectorAll("[data-node]").length).toBe(6);
    // The card slides away from the resting pointer: its details follow it (index 1 again, a new
    // anchor) and close once, at the end. They never close and reopen on the way.
    expect(seen.filter((index) => index !== null && index !== 1)).toEqual([]);
    expect(seen.indexOf(null)).toBeGreaterThanOrEqual(seen.length - 1);
  });

  it("searches: matches are ringed, Enter steps through them and pins each", async () => {
    const c = await make("searchable");
    await wait(150);
    const input = c.querySelector("input[type=search]") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = "sales";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    await wait(100);
    expect(c.querySelectorAll("[data-card][data-matched]")).toHaveLength(1);
    expect(c.selected).toBe(4);
    input.value = "o";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(c.querySelectorAll("[data-card][data-matched]").length).toBeGreaterThan(2);
  });

  it("draws a custom SVG template for a node", async () => {
    const host = mount(
      `<div style="width:900px"><ui-tree-chart id="t" label="x" height="300" fit="contain"></ui-tree-chart></div>`,
    );
    const c = host.querySelector("ui-tree-chart") as UiTreeChart;
    c.renderNode = (node, state) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "text");
      g.setAttribute("data-custom-node", node.name);
      g.setAttribute("y", `${state.height / 2}`);
      g.textContent = node.name;
      return g;
    };
    c.data = { name: "A", children: [{ name: "B" }] };
    await settle();
    expect(c.querySelectorAll("[data-custom-node]")).toHaveLength(2);
    expect(c.querySelector("[data-name]")).toBeNull();
  });

  it("reads JSON data, takes labels, zooms with the keys and with Ctrl + wheel, and recovers from empty", async () => {
    const host = mount(
      `<div style="width:1300px"><ui-tree-chart label="Org" height="420" fit="contain" animate="off" data='${JSON.stringify(ORG)}'></ui-tree-chart></div>`,
    );
    const c = host.querySelector("ui-tree-chart") as UiTreeChart;
    await settle();
    expect(names(c)).toEqual(PRE_ORDER);
    c.labels = { level: "Nivel", of: "de" };
    c.requestDraw();
    await settle();
    expect(cards(c)[1]?.getAttribute("aria-label")).toContain("Nivel 2. 1 de 3");

    await userEvent.tab();
    await wait(100);
    const k = () => Number(/scale\(([\d.]+)\)/.exec(transform(c))?.[1]);
    const fitted = k();
    await userEvent.keyboard("+");
    await wait(30);
    expect(k()).toBeCloseTo(Math.min(2.5, fitted * 1.25), 2);
    await userEvent.keyboard("0");
    await wait(30);
    expect(k()).toBeCloseTo(fitted, 2);
    const box = drawingOf(c).getBoundingClientRect();
    const wheel = (ctrlKey: boolean) =>
      drawingOf(c).dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -120,
          ctrlKey,
          clientX: box.left + 400,
          clientY: box.top + 200,
          bubbles: true,
          cancelable: true,
        }),
      );
    wheel(false);
    await wait(30);
    expect(k()).toBeCloseTo(fitted, 2); // a plain wheel scrolls the page
    wheel(true);
    await wait(30);
    expect(k()).toBeGreaterThan(fitted);

    c.setAttribute("empty", "");
    await settle();
    expect(c.querySelectorAll("[data-card]")).toHaveLength(0);
    c.removeAttribute("empty");
    await settle();
    expect(names(c)).toEqual(PRE_ORDER);
    expect(c.querySelector("[role=toolbar]")).not.toBeNull();
  });

  it("keeps the path of the pinned node lit when selectable, and not otherwise", async () => {
    const lit = (c: Element) => c.querySelectorAll("[data-card][data-path]").length;
    for (const [attrs, expected] of [
      ['selectable highlight-path="off"', 3],
      ["selectable", 3],
      ["", 0],
    ] as const) {
      const c = await make(attrs);
      await awake(c);
      const noa = center(cards(c)[3] as Element);
      pointer(c, "pointerdown", noa.x, noa.y, "touch");
      pointer(c, "pointerup", noa.x, noa.y, "touch");
      await settle();
      expect(lit(c)).toBe(expected);
      document.body.innerHTML = "";
    }
  });

  it("has no axe violations, gives the screen reader a table of the nodes and zoom controls", async () => {
    const c = await make("searchable");
    await wait(200);
    const result = await axe.run(c, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" "))}`),
    ).toEqual([]);
    const table = c.querySelector("table");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(9);
    expect(table?.querySelector("thead")?.textContent).toContain("Reports to");
    expect(c.querySelector('[role=toolbar] button[aria-label="Zoom in"]')).not.toBeNull();
    const before = transform(c);
    (c.querySelector('button[aria-label="Zoom in"]') as HTMLElement).click();
    await wait(450);
    expect(transform(c)).not.toBe(before);
  });

  it("keeps the pin on the same node when other nodes appear or fold away", async () => {
    const pinned = (c: Element) =>
      c.querySelector("[data-card][data-selected]")?.getAttribute("aria-label")?.split(". ")[0];
    const c = await make();
    c.select(4); // Kevin Salas
    await settle();
    expect(pinned(c)).toBe("Kevin Salas");
    // Luis folds: Kevin moves from mark 4 to mark 2, and mark 4 is Pia Leon now.
    c.collapse("root/Luis Paredes");
    await settle();
    expect(c.selectedId).toBe("root/Kevin Salas");
    expect(c.selected).toBe(2);
    expect(pinned(c)).toBe("Kevin Salas");
    c.expand("root/Luis Paredes");
    await settle();
    expect(c.selected).toBe(4);
    expect(pinned(c)).toBe("Kevin Salas");
    // The last node: its old mark index is gone after Kevin folds, the pin still follows it.
    c.focusNode("root/Rita Campos");
    await settle();
    expect(c.selected).toBe(8);
    c.collapse("root/Kevin Salas");
    await settle();
    expect(c.selectedId).toBe("root/Rita Campos");
    expect(pinned(c)).toBe("Rita Campos");
    // A pinned node that folds away is unpinned on screen and pinned again when it comes back.
    c.collapse("root/Luis Paredes");
    c.focusNode("root/Luis Paredes/Mia Torres");
    await settle();
    expect(pinned(c)).toBe("Mia Torres");
    c.collapse("root/Luis Paredes");
    await settle();
    expect(pinned(c)).toBeUndefined();
    expect(c.selected).toBeNull();
    c.expand("root/Luis Paredes");
    await settle();
    expect(pinned(c)).toBe("Mia Torres");
  });

  it("keeps the pin on the same node after a lazy load adds nodes before it", async () => {
    const data = { name: "Root", children: [{ name: "Branch", lazy: true }, { name: "Last" }] };
    const c = await make("", 700, data);
    c.loadChildren = async () => [{ name: "Leaf A" }, { name: "Leaf B" }];
    c.focusNode("root/Last");
    await settle();
    expect(c.selected).toBe(2);
    c.expand("root/Branch");
    await settle();
    await wait(100);
    expect(names(c)).toEqual(["Root", "Branch", "Leaf A", "Leaf B", "Last"]);
    expect(c.selectedId).toBe("root/Last");
    expect(c.selected).toBe(4);
    expect(c.querySelector("[data-card][data-selected]")?.getAttribute("aria-label")).toMatch(
      /^Last/,
    );
  });

  it("redraws a custom template when the node data or the template changes", async () => {
    const host = mount(
      `<div style="width:700px"><ui-tree-chart label="x" height="300" fit="contain" animate="off"></ui-tree-chart></div>`,
    );
    const c = host.querySelector("ui-tree-chart") as UiTreeChart;
    const text = (prefix: string) => (node: { name: string; data: { subtitle?: string } }) => {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("data-custom-node", "");
      t.textContent = `${prefix}${node.name}:${node.data.subtitle}`;
      return t;
    };
    c.renderNode = text("");
    c.data = {
      id: "r",
      name: "A",
      subtitle: "one",
      children: [{ id: "b", name: "B", subtitle: "x" }],
    };
    await settle();
    const shown = () => [...c.querySelectorAll("[data-custom-node]")].map((el) => el.textContent);
    expect(shown()).toEqual(["A:one", "B:x"]);
    // Same ids, same state, new data: the card must not keep the old drawing.
    c.data = {
      id: "r",
      name: "A",
      subtitle: "two",
      children: [{ id: "b", name: "B", subtitle: "y" }],
    };
    await settle();
    expect(shown()).toEqual(["A:two", "B:y"]);
    c.renderNode = text("> ");
    await settle();
    expect(shown()).toEqual(["> A:two", "> B:y"]);
  });

  it("fires node-click on every click and expands or collapses without selectable", async () => {
    const c = await make();
    await awake(c);
    const clicks = events(c, "node-click") as Array<{ id: string; node: { name: string } }>;
    const toggles = events(c, "toggle");
    const selects = events(c, "select");
    await userEvent.click(cards(c)[4] as Element); // Kevin Salas
    await settle();
    expect(clicks.map((click) => [click.id, click.node.name])).toEqual([
      ["root/Kevin Salas", "Kevin Salas"],
    ]);
    expect(toggles).toEqual([{ id: "root/Kevin Salas", expanded: false }]);
    expect(names(c)).toHaveLength(6);
    expect(c.selected).toBeNull();
    expect(selects).toEqual([]);
    // A leaf has nothing to toggle but still reports the click.
    await userEvent.click(cards(c)[3] as Element);
    expect(clicks).toHaveLength(2);
    // A cancelled node-click leaves the node as it is.
    c.addEventListener("node-click", (event) => event.preventDefault());
    await userEvent.click(cards(c)[4] as Element);
    await settle();
    expect(toggles).toHaveLength(1);
    expect(names(c)).toHaveLength(6);
  });

  it("pins on click with selectable, tells select, and takes selectedId and default-selected-id", async () => {
    const c = await make("selectable");
    await awake(c);
    const clicks = events(c, "node-click");
    const selects = events(c, "select") as Array<{ id: string; node: { name: string } } | null>;
    await userEvent.click(cards(c)[4] as Element);
    await settle();
    expect(clicks).toHaveLength(1);
    expect(names(c)).toEqual(PRE_ORDER); // pinned, not collapsed
    expect(c.selectedId).toBe("root/Kevin Salas");
    expect(selects.map((event) => event?.id)).toEqual(["root/Kevin Salas"]);
    expect(selects[0]?.node.name).toBe("Kevin Salas");
    await userEvent.click(cards(c)[4] as Element);
    await settle();
    expect(c.selectedId).toBeNull();
    expect(selects.at(-1)).toBeNull();

    // selectedId pins without panning (and without telling select).
    const before = transform(c);
    const count = selects.length;
    c.selectedId = "root/Rita Campos";
    await settle();
    expect(c.selected).toBe(8);
    expect(transform(c)).toBe(before);
    expect(selects).toHaveLength(count);

    const d = await make('selectable default-selected-id="root/Luis Paredes/Noa Quispe"');
    expect(d.selectedId).toBe("root/Luis Paredes/Noa Quispe");
    expect(d.selected).toBe(3);
    expect(d.querySelectorAll("[data-card][data-path]")).toHaveLength(3);
  });

  it("names a big tree with virtual marks instead of an element per node", async () => {
    const leaves = Array.from({ length: 1100 }, (_, i) => ({ name: `Leaf ${i}` }));
    const c = await make("", 1300, { name: "Root", children: leaves });
    expect(cards(c)).toHaveLength(1101);
    expect(c.querySelectorAll("[data-card][aria-label]")).toHaveLength(0);
    expect(c.querySelector("[role=listbox]")).not.toBeNull();
  });
});
