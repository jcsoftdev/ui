import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineSlopeChart } from "../src/slope-chart/slope-chart.ts";
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

// Plot height 260 -> inner 212, domain 10..40: A runs 212 -> 71, B 0 -> 141, C stays at 106.
const ITEMS = [
  { label: "Classic cut", from: 10, to: 30 },
  { label: "Fade", from: 40, to: 20 },
  { label: "Beard", from: 25, to: 25 },
];

beforeAll(() => {
  defineSlopeChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", width = 520) =>
  chart("ui-slope-chart", {
    attrs: `from-label="Sept" to-label="Oct" value-format="integer" ${attrs}`,
    inner: "<ui-chart-legend readonly></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      c.items = ITEMS;
    },
  });

const strokes = (c: Element) =>
  [...c.querySelectorAll<SVGElement>("[data-line]")].map((line) => line.style.stroke);

describe("ui-slope-chart", () => {
  it("names each line, describes the change and publishes the up/down key", async () => {
    const c = await mountChart();
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(await ax("image", "Classic cut. Sept 10, Oct 30, Change +20 (+200%)")).toBeTruthy();
    expect(await ax("image", "Beard. Sept 25, Oct 25, Change 0 (0%)")).toBeTruthy();
    expect(c.chartSnapshot?.series.map((s) => s.name)).toEqual(["Sept", "Oct", "Change"]);
    expect(c.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["▲", "▼"]);
  });

  it("hovers by label on the sides and by line in the middle, without flicker", async () => {
    const c = await mountChart();
    const seen = await sweep(c, [
      [20, 34 + 4],
      [20, 34 + 110],
      [20, 34 + 205],
      [500, 34 + 138],
      // Middle: halfway the lines of A and B cross near y=106 where C also sits; pick A's start.
      [150, 34 + 190],
    ]);
    expect(seen).toEqual([1, 2, 0, 1, 0]);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Classic cut");
  });

  it("ignores the middle when no line is within 16px", async () => {
    const c = await mountChart();
    const seen = await sweep(c, [[260, 34 + 3]]);
    // At the midpoint the lines sit at y=141, 70 and 106: far from y=3.
    expect(seen).toEqual([]);
  });

  it("walks the lines with Up/Down and Left/Right", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowDown", ITEMS.length);
  });

  it("pins a line with a tap on its label", async () => {
    const c = await mountChart();
    await pinByTap(c, 20, 34 + 110, 2);
  });

  it("colors by direction, flips with lower-is-better, and by series", async () => {
    const c = await mountChart();
    const [up, down, flat] = strokes(c);
    expect(up).not.toBe(down);
    expect(flat).not.toBe(up);
    c.setAttribute("lower-is-better", "");
    await settle();
    expect(strokes(c)).toEqual([down, up, flat]);
    expect(c.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["▼", "▲"]);
    c.setAttribute("color-by", "series");
    await settle();
    expect(new Set(strokes(c)).size).toBe(3);
    expect(c.chartSnapshot?.legend).toEqual([]);
  });

  it("keeps close labels apart and grows with the items", async () => {
    const c = await mountChart();
    c.items = Array.from({ length: 14 }, (_, i) => ({
      label: `Item ${i}`,
      from: 50 + i * 0.1,
      to: 20 + i,
    }));
    await settle();
    expect(svgOf(c).getAttribute("height")).toBe(`${14 * 22 + 34 + 14}`);
    const ys = [...c.querySelectorAll("[data-label]")]
      .filter((t) => t.getAttribute("text-anchor") === "end")
      .map((t) => Number(t.getAttribute("y")))
      .sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1)
      expect((ys[i] as number) - (ys[i - 1] as number)).toBeGreaterThanOrEqual(12);
  });

  it("handles one item and an empty list", async () => {
    const c = await mountChart();
    c.items = [{ label: "Only", from: 5, to: 5 }];
    await settle();
    expect(marks(c)).toHaveLength(1);
    c.items = [];
    await settle();
    expect(marks(c)).toHaveLength(0);
  });

  it("formats with the locale and passes axe", async () => {
    const c = await mountChart('locale="de-DE"');
    c.setAttribute("value-format", "number");
    c.items = [{ label: "A", from: 1234.5, to: 2000 }];
    await settle();
    expect(c.chartSnapshot?.series[0]?.text[0]).toBe("1.234,5");
    expect(c.chartSnapshot?.series[2]?.text[0]).toContain("+765,5");
    expect(await violations(c)).toEqual([]);
  });

  it("leaves NaN, Infinity and missing values out of the markup", async () => {
    const c = await mountChart();
    c.items = [
      { label: "Ok", from: 10, to: 20 },
      { label: "Nan", from: Number.NaN, to: 5 },
      { label: "Inf", from: 1, to: Number.NEGATIVE_INFINITY },
      { label: "Missing" } as unknown as (typeof ITEMS)[number],
      { label: "Fine", from: 30, to: 5 },
    ];
    await settle();
    expect(c.chartSnapshot?.categories).toEqual(["Ok", "Fine"]);
    expect(marks(c)).toHaveLength(2);
    expect(svgOf(c).outerHTML).not.toMatch(/NaN|Infinity/);
    c.items = [{ label: "Nothing", from: Number.NaN, to: Number.NaN }];
    await settle();
    expect(svgOf(c).outerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("centres the lines when every value is equal", async () => {
    const c = await mountChart();
    c.items = [
      { label: "A", from: 5, to: 5 },
      { label: "B", from: 5, to: 5 },
    ];
    await settle();
    // Plot height 260 -> inner 212: the middle is 106.
    for (const line of c.querySelectorAll("[data-line]")) {
      expect(Number(line.getAttribute("y1"))).toBeCloseTo(106, 0);
      expect(Number(line.getAttribute("y2"))).toBeCloseTo(106, 0);
    }
    expect(svgOf(c).outerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("colors by series with the palette", async () => {
    const c = await mountChart('color-by="series" palette="red,blue"');
    expect(strokes(c)).toEqual(["red", "blue", "red"]);
  });

  it("draws 70k lines on the canvas layer with virtual marks", async () => {
    const rows = Array.from({ length: 70_000 }, (_, i) => ({
      label: `Line ${i}`,
      from: i % 100,
      to: (i * 37) % 100,
    }));
    const started = performance.now();
    const c = await chart("ui-slope-chart", {
      attrs: 'from-label="Sept" to-label="Oct" value-format="integer"',
      inner: "<ui-chart-tooltip></ui-chart-tooltip>",
      setup: (el) => {
        el.items = rows;
      },
    });
    const elapsed = performance.now() - started;
    console.info(`slope 70k lines: ${Math.round(elapsed)} ms`);
    expect(elapsed).toBeLessThan(1500);
    expect(c.querySelector("canvas")).toBeTruthy();
    expect(svgOf(c).querySelectorAll("*").length).toBeLessThan(100);
    expect(c.querySelector("[role=listbox]")).toBeTruthy();

    // Inner height 592 (640 - 34 - 14), values 0..99: a left-side hover snaps to the nearest start.
    const at = (value: number) => 34 + 592 - (value / 99) * 592;
    const seen = await sweep(c, [[10, at(50)]]);
    expect(seen).toHaveLength(1);
    expect((seen[0] as number) % 100).toBe(50);

    // Midway, the line that passes through value 33 is the one under the pointer.
    const middle = await sweep(c, [[260, at(33)]]);
    const i = middle[middle.length - 1] as number;
    expect(Math.abs(((i % 100) + ((i * 37) % 100)) / 2 - 33)).toBeLessThanOrEqual(2.8);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain(`Line ${i}`);

    await userEvent.tab();
    await wait(80);
    expect(c.hover?.index).toBe(0);
    await userEvent.keyboard("{ArrowDown}");
    expect(c.hover?.index).toBe(1);
  });
});
