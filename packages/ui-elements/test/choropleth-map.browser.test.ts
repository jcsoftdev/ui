import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChoroplethMap } from "../src/choropleth-map/choropleth-map.ts";
import { awake, parkMouse, pointerAt, reachable, record, settle, svgOf } from "./e24-fixture.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineChoroplethMap();
  defineChartLegend();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const DATA = [
  { id: "PE-LIM", value: 1200 },
  { id: "PE-CUS", value: 640 },
  { id: "PE-AMA", value: 80 },
  { name: "Ancash", id: "áncash", value: 300 },
  { id: "PE-ARE", value: null },
];

type Chart = HTMLElement & {
  data: typeof DATA;
  selected: number | null;
  regions: Array<{ index: number; id: string; name: string; value: number | null }>;
  chartSnapshot: {
    categories: string[];
    series: Array<{ values: unknown[]; text: string[] }>;
    scale?: { min: number; max: number; colors: string[] };
    legend?: Array<{ id: string; name: string }>;
  } | null;
};

async function chart(attrs = 'locale="en-US"', width = 520) {
  const host = mount(
    `<div style="width:${width}px"><ui-choropleth-map id="c" label="Customers by department" map="peru" value-name="Customers" ${attrs}></ui-choropleth-map>
     <ui-chart-legend for="c"></ui-chart-legend></div>`,
  );
  const c = host.querySelector("ui-choropleth-map") as Chart;
  c.data = DATA;
  await settle(120);
  return c;
}
const regionEls = (c: Element) => [...c.querySelectorAll<SVGElement>("svg path[data-region]")];

