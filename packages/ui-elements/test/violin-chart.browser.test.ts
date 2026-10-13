import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineViolinChart } from "../src/violin-chart/violin-chart.ts";
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

const wave = (base: number, spread: number) =>
  Array.from({ length: 40 }, (_, i) => base + Math.sin(i * 1.7) * spread + (i % 7) * 0.4);

const CATEGORIES = ["Mon", "Tue", "Wed"];
const SERIES = [
  { id: "a", name: "Morning", data: [wave(30, 8), wave(40, 6), wave(35, 10)] },
  { id: "b", name: "Evening", data: [wave(45, 5), wave(52, 9), wave(48, 7)] },
];

beforeAll(() => {
  defineViolinChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", width = 560, series = SERIES) =>
  chart("ui-violin-chart", {
    attrs: `value-format="integer" height="300" ${attrs}`,
    inner: "<ui-chart-legend></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      c.categories = CATEGORIES;
      c.series = series;
    },
  });

/** Centers (drawing units) of the violins of one chart, from the hit rectangles of its marks. */
const centers = (c: HTMLElement) => {
  const origin = svgOf(c).getBoundingClientRect();
  return marks(c).map((m) => {
    const r = m.getBoundingClientRect();
    return { x: r.left - origin.left + r.width / 2, y: r.top - origin.top + r.height / 2 };
  });
};

describe("ui-violin-chart", () => {
  it("names every violin with its statistics and builds the table", async () => {
    const c = await mountChart();
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(marks(c)).toHaveLength(6);
    expect(marks(c)[0]?.getAttribute("aria-label")).toMatch(/^Mon · Morning: Median \d+, Q1 /);
    expect(c.chartSnapshot?.categories).toHaveLength(6);
    expect(c.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["Morning", "Evening"]);
  });

  it("hovers one violin at a time, in order, without flicker", async () => {
    const c = await mountChart();
    const points = centers(c).map((p) => [p.x, p.y] as [number, number]);
    const seen = await sweep(c, points);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Wed · Evening");
  });

  it("walks the violins with the arrow keys", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowRight", 6);
  });

  it("pins a violin with a tap", async () => {
    const c = await mountChart();
    const p = centers(c)[1] as { x: number; y: number };
    await pinByTap(c, p.x, p.y, 1);
  });

  it("splits two series into halves and only with exactly two visible", async () => {
    const c = await mountChart("split");
    const halves = marks(c).map((m) => m.getBoundingClientRect().width);
    const full = await mountChart();
    const whole = marks(full)[0]?.getBoundingClientRect().width as number;
    expect(marks(c)).toHaveLength(6);
    expect(Math.max(...halves)).toBeLessThanOrEqual(whole * 1.2);
    (c as unknown as { toggleSeries(id: string): void }).toggleSeries("b");
    await settle();
    expect(marks(c)).toHaveLength(3);
    expect(marks(c)[0]?.getAttribute("aria-label")).toMatch(/^Mon:/);
  });

  it("draws horizontally with points and the quartile inner", async () => {
    const c = await mountChart('orientation="horizontal" inner="quartiles" show-points');
    expect(svgOf(c).querySelectorAll("[data-observations] circle").length).toBe(6 * 40);
    expect(svgOf(c).querySelectorAll("line[stroke-dasharray]").length).toBeGreaterThan(0);
    await walkKeys(c, "ArrowDown", 6);
  });

  it("skips categories without samples and shows the empty state without any", async () => {
    const c = await mountChart("", 560, [{ id: "a", name: "A", data: [[1, 2, 3], [], [4, 5, 9]] }]);
    expect(marks(c)).toHaveLength(2);
    c.series = [];
    await settle();
    expect(marks(c)).toHaveLength(0);
    expect(c.querySelector("[data-ui-part=empty], [data-state=empty]")).not.toBeNull();
  });

  it("formats with the locale and passes axe", async () => {
    const c = await mountChart('locale="de-DE" value-format="number"', 560, [
      { id: "a", name: "A", data: [[1234.5, 1500.25, 2000.75, 1800.5]] },
    ]);
    c.categories = ["Only"];
    await settle();
    expect(c.chartSnapshot?.series[0]?.text[0]).toBe("4");
    expect(c.chartSnapshot?.series.find((s) => s.id === "median")?.text[0]).toBe("1.650");
    expect(await violations(c)).toEqual([]);
  });
});
