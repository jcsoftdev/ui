import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { commands, userEvent } from "vitest/browser";
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
afterEach(async () => {
  document.body.innerHTML = "";
  await commands.timezone(null);
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
    `<div style="width:${width}px"><ui-gantt label="Plan" ${attrs.includes("locale") ? "" : 'locale="en-US"'} ${attrs.includes("toolbar") ? "" : 'toolbar="off"'} today="2026-10-12" ${attrs}><ui-chart-tooltip></ui-chart-tooltip></ui-gantt></div>`,
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
  // Awaiting the module runs after the chart's own continuation, which attaches the layer.
  await import("../src/internal/chart-interact.ts");
  await frame();
  await frame();
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
    await expect
      .poll(() => el.chartSnapshot?.categories)
      .toEqual(["Discovery", "· Interviews", "· Workshop", "Build", "· API", "Launch"]);
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
    await expect.poll(() => seen).toEqual([0, 1, 2, 3, 4, 5]);
    const tip = el.querySelector("ui-chart-tooltip") as HTMLElement;
    expect(tip.textContent).toContain("Launch");
    expect(tip.textContent).toContain("Milestone");
  });

  it("keyboard: rows are one tab stop; arrows move, left collapses or goes to the parent, Enter toggles", async () => {
    const el = await gantt();
    await userEvent.tab();
    await expect
      .poll(() => document.activeElement === proxyOf(el) && el.hover?.index === 0)
      .toBe(true);
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
    await expect.poll(() => el.selected).toBe(2);
    const selects: unknown[] = [];
    el.addEventListener("chart-select", (e) => selects.push((e as CustomEvent).detail));
    el.select(null);
    await expect.poll(() => el.selected).toBeNull();
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
    expect(el.selected).toBeNull();
    // A plain click on the list still selects.
    await userEvent.click(drawingOf(el), { position: { x: 30, y: listY(3) } });
    await expect.poll(() => el.selected).toBe(3);
  });

  it("zoom: the attribute, the keys and Ctrl+wheel change the level and report it", async () => {
    const el = await gantt('zoom="week"');
    const levels: string[] = [];
    el.addEventListener("gantt-zoom", (e) => levels.push((e as CustomEvent).detail.zoom));
    expect(el.zoom).toBe("week");
    await userEvent.tab();
    await expect
      .poll(() => document.activeElement === proxyOf(el) && el.hover?.index === 0)
      .toBe(true);
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
    await expect
      .poll(() => document.activeElement === proxyOf(el) && el.hover?.index === 0)
      .toBe(true);
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
    await expect
      .poll(() => el.chartSnapshot?.legend?.map((item) => item.id))
      .toEqual(["critical", "baseline"]);
    el.toggleSeries("baseline");
    await expect.poll(() => svgOf(el).querySelectorAll(".baseline").length).toBe(0);
  });

  it("uses the locale of the page, never a hard-wired one", async () => {
    const en = await gantt('locale="en-US"');
    expect(svgOf(en).textContent).toContain("oct 2026");
    document.body.innerHTML = "";
    const de = await gantt('locale="de-DE"');
    expect(svgOf(de).textContent).toContain("okt 2026");
    expect(svgOf(de).textContent).not.toContain("oct 2026");
  });

  it("time zone: the list, the end date and the day grid follow time-zone, not the runtime", async () => {
    await commands.timezone("America/Lima");
    const at = (d: number, h: number) => new Date(Date.UTC(2026, 9, d, h));
    // 06:00 UTC is 01:00 on the 5th in Lima but 23:00 on the 4th in Los Angeles.
    const tasks: GanttTask[] = [{ id: "z", name: "Zone", start: at(5, 6), end: at(9, 6) }];
    const la = await gantt('time-zone="America/Los_Angeles"', tasks);
    const cells = [...svgOf(la).querySelectorAll(".list-cell")].map((c) => c.textContent);
    expect(cells).toContain("4 oct");
    expect(cells).toContain("8 oct");
    document.body.innerHTML = "";
    const lima = await gantt('time-zone="America/Lima"', tasks);
    const limaCells = [...svgOf(lima).querySelectorAll(".list-cell")].map((c) => c.textContent);
    expect(limaCells).toContain("5 oct");
    expect(limaCells).toContain("9 oct");
  });

  it("daylight saving: a one-day task is one day, not 23 hours", async () => {
    const day = (d: number) => new Date(2026, 2, d); // 8 March 2026 is 23 hours long in the US
    const tasks: GanttTask[] = [{ id: "d", name: "Spring", start: day(8), end: day(9) }];
    await commands.timezone("America/Los_Angeles");
    const el = await gantt('time-zone="America/Los_Angeles"', [
      {
        id: "d",
        name: "Spring",
        start: new Date("2026-03-08T08:00:00Z"),
        end: new Date("2026-03-09T07:00:00Z"),
      },
    ]);
    const duration = el.chartSnapshot?.series?.find((s) => s.id === "duration");
    expect(duration?.text?.[0]).toBe("1 day");
    expect(tasks).toHaveLength(1);
  });

  it("a task with an invalid date is skipped and a repeated id keeps its row", async () => {
    const warn = console.warn;
    const warned: string[] = [];
    console.warn = (message: string) => void warned.push(String(message));
    try {
      const el = await gantt("", [
        { id: "a", name: "One", start: day(5), end: day(8) },
        { id: "a", name: "Two", start: day(6), end: day(9) },
        { id: "bad", name: "Broken", start: new Date("nope"), end: day(9) },
      ]);
      await expect.poll(() => el.chartSnapshot?.categories).toEqual(["One", "Two"]);
      expect(svgOf(el).querySelectorAll("[data-task]")).toHaveLength(2);
      expect(warned.some((m) => m.includes('"bad"'))).toBe(true);
      expect(warned.some((m) => m.includes('"a"'))).toBe(true);
    } finally {
      console.warn = warn;
    }
  });

  it("a property set before the element upgrades is not lost", async () => {
    const host = document.createElement("div");
    const plain = document.createElement("ui-gantt") as UiGantt;
    // Not yet defined as a gantt for this node: own properties shadow the accessors.
    Object.defineProperty(plain, "tasks", { value: TASKS, configurable: true, writable: true });
    host.append(plain);
    document.body.append(host);
    host.style.width = "900px";
    plain.setAttribute("toolbar", "off");
    await settle();
    expect(svgOf(plain).querySelectorAll("[data-task]")).toHaveLength(TASKS.length);
  });

  it("toolbar: on by default, switches the zoom level and goes to today", async () => {
    const el = await gantt('toolbar="on" zoom="week"');
    await expect.poll(() => el.querySelector("[data-ui-part=toolbar]")).not.toBeNull();
    const bar = el.querySelector("[data-ui-part=toolbar]") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.nextElementSibling).toBe(drawingOf(el));
    const pressed = () => bar.querySelector("[aria-pressed=true]")?.getAttribute("data-zoom");
    expect(pressed()).toBe("week");
    (bar.querySelector('[data-zoom="month"]') as HTMLButtonElement).click();
    await settle();
    expect(el.zoom).toBe("month");
    expect(pressed()).toBe("month");
    const before = pane(el).getAttribute("transform");
    (bar.querySelector("[data-ui-part=today]") as HTMLButtonElement).click();
    await settle();
    expect(pane(el).getAttribute("transform")).toBeDefined();
    expect(before).toBeDefined();
    el.setAttribute("toolbar", "off");
    await settle();
    expect(el.querySelector("[data-ui-part=toolbar]")).toBeNull();
  });

  describe("touch (CDP)", () => {
    const many: GanttTask[] = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`,
      name: `Task ${i}`,
      start: day(5 + (i % 10)),
      end: day(8 + (i % 10)),
    }));
    const mountTall = async (attrs = "", tasks = many) => {
      const el = await gantt(`height="400" ${attrs}`, tasks, 380);
      el.parentElement?.insertAdjacentHTML("afterend", '<div style="height:3000px"></div>');
      await settle();
      return el;
    };
    const center = (target: Element) => {
      const box = target.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };

    it("a vertical swipe scrolls the rows, not the page", async () => {
      const el = await mountTall();
      expect(svgOf(el).querySelector('[data-task="t0"]')).toBeTruthy();
      const { x, y } = center(drawingOf(el));
      const log: string[] = [];
      drawingOf(el).addEventListener("pointerdown", (e) => log.push(`${e.pointerType}`));
      await commands.touch([
        { type: "touchStart", points: [{ x, y: y + 80, id: 0 }] },
        ...[40, 0, -40, -80].map((dy) => ({
          type: "touchMove" as const,
          points: [{ x, y: y + dy + 80 - 40, id: 0 }],
        })),
        { type: "touchEnd", points: [] },
      ]);
      await settle();
      expect(log).toContain("touch");
      expect(document.scrollingElement?.scrollTop).toBe(0);
      expect(svgOf(el).querySelector('[data-task="t0"]')).toBeNull();
    });

    it("a pinch that starts on an editable bar zooms and never drags it", async () => {
      const el = await mountTall('editable zoom="week"', TASKS);
      const changes: unknown[] = [];
      el.addEventListener("gantt-change", (e) => changes.push((e as CustomEvent).detail));
      const handle = '[data-task="c"] [data-handle="move"]';
      await expect.poll(() => svgOf(el).querySelector(handle)).not.toBeNull();
      const { x, y } = center(svgOf(el).querySelector(handle) as Element);
      const pinch = async (from: number, to: number) => {
        const at = (gap: number) => [
          { x: x - gap / 2, y, id: 0 },
          { x: x + gap / 2, y, id: 1 },
        ];
        const steps = 10;
        await commands.touch([
          { type: "touchStart", points: at(from) },
          ...Array.from({ length: steps }, (_, i) => ({
            type: "touchMove" as const,
            points: at(from + ((to - from) * (i + 1)) / steps),
          })),
          { type: "touchEnd", points: [] },
        ]);
        await settle();
      };
      const order = ["hour", "day", "week", "month", "quarter", "year"];
      const level = () => order.indexOf(el.zoom);
      await pinch(40, 100); // spread: finer levels
      const zoomedIn = level();
      expect(zoomedIn).toBeLessThan(order.indexOf("week"));
      expect(changes).toEqual([]);
      await pinch(100, 40); // pinch in: steps back to coarser levels
      expect(level()).toBeGreaterThan(zoomedIn);
      expect(changes).toEqual([]);
    });
  });

  it("has no accessibility violations", async () => {
    const el = await gantt("editable critical-path");
    await userEvent.tab();
    await expect.poll(() => document.activeElement === proxyOf(el)).toBe(true);
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
