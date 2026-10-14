import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineDonutChart } from "../src/donut-chart/donut-chart.ts";
import { definePieChart } from "../src/pie-chart/pie-chart.ts";
import {
  awake,
  chart,
  marks,
  middle,
  type PolarChart,
  parkMouse,
  pointer,
  record,
  settle,
  svgOf,
  tap,
  violations,
} from "./e20-charts.ts";
import { ax, frame, wait } from "./setup.ts";

beforeAll(() => {
  defineDonutChart();
  definePieChart();
  defineChartLegend();
  defineChartTooltip();
  defineChartBreadcrumb();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const DATA = [
  { id: "cut", name: "Haircut", value: 120 },
  { id: "beard", name: "Beard", value: 80 },
  { id: "color", name: "Color", value: 60 },
  { id: "kids", name: "Kids", value: 40 },
];
const donut = async (attrs = "", inner = "", width = 480) => {
  const c = (await chart("ui-donut-chart", `height="300" ${attrs}`, inner, width)) as PolarChart & {
    data: unknown;
  };
  c.data = DATA;
  await settle();
  return c;
};
/** A point on the ring, `degrees` clockwise from 12 o'clock, in drawing units. */
const onRing = (c: Element, degrees: number, radiusShare = 0.82) => {
  const { x, y } = middle(c);
  const outer = Math.min(x, y) - 14 - 8;
  const a = (degrees * Math.PI) / 180;
  return { x: x + Math.sin(a) * outer * radiusShare, y: y - Math.cos(a) * outer * radiusShare };
};

describe("ui-donut-chart", () => {
  it("names the chart, one image per slice, and the centre total", async () => {
    const c = await donut();
    expect(await ax("group", "Chart")).toBeTruthy();
    expect(marks(c).map((m) => m.getAttribute("aria-label"))).toEqual([
      "Haircut: 120, 40%",
      "Beard: 80, 26.7%",
      "Color: 60, 20%",
      "Kids: 40, 13.3%",
    ]);
    expect(c.querySelector("svg g[aria-hidden] text")?.textContent).toBe("300");
  });

  it("hovers each slice once, in order, and the centre follows without the pointer ever losing it", async () => {
    const c = await donut("", "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = record(c, "chart-hover");
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    let opens = 0;
    new MutationObserver((records) => {
      for (const r of records) if (r.attributeName === "data-open") opens++;
    }).observe(tip, { attributes: true });
    for (let degrees = 2; degrees < 360; degrees += 3) {
      const p = onRing(c, degrees);
      pointer(c, "pointermove", p.x, p.y);
      await frame();
    }
    expect((events as Array<{ index: number } | null>).map((e) => e?.index)).toEqual([0, 1, 2, 3]);
    expect(opens).toBe(1);
    // The resting slice that stepped out is not what the pointer tests: a still pointer on a
    // slice edge changes nothing, however long it stays.
    const edge = onRing(c, 0.4 * 360 + 0.5);
    pointer(c, "pointermove", edge.x, edge.y);
    await wait(120);
    const count = events.length;
    for (let i = 0; i < 12; i++) {
      pointer(c, "pointermove", edge.x, edge.y);
      await frame();
    }
    expect(events.length).toBe(count);
    expect(c.querySelector("svg g[aria-hidden] text")?.textContent).toBe("80");
    pointer(c, "pointerleave", 0, 0);
    await frame();
    expect(c.querySelector("svg g[aria-hidden] text")?.textContent).toBe("300");
  });

  it("keeps the tooltip side steady across slices near the middle", async () => {
    const c = await donut("", "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = record(c, "chart-hover") as Array<{ side?: string } | null>;
    // 0 to 360 degrees: the first two slices are right of the middle, the last two left.
    for (const degrees of [10, 100, 180, 250, 330]) {
      const p = onRing(c, degrees);
      pointer(c, "pointermove", p.x, p.y);
      await frame();
    }
    const sides = events.flatMap((e) => (e ? [e.side] : []));
    expect(sides.filter((side, i) => side !== sides[i - 1])).toEqual(["right", "left"]);
  });

  it("walks the slices with the arrow keys, wrapping, from one tab stop", async () => {
    const c = await donut();
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(marks(c)[0]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(marks(c)[3]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(marks(c)[0]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(marks(c)[3]);
    expect(c.querySelector("svg g[aria-hidden] text")?.textContent).toBe("40");
    await userEvent.keyboard("{Escape}");
    expect(c.hover).toBeNull();
  });

  it("a tap pins the slice under the finger and a swipe does not", async () => {
    const c = await donut();
    await awake(c);
    const p = onRing(c, 180);
    tap(c, p.x, p.y);
    expect(c.selected).toBe(1);
    expect(c.hover).toMatchObject({ index: 1, category: 1, pinned: true, source: "touch" });
    expect(c.querySelector("svg g[aria-hidden] text")?.textContent).toBe("80");
    tap(c, p.x, p.y);
    expect(c.selected).toBeNull();
  });

  it("lists the slices in the legend and hides one with a toggle", async () => {
    const c = await donut("", "<ui-chart-legend></ui-chart-legend>");
    await wait(60);
    const buttons = [...c.querySelectorAll<HTMLButtonElement>("ui-chart-legend button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Haircut", "Beard", "Color", "Kids"]);
    expect(c.chartSnapshot?.series.map((s) => s.name)).toEqual(["Value", "Share"]);
    buttons[1]?.click();
    await wait(80);
    expect(c.isHidden("beard")).toBe(true);
    expect(marks(c)).toHaveLength(3);
    expect(c.querySelector("svg g[aria-hidden] text")?.textContent).toBe("220");
    buttons[1]?.click();
    await wait(80);
    expect(marks(c)).toHaveLength(4);
  });

  it("puts the legend beside the drawing in a wide container and below in a narrow one", async () => {
    const wide = await donut("", "<ui-chart-legend></ui-chart-legend>", 640);
    const legend = wide.querySelector("ui-chart-legend") as HTMLElement;
    expect(getComputedStyle(legend).position).toBe("absolute");
    expect(legend.getBoundingClientRect().left).toBeGreaterThan(
      wide.querySelector("svg")?.getBoundingClientRect().right ?? 0,
    );
    document.body.innerHTML = "";
    const narrow = await donut("", "<ui-chart-legend></ui-chart-legend>", 360);
    expect(
      getComputedStyle(narrow.querySelector("ui-chart-legend") as HTMLElement).position,
    ).not.toBe("absolute");
  });

  it("drills into children, keeps the path in a breadcrumb and goes back", async () => {
    const c = await donut("", "<ui-chart-breadcrumb></ui-chart-breadcrumb>");
    c.data = [
      {
        id: "a",
        name: "Hair",
        value: 10,
        children: [
          { id: "a1", name: "Cut", value: 6 },
          { id: "a2", name: "Dye", value: 4 },
        ],
      },
      { id: "b", name: "Beard", value: 5 },
    ];
    await settle();
    await awake(c);
    const p = onRing(c, 60);
    pointer(c, "pointermove", p.x, p.y);
    pointer(c, "click", p.x, p.y);
    await userEvent.click(c.querySelector("svg") as Element, { position: { x: p.x, y: p.y } });
    await settle();
    expect(marks(c).map((m) => m.getAttribute("aria-label")?.split(":")[0])).toEqual([
      "Cut",
      "Dye",
    ]);
    const crumbs = [
      ...c.querySelectorAll("ui-chart-breadcrumb button, ui-chart-breadcrumb [aria-current]"),
    ];
    expect(crumbs.length).toBeGreaterThan(0);
    (c as unknown as { goTo(id: string): void }).goTo("");
    await settle();
    expect(marks(c)).toHaveLength(2);
  });

  it("is a pie without the hole and a centre", async () => {
    const host = await chart("ui-pie-chart", 'height="260"', "", 420);
    (host as unknown as { data: unknown }).data = DATA;
    await settle();
    expect(marks(host)).toHaveLength(4);
    expect(host.querySelector("svg g[aria-hidden]")).toBeNull();
    expect(svgOf(host).querySelectorAll("[data-slice]")).toHaveLength(4);
  });

  it("has no accessibility violations", async () => {
    const c = await donut(
      "outside-labels slice-labels",
      "<ui-chart-legend></ui-chart-legend>",
      640,
    );
    expect(await violations(c)).toEqual([]);
  });
});
