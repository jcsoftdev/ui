import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineBubbleMap } from "../src/bubble-map/bubble-map.ts";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { awake, parkMouse, pointerAt, reachable, record, settle, svgOf } from "./e24-fixture.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineBubbleMap();
  defineChartLegend();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const POINTS = [
  { id: "lim", name: "Lima", lon: -77.04, lat: -12.04, value: 120, category: "North" },
  { id: "cal", name: "Callao", lon: -77.12, lat: -12.05, value: 40, category: "North" },
  { id: "cus", name: "Cusco", lon: -71.97, lat: -13.52, value: 60, category: "South" },
  { id: "are", name: "Arequipa", lon: -71.53, lat: -16.4, value: 80, category: "South" },
  { id: "pui", name: "Piura", lon: -80.63, lat: -5.19, category: "North" },
];
const ROUTES = [{ id: "r1", from: "lim", to: "cus", value: 30 }];

type Chart = HTMLElement & {
  points: typeof POINTS;
  routes: typeof ROUTES;
  selected: number | null;
  markInfo(index: number): { kind: string; points?: unknown[] } | undefined;
  chartSnapshot: { legend?: Array<{ id: string }>; categories: string[] } | null;
};

async function chart(attrs = 'locale="en-US"') {
  const host = mount(
    `<div style="width:520px"><ui-bubble-map id="c" label="Appointments by city" map="peru" value-name="Citas" ${attrs}></ui-bubble-map>
     <ui-chart-legend for="c"></ui-chart-legend></div>`,
  );
  const c = host.querySelector("ui-bubble-map") as Chart;
  c.points = POINTS;
  c.routes = ROUTES;
  await settle(120);
  return c;
}
const bubbles = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [data-bubble]")];

describe("ui-bubble-map", () => {
  it("names every bubble and route for assistive technology", async () => {
    const c = await chart();
    expect(await ax("group", "Appointments by city")).toBeTruthy();
    expect(await ax("image", "Lima, Citas: 120")).toBeTruthy();
    expect(await ax("image", "Piura")).toBeTruthy();
    expect(await ax("image", "Lima → Cusco: Citas 30")).toBeTruthy();
    expect(bubbles(c)).toHaveLength(5);
  });

  it("sizes bubbles by area and publishes categories as the legend", async () => {
    const c = await chart();
    const radius = (name: string) =>
      Number(
        (c.querySelector(`[aria-label^="${name}"] circle`) as SVGCircleElement).getAttribute("r"),
      );
    expect(radius("Lima,")).toBeCloseTo(28, 5);
    expect(radius("Cusco")).toBeCloseTo(28 * Math.sqrt(60 / 120), 5);
    expect(c.chartSnapshot?.legend?.map((item) => item.id)).toEqual(["North", "South"]);
    (c.parentElement as Element)
      .querySelectorAll<HTMLButtonElement>("ui-chart-legend button")[1]
      ?.click();
    await settle(60);
    expect(bubbles(c)).toHaveLength(3);
  });

  it("hovers each bubble once, in mark order", async () => {
    const c = await chart();
    await awake(c);
    const hovers = record(c, "chart-hover");
    const found = reachable(bubbles(c)).map((p) => ({
      ...p,
      mark: Number((bubbles(c)[p.index] as SVGElement).dataset.i),
    }));
    expect(found.length).toBe(5);
    const order = found.sort((a, b) => a.mark - b.mark);
    for (const p of order) {
      pointerAt("pointermove", p.x, p.y);
      pointerAt("pointermove", p.x, p.y + 0.4);
    }
    expect(hovers.map((h) => h?.index)).toEqual(order.map((p) => p.mark));
  });

  it("hovers a route through its wide hit line", async () => {
    const c = await chart();
    await awake(c);
    const hovers = record(c, "chart-hover");
    const route = svgOf(c).querySelector("[data-route] [data-route-hit]") as SVGGeometryElement;
    const total = route.getTotalLength();
    const at = route.getPointAtLength(total / 2);
    const matrix = route.getScreenCTM() as DOMMatrix;
    const point = at.matrixTransform(matrix);
    pointerAt("pointermove", point.x, point.y);
    expect(hovers.at(-1)?.index).toBe(5);
    expect(hovers.at(-1)?.title).toBe("Lima → Cusco");
  });

  it("clusters close markers and zooms into a cluster instead of pinning it", async () => {
    const c = await chart('locale="en-US" cluster animate="off"');
    await awake(c);
    expect(bubbles(c).length).toBeLessThan(5);
    const clusterIndex = [0, 1, 2, 3, 4].find((i) => c.markInfo(i)?.kind === "cluster") as number;
    expect(clusterIndex).toBeGreaterThanOrEqual(0);
    const group = svgOf(c).querySelector("[data-layer=regions]") as SVGGElement;
    (c as unknown as { select(i: number): void }).select(clusterIndex);
    await settle(80);
    expect(group.getAttribute("transform")).not.toMatch(/scale\(1\)/);
    expect(c.selected).toBeNull();
  });

  it("walks the markers with the arrows and stops the dashes without motion", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    expect(svgOf(c).querySelector("[data-flow]")).toBeNull();
    const first = c.querySelector<SVGElement>("svg [role=img][tabindex='0']") as SVGElement;
    first.focus();
    await wait(80);
    const hovers = record(c, "chart-hover");
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await wait(40);
    expect(hovers.at(-1)?.index).toBeGreaterThan(-1);
    const moving = await chart('locale="en-US"');
    expect(svgOf(moving).querySelector("[data-flow]")).toBeTruthy();
  });

  it("a tap pins a bubble", async () => {
    const c = await chart();
    await awake(c);
    const p = reachable(bubbles(c))[0] as { index: number; x: number; y: number };
    pointerAt("pointerdown", p.x, p.y, "touch");
    pointerAt("pointerup", p.x, p.y, "touch");
    await wait(20);
    expect(c.selected).toBe(Number((bubbles(c)[p.index] as SVGElement).dataset.i));
  });

  it("passes axe", async () => {
    const c = await chart();
    const results = await axe.run(c.parentElement as Element, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80))}`),
    ).toEqual([]);
  });
});
