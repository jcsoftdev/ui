import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineGlobeChart } from "../src/globe-chart/globe-chart.ts";
import { awake, parkMouse, pointerAt, reachable, record, settle, svgOf } from "./e24-fixture.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineGlobeChart();
  defineChartLegend();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const POINTS = [
  { id: "lim", name: "Lima", lon: -77.04, lat: -12.04, value: 120 },
  { id: "bue", name: "Buenos Aires", lon: -58.38, lat: -34.6, value: 60 },
  { id: "mad", name: "Madrid", lon: -3.7, lat: 40.4, value: 80 },
];

type Chart = HTMLElement & {
  points: typeof POINTS;
  routes: unknown[];
  data: Array<{ id: string; value: number }>;
  rotation: { lon: number; lat: number };
  selected: number | null;
  markInfo(index: number): { kind: string } | undefined;
  chartSnapshot: { scale?: { min: number; max: number }; categories: string[] } | null;
};

async function chart(attrs = 'locale="en-US"') {
  const host = mount(
    `<div style="width:420px"><ui-globe-chart id="c" label="Customers worldwide" value-name="Customers" rotation="-70,-10" ${attrs}></ui-globe-chart>
     <ui-chart-legend for="c"></ui-chart-legend></div>`,
  );
  const c = host.querySelector("ui-globe-chart") as Chart;
  c.points = POINTS;
  c.data = [
    { id: "PE", value: 900 },
    { id: "AR", value: 300 },
  ];
  await settle(300);
  return c;
}
const markers = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [data-marker]")];

function drag(c: Element, from: [number, number], to: [number, number], steps = 6) {
  const svg = svgOf(c);
  const moves: PointerEvent[] = [];
  const send = (type: string, x: number, y: number) => {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerType: "mouse",
      pointerId: 1,
      isPrimary: true,
      buttons: 1,
    });
    svg.dispatchEvent(event);
    return event;
  };
  send("pointerdown", ...from);
  for (let i = 1; i <= steps; i += 1)
    moves.push(
      send(
        "pointermove",
        from[0] + ((to[0] - from[0]) * i) / steps,
        from[1] + ((to[1] - from[1]) * i) / steps,
      ),
    );
  const up = send("pointerup", ...to);
  return { moves, up };
}

describe("ui-globe-chart", () => {
  it("loads the world lazily, paints it on a canvas and names markers", async () => {
    const c = await chart();
    expect(c.querySelector("canvas")).toBeTruthy();
    expect(c.querySelectorAll("svg path[data-region]")).toHaveLength(0);
    expect(markers(c).length).toBeGreaterThan(0);
    expect(await ax("group", "Customers worldwide")).toBeTruthy();
    expect(c.querySelector("[role=listbox]")).toBeTruthy();
    expect(c.chartSnapshot?.scale).toMatchObject({ min: 0, max: 900 });
    expect(c.markInfo(0)?.kind).toBe("point");
  });

  it("hovers a marker without flicker and keeps it across redraws", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    const hovers = record(c, "chart-hover");
    const found = reachable(markers(c));
    expect(found.length).toBeGreaterThan(0);
    const p = found[0] as { index: number; x: number; y: number };
    pointerAt("pointermove", p.x, p.y);
    pointerAt("pointermove", p.x + 0.5, p.y);
    expect(hovers).toHaveLength(1);
    c.data = [...c.data];
    await settle(60);
    expect(hovers).toHaveLength(1);
  });

  it("drag rotates, never selects, and inertia stops with reduced motion", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    const before = { ...c.rotation };
    const box = svgOf(c).getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const { moves, up } = drag(c, [cx, cy], [cx + 60, cy]);
    expect(moves.slice(2).every((event) => event.defaultPrevented)).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    const after = { ...c.rotation };
    expect(after.lon).toBeLessThan(before.lon);
    await wait(250);
    expect(c.rotation.lon).toBeCloseTo(after.lon, 5);
    expect(c.selected).toBeNull();
  });

  it("a flick keeps turning when motion is on", async () => {
    const c = await chart();
    await awake(c);
    const box = svgOf(c).getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    drag(c, [cx, cy], [cx + 80, cy], 4);
    const after = c.rotation.lon;
    await wait(200);
    expect(c.rotation.lon).not.toBeCloseTo(after, 3);
  });

  it("keyboard: arrows reveal marks, shift rotates, zero resets", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    (c.querySelector("[role=listbox]") as HTMLElement).focus();
    await wait(80);
    const hovers = record(c, "chart-hover");
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }),
    );
    await wait(80);
    expect(hovers.length).toBeGreaterThan(0);
    expect(c.querySelector("[role=option]")?.textContent).toMatch(/\w/);
    const turned = { ...c.rotation };
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await wait(40);
    expect(c.rotation.lon).toBeCloseTo(turned.lon + 10, 3);
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "0", bubbles: true, cancelable: true }),
    );
    await wait(60);
    expect(c.rotation.lon).not.toBeCloseTo(turned.lon + 10, 0);
  });

  it("a tap pins a marker and a second tap releases it", async () => {
    const c = await chart('locale="en-US" animate="off"');
    await awake(c);
    const p = reachable(markers(c))[0] as { index: number; x: number; y: number };
    pointerAt("pointerdown", p.x, p.y, "touch");
    pointerAt("pointerup", p.x, p.y, "touch");
    await wait(20);
    expect(c.selected).not.toBeNull();
    pointerAt("pointerdown", p.x, p.y, "touch");
    pointerAt("pointerup", p.x, p.y, "touch");
    await wait(20);
    expect(c.selected).toBeNull();
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
