import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
import { ax, wait } from "./setup.ts";

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

/** Plot box inside the drawing, from the translate of the plot group (the bottom margin is 28). */
const plotBox = (c: Element) => {
  const svg = svgOf(c);
  const [left = 0, top = 0] = (svg.querySelector(":scope > g")?.getAttribute("transform") ?? "")
    .replace(/[^\d.,-]/g, "")
    .split(",")
    .map(Number);
  const box = svg.getBoundingClientRect();
  return { left, top, right: box.width - 14, bottom: box.height - 28 };
};

const until = async (done: () => boolean, ms = 4000) => {
  const end = performance.now() + ms;
  while (!done() && performance.now() < end) await wait(20);
};

const bigSamples = (n: number) =>
  Array.from({ length: n }, (_, i) => 50 + Math.sin(i * 0.37) * 20 + ((i * 7919) % 100) / 10);

/** The hover log of a sweep must be a non-decreasing run of real marks with no leave in it. */
const expectSteady = (seen: Array<number | null>, count: number) => {
  expect(seen.length).toBeGreaterThan(0);
  expect(seen).not.toContain(null);
  const marks = seen as number[];
  expect([...marks].sort((a, b) => a - b)).toEqual(marks);
  expect(new Set(marks).size).toBe(count);
};

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

  it("keeps the tooltip across the gutters of the whole plot height", async () => {
    for (const series of [SERIES, TWO]) {
      const c = await mountChart("", series);
      const p = plotBox(c);
      const path: Array<[number, number]> = [];
      for (let y = p.top + 1; y < p.bottom; y += 2) path.push([200, y]);
      expectSteady(await sweep(c, path), series.length * 3);
    }
  });

  it("does not hover outside the plot", async () => {
    const c = await mountChart();
    const p = plotBox(c);
    expect(
      await sweep(c, [
        [200, p.top - 4],
        [200, p.bottom + 4],
        [p.right + 6, 100],
      ]),
    ).toEqual([]);
  });

  it("takes its tick format from the value-format preset", async () => {
    const c = await mountChart("", [
      {
        id: "a",
        name: "A",
        data: [
          [0.1, 0.2, 0.3],
          [0.2, 0.4],
          [0.5, 0.6],
        ],
      },
    ]);
    c.setAttribute("value-format", "percent");
    await settle();
    expect(svgOf(c).textContent).toContain("%");
  });

  it("reads the JSON attributes", async () => {
    const c = await chart("ui-raincloud-chart", {
      attrs: `categories='["X","Y"]' series='[{"id":"a","name":"A","data":[[1,2,3],[4,5,6]]}]' seed="3" point-radius="3"`,
    });
    expect(marks(c)).toHaveLength(2);
    expect(c.querySelector("[data-rain] circle")?.getAttribute("r")).toBe("3");
  });

  it("draws a 200k-sample cell and 20k samples on a canvas", async () => {
    const c = await mountChart("", [{ id: "a", name: "A", data: [bigSamples(200_000), [], []] }]);
    await until(() => c.querySelector("canvas") != null, 8000);
    expect(marks(c)).toHaveLength(1);
    expect(c.querySelector("canvas")).not.toBeNull();

    const many = await mountChart("", [{ id: "a", name: "A", data: [[1], [2], [3]] }]);
    const start = performance.now();
    many.series = [
      { id: "a", name: "A", data: [bigSamples(7000), bigSamples(7001), bigSamples(6000)] },
    ];
    await until(() => many.querySelector("canvas") != null);
    const took = performance.now() - start;
    console.log(`raincloud 20k samples drawn in ${took.toFixed(0)} ms`);
    expect(svgOf(many).querySelectorAll("*").length).toBeLessThan(300);
    expect(took).toBeLessThan(1500);
  });

  it("sorts each cell once: a resize or a hover sorts nothing", async () => {
    const c = await mountChart();
    const sort = vi.spyOn(Array.prototype, "sort");
    try {
      (c.parentElement as HTMLElement).style.width = "430px";
      await settle();
      await settle();
      await sweep(c, [[200, 100]]);
      expect(sort).not.toHaveBeenCalled();
    } finally {
      sort.mockRestore();
    }
  });
});
