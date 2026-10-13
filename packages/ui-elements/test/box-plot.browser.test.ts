import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineBoxPlot } from "../src/box-plot/box-plot.ts";
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

const CATEGORIES = ["Ana", "Beto", "Carla"];
const A = [
  [20, 22, 25, 27, 30, 31, 34, 38, 90],
  [15, 18, 21, 24, 26, 29, 33],
  [40, 42, 44, 47, 50, 52, 55],
];
const B = [
  [10, 12, 14, 16, 18],
  [30, 31, 33, 35, 36],
  [22, 24, 26, 28, 30],
];

beforeAll(() => {
  defineBoxPlot();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", series = [{ id: "a", name: "Cuts", data: A }], width = 520) =>
  chart("ui-box-plot", {
    attrs: `value-format="integer" ${attrs}`,
    inner: "<ui-chart-legend></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      c.categories = CATEGORIES;
      c.series = series;
    },
  });

describe("ui-box-plot", () => {
  it("names each box with its statistics and publishes the stats table", async () => {
    const c = await mountChart();
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(marks(c)).toHaveLength(3);
    expect(marks(c)[0]?.getAttribute("aria-label")).toBe(
      "Ana: Median 30, Q1 25, Q3 34, Min 20, Max 90, Mean 35, n 9, Outliers 1",
    );
    expect(c.chartSnapshot?.categories).toEqual(CATEGORIES);
    expect(c.chartSnapshot?.series.map((s) => s.name)).toEqual([
      "n",
      "Min",
      "Q1",
      "Median",
      "Q3",
      "Max",
      "Mean",
      "Outliers",
    ]);
    expect(c.querySelectorAll("[data-box]")).toHaveLength(3);
  });

  it("hovers one box at a time, in order, without flicker", async () => {
    const c = await mountChart();
    const box = svgOf(c).getBoundingClientRect();
    const seen = await sweep(
      c,
      [0.2, 0.5, 0.8].map((f) => [60 + (box.width - 70) * f, 120] as [number, number]),
    );
    expect(seen).toEqual([0, 1, 2]);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Carla");
  });

  it("walks the boxes with the arrow keys", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowRight", 3);
  });

  it("pins a box with a tap", async () => {
    const c = await mountChart();
    const box = svgOf(c).getBoundingClientRect();
    await pinByTap(c, 60 + (box.width - 70) * 0.5, 120, 1);
  });

  it("groups series side by side, names them and toggles from the legend", async () => {
    const c = await mountChart("", [
      { id: "a", name: "Cuts", data: A },
      { id: "b", name: "Beards", data: B },
    ]);
    expect(marks(c)).toHaveLength(6);
    expect(marks(c)[1]?.getAttribute("aria-label")).toContain("Ana · Beards");
    expect(c.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["Cuts", "Beards"]);
    (c as unknown as { toggleSeries(id: string): void }).toggleSeries("b");
    await settle();
    expect(marks(c)).toHaveLength(3);
    expect(c.querySelectorAll('[data-series="b"]')).toHaveLength(0);
  });

  it("lays out rows when horizontal and reaches min and max with an infinite whisker", async () => {
    const c = await mountChart('orientation="horizontal" whisker="infinity" show-points');
    const ms = marks(c);
    expect(ms).toHaveLength(3);
    expect(Number(ms[1]?.getAttribute("y"))).toBeGreaterThan(Number(ms[0]?.getAttribute("y")));
    expect(ms[0]?.getAttribute("aria-label")).not.toContain("Outliers");
    expect(c.querySelectorAll("[data-observations] circle")).toHaveLength(9 + 7 + 7);
    await walkKeys(c, "ArrowDown", 3);
  });

  it("shows the empty state without samples", async () => {
    const c = await mountChart("", [{ id: "a", name: "Cuts", data: [[], [], []] }]);
    expect(marks(c)).toHaveLength(0);
    expect(c.querySelector("[data-ui-part=state]")).toBeTruthy();
  });

  it("formats with the locale and passes axe", async () => {
    const c = await mountChart('locale="de-DE" value-format="number"', [
      { id: "a", name: "Cuts", data: [[1234.5, 1300.5, 1400.5], [], []] },
    ]);
    expect(c.chartSnapshot?.series[3]?.text[0]).toBe("1.301");
    expect(await violations(c)).toEqual([]);
  });
});
