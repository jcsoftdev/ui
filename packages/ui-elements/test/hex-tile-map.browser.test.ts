import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineHexTileMap } from "../src/hex-tile-map/hex-tile-map.ts";
import { awake, parkMouse, pointerAt, reachable, record, settle } from "./e24-fixture.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineHexTileMap();
  defineChartLegend();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const DATA = [
  { id: "PE-LIM", value: 900 },
  { id: "PE-CUS", value: 450 },
  { id: "Callao", value: 120 },
  { id: "PE-TUM", value: null },
];

type Chart = HTMLElement & {
  data: typeof DATA;
  selected: number | null;
  tileInfo(index: number): { id: string; value: number | null } | undefined;
  chartSnapshot: { categories: string[]; scale?: { min: number; max: number } } | null;
};

async function chart(attrs = 'locale="en-US"') {
  const host = mount(
    `<div style="width:420px"><ui-hex-tile-map id="c" label="Customers by region" value-name="Customers" ${attrs}></ui-hex-tile-map>
     <ui-chart-legend for="c"></ui-chart-legend></div>`,
  );
  const c = host.querySelector("ui-hex-tile-map") as Chart;
  c.data = DATA;
  await settle(80);
  return c;
}
const tiles = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [data-tile]")];

describe("ui-hex-tile-map", () => {
  it("draws one named hexagon per region without loading any map data", async () => {
    const c = await chart();
    expect(tiles(c)).toHaveLength(25);
    expect(await ax("group", "Customers by region")).toBeTruthy();
    expect(await ax("image", "Lima: 900")).toBeTruthy();
    expect(await ax("image", "Tumbes: No data")).toBeTruthy();
    expect(c.tileInfo(0)?.id).toBe("PE-TUM");
    const names = performance.getEntriesByType("resource").map((entry) => entry.name);
    expect(names.some((name) => /geo-data/.test(name))).toBe(false);
    expect(c.chartSnapshot?.scale).toMatchObject({ min: 0, max: 900 });
  });

  it("hovers every tile once, in order, and keeps the tooltip content stable on redraw", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    const hovers = record(c, "chart-hover");
    const found = reachable(tiles(c));
    expect(found).toHaveLength(25);
    for (const p of found) {
      pointerAt("pointermove", p.x, p.y);
      pointerAt("pointermove", p.x + 0.5, p.y);
    }
    expect(hovers.map((h) => h?.index)).toEqual(found.map((p) => p.index));
    const before = hovers.length;
    c.data = [...DATA];
    await settle(60);
    expect(hovers.length).toBe(before);
  });

  it("moves between tiles by direction", async () => {
    const c = await chart();
    await awake(c);
    (c.querySelector("svg [role=img][tabindex='0']") as SVGElement).focus();
    await wait(80);
    const hovers = record(c, "chart-hover");
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await wait(30);
    const down = hovers.at(-1)?.index as number;
    const origin = tiles(c)[0]?.getBoundingClientRect() as DOMRect;
    const moved = tiles(c)[down]?.getBoundingClientRect() as DOMRect;
    expect(moved.top).toBeGreaterThan(origin.top);
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }),
    );
    await wait(30);
    expect(hovers.at(-1)?.index).toBe(24);
  });

  it("a tap pins a tile and a second tap releases it", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    const p = reachable(tiles(c))[4] as { index: number; x: number; y: number };
    pointerAt("pointerdown", p.x, p.y, "touch");
    pointerAt("pointerup", p.x, p.y, "touch");
    await wait(20);
    expect(c.selected).toBe(p.index);
    pointerAt("pointerdown", p.x, p.y, "touch");
    pointerAt("pointerup", p.x, p.y, "touch");
    await wait(20);
    expect(c.selected).toBeNull();
  });

  it("takes custom tiles and formats with the page locale", async () => {
    const c = await chart('locale="de-DE"');
    (c as unknown as { tiles: unknown }).tiles = [
      { id: "a", name: "Alpha", code: "A", row: 0, col: 0 },
      { id: "b", name: "Beta", code: "B", row: 0, col: 1 },
    ];
    c.data = [
      { id: "a", value: 1500 },
      { id: "b", value: 20 },
    ];
    await settle(80);
    expect(tiles(c)).toHaveLength(2);
    expect(await ax("image", "Alpha: 1.500")).toBeTruthy();
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
