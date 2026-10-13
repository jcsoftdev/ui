import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineDumbbellChart } from "../src/dumbbell-chart/dumbbell-chart.ts";
import {
  chart,
  marks,
  parkMouse,
  pinByTap,
  settle,
  svgOf,
  sweep,
  violations,
  walkKeys,
} from "./e18-fixture.ts";
import { ax } from "./setup.ts";

const ITEMS = [
  { label: "Classic cut", from: 182, to: 214 },
  { label: "Fade", from: 140, to: 171 },
  { label: "Beard", from: 96, to: 88 },
  { label: "Cut and beard", from: 74, to: 112 },
];

beforeAll(() => {
  defineDumbbellChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", width = 520) =>
  chart("ui-dumbbell-chart", {
    attrs: `from-label="Last month" to-label="This month" value-format="integer" ${attrs}`,
    inner: "<ui-chart-legend readonly></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      c.items = ITEMS;
    },
  });

describe("ui-dumbbell-chart", () => {
  it("sizes its rows itself, names each row and describes the change", async () => {
    const c = await mountChart();
    expect(svgOf(c).getAttribute("height")).toBe(`${ITEMS.length * 38 + 8 + 30}`);
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(
      await ax("image", "Classic cut. Last month 182, This month 214, Change +32"),
    ).toBeTruthy();
    expect(c.chartSnapshot?.series.map((s) => s.name)).toEqual([
      "Last month",
      "This month",
      "Change",
    ]);
    expect(c.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["Last month", "This month"]);
  });

  it("sorts by change and flips to columns when vertical", async () => {
    const c = await mountChart('sort="delta"');
    expect(c.chartSnapshot?.categories).toEqual(["Cut and beard", "Classic cut", "Fade", "Beard"]);
    c.setAttribute("orientation", "vertical");
    await settle();
    expect(svgOf(c).getAttribute("height")).toBe("320");
  });

  it("supports more than two measures", async () => {
    const c = await mountChart();
    c.measures = [{ name: "Q1" }, { name: "Q2" }, { name: "Q3" }];
    c.items = [{ label: "A", values: [1, 5, 3] }];
    await settle();
    expect(c.chartSnapshot?.series.map((s) => s.name)).toEqual(["Q1", "Q2", "Q3", "Change"]);
    expect(marks(c)[0]?.getAttribute("aria-label")).toContain("Q3 3");
  });

  it("hovers one row at a time, in order, without flicker", async () => {
    const c = await mountChart();
    const seen = await sweep(c, [
      [200, 20],
      [200, 60],
      [200, 98],
      [200, 136],
    ]);
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Cut and beard");
  });

  it("walks the rows with the arrow keys", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowDown", ITEMS.length);
  });

  it("pins a row with a tap", async () => {
    const c = await mountChart();
    await pinByTap(c, 200, 60, 1);
  });

  it("formats with the locale and passes axe", async () => {
    const c = await mountChart('locale="de-DE"');
    c.setAttribute("value-format", "number");
    c.items = [{ label: "A", from: 1234.5, to: 2000 }];
    await settle();
    expect(c.chartSnapshot?.series[0]?.text[0]).toBe("1.234,5");
    expect(await violations(c)).toEqual([]);
  });
});
