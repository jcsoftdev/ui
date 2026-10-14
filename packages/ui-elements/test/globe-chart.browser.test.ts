import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineGlobeChart } from "../src/globe-chart/globe-chart.ts";
import { awake, parkMouse, pointerAt, reachable, record, settle, svgOf } from "./e24-fixture.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineGlobeChart();
  defineChartLegend();
});
beforeEach(async () => {
  await commands.reducedMotion("no-preference");
  await parkMouse();
});
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
  markInfo(index: number): { kind: string; point?: { name: string } } | undefined;
  toggleSeries(id: string): void;
  chartSnapshot: {
    scale?: { min: number; max: number };
    legend?: Array<{ id: string }>;
    categories: string[];
    series: Array<{ id: string; text: string[] }>;
  } | null;
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

  describe("motion", () => {
    const lon = (c: Chart) => c.rotation.lon;
    const spinning = async (attrs: string) => {
      const c = await chart(`locale="en-US" auto-rotate auto-rotate-speed="90" ${attrs}`);
      const start = lon(c);
      await wait(300);
      return { moved: Math.abs(lon(c) - start) > 1 };
    };

    it("spins when motion is allowed (the control case)", async () => {
      expect((await spinning("")).moved).toBe(true);
    });
    it("does not spin under reduced motion, read before any draw", async () => {
      await commands.reducedMotion("reduce");
      expect((await spinning("")).moved).toBe(false);
    });
    it("does not spin with animate=off", async () => {
      expect((await spinning('animate="off"')).moved).toBe(false);
    });
    it("does not spin when the map failed to load, and fires map-error", async () => {
      const host = mount(
        '<div style="width:300px"><ui-globe-chart map="atlantis" auto-rotate auto-rotate-speed="90" rotation="-70,-10"></ui-globe-chart></div>',
      );
      const c = host.querySelector("ui-globe-chart") as Chart;
      const errors = record(c, "map-error");
      await settle(300);
      expect(errors).toEqual([{ map: "atlantis", reason: "unknown" }]);
      expect(c.querySelector("canvas")).toBeNull();
      expect(c.rotation.lon).toBe(-70);
      c.setAttribute("map", "world");
      await settle(400);
      expect(c.querySelector("canvas")).toBeTruthy();
      expect(Math.abs(c.rotation.lon - -70)).toBeGreaterThan(1);
    });
    it("pauses while it is off screen", async () => {
      const host = mount(
        '<div style="position:fixed;top:-4000px;width:300px"><ui-globe-chart map="world" auto-rotate auto-rotate-speed="90" rotation="-70,-10" locale="en-US"></ui-globe-chart></div>',
      );
      const c = host.querySelector("ui-globe-chart") as Chart;
      await settle(300);
      const start = c.rotation.lon;
      await wait(300);
      expect(c.rotation.lon).toBe(start);
    });
  });

  it("lists the markers and the regions in one table, with the color bar and the categories both shown", async () => {
    const c = await chart();
    (c as unknown as { points: unknown }).points = [
      { ...POINTS[0], category: "North" },
      { ...POINTS[1], category: "South" },
      { ...POINTS[2], category: "South" },
    ];
    await settle(150);
    const snapshot = c.chartSnapshot;
    expect(snapshot?.categories.slice(0, 3)).toEqual(["Lima", "Buenos Aires", "Madrid"]);
    expect(snapshot?.categories.length).toBeGreaterThan(100);
    expect(snapshot?.series.map((s) => s.id)).toEqual(["value", "lon", "lat"]);
    expect(snapshot?.scale).toMatchObject({ max: 900 });
    const key = c.querySelector("[data-ui-part=geo-key]");
    expect(key?.textContent).toContain("North");
    expect(key?.textContent).toContain("South");
    expect(key?.textContent).toContain("No data");
    // Without region values the categories are the chart's own legend.
    c.data = [];
    await settle(150);
    expect(c.chartSnapshot?.legend?.map((item) => item.id)).toEqual(["North", "South"]);
    expect(c.chartSnapshot?.scale).toBeUndefined();
  });

  it("hover reports the table row of a mark, also with a category hidden", async () => {
    const c = await chart('locale="en-US" animate="off"');
    (c as unknown as { points: unknown }).points = [
      { ...POINTS[0], category: "North" },
      { ...POINTS[1], category: "South" },
    ];
    await settle(150);
    c.toggleSeries("North");
    await settle(120);
    await awake(c);
    const hovers = record(c, "chart-hover");
    for (const p of reachable(markers(c))) {
      pointerAt("pointermove", p.x, p.y);
      pointerAt("pointermove", p.x + 0.5, p.y);
    }
    expect(hovers.length).toBeGreaterThan(0);
    for (const hover of hovers) {
      expect(c.chartSnapshot?.categories[hover?.category as number]).toBe(
        c.markInfo(hover?.index as number)?.point?.name,
      );
    }
  });

  it("moves between visible marks by direction and out of sight marks recover", async () => {
    const c = await chart('locale="en-US" animate="off"');
    (c as unknown as { points: unknown }).points = [
      { id: "a", name: "A", lon: -77, lat: -12, value: 5 },
      { id: "b", name: "B", lon: -62, lat: -12, value: 5 },
    ];
    c.rotation = { lon: -70, lat: -12 };
    await settle(150);
    await awake(c);
    (c.querySelector("[role=listbox]") as HTMLElement).focus();
    await wait(60);
    const hovers = record(c, "chart-hover");
    const key = (name: string) =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
      );
    key("ArrowRight");
    await wait(40);
    const right = hovers.at(-1) as { index: number; x: number };
    expect(right.index).not.toBe(0);
    key("ArrowLeft");
    await wait(40);
    expect(hovers.at(-1)?.index).not.toBe(right.index);
  });

  describe("touch", () => {
    const touch = (type: string, svg: Element, id: number, x: number, y: number) =>
      svg.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          pointerType: "touch",
          pointerId: id,
          isPrimary: id === 1,
        }),
      );
    it("one finger leaves the page scrolling until a tap engages the globe; two fingers always rotate", async () => {
      const c = await chart('locale="en-US" animate="off"');
      await awake(c);
      const svg = svgOf(c);
      const drawing = c.querySelector("[data-ui-part=drawing]") as HTMLElement;
      const box = svg.getBoundingClientRect();
      const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
      expect(drawing.style.touchAction).toBe("pan-y");
      const start = c.rotation.lon;
      touch("pointerdown", svg, 1, x, y);
      for (let i = 1; i <= 5; i += 1) touch("pointermove", svg, 1, x + i * 12, y);
      touch("pointerup", svg, 1, x + 60, y);
      await settle();
      expect(c.rotation.lon).toBe(start);
      expect(drawing.style.touchAction).toBe("none");
      touch("pointerdown", svg, 1, x, y);
      for (let i = 1; i <= 5; i += 1) touch("pointermove", svg, 1, x + i * 12, y);
      touch("pointerup", svg, 1, x + 60, y);
      await settle();
      expect(c.rotation.lon).not.toBe(start);
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await settle();
      expect(drawing.style.touchAction).toBe("pan-y");
      const before = c.rotation.lon;
      touch("pointerdown", svg, 1, x - 20, y);
      touch("pointerdown", svg, 2, x + 20, y);
      for (let i = 1; i <= 4; i += 1) {
        touch("pointermove", svg, 1, x - 20 + i * 10, y);
        touch("pointermove", svg, 2, x + 20 + i * 10, y);
      }
      await settle();
      expect(c.rotation.lon).not.toBe(before);
    });
  });
});
