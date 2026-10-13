import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineRangeAreaChart } from "../src/range-area-chart/range-area-chart.ts";
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

const CATEGORIES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const BANDS = [
  {
    id: "wait",
    name: "Waiting time",
    min: [4, 5, 6, 5, 4],
    max: [12, 15, 18, 14, 11],
    mean: [8, 10, 12, 9, 7],
  },
  { id: "chair", name: "Chair time", min: [20, 22, null, 24, 21], max: [40, 44, null, 46, 39] },
];

beforeAll(() => {
  defineRangeAreaChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const mountChart = (attrs = "", width = 520) =>
  chart("ui-range-area-chart", {
    attrs: `value-format="integer" ${attrs}`,
    inner: "<ui-chart-legend></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    width,
    setup: (c) => {
      c.categories = CATEGORIES;
      c.bands = BANDS;
    },
  });

describe("ui-range-area-chart", () => {
  it("names each category with every band and lists min, max and mean in the table", async () => {
    const c = await mountChart();
    expect(svgOf(c).getAttribute("height")).toBe("300");
    expect(await ax("group", "Test chart")).toBeTruthy();
    expect(
      await ax("image", "Wed. Waiting time: Min 6, Max 18, Mean 12. Chair time: -"),
    ).toBeTruthy();
    expect(c.chartSnapshot?.series.map((s) => s.name)).toEqual([
      "Waiting time Min",
      "Waiting time Max",
      "Waiting time Mean",
      "Chair time Min",
      "Chair time Max",
    ]);
    expect(c.chartSnapshot?.legend?.map((l) => l.id)).toEqual(["wait", "chair"]);
  });

  it("hovers one category at a time, in order, with the crosshair and the tooltip", async () => {
    const c = await mountChart();
    const box = svgOf(c).getBoundingClientRect();
    const xs = marks(c).map((m) => {
      const r = m.getBoundingClientRect();
      return r.left + r.width / 2 - box.left;
    });
    const seen = await sweep(
      c,
      xs.map((x) => [x, 120] as [number, number]),
    );
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    await settle();
    expect(svgOf(c).querySelector("line[stroke-dasharray]")).toBeTruthy();
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Waiting time");
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Mean 7");
  });

  it("walks the categories with the arrow keys", async () => {
    const c = await mountChart();
    await walkKeys(c, "ArrowRight", CATEGORIES.length);
  });

  it("pins a category with a tap", async () => {
    const c = await mountChart();
    const box = svgOf(c).getBoundingClientRect();
    const r = (marks(c)[1] as SVGElement).getBoundingClientRect();
    await pinByTap(c, r.left + r.width / 2 - box.left, 120, 1);
  });

  it("hides a band from the plot, the labels and the tooltip when its toggle is off", async () => {
    const c = await mountChart();
    (c.toggleSeries as (id: string) => void)("chair");
    await settle();
    expect(svgOf(c).querySelectorAll("[data-series]")).toHaveLength(1);
    expect(marks(c)[0]?.getAttribute("aria-label")).not.toContain("Chair time");
  });

  it("uses a real time axis for dates, in the locale and time zone", async () => {
    const c = await mountChart('locale="de-DE" time-zone="UTC"');
    c.categories = [new Date("2026-03-02T00:00:00Z"), new Date("2026-03-03T00:00:00Z")];
    c.bands = [{ id: "a", name: "A", min: [1, 2], max: [3, 4] }];
    await settle();
    const labels = c.chartSnapshot?.categories ?? [];
    expect(labels).toHaveLength(2);
    expect(labels.join()).not.toMatch(/es-PE/);
    expect(labels[0]).toMatch(/2026/);
    expect(labels[0]).not.toBe(new Date("2026-03-02T00:00:00Z").toLocaleDateString("en-US"));
  });

  it("formats with the locale, shows the empty state without data and passes axe", async () => {
    const c = await mountChart('locale="de-DE"');
    c.setAttribute("value-format", "number");
    c.bands = [{ id: "a", name: "A", min: [1234.5, 1], max: [2000, 5] }];
    c.categories = ["x", "y"];
    await settle();
    expect(c.chartSnapshot?.series[0]?.text[0]).toBe("1.234,5");
    expect(await violations(c)).toEqual([]);
    c.bands = [{ id: "a", name: "A", min: [null, null], max: [null, null] }];
    await settle();
    expect(c.querySelector("svg [data-series]")).toBeNull();
  });
});
