import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineFillGaugeChart } from "../src/fill-gauge-chart/fill-gauge-chart.ts";
import { defineGaugeChart } from "../src/gauge-chart/gauge-chart.ts";
import { defineParliamentChart } from "../src/parliament-chart/parliament-chart.ts";
import { definePolarAreaChart } from "../src/polar-area-chart/polar-area-chart.ts";
import { defineRadarChart } from "../src/radar-chart/radar-chart.ts";
import { defineRadialBarChart } from "../src/radial-bar-chart/radial-bar-chart.ts";
import {
  awake,
  chart,
  marks,
  parkMouse,
  pointer,
  record,
  settle,
  svgOf,
  tap,
  violations,
} from "./e20-charts.ts";
import { frame, wait } from "./setup.ts";

beforeAll(() => {
  defineGaugeChart();
  defineFillGaugeChart();
  defineRadarChart();
  defineRadialBarChart();
  definePolarAreaChart();
  defineParliamentChart();
  defineChartLegend();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const ITEMS = [
  { id: "cut", name: "Haircut", value: 120 },
  { id: "beard", name: "Beard", value: 80 },
  { id: "color", name: "Color", value: 60 },
  { id: "kids", name: "Kids", value: 40 },
];
const RANGES = [
  { from: 0, to: 40, label: "Low", color: "#d33" },
  { from: 40, to: 70, label: "Mid", color: "#db3" },
  { from: 70, to: 100, label: "High", color: "#3a3" },
];
const RADAR = {
  axes: ["Fade", "Beard", "Color", "Style", "Speed"],
  series: [
    { id: "a", name: "Ana", data: [80, 60, 40, 90, 70] },
    { id: "b", name: "Luis", data: [50, 70, 60, 40, 80] },
  ],
};

interface Spec {
  tag: string;
  attrs: string;
  props: Record<string, unknown>;
  count: number;
  width?: number;
  /** Entry animation to wait out (a gauge counts up and redraws each frame). */
  wait?: number;
  /** The React gauge steps through its bands without wrapping. */
  noWrap?: boolean;
}
const SPECS: Record<string, Spec> = {
  gauge: {
    tag: "ui-gauge-chart",
    attrs: 'value="55" min="0" max="100" caption="Load"',
    props: { ranges: RANGES },
    count: 3,
    wait: 1200,
    noWrap: true,
  },
  radar: { tag: "ui-radar-chart", attrs: 'height="340"', props: RADAR, count: 5 },
  "radial-bar": {
    tag: "ui-radial-bar-chart",
    attrs: "",
    props: { data: ITEMS.map((i) => ({ ...i, value: i.value / 1.5 })) },
    count: 4,
    width: 500,
  },
  "polar-area": {
    tag: "ui-polar-area-chart",
    attrs: "",
    props: { data: ITEMS },
    count: 4,
    width: 560,
  },
  parliament: {
    tag: "ui-parliament-chart",
    attrs: "majority center-label=Seats",
    props: { data: ITEMS },
    count: 4,
  },
};

const make = async (spec: Spec, extra = "", inner = "<ui-chart-tooltip></ui-chart-tooltip>") => {
  const c = await chart(spec.tag, `${spec.attrs} ${extra}`, inner, spec.width);
  Object.assign(c, spec.props);
  await settle();
  if (spec.wait) await wait(spec.wait);
  return c;
};

/** A point inside (or on the stroke of) a mark, in drawing units. */
const inside = (el: SVGElement): { x: number; y: number } => {
  const root = el.ownerSVGElement as SVGSVGElement;
  const origin = root.getBoundingClientRect();
  const hits: Array<{ x: number; y: number }> = [];
  const parts =
    el instanceof SVGGElement
      ? [...el.querySelectorAll<SVGGeometryElement>("circle,rect,path")]
      : [el as unknown as SVGGeometryElement];
  for (const part of parts) {
    if (el instanceof SVGGElement) {
      const r = part.getBoundingClientRect();
      return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
    }
    const filled = getComputedStyle(part).fill !== "none";
    const box = part.getBBox();
    for (let i = 0; i <= 16; i++)
      for (let j = 0; j <= 16; j++) {
        const point = new DOMPoint(box.x + (box.width * i) / 16, box.y + (box.height * j) / 16);
        if ((filled && part.isPointInFill(point)) || part.isPointInStroke(point)) hits.push(point);
      }
  }
  const mean = hits.reduce((a, h) => ({ x: a.x + h.x / hits.length, y: a.y + h.y / hits.length }), {
    x: 0,
    y: 0,
  });
  return hits.reduce((best, h) =>
    Math.hypot(h.x - mean.x, h.y - mean.y) < Math.hypot(best.x - mean.x, best.y - mean.y)
      ? h
      : best,
  );
};

describe.each(Object.entries(SPECS))("ui-%s-chart", (_name, spec) => {
  it("hovers each mark once, in order, with one tooltip opening", async () => {
    const c = await make(spec);
    await awake(c);
    expect(marks(c)).toHaveLength(spec.count);
    const events = record(c, "chart-hover");
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    let opens = 0;
    new MutationObserver((records) => {
      for (const r of records) if (r.attributeName === "data-open") opens++;
    }).observe(tip, { attributes: true });
    for (const mark of marks(c)) {
      const p = inside(mark as SVGElement);
      for (let i = 0; i < 3; i++) {
        pointer(c, "pointermove", p.x, p.y);
        await frame();
      }
    }
    const indices = (events as Array<{ index: number } | null>).map((e) => e?.index);
    expect(indices).toEqual(Array.from({ length: spec.count }, (_, i) => i));
    expect(opens).toBe(1);
    expect(c.hover?.side).toMatch(/left|right/);
  });

  it("walks the marks with the arrow keys, wrapping, from one tab stop", async () => {
    const c = await make(spec);
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(marks(c)[0]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(marks(c)[spec.noWrap ? 0 : spec.count - 1]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(marks(c)[spec.noWrap ? 1 : 0]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(marks(c)[spec.count - 1]);
    await userEvent.keyboard("{Escape}");
    expect(c.hover).toBeNull();
  });

  it("a tap pins the mark under the finger", async () => {
    const c = await make(spec);
    await awake(c);
    const p = inside(marks(c)[1] as SVGElement);
    tap(c, p.x, p.y);
    expect(c.selected).toBe(1);
    expect(c.hover).toMatchObject({ pinned: true, source: "touch" });
    tap(c, p.x, p.y);
    expect(c.selected).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const c = await make(
      spec,
      "",
      "<ui-chart-legend></ui-chart-legend><ui-chart-tooltip></ui-chart-tooltip>",
    );
    expect(await violations(c)).toEqual([]);
  });
});

describe("legend toggling by id", () => {
  it.each(["radial-bar", "polar-area", "parliament"])(
    "%s hides a group from the legend",
    async (name) => {
      const c = await make(SPECS[name] as Spec, "", "<ui-chart-legend></ui-chart-legend>");
      await wait(60);
      const buttons = [...c.querySelectorAll<HTMLButtonElement>("ui-chart-legend button")];
      expect(buttons.map((b) => b.textContent)).toEqual(["Haircut", "Beard", "Color", "Kids"]);
      buttons[1]?.click();
      await wait(80);
      expect(c.isHidden("beard")).toBe(true);
      expect(marks(c)).toHaveLength(3);
    },
  );
});

describe("parliament seats", () => {
  it("keeps the group while the pointer crosses the space between two seats", async () => {
    const c = await make(SPECS.parliament as Spec);
    await awake(c);
    const events = record(c, "chart-hover") as Array<{ index: number } | null>;
    const [first] = marks(c);
    const seats = [...(first as SVGElement).querySelectorAll("circle")];
    const a = seats[0] as SVGCircleElement;
    const b = seats[1] as SVGCircleElement;
    for (let t = 0; t <= 1.001; t += 0.1) {
      pointer(
        c,
        "pointermove",
        a.cx.baseVal.value + (b.cx.baseVal.value - a.cx.baseVal.value) * t,
        a.cy.baseVal.value + (b.cy.baseVal.value - a.cy.baseVal.value) * t,
      );
      await frame();
    }
    expect(events.map((e) => e?.index)).toEqual([0]);
  });
});

describe("fill gauge", () => {
  it("draws one named gauge per item and passes axe", async () => {
    const c = await chart("ui-fill-gauge-chart", "", "", 480);
    (c as unknown as { data: unknown }).data = ITEMS.map((i) => ({ ...i, value: i.value / 2 }));
    await settle();
    const text = [...svgOf(c).querySelectorAll("text")].map((t) => t.textContent).join(" ");
    for (const item of ITEMS) expect(text).toContain(item.name);
    expect(await violations(c)).toEqual([]);
    expect(c.chartSnapshot?.categories).toEqual(ITEMS.map((i) => i.name));
  });
});
