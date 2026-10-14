import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineTimelineChart, type UiTimelineChart } from "../src/timeline-chart/timeline-chart.ts";
import {
  awake,
  chartOf,
  hoverLog,
  mount,
  settle,
  sweep,
  tap,
  violations,
  wait,
} from "./e19-helpers.ts";

beforeAll(() => {
  defineTimelineChart();
  defineChartLegend();
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

const at = (h: number, m = 0) => Date.UTC(2026, 5, 12, h, m);
const rows = [
  { id: "diego", label: "Diego" },
  { id: "mateo", label: "Mateo" },
];
const groups = [
  { id: "done", name: "Done" },
  { id: "booked", name: "Booked" },
];
const items = [
  {
    id: "a",
    rowId: "diego",
    start: at(9),
    end: at(10),
    label: "Ana",
    group: "done",
    detail: "Cut",
  },
  { id: "b", rowId: "diego", start: at(9, 30), end: at(10, 30), label: "Beto", group: "booked" },
  { id: "c", rowId: "diego", start: at(11), end: at(12), label: "Carla", group: "booked" },
  { id: "d", rowId: "mateo", start: at(9, 15), end: at(10, 45), label: "Dani", group: "done" },
];
const timeline = async (attrs = "", width = 560, inner = "") => {
  const c = await chartOf<UiTimelineChart>(
    "ui-timeline-chart",
    `time-zone="UTC" ${attrs}`,
    width,
    inner,
  );
  c.rows = rows;
  c.items = items;
  c.groups = groups;
  await settle();
  return c;
};
const bars = (c: Element) => [...c.querySelectorAll<SVGElement>("g[data-bar]")];
const option = (c: Element) => c.querySelector("[role=option]") as HTMLElement;

describe("ui-timeline-chart", () => {
  it("packs overlapping bars into lanes and sizes the chart to them", async () => {
    const c = await timeline();
    expect(bars(c)).toHaveLength(4);
    // Diego has two lanes (a and b overlap), Mateo one: 22 + (2*31-3+16) + (31-3+16) + 30.
    expect(c.getAttribute("height")).toBe("171");
    const ys = bars(c).map((b) => Number(b.firstElementChild?.getAttribute("y")));
    expect(new Set(ys.slice(0, 2)).size).toBe(2);
    expect(c.textContent).toContain("Diego");
    expect(c.textContent).toContain("09:00");
  });

  it("draws the now marker only inside the window", async () => {
    const c = await timeline(`now="${at(9, 30)}"`);
    expect(c.textContent).toContain("Now");
    c.setAttribute("now", `${at(20)}`);
    await settle();
    expect(c.textContent).not.toContain("Now");
  });

  it("hovers a bar with group, row, time and duration, one event per bar", async () => {
    const c = await timeline("", 560, "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = hoverLog(c);
    const geometry = bars(c).map((b) => {
      const r = b.firstElementChild as SVGRectElement;
      return {
        x: Number(r.getAttribute("x")) + Number(r.getAttribute("width")) / 2,
        y: Number(r.getAttribute("y")) + 10,
      };
    });
    // The plot starts 64px from the left (the widest row title) and 22px from the top.
    for (const g of geometry) for (let d = -2; d <= 2; d++) sweep(c, 64 + g.x + d, 22 + g.y);
    const seen = events.filter((e): e is number => e !== null);
    expect(new Set(seen).size).toBe(4);
    expect(c.hover?.rows.map((r) => r.name)).toContain("Duration");
  });

  it("walks bars with Left and Right, rows with Up and Down, and a tap pins one", async () => {
    const c = await timeline();
    await userEvent.tab();
    await wait(80);
    expect(option(c).getAttribute("aria-setsize")).toBe("4");
    expect(option(c).textContent).toBe("Ana. Diego. 09:00 - 10:00. Done");
    await userEvent.keyboard("{ArrowRight}");
    expect(option(c).textContent).toContain("Beto");
    await userEvent.keyboard("{ArrowDown}");
    expect(option(c).textContent).toContain("Dani");
    await userEvent.keyboard("{ArrowUp}");
    expect(option(c).textContent).toMatch(/Ana|Beto/);
    await userEvent.keyboard("{End}");
    expect(option(c).textContent).toContain("Dani");
    expect(c.querySelectorAll("g[data-bar][data-active]")).toHaveLength(1);
    (document.activeElement as HTMLElement).blur();
    const first = bars(c)[0]?.firstElementChild as SVGRectElement;
    tap(c, 64 + Number(first.getAttribute("x")) + 5, 22 + Number(first.getAttribute("y")) + 5);
    await wait(80);
    expect(c.selected).toBe(0);
  });

  it("hides a group from the legend and stretches the lanes with height=fill", async () => {
    const c = await timeline("", 560, "<ui-chart-legend></ui-chart-legend>");
    c.toggleSeries("booked");
    await settle();
    expect(bars(c)).toHaveLength(2);
    const wrap = c.parentElement as HTMLElement;
    wrap.style.height = "400px";
    c.setAttribute("height", "fill");
    await settle();
    const rect = bars(c)[0]?.firstElementChild as SVGRectElement;
    expect(Number(rect.getAttribute("height"))).toBeGreaterThan(28);
  });

  it("formats the clock in the locale of the page and passes axe", async () => {
    const c = await timeline('locale="en-US"');
    c.setAttribute("time-zone", "America/Lima");
    await settle();
    expect(c.textContent).toContain("04:00");
    expect(await violations(c)).toEqual([]);
    c.items = [];
    await settle();
    expect(c.textContent).toContain("No data");
  });
});
