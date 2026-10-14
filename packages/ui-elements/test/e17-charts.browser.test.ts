import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineAreaChart } from "../src/area-chart/area-chart.ts";
import { defineBarChart } from "../src/bar-chart/bar-chart.ts";
import { defineBubbleChart } from "../src/bubble-chart/bubble-chart.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineComboChart } from "../src/combo-chart/combo-chart.ts";
import { defineHistogram } from "../src/histogram/histogram.ts";
import { defineLineChart } from "../src/line-chart/line-chart.ts";
import { defineLollipopChart } from "../src/lollipop-chart/lollipop-chart.ts";
import { defineScatterChart } from "../src/scatter-chart/scatter-chart.ts";
import { frame, mount, wait } from "./setup.ts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cartesian = (el: any) => {
  el.categories = DAYS;
  el.series = [
    { id: "a", name: "Cuts", data: [12, 18, 9, 22, 30, 41] },
    { id: "b", name: "Beards", data: [5, 8, 4, 12, 15, 22] },
  ];
};
const points = (size: boolean) => (n: number, k: number) =>
  Array.from({ length: n }, (_, i) => ({
    x: i * 10 + k,
    y: ((i * 37 + k * 11) % 90) + 5,
    ...(size ? { size: 10 + ((i * 13) % 50) } : {}),
    label: `P${i}`,
  }));

interface Case {
  tag: string;
  define: () => string;
  attrs?: string;
  fill: (el: any) => void;
  /** Where the pointer sweeps: along x across the plot, or along y (horizontal lollipop). */
  sweep: "x" | "y";
  /** Marks are found by position (scatter family) rather than by sweeping. */
  scatter?: boolean;
}
const CASES: Case[] = [
  { tag: "ui-bar-chart", define: defineBarChart, fill: cartesian, sweep: "x" },
  { tag: "ui-line-chart", define: defineLineChart, fill: cartesian, sweep: "x" },
  { tag: "ui-area-chart", define: defineAreaChart, fill: cartesian, sweep: "x" },
  {
    tag: "ui-combo-chart",
    define: defineComboChart,
    fill: (el) => {
      el.categories = DAYS;
      el.series = [
        { id: "a", name: "Cuts", type: "bar", data: [12, 18, 9, 22, 30, 41] },
        { id: "b", name: "Rate", type: "line", axis: "right", data: [5, 8, 4, 12, 15, 22] },
      ];
    },
    sweep: "x",
  },
  {
    tag: "ui-scatter-chart",
    define: defineScatterChart,
    fill: (el) => {
      el.series = [{ id: "a", name: "Visits", points: points(false)(24, 0) }];
    },
    sweep: "x",
    scatter: true,
  },
  {
    tag: "ui-bubble-chart",
    define: defineBubbleChart,
    fill: (el) => {
      el.series = [{ id: "a", name: "Shops", points: points(true)(12, 0) }];
    },
    sweep: "x",
    scatter: true,
  },
  {
    tag: "ui-histogram",
    define: defineHistogram,
    attrs: 'bins="6"',
    fill: (el) => {
      el.series = [
        { id: "a", name: "Wait", values: Array.from({ length: 80 }, (_, i) => (i * 7) % 41) },
      ];
    },
    sweep: "x",
  },
  {
    tag: "ui-lollipop-chart",
    define: defineLollipopChart,
    attrs: 'orientation="vertical"',
    fill: (el) => {
      el.items = DAYS.map((label, i) => ({ label, value: [12, 18, 9, 22, 30, 41][i] }));
    },
    sweep: "x",
  },
];

beforeAll(() => {
  defineChartTooltip();
  for (const c of CASES) c.define();
});
beforeEach(async () => {
  const park = mount('<i style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>');
  await userEvent.hover(park.firstElementChild as Element);
});
afterEach(() => {
  document.body.innerHTML = "";
});

const settle = async () => {
  await frame();
  await frame();
  await wait(60);
};
const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
const pointer = (c: Element, type: string, x: number, y: number, pointerType = "mouse") => {
  const box = svgOf(c).getBoundingClientRect();
  drawingOf(c).dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerleave",
      clientX: box.left + x,
      clientY: box.top + y,
      pointerType,
      pointerId: 1,
      isPrimary: true,
    }),
  );
};
const tap = (c: Element, x: number, y: number) => {
  pointer(c, "pointerdown", x, y, "touch");
  pointer(c, "pointerup", x, y, "touch");
};

const make = async (spec: Case) => {
  const host = mount(
    `<div style="width:520px"><${spec.tag} label="${spec.tag}" height="260" locale="en-US" ${spec.attrs ?? ""}></${spec.tag}></div>`,
  );
  const el = host.querySelector(spec.tag) as any;
  spec.fill(el);
  await settle();
  return el as HTMLElement & {
    hover: { index: number; pinned: boolean } | null;
    selected: number | null;
  };
};

