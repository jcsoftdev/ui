import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineRaincloudChart } from "../src/raincloud-chart/raincloud-chart.ts";
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

const wave = (base: number, n: number) =>
  Array.from({ length: n }, (_, i) => base + ((i * 37) % 23) + (i % 5));
const CATEGORIES = ["Ana", "Luis", "Marta"];
const SERIES = [{ id: "visit", name: "Visit", data: [wave(30, 24), wave(40, 24), wave(25, 24)] }];
const TWO = [
  ...SERIES,
  { id: "walk", name: "Walk-in", data: [wave(20, 24), wave(35, 24), wave(15, 24)] },
];

beforeAll(() => {
  defineRaincloudChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", series: unknown = SERIES, width = 520) =>
  chart("ui-raincloud-chart", {
    attrs: `value-format="integer" ${attrs}`,
    inner: "<ui-chart-legend></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      c.categories = CATEGORIES;
      c.series = series;
    },
  });

describe("ui-raincloud-chart", () => {
  it("sizes its rows and names each cloud with its summary", async () => {
    const c = await mountChart();
    expect(svgOf(c).getAttribute("height")).toBe(`${Math.max(220, 3 * 92 + 48)}`);
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(marks(c)).toHaveLength(3);
    expect(marks(c)[0]?.getAttribute("aria-label")).toMatch(/^Ana: Median \d+, Q1 /);
    expect(c.chartSnapshot?.categories).toEqual(CATEGORIES);
  });

  it("draws one rain drop per observation, the same on every render", async () => {
    const c = await mountChart();
    const drops = () =>
      [...c.querySelectorAll("[data-rain] circle")].map((d) => d.getAttribute("cy"));
    expect(drops()).toHaveLength(72);
    const first = drops();
    c.setAttribute("seed", "7");
    (c.requestDraw as () => void)();
    await settle();
    expect(drops()).toEqual(first);
    c.setAttribute("seed", "8");
    await settle();
    expect(drops()).not.toEqual(first);
    c.setAttribute("rain", "off");
    await settle();
    expect(drops()).toHaveLength(0);
  });

  it("stacks series per row and toggles one with the legend", async () => {
    const c = await mountChart("", TWO);
    expect(marks(c)).toHaveLength(6);
    expect(marks(c)[1]?.getAttribute("aria-label")).toContain("Ana · Walk-in:");
    expect(svgOf(c).getAttribute("height")).toBe(`${3 * 2 * 92 + 48}`);
    (c.toggleSeries as (id: string) => void)("walk");
    await settle();
    expect(marks(c)).toHaveLength(3);
    expect(c.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["Visit", "Walk-in"]);
  });

  it("hovers one cloud at a time, in order, without flicker", async () => {
    const c = await mountChart();
    const rows = marks(c).map((m) => {
      const box = m.getBoundingClientRect();
      const origin = svgOf(c).getBoundingClientRect();
      return box.top - origin.top + box.height / 2;
    });
    const seen = await sweep(
      c,
      rows.map((y) => [200, y] as [number, number]),
    );
    expect(seen).toEqual([0, 1, 2]);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Marta");
  });

  it("walks the clouds with the arrow keys", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowDown", 3);
  });

  it("pins a cloud with a tap", async () => {
    const c = await mountChart();
    const m = marks(c)[1] as SVGElement;
    const box = m.getBoundingClientRect();
    const origin = svgOf(c).getBoundingClientRect();
    await pinByTap(c, 200, box.top - origin.top + box.height / 2, 1);
  });

  it("formats with the locale and passes axe", async () => {
    const c = await mountChart('locale="de-DE" value-format="number"');
    c.series = [{ id: "a", name: "A", data: [[1234.5, 2000.5, 1500.25], [], []] }];
    await settle();
    expect(c.chartSnapshot?.series.find((s) => s.id === "max")?.text[0]).toBe("2.001");
    expect(await violations(c)).toEqual([]);
  });

  it("shows the empty state without data and skips categories with no samples", async () => {
    const c = await mountChart();
    c.series = [{ id: "a", name: "A", data: [[], [5, 6, 7], []] }];
    await settle();
    expect(marks(c)).toHaveLength(1);
    c.series = [];
    await settle();
    expect(marks(c)).toHaveLength(0);
  });
});