describe("ui-choropleth-map", () => {
  it("loads the topology lazily and draws one named region per department", async () => {
    const c = await chart();
    expect(regionEls(c)).toHaveLength(26);
    expect(await ax("group", "Customers by department")).toBeTruthy();
    expect(await ax("image", "Lima (región): 1,200")).toBeTruthy();
    expect(await ax("image", "Arequipa: No data")).toBeTruthy();
    const names = performance.getEntriesByType("resource").map((entry) => entry.name);
    expect(names.some((name) => /geo-data\/world/.test(name))).toBe(false);
  });

  it("publishes a continuous scale for the legend and the table of every region", async () => {
    const c = await chart();
    const snapshot = c.chartSnapshot;
    expect(snapshot?.categories).toHaveLength(26);
    expect(snapshot?.scale).toMatchObject({ min: 0, max: 1200 });
    expect(snapshot?.scale?.colors).toHaveLength(2);
    expect(
      (c.parentElement as Element).querySelector("ui-chart-legend [data-ui-part=scale]"),
    ).toBeTruthy();
  });

  it("stepped ranges become legend items that dim their regions", async () => {
    const c = await chart();
    (c as unknown as { ranges: unknown }).ranges = [
      { from: 0, to: 500, label: "Low" },
      { from: 500, label: "High" },
    ];
    await settle(60);
    expect(c.chartSnapshot?.legend?.map((item) => item.name)).toEqual(["Low", "High"]);
    (c.parentElement as Element)
      .querySelectorAll<HTMLButtonElement>("ui-chart-legend button")[1]
      ?.click();
    await settle(60);
    const lima = regionEls(c)[c.regions.findIndex((r) => r.id === "PE-LIM")] as SVGElement;
    expect(lima.style.fill).toBe("var(--surface-2)");
  });

  it("hovers each region once, in order, even while the map redraws", async () => {
    const c = await chart();
    await awake(c);
    const hovers = record(c, "chart-hover");
    const points = reachable(regionEls(c)).slice(0, 6);
    for (const p of points) {
      pointerAt("pointermove", p.x, p.y);
      pointerAt("pointermove", p.x + 1, p.y);
    }
    expect(hovers.map((h) => h?.index)).toEqual(points.map((p) => p.index));
    const last = points.at(-1) as (typeof points)[number];
    pointerAt("pointermove", last.x, last.y);
    const before = hovers.length;
    c.data = [...DATA];
    await settle(60);
    expect(hovers.length).toBe(before);
    expect((c as unknown as { hover: { index: number } }).hover.index).toBe(last.index);
  });

  it("walks the regions with the arrows and jumps with Home and End", async () => {
    const c = await chart();
    await awake(c);
    const first = c.querySelector<SVGElement>("svg [role=img][tabindex='0']") as SVGElement;
    first.focus();
    await wait(80);
    const hovers = record(c, "chart-hover");
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }),
    );
    await wait(30);
    expect(hovers.at(-1)?.index).toBe(25);
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }),
    );
    await wait(30);
    expect(hovers.at(-1)?.index).toBe(0);
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
    await wait(30);
    const moved = hovers.at(-1)?.index as number;
    expect(moved).toBeGreaterThan(0);
    const { regions } = c;
    expect(regions[moved]?.name).toBeTruthy();
  });

  it("a tap pins a region and a second tap releases it", async () => {
    const c = await chart();
    await awake(c);
    const point = reachable(regionEls(c))[2] as { index: number; x: number; y: number };
    pointerAt("pointerdown", point.x, point.y, "touch");
    pointerAt("pointerup", point.x, point.y, "touch");
    await wait(20);
    expect(c.selected).toBe(point.index);
    pointerAt("pointerdown", point.x, point.y, "touch");
    pointerAt("pointerup", point.x, point.y, "touch");
    await wait(20);
    expect(c.selected).toBeNull();
  });

  it("a drag pans the map and never selects; a click still selects", async () => {
    const c = await chart();
    await awake(c);
    const selects = record(c, "chart-select");
    const group = svgOf(c).querySelector("[data-layer=regions]") as SVGGElement;
    c.querySelector<HTMLButtonElement>("[data-ui-part=geo-controls] [data-kind=in]")?.click();
    await wait(400);
    const start = reachable(regionEls(c))[0] as { index: number; x: number; y: number };
    const el = regionEls(c)[start.index] as Element;
    const before = group.getAttribute("transform");
    pointerAt("pointerdown", start.x, start.y, "mouse", el);
    for (let step = 1; step <= 5; step += 1)
      pointerAt("pointermove", start.x + step * 12, start.y + step * 6, "mouse", el);
    pointerAt("pointerup", start.x + 60, start.y + 30, "mouse", el);
    el.dispatchEvent(
      new PointerEvent("click", {
        bubbles: true,
        cancelable: true,
        detail: 1,
        pointerType: "mouse",
        clientX: start.x,
        clientY: start.y,
      }),
    );
    await wait(40);
    expect(group.getAttribute("transform")).not.toBe(before);
    expect(selects).toEqual([]);
    expect(c.selected).toBeNull();
    // A press that stays put is a click.
    pointerAt("pointerdown", start.x, start.y, "mouse", el);
    pointerAt("pointerup", start.x, start.y, "mouse", el);
    el.dispatchEvent(
      new PointerEvent("click", {
        bubbles: true,
        cancelable: true,
        detail: 1,
        pointerType: "mouse",
        clientX: start.x,
        clientY: start.y,
      }),
    );
    await wait(30);
    expect(c.selected).toBe(start.index);
  });

  it("zooms with the keys and the buttons, and fits with 0", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    const group = svgOf(c).querySelector("[data-layer=regions]") as SVGGElement;
    const first = c.querySelector<SVGElement>("svg [role=img][tabindex='0']") as SVGElement;
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "+", bubbles: true, cancelable: true }),
    );
    await settle();
    expect(group.getAttribute("transform")).toMatch(/scale\(1\.6/);
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "0", bubbles: true, cancelable: true }),
    );
    await settle();
    expect(group.getAttribute("transform")).toMatch(/scale\(1\)/);
  });

  it("uses the locale of the page, never a hard-wired one", async () => {
    const c = await chart('locale="de-DE"');
    expect(c.chartSnapshot?.series[0]?.text[c.regions.findIndex((r) => r.id === "PE-LIM")]).toBe(
      "1.200",
    );
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

  it("shows the empty state and fires map-error for an unknown map, then recovers", async () => {
    const c = await chart();
    const errors = record(c, "map-error");
    c.setAttribute("map", "atlantis");
    await settle(120);
    expect(errors).toEqual([{ map: "atlantis", reason: "unknown" }]);
    expect(regionEls(c)).toHaveLength(0);
    expect(c.querySelector("svg")).toBeNull();
    c.setAttribute("map", "peru");
    await settle(160);
    expect(regionEls(c)).toHaveLength(26);
  });

  it("keys the regions without a value with a No data swatch", async () => {
    const c = await chart();
    const key = () => c.querySelector("[data-ui-part=geo-key]")?.textContent ?? "";
    expect(key()).toContain("No data");
    c.data = c.regions.map((region) => ({ id: region.id, value: 10 }));
    await settle(120);
    expect(key()).toBe("");
  });

  it("names the chart from its label, never from the bundled map name", async () => {
    const host = mount(
      '<div style="width:400px"><ui-choropleth-map id="n" map="world" locale="en-US"></ui-choropleth-map></div>',
    );
    const c = host.querySelector("ui-choropleth-map") as Chart;
    c.data = [{ id: "PE", value: 3 }];
    await settle(200);
    expect(await ax("group", "Mundo")).toBeUndefined();
  });

  it("sizes the box like React (220 to 640 px) without writing aspect-ratio, and follows projection", async () => {
    const c = await chart('locale="en-US"', 300);
    expect(c.hasAttribute("aspect-ratio")).toBe(false);
    const height = () => Number(c.getAttribute("height"));
    expect(height()).toBeGreaterThanOrEqual(220);
    expect(height()).toBeLessThanOrEqual(640);
    const before = height();
    c.setAttribute("projection", "equirectangular");
    await settle(100);
    expect(height()).not.toBe(before);
    c.setAttribute("height", "300");
    await settle(100);
    expect(height()).toBe(300);
  });

  describe("touch", () => {
    const touch = (
      type: string,
      target: Element,
      id: number,
      x: number,
      y: number,
      extra: PointerEventInit = {},
    ) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerType: "touch",
          pointerId: id,
          isPrimary: id === 1,
          ...extra,
        }),
      );

    it("one finger leaves the page scrolling; a tap engages and then one finger pans", async () => {
      const c = await chart('locale="en-US" animate="off"');
      await awake(c);
      const drawing = c.querySelector("[data-ui-part=drawing]") as HTMLElement;
      const svg = svgOf(c);
      const group = svg.querySelector("[data-layer=regions]") as SVGGElement;
      expect(drawing.style.touchAction).toBe("pan-y");
      c.querySelector<HTMLButtonElement>("[data-ui-part=geo-controls] [data-kind=in]")?.click();
      await settle();
      const zoomed = group.getAttribute("transform");
      const box = svg.getBoundingClientRect();
      const [x, y] = [box.left + 200, box.top + 100];
      touch("pointerdown", svg, 1, x, y);
      for (let i = 1; i <= 5; i += 1) touch("pointermove", svg, 1, x + i * 10, y);
      touch("pointerup", svg, 1, x + 50, y);
      await settle();
      expect(group.getAttribute("transform")).toBe(zoomed);
      // The tap engaged the map.
      expect(drawing.style.touchAction).toBe("none");
      touch("pointerdown", svg, 1, x, y);
      for (let i = 1; i <= 5; i += 1) touch("pointermove", svg, 1, x + i * 10, y);
      touch("pointerup", svg, 1, x + 50, y);
      await settle();
      expect(group.getAttribute("transform")).not.toBe(zoomed);
    });

    it("two fingers pinch-zoom without engaging first", async () => {
      const c = await chart('locale="en-US" animate="off"');
      await awake(c);
      const svg = svgOf(c);
      const group = svg.querySelector("[data-layer=regions]") as SVGGElement;
      const box = svg.getBoundingClientRect();
      const [x, y] = [box.left + 200, box.top + 100];
      touch("pointerdown", svg, 1, x - 20, y);
      touch("pointerdown", svg, 2, x + 20, y);
      for (let i = 1; i <= 4; i += 1) {
        touch("pointermove", svg, 1, x - 20 - i * 12, y);
        touch("pointermove", svg, 2, x + 20 + i * 12, y);
      }
      await settle();
      expect(group.getAttribute("transform")).toMatch(/scale\((?!1\))/);
      touch("pointerup", svg, 1, x, y);
      touch("pointerup", svg, 2, x, y);
    });
  });
});