/** Pixel position of mark `i` (scatter family) or of the i-th slice of the plot. */
const spotOf = (c: HTMLElement, spec: Case, i: number): [number, number] => {
  const box = svgOf(c).getBoundingClientRect();
  if (spec.scatter) {
    const dots = [...c.querySelectorAll<SVGElement>("[data-point]")];
    const r = (dots[i] as SVGElement).getBoundingClientRect();
    return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
  }
  return [box.width * (0.16 + i * 0.12), box.height * 0.5];
};

for (const spec of CASES) {
  describe(spec.tag, () => {
    it("hovers without flicker: one enter, indices follow the pointer", async () => {
      const c = await make(spec);
      const seen: number[] = [];
      let leaves = 0;
      c.addEventListener("chart-hover", (e) => {
        const d = (e as CustomEvent).detail;
        if (d) seen.push(d.index);
        else leaves++;
      });
      pointer(c, "pointerenter", -1000, -1000);
      await wait(80);
      const spots = spec.scatter ? [0, 3, 6] : [0, 2, 4];
      for (const i of spots) {
        const [x, y] = spotOf(c, spec, i);
        for (let k = 0; k < 4; k++) pointer(c, "pointermove", x + k * 0.2, y);
      }
      expect(seen.length).toBeGreaterThanOrEqual(2);
      // no repeats back to back (one event per change) and no leave while moving between marks
      for (let k = 1; k < seen.length; k++) expect(seen[k]).not.toBe(seen[k - 1]);
      expect(leaves).toBe(0);
      if (!spec.scatter) expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    });

    it("keyboard: Tab enters, arrows move, End jumps, Escape clears", async () => {
      const c = await make(spec);
      await userEvent.tab();
      await userEvent.keyboard("{ArrowRight}");
      const first = c.hover?.index;
      expect(first).toBeDefined();
      await userEvent.keyboard("{ArrowRight}");
      expect(c.hover?.index).toBeGreaterThan(first as number);
      await userEvent.keyboard("{Home}");
      expect(c.hover?.index).toBe(0);
      await userEvent.keyboard("{End}");
      expect(c.hover?.index).toBeGreaterThan(first as number);
      await userEvent.keyboard("{Escape}");
      expect(c.hover).toBeNull();
    });

    it("touch: a tap pins the mark, the same mark again clears it", async () => {
      const c = await make(spec);
      pointer(c, "pointerenter", -1000, -1000, "touch");
      await wait(80);
      const [x, y] = spotOf(c, spec, spec.scatter ? 2 : 1);
      tap(c, x, y);
      expect(c.selected).not.toBeNull();
      expect(c.hover?.pinned).toBe(true);
      tap(c, x, y);
      expect(c.selected).toBeNull();
    });

    it("passes axe", async () => {
      const c = await make(spec);
      const result = await axe.run(c.parentElement as Element, {
        rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
      });
      expect(
        result.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        ),
      ).toEqual([]);
    });
  });
}

describe("e17 specifics", () => {
  it("scatter brush: a drag emits a rectangle and does not pin a point", async () => {
    const spec = CASES.find((c) => c.tag === "ui-scatter-chart") as Case;
    const c = await make({ ...spec, attrs: "brush" });
    const rects: unknown[] = [];
    c.addEventListener("brush", (e) => rects.push((e as CustomEvent).detail));
    pointer(c, "pointerenter", -1000, -1000);
    await wait(150);
    pointer(c, "pointerdown", 80, 60);
    for (let i = 1; i <= 6; i++) pointer(c, "pointermove", 80 + i * 30, 60 + i * 20);
    pointer(c, "pointerup", 260, 180);
    await wait(60);
    expect(c.selected).toBeNull();
    expect(rects.length).toBeGreaterThan(0);
  });

  it("line brush strip zooms and the reset button restores the range", async () => {
    const host = mount(
      '<div style="width:520px"><ui-line-chart label="l" height="260" locale="en-US" brush></ui-line-chart></div>',
    );
    const el = host.querySelector("ui-line-chart") as any;
    el.categories = Array.from({ length: 60 }, (_, i) => `d${i}`);
    el.series = [{ id: "a", name: "A", data: Array.from({ length: 60 }, (_, i) => 10 + (i % 9)) }];
    await settle();
    el.zoom = [10, 30];
    await settle();
    expect(el.querySelector('button[data-e17="reset"]')?.hasAttribute("hidden")).toBe(false);
    el.resetZoom();
    await settle();
    expect(el.querySelector('button[data-e17="reset"]')?.hasAttribute("hidden")).toBe(true);
  });

  it("histogram: explode toggle swaps bars for dots", async () => {
    const spec = CASES.find((c) => c.tag === "ui-histogram") as Case;
    const c = await make({ ...spec, attrs: 'bins="6" explode-toggle' });
    expect(c.querySelectorAll("svg path[style*=fill]").length).toBeGreaterThan(0);
    (c.querySelector('button[data-e17="reset"]') as HTMLButtonElement).click();
    await settle();
    expect(c.hasAttribute("exploded")).toBe(true);
    expect(c.querySelectorAll("svg circle").length).toBeGreaterThan(10);
  });
});
