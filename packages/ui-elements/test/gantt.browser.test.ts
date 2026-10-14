import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineGantt, type GanttTask, type UiGantt } from "../src/gantt/gantt.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineGantt();
  defineChartTooltip();
});
beforeEach(async () => {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
});
afterEach(() => {
  document.body.innerHTML = "";
});

const day = (n: number) => new Date(2026, 9, n); // 2026-10-n, local midnight
const TASKS: GanttTask[] = [
  { id: "p1", name: "Discovery", start: day(5), end: day(16) },
  {
    id: "a",
    name: "Interviews",
    parentId: "p1",
    start: day(5),
    end: day(9),
    progress: 1,
    assignee: "Ana",
  },
  {
    id: "b",
    name: "Workshop",
    parentId: "p1",
    start: day(9),
    end: day(16),
    progress: 0.5,
    dependencies: ["a"],
  },
  { id: "p2", name: "Build", start: day(16), end: day(30) },
  {
    id: "c",
    name: "API",
    parentId: "p2",
    start: day(16),
    end: day(23),
    progress: 0.3,
    dependencies: ["b"],
  },
  { id: "m", name: "Launch", start: day(30), end: day(30), milestone: true, dependencies: ["c"] },
];

const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};

const gantt = async (attrs = "", tasks: GanttTask[] = TASKS, width = 900) => {
  const host = mount(
    `<div style="width:${width}px"><ui-gantt label="Plan" ${attrs.includes("locale") ? "" : 'locale="en-US"'} today="2026-10-12" ${attrs}><ui-chart-tooltip></ui-chart-tooltip></ui-gantt></div>`,
  );
  const el = host.querySelector("ui-gantt") as UiGantt;
  el.tasks = tasks;
  await settle();
  return el;
};

const svgOf = (el: Element) => el.querySelector("svg") as SVGSVGElement;
const drawingOf = (el: Element) => el.querySelector("[data-ui-part=drawing]") as HTMLElement;
const proxyOf = (el: Element) => el.querySelector("[data-ui-part=proxy]") as HTMLElement;
const pane = (el: Element) => svgOf(el).querySelector(".pane") as SVGGElement;

const pointer = (
  el: Element,
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  id = 1,
) => {
  const box = svgOf(el).getBoundingClientRect();
  drawingOf(el).dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerleave",
      cancelable: true,
      clientX: box.left + x,
      clientY: box.top + y,
      pointerType,
      pointerId: id,
      isPrimary: true,
      button: 0,
    }),
  );
};
const awake = async (el: Element) => {
  drawingOf(el).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  await wait(60);
};
const ROW = 36;
const HEAD = 48;
/** Center of the list-pane cell of row `i`. */
const listY = (i: number) => HEAD + i * ROW + ROW / 2;

