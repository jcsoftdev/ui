import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineChoroplethDrilldown } from "../src/choropleth-drilldown/choropleth-drilldown.ts";
import { defineChoroplethMap } from "../src/choropleth-map/choropleth-map.ts";
import { awake, parkMouse, reachable, record, settle } from "./e24-fixture.ts";
import { mount, wait } from "./setup.ts";

beforeAll(() => {
  defineChoroplethMap();
  defineChartBreadcrumb();
  defineChoroplethDrilldown();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

type Drill = HTMLElement & {
  root: unknown;
  resolve: unknown;
  path: Array<{ id: string }>;
};

async function drill(attr = "") {
  const host = mount(
    `<div style="width:520px"><ui-choropleth-drilldown label="Customers" ${attr}>
       <ui-chart-breadcrumb></ui-chart-breadcrumb>
       <ui-choropleth-map locale="en-US" animate="off"></ui-choropleth-map>
     </ui-choropleth-drilldown></div>`,
  );
  const el = host.querySelector("ui-choropleth-drilldown") as Drill;
  el.resolve = (region: { id: string }, path: unknown[]) =>
    path.length === 1 && region.id === "PER"
      ? {
          id: "pe",
          name: "Perú",
          map: "peru",
          data: [{ id: "PE-LIM", value: 9 }],
          valueName: "Citas",
        }
      : undefined;
  el.root = { id: "world", name: "World", map: "world", data: [{ id: "PER", value: 5 }] };
  await settle(250);
  return el;
}
const map = (el: Element) =>
  el.querySelector("ui-choropleth-map") as HTMLElement & {
    regions: Array<{ index: number; id: string }>;
    drill(index: number): void;
    selected: number | null;
  };
const regionEls = (el: Element) => [...el.querySelectorAll<SVGElement>("svg path[data-region]")];

describe("ui-choropleth-drilldown", () => {
  it("opens a region into its own map and goes back through the breadcrumb", async () => {
    const el = await drill('drill-on="drill"');
    const c = map(el);
    expect(c.getAttribute("label")).toBe("Customers: World");
    expect(regionEls(el).length).toBeGreaterThan(100);
    const changes = record(el, "drilldown-change");
    await awake(c);
    c.drill(c.regions.findIndex((region) => region.id === "PER"));
    await settle(250);
    expect(regionEls(el)).toHaveLength(26);
    expect(c.getAttribute("label")).toBe("Customers: Perú");
    expect(c.getAttribute("value-name")).toBe("Citas");
    expect(changes.at(-1)).toEqual({ path: ["world", "pe"] });
    expect(el.querySelector("[role=status]")?.textContent).toBe("World > Perú");
    const crumb = el.querySelector<HTMLButtonElement>("ui-chart-breadcrumb button");
    expect(crumb?.textContent).toBe("World");
    crumb?.click();
    await settle(250);
    expect(regionEls(el).length).toBeGreaterThan(100);
    expect(c.getAttribute("label")).toBe("Customers: World");
    expect(el.path.map((level) => level.id)).toEqual(["world"]);
  });

  it("a click opens the level by default, and a region without detail fires region-click", async () => {
    const el = await drill();
    const c = map(el);
    await awake(c);
    const clicks = record(el, "region-click");
    const found = reachable(regionEls(el));
    const peru = found.find((p) => c.regions[p.index]?.id === "PER");
    const other = found.find((p) => c.regions[p.index]?.id !== "PER") as { x: number; y: number };
    const click = (p: { x: number; y: number }) => {
      const target = document.elementFromPoint(p.x, p.y) as Element;
      for (const type of ["pointerdown", "pointerup", "click"])
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            detail: 1,
            pointerType: "mouse",
            clientX: p.x,
            clientY: p.y,
            pointerId: 1,
            isPrimary: true,
          }),
        );
    };
    click(other);
    await wait(30);
    expect(clicks).toHaveLength(1);
    expect(el.path).toHaveLength(1);
    expect(peru).toBeTruthy();
    click(peru as { x: number; y: number });
    await settle(250);
    expect(el.path.map((level) => level.id)).toEqual(["world", "pe"]);
  });
});
