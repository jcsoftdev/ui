import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineFunnelChart } from "../src/funnel-chart/funnel-chart.ts";
import {
  animateCalls,
  awake,
  axeViolations,
  focusChart,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  settle,
  sweep,
  tap,
} from "./e21b-helpers.ts";
import { ax } from "./setup.ts";

beforeAll(() => defineFunnelChart());
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const STAGES = [
  { id: "visit", name: "Visits", value: 1000 },
  { id: "signup", name: "Sign ups", value: 600 },
  { id: "trial", name: "Trials", value: 300 },
  { id: "paid", name: "Paid", value: 90 },
];
const funnel = (attrs = "", width = 520) =>
  mountChart("ui-funnel-chart", `label="Conversion" ${attrs}`, { stages: STAGES }, width);

type Stage = { widthFrom: number; widthTo: number; from: number };
const poly = (c: Element) =>
  [...c.querySelectorAll<SVGPolygonElement>("polygon[data-stage]")].map((p) =>
    (p.getAttribute("points") as string)
      .split(" ")
      .map((pair) => pair.split(",").map(Number) as [number, number]),
  );

describe("ui-funnel-chart", () => {
  it("sizes the stages like the React funnel and names each as an image with its conversion", async () => {
    const c = await funnel();
    // Golden: widths come from the React stage geometry (imported by path at run time).
    const react = await import(/* @vite-ignore */ "../../ui/src/charts/core/polar.ts");
    const side = Math.round(Math.min(200, Math.max(96, 520 * 0.36)));
    const areaW = Math.max(60, 520 - side - 12 - 8);
    const stages = react.funnelStages(
      STAGES.map((s) => s.value),
      { length: 360 - 8, thickness: areaW, gap: 4, variant: "funnel", tapered: true, neck: 0.72 },
    );
    const shapes = poly(c);
    expect(shapes).toHaveLength(STAGES.length);
    shapes.forEach((points, i) => {
      const [p0, p1, p2, p3] = points as [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
      ];
      expect(p1[0] - p0[0]).toBeCloseTo((stages[i] as Stage).widthFrom, 1);
      expect(p2[0] - p3[0]).toBeCloseTo((stages[i] as Stage).widthTo, 1);
      expect(p0[1]).toBeCloseTo(4 + (stages[i] as Stage).from, 1);
    });
    expect(marksOf(c)).toHaveLength(4);
    expect(await ax("group", "Conversion")).toBeTruthy();
    expect(await ax("image", "Sign ups: 600, 60%, Conversion 60%")).toBeTruthy();
    expect(c.chartSnapshot?.series.map((s) => s.id)).toEqual(["value", "share", "conversion"]);
    expect(c.chartSnapshot?.series[2]?.text).toEqual(["", "60%", "50%", "30%"]);
  });

  it("passes axe, vertical and horizontal", async () => {
    expect(await axeViolations(await funnel())).toEqual([]);
    expect(await axeViolations(await funnel('orientation="horizontal"'))).toEqual([]);
  });

  it("hover never blinks: one event per stage in order, and the gaps snap to the nearest stage", async () => {
    const c = await funnel();
    await awake(c);
    const down = sweep(c, [60, 1], [60, 359]);
    expect(down).toEqual([0, 1, 2, 3]);
    const across = sweep(c, [1, 40], [519, 40]);
    expect(across).toEqual([0]); // along the stage the answer never changes
    const horizontal = await funnel('orientation="horizontal" height="260"');
    await awake(horizontal);
    expect(sweep(horizontal, [1, 120], [519, 120])).toEqual([0, 1, 2, 3]);
    const pyramid = await funnel('variant="pyramid"');
    await awake(pyramid);
    expect(sweep(pyramid, [60, 1], [60, 359])).toEqual([3, 2, 1, 0]); // the first stage is the base
    // Leaving the drawing is the only way to nothing.
    expect(sweep(c, [60, 359], [60, 380]).at(-1)).toBeNull();
  });

  it("shows value, share and conversion of the hovered stage, and dims the others", async () => {
    const c = await funnel();
    await awake(c);
    pointer(c, "pointermove", 60, 150);
    expect(c.hover).toMatchObject({ index: 1, title: "Sign ups" });
    expect(c.querySelectorAll("polygon[data-dim]")).toHaveLength(3);
    pointer(c, "pointerleave", 0, 0);
    expect(c.querySelectorAll("[data-dim]")).toHaveLength(0);
  });

  it("steps through the stages with the arrow keys", async () => {
    const c = await funnel();
    await focusChart();
    const index = () => (c.hover as { index: number }).index;
    expect(index()).toBe(0);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(index()).toBe(2);
    await userEvent.keyboard("{ArrowUp}{End}");
    expect(index()).toBe(3);
    await userEvent.keyboard("{Home}");
    expect(index()).toBe(0);
  });

  it("a tap pins a stage; hidden stages leave the funnel; the locale formats numbers", async () => {
    const c = await funnel('value-format="number"');
    c.setAttribute("locale", "de-DE");
    (c as unknown as { stages: unknown }).stages = STAGES.map((s) => ({
      ...s,
      value: s.value * 10,
    }));
    await settle();
    await awake(c);
    tap(c, 60, 150);
    expect(c.selected).toBe(1);
    expect(c.hover).toMatchObject({ pinned: true, source: "touch" });
    expect(marksOf(c).some((m) => /10\.000/.test(m.getAttribute("aria-label") ?? ""))).toBe(true);
    (c as unknown as { toggleSeries(id: string): void }).toggleSeries("paid");
    await settle();
    await settle();
    expect(poly(c)).toHaveLength(3);
  });

  it("plays the entry animation only when motion is allowed", async () => {
    expect(await animateCalls(() => funnel(), true)).toBe(0);
    expect(await animateCalls(() => funnel(), false)).toBeGreaterThan(0);
  });
});
