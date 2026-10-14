import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineIcicleChart } from "../src/icicle-chart/icicle-chart.ts";
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
  defineIcicleChart();
  defineChartBreadcrumb();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const TAG = "ui-icicle-chart";
const focused = () => document.activeElement?.getAttribute("aria-label")?.split(":")[0];

describe("ui-icicle-chart", () => {
  it("names one mark per cell below the open node", async () => {
    const c = await mountChart(TAG, "", "", 560);
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label"));
    expect(labels).toHaveLength(8);
    expect(labels[0]).toMatch(/^Engineering: 900/);
  });

  it("sweeps across the first level and its gutters without reporting nothing", async () => {
    const c = await mountChart(TAG, "", "", 560);
    await awake(c);
    const events = hoverLog(c);
    const box = svgOf(c).getBoundingClientRect();
    const x = box.width * 0.375;
    for (let y = 1; y < box.height - 1; y += 1) pointer(c, "pointermove", x, y);
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label") ?? "");
    expect(events).not.toContain(null);
    expect(events.map((i) => labels[i as number]?.split(":")[0])).toEqual([
      "Engineering",
      "Sales",
      "Support",
    ]);
    pointer(c, "pointerleave", 0, 0);
    expect(events.at(-1)).toBeNull();
  });

  it("keeps the hover through a redraw", async () => {
    const c = await mountChart(TAG, "", "", 560);
    await awake(c);
    const events = hoverLog(c);
    const [x, y] = centerOf(c, "Engineering ›");
    pointer(c, "pointermove", x, y);
    const first = c.hover?.index;
    c.requestDraw();
    await settle();
    expect(c.hover?.index).toBe(first);
    expect(events).toEqual([first]);
  });

  it("goes across levels with Right/Left and across siblings with Down/Up when horizontal", async () => {
    const c = await mountChart(TAG, "", "", 560);
    marksOf(c)[0]?.focus();
    await wait(80);
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Engineering › Platform");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("Engineering › Mobile");
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("Sales");
  });

  it("goes across levels with Down/Up when vertical", async () => {
    const c = await mountChart(TAG, 'orientation="vertical"', "", 560);
    marksOf(c)[0]?.focus();
    await wait(80);
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("Engineering › Platform");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Engineering › Mobile");
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()).toBe("Engineering");
  });

  it("drills with Shift+Enter, zooms out from the first band and by Escape", async () => {
    const c = await mountChart(TAG, 'animate="off"', "", 560);
    marksOf(c)[1]?.focus();
    await wait(80);
    await userEvent.keyboard("{ArrowLeft}{Shift>}{Enter}{/Shift}");
    await settle();
    expect(c.focusId).toBe("root/Engineering");
    expect(focused()).toBe("Platform");
    const box = svgOf(c).getBoundingClientRect();
    svgOf(c).dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        detail: 1,
        clientX: box.left + 10,
        clientY: box.top + 60,
      }),
    );
    await settle();
    expect(c.focusId).toBe("root");
    c.zoomTo("root/Sales");
    await settle();
    marksOf(c)[0]?.focus();
    await wait(80);
    await userEvent.keyboard("{Escape}");
    await settle();
    expect(c.focusId).toBe("root");
  });

  it("pins on the first tap and opens the cell on the second", async () => {
    const c = await mountChart(TAG, 'animate="off"', "", 560);
    await awake(c);
    const [x, y] = centerOf(c, "Sales:");
    tap(c, x, y);
    await settle();
    expect(c.selected).not.toBeNull();
    tap(c, x, y);
    await settle();
    expect(c.focusId).toBe("root/Sales");
  });

  it("passes axe", async () => {
    const c = await mountChart(TAG, "", "", 560);
    expect(await violations(c)).toEqual([]);
  });
});
