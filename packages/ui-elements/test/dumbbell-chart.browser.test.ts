import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
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
import { ax, wait } from "./setup.ts";

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

  it("keeps NaN, Infinity and missing values out of the markup", async () => {
    const c = await mountChart();
    c.items = [
      { label: "Ok", from: 10, to: 20 },
      { label: "Nan", from: Number.NaN, to: 5 },
      { label: "Inf", from: 1, to: Number.POSITIVE_INFINITY },
      { label: "Missing" },
      { label: "Holes", values: [1, undefined as unknown as number, 3] },
      { label: "Flat", from: 7, to: 7 },
    ];
    await settle();
    // "Missing" has no values and counts as 0 to 0; NaN and Infinity rows are left out.
    expect(c.chartSnapshot?.categories).toEqual(["Ok", "Missing", "Flat"]);
    for (const attrs of [{}, { orientation: "vertical" }, { sort: "delta" }]) {
      for (const [name, value] of Object.entries(attrs)) c.setAttribute(name, value);
      await settle();
      expect(svgOf(c).outerHTML).not.toMatch(/NaN|Infinity/);
    }
  });

  it("takes the measure colors from the palette", async () => {
    const c = await mountChart('palette="red,blue"');
    const fills = [...c.querySelectorAll<SVGElement>("circle")].map((dot) => dot.style.fill);
    expect(fills).toContain("red");
    c.setAttribute("palette", "green,gold");
    await settle();
    expect([...c.querySelectorAll<SVGElement>("circle")].map((dot) => dot.style.fill)).toContain(
      "green",
    );
  });

  it("draws 70k rows on the canvas layer with virtual marks", async () => {
    const rows = Array.from({ length: 70_000 }, (_, i) => ({
      label: `Row ${i}`,
      from: i % 97,
      to: (i * 7) % 113,
    }));
    const started = performance.now();
    const c = await chart("ui-dumbbell-chart", {
      attrs: 'from-label="A" to-label="B" value-format="integer"',
      inner: "<ui-chart-tooltip></ui-chart-tooltip>",
      setup: (el) => {
        el.items = rows;
      },
    });
    const elapsed = performance.now() - started;
    console.info(`dumbbell 70k rows: ${Math.round(elapsed)} ms`);
    expect(elapsed).toBeLessThan(1500);
    await expect.poll(() => c.querySelector("canvas")).toBeTruthy();
    expect(svgOf(c).querySelectorAll("*").length).toBeLessThan(500);
    expect(c.querySelector("[role=listbox]")).toBeTruthy();

    const height = Number(svgOf(c).getAttribute("height"));
    const seen = await sweep(c, [[200, 8 + (height - 38) / 2]]);
    expect(seen).toHaveLength(1);
    expect(Math.abs((seen[0] as number) - 35_000)).toBeLessThanOrEqual(1);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain(`Row ${seen[0]}`);

    await userEvent.tab();
    await wait(80);
    expect(c.hover?.index).toBe(0);
    await userEvent.keyboard("{ArrowDown}");
    expect(c.hover?.index).toBe(1);
    await userEvent.keyboard("{End}");
    expect(c.hover?.index).toBe(69_999);
  });
});
