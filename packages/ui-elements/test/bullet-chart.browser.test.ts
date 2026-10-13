import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineBulletChart } from "../src/bullet-chart/bullet-chart.ts";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
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
  { label: "Revenue", actual: 270, target: 300, ranges: [200, 260, 320] },
  { label: "Profit", actual: 22, target: 25, ranges: [15, 22, 30] },
  { label: "Orders", actual: 1500, ranges: [1000, 1800] },
];

beforeAll(() => {
  defineBulletChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", width = 520) =>
  chart("ui-bullet-chart", {
    attrs: `value-format="integer" ${attrs}`,
    inner: "<ui-chart-legend readonly></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      c.items = ITEMS;
      c.rangeLabels = ["Low", "Mid", "High"];
    },
  });

describe("ui-bullet-chart", () => {
  it("sizes its rows itself and names each row with its band", async () => {
    const c = await mountChart();
    expect(svgOf(c).getAttribute("height")).toBe(`${ITEMS.length * 46 + 16}`);
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(await ax("image", "Revenue: Actual 270, Target 300, High")).toBeTruthy();
    expect(await ax("image", "Orders: Actual 1,500, Mid")).toBeTruthy();
    expect(c.chartSnapshot?.series.map((s) => s.name)).toEqual([
      "Actual",
      "Target",
      "Low",
      "Mid",
      "High",
    ]);
  });

  it("goes vertical and draws one shared axis", async () => {
    const c = await mountChart('orientation="vertical" scale="shared"');
    expect(svgOf(c).getAttribute("height")).toBe("300");
    expect(marks(c)).toHaveLength(3);
    expect(svgOf(c).querySelectorAll("line[shape-rendering]").length).toBeGreaterThan(1);
    c.setAttribute("orientation", "horizontal");
    await settle();
    expect(svgOf(c).getAttribute("height")).toBe(`${ITEMS.length * 46 + 8 + 30}`);
  });

  it("copes with one row, no ranges and a row format", async () => {
    const c = await mountChart();
    c.items = [{ label: "Only", actual: 0 }];
    await settle();
    expect(marks(c)[0]?.getAttribute("aria-label")).toBe("Only: Actual 0");
    c.items = [{ label: "Rate", actual: 0.5, target: 0.8, format: "percent" }];
    await settle();
    expect(marks(c)[0]?.getAttribute("aria-label")).toBe("Rate: Actual 50%, Target 80%");
  });

  it("hovers one row at a time, in order, without flicker", async () => {
    const c = await mountChart();
    const seen = await sweep(c, [
      [200, 30],
      [200, 76],
      [200, 122],
    ]);
    expect(seen).toEqual([0, 1, 2]);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Orders");
  });

  it("walks the rows with the arrow keys", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowDown", ITEMS.length);
  });

  it("walks the columns with the arrow keys when vertical", async () => {
    const c = await mountChart('orientation="vertical"');
    await walkKeys(c, "ArrowRight", ITEMS.length);
  });

  it("pins a row with a tap", async () => {
    const c = await mountChart();
    await pinByTap(c, 200, 76, 1);
  });

  it("formats with the locale and passes axe", async () => {
    const c = await mountChart('locale="de-DE"');
    c.setAttribute("value-format", "number");
    c.items = [{ label: "A", actual: 1234.5, target: 2000, ranges: [3000] }];
    await settle();
    expect(c.chartSnapshot?.series[0]?.text[0]).toBe("1.234,5");
    expect(await violations(c)).toEqual([]);
  });
});
