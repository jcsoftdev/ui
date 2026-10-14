import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineWaterfallChart } from "../src/waterfall-chart/waterfall-chart.ts";
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

const STEPS = [
  { label: "Opening", value: 1000, type: "start" as const },
  { label: "Walk-ins", value: 400 },
  { label: "Refunds", value: -150 },
  { label: "Q1", type: "subtotal" as const },
  { label: "Products", value: 250 },
  { label: "Closing", type: "total" as const },
];

beforeAll(() => {
  defineWaterfallChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", width = 560, steps: typeof STEPS | null = STEPS) =>
  chart("ui-waterfall-chart", {
    attrs: `value-format="integer" ${attrs}`,
    inner: "<ui-chart-legend readonly></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      if (steps) c.steps = steps;
    },
  });

describe("ui-waterfall-chart", () => {
  // First on purpose: once an earlier test reads the accessibility tree (`ax`), CDP crashes on 5000 marks.
  it("draws 5k steps quickly", async () => {
    const steps = Array.from({ length: 5000 }, (_, i) =>
      i === 0
        ? { label: "s0", value: 1000, type: "start" as const }
        : { label: `s${i}`, value: (i % 7) - 3 },
    );
    const start = performance.now();
    const c = await mountChart("", 560, steps as typeof STEPS);
    const ms = performance.now() - start;
    console.log(`waterfall 5k steps: ${Math.round(ms)} ms`);
    expect(marks(c)).toHaveLength(5000);
    expect(ms).toBeLessThan(2500);
  });

  it("names each step with its change and running total, and publishes the key", async () => {
    const c = await mountChart();
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(await ax("image", "Walk-ins. Increase +400. Running total 1,400")).toBeTruthy();
    expect(await ax("image", "Refunds. Decrease -150. Running total 1,250")).toBeTruthy();
    expect(c.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["Increase", "Decrease", "Total"]);
    expect(c.chartSnapshot?.series[1]?.text).toEqual([
      "1,000",
      "1,400",
      "1,250",
      "1,250",
      "1,500",
      "1,500",
    ]);
  });

  it("hovers one step at a time, in order, without flicker", async () => {
    const c = await mountChart();
    const w = svgOf(c).getBoundingClientRect().width;
    const step = (w - 50) / STEPS.length;
    const seen = await sweep(
      c,
      STEPS.map((_, i): [number, number] => [50 + step * (i + 0.5), 100]),
    );
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Closing");
  });

  it("walks the steps with the arrow keys", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowRight", STEPS.length);
  });

  it("pins a step with a tap", async () => {
    const c = await mountChart();
    const w = svgOf(c).getBoundingClientRect().width;
    await pinByTap(c, 50 + ((w - 50) / STEPS.length) * 1.5, 100, 1);
  });

  it("runs top to bottom when horizontal", async () => {
    const c = await mountChart('orientation="horizontal"');
    await walkKeys(c, "ArrowDown", STEPS.length);
    const seen = await sweep(c, [
      [200, 20],
      [200, 70],
    ]);
    expect(seen).toEqual([0, 1]);
  });

  it("formats with the locale, handles one step and passes axe", async () => {
    const c = await mountChart('locale="de-DE"', 560, [
      { label: "A", value: 1234.5, type: "start" },
    ]);
    c.setAttribute("value-format", "number");
    await settle();
    expect(c.chartSnapshot?.series[1]?.text[0]).toBe("1.234,5");
    expect(marks(c)).toHaveLength(1);
    expect(await violations(c)).toEqual([]);
  });

  it("accepts steps as JSON and lets a negative total dip below zero", async () => {
    const c = await mountChart(
      `steps='[{"label":"Start","value":100,"type":"start"},{"label":"Loss","value":-300}]'`,
      560,
      null,
    );
    expect(marks(c)).toHaveLength(2);
    expect(c.chartSnapshot?.series[1]?.text[1]).toBe("-200");
  });
  it("draws non-finite step values as zero-height deltas without NaN in the SVG", async () => {
    const c = await mountChart("", 560, [
      { label: "Open", value: 100, type: "start" },
      { label: "Bad", value: Number.NaN },
      { label: "Inf", value: Number.POSITIVE_INFINITY },
      { label: "Missing", value: undefined },
      { label: "Up", value: 20 },
      { label: "End", type: "total" },
    ] as typeof STEPS);
    c.yAxis = { min: () => Number.NaN, max: () => Number.POSITIVE_INFINITY };
    await settle();
    expect(svgOf(c).outerHTML).not.toMatch(/NaN|Infinity/);
    expect(marks(c)).toHaveLength(6);
    expect(c.chartSnapshot?.series[1]?.text.at(-1)).toBe("120");
  });

  it("shortens long labels with an ellipsis that fits the band", async () => {
    const c = await mountChart("", 300, [
      { label: "A very long category name indeed", value: 10, type: "start" },
      { label: "Another extremely long label here", value: 5 },
      { label: "x", value: 5 },
    ] as typeof STEPS);
    const texts = [...svgOf(c).querySelectorAll("text")].map((t) => t.textContent ?? "");
    expect(texts.some((t) => t.endsWith("…"))).toBe(true);
  });
});
