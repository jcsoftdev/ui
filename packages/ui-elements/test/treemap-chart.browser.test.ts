import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineTreemapChart } from "../src/treemap-chart/treemap-chart.ts";
import {
  awake,
  centerOf,
  hoverLog,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  settle,
  svgOf,
  tap,
  violations,
} from "./e21-helpers.ts";
import { wait } from "./setup.ts";

beforeAll(() => {
  defineTreemapChart();
  defineChartBreadcrumb();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const TAG = "ui-treemap-chart";
const focused = () => document.activeElement?.getAttribute("aria-label")?.split(":")[0];

describe("ui-treemap-chart", () => {
  it("makes one cell per group and leaf, parents first, each a named mark", async () => {
    const c = await mountChart(TAG);
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label"));
    expect(labels[0]).toMatch(/^Engineering: 900/);
    expect(labels).toContain("Engineering › Platform: 400 (28%)");
    expect(labels).toHaveLength(8);
    expect(marksOf(c).filter((m) => m.tabIndex === 0)).toHaveLength(1);
  });

  it("sweeps across cells and gutters without ever reporting nothing", async () => {
    const c = await mountChart(TAG);
    await awake(c);
    const events = hoverLog(c);
    const box = svgOf(c).getBoundingClientRect();
    for (let y = 40; y < box.height - 40; y += 40)
      for (let x = 2; x < box.width - 2; x += 2) pointer(c, "pointermove", x, y);
    expect(events.length).toBeGreaterThan(8);
    expect(events).not.toContain(null);
    for (let i = 1; i < events.length; i += 1) expect(events[i]).not.toBe(events[i - 1]);
    pointer(c, "pointerleave", 0, 0);
    expect(events.at(-1)).toBeNull();
  });

  it("keeps the hover through a redraw", async () => {
    const c = await mountChart(TAG);
    await awake(c);
    const events = hoverLog(c);
    const [x, y] = centerOf(c, "Engineering › Platform");
    pointer(c, "pointermove", x, y);
    const first = c.hover?.index;
    c.requestDraw();
    await settle();
    expect(c.hover?.index).toBe(first);
    expect(events).toEqual([first]);
  });

  it("walks siblings, parents and children with the arrows", async () => {
    const c = await mountChart(TAG);
    marksOf(c)[0]?.focus();
    await wait(80);
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("Engineering › Platform");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Engineering › Mobile");
    await userEvent.keyboard("{End}");
    expect(focused()).toBe("Engineering › Data");
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Sales");
  });

  it("drills the group of the focused cell with Shift+Enter and goes back with Backspace", async () => {
    const c = await mountChart(TAG);
    const focuses: string[] = [];
    c.addEventListener("chart-focus", (e) => focuses.push((e as CustomEvent).detail.name));
    marksOf(c)[0]?.focus();
    await wait(80);
    await userEvent.keyboard("{ArrowDown}{Shift>}{Enter}{/Shift}");
    await settle();
    expect(focuses).toEqual(["Engineering"]);
    expect(c.path.map((p) => p.name)).toEqual(["Company", "Engineering"]);
    expect(focused()).toBe("Platform");
    await userEvent.keyboard("{Backspace}");
    await settle();
    expect(c.path).toHaveLength(1);
    expect(focused()).toBe("Engineering");
  });

  it("pins on the first tap and opens the group on the second", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    await awake(c);
    const [x, y] = centerOf(c, "Sales ›");
    tap(c, x, y);
    await settle();
    expect(c.selected).not.toBeNull();
    tap(c, x, y);
    await settle();
    expect(c.focusId).toBe("root/Sales");
    expect(c.selected).toBeNull();
  });

  it("follows a breadcrumb inside the chart", async () => {
    const c = await mountChart(TAG, "", "<ui-chart-breadcrumb></ui-chart-breadcrumb>");
    c.zoomTo("root/Sales");
    await settle();
    const crumb = c.querySelector("ui-chart-breadcrumb") as HTMLElement & { items: unknown[] };
    expect(crumb.items).toHaveLength(2);
    (crumb.querySelector("button") as HTMLButtonElement).click();
    await settle();
    expect(c.focusId).toBe("root");
  });

  it("passes axe", async () => {
    const c = await mountChart(TAG);
    expect(await violations(c)).toEqual([]);
  });
});
