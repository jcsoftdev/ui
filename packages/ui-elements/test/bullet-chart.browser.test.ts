import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
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
import { ax, wait } from "./setup.ts";

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

  it("keeps NaN, Infinity and missing values out of the markup", async () => {
    const c = await mountChart();
    c.items = [
      { label: "Nan", actual: Number.NaN, target: Number.NaN, ranges: [10, Number.NaN] },
      { label: "Inf", actual: Number.POSITIVE_INFINITY, target: Number.NEGATIVE_INFINITY },
      { label: "Missing" } as unknown as (typeof ITEMS)[number],
      { label: "Fine", actual: 5, target: 8, ranges: [4, 10] },
    ];
    for (const attrs of ["", 'orientation="vertical"', 'scale="shared"']) {
      c.removeAttribute("orientation");
      c.removeAttribute("scale");
      for (const attr of attrs.split(" ").filter(Boolean)) {
        const [name, value] = attr.split("=");
        c.setAttribute(name as string, (value as string).replaceAll('"', ""));
      }
      await settle();
      expect(marks(c)).toHaveLength(4);
      expect(svgOf(c).outerHTML).not.toMatch(/NaN|Infinity/);
    }
    expect(c.chartSnapshot?.series[0]?.text[0]).toBe("0");
  });

  it("clamps a negative actual and target inside the plot", async () => {
    const c = await mountChart();
    c.items = [
      { label: "Down", actual: -50, target: -20, ranges: [100] },
      { label: "Up", actual: 400, target: 900, ranges: [100] },
    ];
    await settle();
    const plotWidth = svgOf(c).getBoundingClientRect().width;
    for (const bar of c.querySelectorAll("[data-bar]")) {
      const x = Number(bar.getAttribute("x"));
      const width = Number(bar.getAttribute("width"));
      expect(width).toBeGreaterThanOrEqual(0);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(plotWidth);
    }
    for (const tick of c.querySelectorAll("g[data-row] line")) {
      expect(Number(tick.getAttribute("x1"))).toBeGreaterThanOrEqual(0);
    }
    c.setAttribute("orientation", "vertical");
    await settle();
    for (const bar of c.querySelectorAll("[data-bar]")) {
      expect(Number(bar.getAttribute("y"))).toBeGreaterThanOrEqual(0);
      expect(Number(bar.getAttribute("height"))).toBeGreaterThan(0);
    }
    expect(svgOf(c).outerHTML).not.toMatch(/NaN|Infinity|(width|height)="-/);
  });

  it("draws 20k rows on the canvas layer with virtual marks", async () => {
    const rows = Array.from({ length: 20_000 }, (_, i) => ({
      label: `KPI ${i}`,
      actual: (i * 13) % 100,
      target: (i * 7) % 100,
      ranges: [30, 60, 100],
    }));
    const started = performance.now();
    const c = await chart("ui-bullet-chart", {
      attrs: 'value-format="integer"',
      inner: "<ui-chart-tooltip></ui-chart-tooltip>",
      setup: (el) => {
        el.items = rows;
      },
    });
    const elapsed = performance.now() - started;
    console.info(`bullet 20k rows: ${Math.round(elapsed)} ms`);
    expect(elapsed).toBeLessThan(1500);
    await expect.poll(() => c.querySelector("canvas")).toBeTruthy();
    expect(svgOf(c).querySelectorAll("*").length).toBeLessThan(100);
    expect(c.querySelector("[role=listbox]")).toBeTruthy();

    // Height 640, top 8, inner 624: the middle of the plot is row 10000.
    const seen = await sweep(c, [[200, 8 + 312]]);
    expect(seen).toHaveLength(1);
    expect(Math.abs((seen[0] as number) - 10_000)).toBeLessThanOrEqual(1);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain(`KPI ${seen[0]}`);

    await userEvent.tab();
    await wait(80);
    expect(c.hover?.index).toBe(0);
    await userEvent.keyboard("{ArrowDown}");
    expect(c.hover?.index).toBe(1);
  });
});
