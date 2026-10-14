import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineSunburstChart } from "../src/sunburst-chart/sunburst-chart.ts";
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
} from "./hierarchy-helpers.ts";
import { wait } from "./setup.ts";

beforeAll(() => {
  defineSunburstChart();
  defineChartBreadcrumb();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const TAG = "ui-sunburst-chart";

describe("ui-sunburst-chart", () => {
  it("draws one named mark per visible slice, in pre-order", async () => {
    const c = await mountChart(TAG);
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label"));
    expect(labels[0]).toMatch(/^Engineering: 900/);
    expect(labels).toContain("Engineering › Platform: 400 (28%)");
    expect(labels.at(-1)).toMatch(/^Support: 120/);
    expect(labels).toHaveLength(8);
    expect(marksOf(c).filter((m) => m.tabIndex === 0)).toHaveLength(1);
  });

  it("hover sweeps without flicker: one event per slice change, none for the gutters", async () => {
    const c = await mountChart(TAG, "", "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = hoverLog(c);
    const box = svgOf(c).getBoundingClientRect();
    const cx = box.width / 2;
    const cy = box.height / 2;
    const r = Math.min(box.width, box.height) / 2;
    // A circle through the first ring: every step lands on a slice or its padding gutter.
    for (let a = 0.02; a < Math.PI * 2; a += 0.02)
      pointer(c, "pointermove", cx + r * 0.45 * Math.sin(a), cy - r * 0.45 * Math.cos(a));
    expect(events).not.toContain(null);
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label") ?? "");
    const names = events.map((i) => labels[i as number]?.split(":")[0]);
    expect(names).toEqual(["Engineering", "Sales", "Support"]);
    pointer(c, "pointerleave", 0, 0);
    expect(events.at(-1)).toBeNull();
  });

  it("keeps the hover through a redraw", async () => {
    const c = await mountChart(TAG);
    await awake(c);
    const events = hoverLog(c);
    const [x, y] = centerOf(c, "Engineering ›");
    pointer(c, "pointermove", x, y);
    const first = c.hover?.index;
    expect(first).toBeGreaterThanOrEqual(0);
    c.requestDraw();
    await settle();
    expect(c.hover?.index).toBe(first);
    expect(events).toEqual([first]);
  });

  it("walks siblings, parents and children with the arrows, and Home/End", async () => {
    const c = await mountChart(TAG);
    marksOf(c)[0]?.focus();
    await wait(80);
    const focused = () => document.activeElement?.getAttribute("aria-label")?.split(":")[0];
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Sales");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("Sales › EMEA");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Sales › APAC");
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()).toBe("Sales");
    await userEvent.keyboard("{Home}");
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{End}");
    expect(focused()).toBe("Support");
  });

  it("drills with Shift+Enter, focuses the first child, and Escape goes back out", async () => {
    const c = await mountChart(TAG);
    const drilled: unknown[] = [];
    c.addEventListener("chart-drill", (e) => drilled.push((e as CustomEvent).detail));
    const focuses: string[] = [];
    c.addEventListener("chart-focus", (e) => focuses.push((e as CustomEvent).detail.name));
    marksOf(c)[0]?.focus();
    await wait(80);
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await settle();
    await wait(800);
    expect(drilled).toHaveLength(1);
    expect(focuses).toEqual(["Engineering"]);
    expect(c.path.map((p) => p.name)).toEqual(["Company", "Engineering"]);
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Platform: 400/);
    await userEvent.keyboard("{Escape}");
    await settle();
    await wait(800);
    expect(c.path.map((p) => p.name)).toEqual(["Company"]);
    expect(focuses).toEqual(["Engineering", "Company"]);
  });

  it("Backspace on a first-ring slice zooms out and keeps the focus on the opened node", async () => {
    const c = await mountChart(TAG);
    c.zoomTo("root/Engineering");
    await settle();
    await wait(800);
    marksOf(c)[0]?.focus();
    await wait(80);
    await userEvent.keyboard("{Backspace}");
    await settle();
    await wait(800);
    expect(c.path).toHaveLength(1);
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Engineering: 900/);
  });

  it("wires a breadcrumb inside the chart both ways", async () => {
    const c = await mountChart(TAG, "", "<ui-chart-breadcrumb></ui-chart-breadcrumb>");
    const crumb = c.querySelector("ui-chart-breadcrumb") as HTMLElement & { items: unknown[] };
    expect(crumb.items).toEqual([{ id: "root", name: "Company" }]);
    c.zoomTo("root/Sales");
    await settle();
    expect(crumb.items).toHaveLength(2);
    (crumb.querySelector("button") as HTMLButtonElement).click();
    await settle();
    expect(c.focusId).toBe("root");
  });

  it("a double click opens a slice, a click pins it, and a second tap on touch opens it", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    await awake(c);
    const [x, y] = centerOf(c, "Sales:");
    const pinned = hoverLog(c);
    tap(c, x, y);
    await settle();
    expect(c.selected).not.toBeNull();
    expect(pinned.at(-1)).not.toBeNull();
    tap(c, x, y);
    await settle();
    expect(c.focusId).toBe("root/Sales");
    expect(c.selected).toBeNull();
  });

  it("zooms out from the center", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    c.zoomTo("root/Engineering");
    await settle();
    const box = svgOf(c).getBoundingClientRect();
    svgOf(c).dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        detail: 1,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    );
    await settle();
    expect(c.focusId).toBe("root");
  });

  it("hides a branch from the legend and keeps the other colors", async () => {
    const c = await mountChart(TAG);
    await awake(c);
    const fills = () =>
      marksOf(c).map((m) => (m as SVGElement).style.fill.match(/var\(--[\w-]+\)/)?.[0]);
    const before = fills();
    const chart = c as unknown as { toggleSeries(id: string): void; isHidden(id: string): boolean };
    chart.toggleSeries("root/Support");
    await settle();
    expect(chart.isHidden("root/Support")).toBe(true);
    expect(marksOf(c)).toHaveLength(7);
    // Engineering and Sales keep their hues.
    expect(fills().slice(0, 5)).toEqual(before.slice(0, 5));
  });

  it("passes axe", async () => {
    const c = await mountChart(TAG);
    expect(await violations(c)).toEqual([]);
  });

  it("empty data shows the empty state", async () => {
    const c = await mountChart(TAG);
    c.data = { name: "x", children: [] };
    await expect.poll(() => svgOf(c)?.querySelectorAll("[role=img]").length ?? 0).toBe(0);
  });
});
