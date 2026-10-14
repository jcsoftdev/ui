import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineWaffleChart } from "../src/waffle-chart/waffle-chart.ts";
import { ax, wait } from "./setup.ts";
import {
  awake,
  focusFirst,
  hoverLog,
  keys,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  settle,
  svgOf,
  tap,
  violations,
} from "./unit-chart-helpers.ts";

beforeAll(() => {
  defineWaffleChart();
  defineChartLegend();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const DATA = [
  { id: "a", name: "Haircuts", value: 40 },
  { id: "b", name: "Beards", value: 35 },
  { id: "c", name: "Colour", value: 25 },
];
const waffle = (attrs = "", data: unknown = DATA, width = 300) =>
  mountChart("ui-waffle-chart", `height="300" ${attrs}`, data, width);

describe("ui-waffle-chart", () => {
  it("shares the cells by largest remainder and names every category as a mark", async () => {
    const c = await waffle();
    const cells = (i: number) => marksOf(c)[i]?.querySelectorAll("[data-unit]").length;
    expect([cells(0), cells(1), cells(2)]).toEqual([40, 35, 25]);
    expect(await ax("group", "Chart")).toBeTruthy();
    expect(await ax("image", "Haircuts: 40 (40%)")).toBeTruthy();
    const withTotal = await waffle('total="200"');
    expect(marksOf(withTotal).map((m) => m.querySelectorAll("[data-unit]").length)).toEqual([
      20, 18, 12,
    ]);
  });

  it("holds the hover across the gaps of one category: one enter per category, in order", async () => {
    const c = await waffle();
    await awake(c);
    const seen = hoverLog(c);
    const size = svgOf(c).getBoundingClientRect().width;
    // Every pixel of the first row, gaps between cells included.
    for (let x = 0; x < size; x += 1) pointer(c, "pointermove", x, 13);
    expect(seen).toEqual([0]);
    // Down column 0 through the gutters: rows 0-3 are the first category, then the second.
    for (let y = 0; y < size; y += 1) pointer(c, "pointermove", 4, y);
    expect(seen).toEqual([0, 1, 2]);
    // Over the diagonal gutter between four cells the details stay.
    pointer(c, "pointermove", 28.5, 28.5);
    expect(c.hover?.index).toBe(0);
    pointer(c, "pointerleave", 0, 0);
    expect(seen.at(-1)).toBeNull();
  });

  it("navigates in two dimensions: left and right walk the categories, up and down the rows", async () => {
    const c = await waffle();
    await focusFirst(c);
    expect(await keys(c, ["{ArrowDown}", "{ArrowDown}", "{ArrowDown}", "{ArrowUp}"])).toEqual([
      1, 2, 2, 1,
    ]);
    expect(await keys(c, ["{ArrowLeft}", "{ArrowRight}", "{End}", "{Home}"])).toEqual([0, 1, 2, 0]);
    expect(c.querySelectorAll("[data-cat][tabindex='0']")).toHaveLength(1);
  });

  it("pins a category on a tap, and unpins it on the same tap", async () => {
    const c = await waffle();
    const seen = hoverLog(c);
    await awake(c);
    tap(c, 4, 4 * 30.4 + 4);
    expect(c.selected).toBe(1);
    expect(c.hover).toMatchObject({ index: 1, pinned: true, source: "touch" });
    tap(c, 4, 4 * 30.4 + 4);
    expect(c.selected).toBeNull();
    expect(seen.filter((i) => i === 1)).toHaveLength(1);
  });

  it("hides a category with the legend: its cells go empty and it leaves the keyboard", async () => {
    const c = await mountChart("ui-waffle-chart", 'height="300"', DATA, 300);
    c.append(document.createElement("ui-chart-legend"));
    await settle();
    c.toggleSeries("b");
    await settle();
    expect(marksOf(c)).toHaveLength(2);
    expect(c.chartSnapshot?.legend?.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(c.isHidden("b")).toBe(true);
  });

  it("formats with the locale and never reaches es-PE", async () => {
    const en = await waffle('locale="en-US"');
    const de = await waffle('locale="de-DE"');
    const label = (c: Element) => marksOf(c)[1]?.getAttribute("aria-label");
    expect(label(en)).toBe("Beards: 35 (35%)");
    expect(label(de)).toMatch(/^Beards: 35 \(35\s%\)$/);
  });

  it("passes axe", async () => {
    const c = await waffle();
    expect(await violations(c)).toEqual([]);
  });

  it("shows nothing over an empty cell, never pins it and leaves nothing held", async () => {
    const c = await waffle('total="200"');
    await awake(c);
    const cells = [...c.querySelectorAll<SVGElement>("svg [data-unit]")].filter(
      (cell) => !cell.closest("[data-cat]"),
    );
    expect(cells.length).toBeGreaterThan(0);
    const origin = svgOf(c).getBoundingClientRect();
    const box = (cells.at(-1) as SVGElement).getBoundingClientRect();
    const x = box.left - origin.left + box.width / 2;
    const y = box.top - origin.top + box.height / 2;
    const seen = hoverLog(c);
    pointer(c, "pointermove", x, y);
    expect(c.hover).toBeNull();
    tap(c, x, y);
    expect(c.selected).toBeNull();
    expect(c.hover).toBeNull();
    expect(seen.filter((index) => index !== null)).toEqual([]);
  });

  it("caps rows and columns so a giant grid stays cheap", async () => {
    const start = performance.now();
    const c = await waffle('rows="500" columns="500"');
    expect(c.querySelectorAll("svg [data-unit]").length).toBeLessThanOrEqual(2000);
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
