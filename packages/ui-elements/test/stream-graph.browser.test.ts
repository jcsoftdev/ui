import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineStreamGraph, type UiStreamGraph } from "../src/stream-graph/stream-graph.ts";
import {
  awake,
  chartOf,
  hoverLog,
  mount,
  pointer,
  settle,
  svgOf,
  sweep,
  tap,
  violations,
  wait,
} from "./e19-helpers.ts";

beforeAll(() => {
  defineStreamGraph();
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

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const series = [
  { id: "a", name: "Cuts", data: [10, 14, 18, 12, 9, 11] },
  { id: "b", name: "Beards", data: [4, 6, 5, 9, 12, 10] },
  { id: "c", name: "Color", data: [2, 3, 6, 5, 4, 7] },
];
const graph = async (attrs = "", width = 480, inner = "") => {
  const c = await chartOf<UiStreamGraph>("ui-stream-graph", `height="260" ${attrs}`, width, inner);
  c.categories = months;
  c.series = series;
  await settle();
  return c;
};
const cols = (c: Element) => [...c.querySelectorAll<SVGElement>("rect[data-col]")];

describe("ui-stream-graph", () => {
  it("draws one path per stream, one focusable column per category and a described image group", async () => {
    const c = await graph();
    expect(c.querySelectorAll("path[data-stream]")).toHaveLength(3);
    expect(cols(c)).toHaveLength(6);
    expect(svgOf(c).getAttribute("role")).toBe("group");
    expect(cols(c)[0]?.getAttribute("aria-label")).toBe("Jan. Cuts: 10, Beards: 4, Color: 2");
    expect(cols(c).filter((el) => el.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("hovers without flicker: one event per column, in order, and the tooltip lists every stream", async () => {
    const c = await graph("", 480, "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = hoverLog(c);
    for (let x = 14; x <= 460; x += 4) sweep(c, x, 120);
    expect(events).toEqual([0, 1, 2, 3, 4, 5]);
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    expect(getComputedStyle(tip).pointerEvents).toBe("none");
    expect(c.hover?.rows.map((row) => row.name)).toContain("Total");
    expect(c.hover?.title).toBe("Jun");
  });

  it("isolates the stream under the pointer by dimming the others", async () => {
    const c = await graph();
    await awake(c);
    const top = c.querySelector("path[data-stream]") as SVGPathElement;
    const box = top.getBBox();
    sweep(c, 14 + 200, box.y + box.height / 2 + 10);
    await wait(20);
    expect(c.querySelectorAll("path[data-stream][data-dim]").length).toBeGreaterThan(0);
    pointer(c, "pointerleave", 0, 0);
    await wait(20);
    expect(c.querySelectorAll("path[data-stream][data-dim]")).toHaveLength(0);
  });

  it("moves through time with Left and Right and switches stream with Up and Down", async () => {
    const c = await graph();
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(cols(c)[0]);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(cols(c)[2]);
    expect(c.hover?.index).toBe(2);
    await userEvent.keyboard("{ArrowDown}");
    await settle();
    expect(c.hover?.body).toMatch(/^(Cuts|Beards|Color): \d+$/);
    expect(document.activeElement).toBe(cols(c)[2]);
    expect(c.querySelectorAll("path[data-stream][data-dim]")).toHaveLength(2);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(cols(c)[5]);
  });

  it("a tap pins the column and a second tap releases it", async () => {
    const c = await graph();
    tap(c, 14 + 100, 100);
    await wait(80);
    const pinned = c.selected;
    expect(pinned).not.toBeNull();
    expect(c.hover?.pinned).toBe(true);
    tap(c, 14 + 100, 100);
    await wait(40);
    expect(c.selected).toBeNull();
  });

  it("publishes streams to the legend and a table-ready snapshot, and honors hidden streams", async () => {
    const c = await graph("", 480, "<ui-chart-legend></ui-chart-legend>");
    const snap = c.chartSnapshot;
    expect(snap?.series.map((s) => s.name)).toEqual(["Cuts", "Beards", "Color"]);
    expect(snap?.categories).toEqual(months);
    c.toggleSeries("b");
    await settle();
    expect(c.querySelectorAll("path[data-stream]")).toHaveLength(2);
  });

  it("supports offsets, no names on thin streams and the expand axis in the locale", async () => {
    const c = await graph('offset="expand" locale="de-DE"');
    expect(c.textContent).toContain("100");
    expect(c.querySelectorAll("path[data-stream]")).toHaveLength(3);
  });

  it("has no axe violations and shows the empty state without data", async () => {
    const c = await graph();
    expect(await violations(c)).toEqual([]);
    c.series = [{ id: "z", name: "Z", data: [0, 0] }];
    await settle();
    expect(c.textContent).toContain("No data");
  });
});