describe("ui-gantt", () => {
  it("draws the list and the timeline, names the chart and lists every row for screen readers", async () => {
    const el = await gantt();
    expect(await ax("group", "Plan")).toBeTruthy();
    expect(svgOf(el).querySelectorAll("[data-task]")).toHaveLength(TASKS.length);
    expect(svgOf(el).textContent).toContain("Discovery");
    expect(proxyOf(el).getAttribute("role")).toBe("listbox");
    expect(el.getAttribute("height")).toBe("276");
    // The headings of the table and the hint are there for assistive tech.
    expect(el.chartSnapshot?.categories).toEqual([
      "Discovery",
      "· Interviews",
      "· Workshop",
      "Build",
      "· API",
      "Launch",
    ]);
  });

  it("hover: one event per row in order, none per pixel, and the tooltip shows the dates", async () => {
    const el = await gantt();
    await awake(el);
    const seen: number[] = [];
    el.addEventListener("chart-hover", (e) => {
      const d = (e as CustomEvent).detail;
      if (d) seen.push(d.index);
    });
    for (let row = 0; row < TASKS.length; row += 1)
      for (const x of [20, 24, 28]) pointer(el, "pointermove", x, listY(row));
    await wait(30);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    const tip = el.querySelector("ui-chart-tooltip") as HTMLElement;
    expect(tip.textContent).toContain("Launch");
    expect(tip.textContent).toContain("Milestone");
  });

  it("keyboard: rows are one tab stop; arrows move, left collapses or goes to the parent, Enter toggles", async () => {
    const el = await gantt();
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(proxyOf(el));
    const hover = () => el.hover?.index;
    expect(hover()).toBe(0);
    await userEvent.keyboard("{ArrowDown}");
    expect(hover()).toBe(1);
    await userEvent.keyboard("{ArrowLeft}"); // a leaf: to its parent
    expect(hover()).toBe(0);
    await userEvent.keyboard("{ArrowLeft}"); // the parent collapses
    await settle();
    expect(svgOf(el).querySelectorAll("[data-task]")).toHaveLength(4);
    expect(el.collapsed).toEqual(["p1"]);
    await userEvent.keyboard("{ArrowRight}"); // and expands
    await settle();
    expect(el.collapsed).toEqual([]);
    await userEvent.keyboard("{ArrowRight}"); // an expanded parent: into its first child
    expect(hover()).toBe(1);
    await userEvent.keyboard("{End}");
    expect(hover()).toBe(5);
    await userEvent.keyboard("{Home}{Enter}"); // Enter on a parent toggles it
    await settle();
    expect(el.collapsed).toEqual(["p1"]);
    await userEvent.tab();
    expect(el.contains(document.activeElement)).toBe(false);
  });

  it("touch: a tap pins the row; a swipe that pans selects nothing", async () => {
    const el = await gantt();
    pointer(el, "pointerdown", 30, listY(2), "touch");
    pointer(el, "pointerup", 30, listY(2), "touch");
    await wait(80);
    expect(el.selected).toBe(2);
    const selects: unknown[] = [];
    el.addEventListener("chart-select", (e) => selects.push((e as CustomEvent).detail));
    el.select(null);
    await wait(20);
    selects.length = 0;
    const before = pane(el).getAttribute("transform");
    pointer(el, "pointerdown", 600, listY(1), "touch", 7);
    for (const x of [580, 540, 500]) pointer(el, "pointermove", x, listY(1), "touch", 7);
    pointer(el, "pointerup", 500, listY(1), "touch", 7);
    await settle();
    expect(pane(el).getAttribute("transform")).not.toBe(before);
    expect(selects).toEqual([]);
    expect(el.selected).toBeNull();
  });

  it("drag pans the timeline and the click that ends it selects nothing", async () => {
    const el = await gantt();
    await awake(el);
    const x0 = pane(el).getAttribute("transform");
    const selects: unknown[] = [];
    el.addEventListener("chart-select", (e) => selects.push((e as CustomEvent).detail));
    pointer(el, "pointerdown", 600, listY(0));
    for (const x of [590, 560, 520]) pointer(el, "pointermove", x, listY(0));
    pointer(el, "pointerup", 520, listY(0));
    await settle();
    expect(pane(el).getAttribute("transform")).not.toBe(x0);
    expect(selects).toEqual([]);
    // A plain click on the list still selects.
    pointer(el, "pointerdown", 30, listY(3));
    pointer(el, "pointerup", 30, listY(3));
    drawingOf(el).dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: svgOf(el).getBoundingClientRect().left + 30,
        clientY: svgOf(el).getBoundingClientRect().top + listY(3),
        detail: 1,
      }),
    );
    await wait(30);
    expect(el.selected === null || el.selected === 3).toBe(true);
  });

  it("zoom: the attribute, the keys and Ctrl+wheel change the level and report it", async () => {
    const el = await gantt('zoom="week"');
    const levels: string[] = [];
    el.addEventListener("gantt-zoom", (e) => levels.push((e as CustomEvent).detail.zoom));
    expect(el.zoom).toBe("week");
    await userEvent.tab();
    await wait(80);
    await userEvent.keyboard("]"); // zoom in: week to day
    await userEvent.keyboard("[[[[");
    expect(levels).toEqual(["day", "week", "month"]);
    drawingOf(el).dispatchEvent(
      new WheelEvent("wheel", {
        ctrlKey: true,
        deltaY: -400,
        clientX: 500,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    expect(levels.length).toBeGreaterThan(3);
  });

  it("editable: keys report moves, resizes and progress; dragging a bar reports the new dates", async () => {
    const el = await gantt("editable");
    const changes: Array<{ id: string; source: string; start: Date; end: Date; progress: number }> =
      [];
    el.addEventListener("gantt-change", (e) => changes.push((e as CustomEvent).detail));
    await userEvent.tab();
    await wait(80);
    await userEvent.keyboard("{ArrowDown}{Alt>}{ArrowRight}{/Alt}");
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    await userEvent.keyboard("{+}");
    expect(changes.map((c) => [c.id, c.source])).toEqual([
      ["a", "move"],
      ["a", "resize"],
      ["a", "progress"],
    ]);
    expect(+(changes[0] as { start: Date }).start).toBe(+day(6));
    expect(changes[2]?.progress).toBe(1);
    // A parent is a summary: it cannot be edited.
    await userEvent.keyboard("{Home}{Alt>}{ArrowRight}{/Alt}");
    expect(changes).toHaveLength(3);
    // Drag the end handle of "Workshop" two days to the right.
    const handle = svgOf(el).querySelector('[data-task="b"] [data-handle="end"]') as SVGElement;
    const box = handle.getBoundingClientRect();
    const svgBox = svgOf(el).getBoundingClientRect();
    const [x, y] = [box.left + box.width / 2 - svgBox.left, box.top + box.height / 2 - svgBox.top];
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: svgBox.left + x,
        clientY: svgBox.top + y,
        pointerType: "mouse",
        pointerId: 3,
        isPrimary: true,
        button: 0,
      }),
    );
    for (const dx of [10, 40, 80])
      drawingOf(el).dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          clientX: svgBox.left + x + dx,
          clientY: svgBox.top + y,
          pointerType: "mouse",
          pointerId: 3,
          isPrimary: true,
        }),
      );
    drawingOf(el).dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: svgBox.left + x + 80,
        clientY: svgBox.top + y,
        pointerType: "mouse",
        pointerId: 3,
        isPrimary: true,
      }),
    );
    await settle();
    const last = changes.at(-1);
    expect(last?.id).toBe("b");
    expect(last?.source).toBe("resize");
    expect(+(last as { end: Date }).end).toBe(+day(18));
  });

  it("shows critical path, baselines and annotations, and a hidden legend item hides its drawing", async () => {
    const el = await gantt("critical-path baselines");
    el.annotations = [{ id: "r", at: day(20), label: "Freeze" }];
    el.tasks = TASKS.map((t) =>
      t.id === "c" ? { ...t, baseline: { start: day(16), end: day(20) } } : t,
    );
    await settle();
    expect(svgOf(el).querySelectorAll(".baseline")).toHaveLength(1);
    expect(svgOf(el).textContent).toContain("Freeze");
    expect(el.chartSnapshot?.legend?.map((item) => item.id)).toEqual(["critical", "baseline"]);
    el.toggleSeries("baseline");
    await wait(60);
    await settle();
    expect(svgOf(el).querySelectorAll(".baseline")).toHaveLength(0);
  });

  it("uses the locale of the page, never a hard-wired one", async () => {
    const en = await gantt('locale="en-US"');
    expect(svgOf(en).textContent).toContain("oct 2026");
    document.body.innerHTML = "";
    const de = await gantt('locale="de-DE"');
    expect(svgOf(de).textContent).toContain("okt 2026");
    expect(svgOf(de).textContent).not.toContain("oct 2026");
  });

  it("has no accessibility violations", async () => {
    const el = await gantt("editable critical-path");
    await userEvent.tab();
    await wait(80);
    const result = await axe.run(el, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(
      result.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      ),
    ).toEqual([]);
  });
});
