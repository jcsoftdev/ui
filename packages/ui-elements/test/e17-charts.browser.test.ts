import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineAreaChart } from "../src/area-chart/area-chart.ts";
import { defineBarChart } from "../src/bar-chart/bar-chart.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineComboChart } from "../src/combo-chart/combo-chart.ts";
import { defineLineChart } from "../src/line-chart/line-chart.ts";
import { frame, mount, wait } from "./setup.ts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cartesian = (el: any) => {
  el.categories = DAYS;
  el.series = [
    { id: "a", name: "Cuts", data: [12, 18, 9, 22, 30, 41] },
    { id: "b", name: "Beards", data: [5, 8, 4, 12, 15, 22] },
  ];
};
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
        { id: "a", name: "Cuts", type: "column", data: [12, 18, 9, 22, 30, 41] },
        { id: "b", name: "Rate", type: "line", axis: "right", data: [5, 8, 4, 12, 15, 22] },
      ];
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

/**
 * The interaction code loads lazily: probe with a move until the chart answers (`hover` set), then
 * leave, so the test starts from a clean state without a fixed wait.
 */
const awake = async (c: HTMLElement & { hover: unknown }, spec: Case, type = "mouse") => {
  await vi.waitFor(
    () => {
      const [x, y] = spotOf(c, spec, spec.scatter ? 0 : 1);
      pointer(c, "pointerenter", x, y, type);
      pointer(c, "pointermove", x, y, type);
      expect(c.hover).not.toBeNull();
    },
    { timeout: 4000, interval: 40 },
  );
  pointer(c, "pointerleave", -1000, -1000, type);
  await vi.waitFor(() => expect(c.hover).toBeNull());
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
      await awake(c, spec);
      seen.length = 0;
      leaves = 0;
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
      await awake(c, spec);
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

  const big = (n: number) => ({
    categories: Array.from({ length: n }, (_, i) => i),
    values: (k: number) => Array.from({ length: n }, (_, i) => ((i * 31 + k * 7) % 97) - 20),
  });
  const mountBig = async (tag: string, attrs: string, n: number, mode: "line" | "stack") => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener("error", onError);
    const host = mount(
      `<div style="width:600px"><${tag} label="big" height="240" locale="en-US" ${attrs}></${tag}></div>`,
    );
    const el = host.querySelector(tag) as any;
    const d = big(n);
    el.categories = d.categories;
    el.series = [
      { id: "a", name: "A", data: d.values(0) },
      { id: "b", name: "B", data: d.values(1) },
    ];
    await settle();
    await vi.waitFor(() => expect(el.querySelectorAll("svg path").length).toBeGreaterThan(0), {
      timeout: 15000,
    });
    window.removeEventListener("error", onError);
    expect(errors).toEqual([]);
    return { el, mode };
  };

  it("regression: a brushed line chart with 150k points renders (no spread over the data)", async () => {
    const { el } = await mountBig("ui-line-chart", "brush", 150_000, "line");
    await vi.waitFor(() => expect(el.querySelector('[data-e17="slider"]')).not.toBeNull(), {
      timeout: 8000,
    });
    expect(el.querySelectorAll("svg *").length).toBeLessThan(400);
  });

  it("regression: a stacked bar chart with 150k categories renders with few nodes", async () => {
    const { el } = await mountBig("ui-bar-chart", 'stack="normal"', 150_000, "stack");
    expect(el.querySelectorAll("svg *").length).toBeLessThan(400);
  });

  it("regression: a stacked area chart with 150k categories renders", async () => {
    await mountBig("ui-area-chart", 'stack="normal"', 150_000, "stack");
  });

  it("combo: a column series draws bars; an unknown type warns and is drawn as a column", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = mount(
      '<div style="width:520px"><ui-combo-chart label="c" height="240" locale="en-US"></ui-combo-chart></div>',
    );
    const el = host.querySelector("ui-combo-chart") as any;
    el.categories = DAYS;
    el.series = [
      { id: "a", name: "A", type: "column", data: [1, 2, 3, 4, 5, 6] },
      { id: "b", name: "B", type: "line", data: [2, 3, 4, 3, 2, 1] },
      { id: "c", name: "C", type: "bar", data: [3, 1, 3, 1, 3, 1] },
    ];
    await settle();
    // two column series (a and the fallback c) share each category slot
    expect(el.querySelectorAll("svg path[data-bar]").length).toBe(12);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown type "bar"'));
    warn.mockRestore();
  });

  it("annotations: a goal line widens the axis, a range sits under the bars, labels show", async () => {
    const host = mount(
      '<div style="width:520px"><ui-bar-chart label="n" height="260" locale="en-US"></ui-bar-chart></div>',
    );
    const el = host.querySelector("ui-bar-chart") as any;
    el.categories = DAYS;
    el.series = [{ id: "a", name: "A", data: [10, 20, 30, 40, 50, 60] }];
    el.annotations = [
      { type: "line", axis: "y", value: 100, label: "Goal", tone: "success" },
      { type: "range", axis: "x", from: "Tue", to: "Wed", label: "Promo" },
      { type: "point", x: "Fri", y: 50, label: "Peak", tooltip: "Best day" },
    ];
    await vi.waitFor(() => expect(el.querySelector('[data-annotation="line"]')).not.toBeNull(), {
      timeout: 4000,
    });
    expect(el.querySelector('[data-annotation="range"]')).not.toBeNull();
    expect(el.querySelector('[data-annotation="point"] title')?.textContent).toBe("Best day");
    const text = el.textContent as string;
    expect(text).toContain("Goal");
    expect(text).toContain("Promo");
    // the 100 line is inside the plot: the value axis reaches it
    expect(el.querySelector('[data-annotation="line"] line')).not.toBeNull();
    const ticks = [...el.querySelectorAll('[data-e17="tick"]')].map((t) => t.textContent);
    expect(ticks.join(" ")).toMatch(/100/);
  });

  it("an unsafe series color never reaches the style", async () => {
    const host = mount(
      '<div style="width:520px"><ui-bar-chart label="c" height="220" locale="en-US"></ui-bar-chart></div>',
    );
    const el = host.querySelector("ui-bar-chart") as any;
    el.categories = DAYS;
    el.series = [{ id: "a", name: "A", color: "red;background:url(x)", data: [1, 2, 3, 4, 5, 6] }];
    await settle();
    expect(el.innerHTML).not.toContain("url(x)");
  });

  it("zoom: a drag on the strip announces one zoom event, the reset button another", async () => {
    const host = mount(
      '<div style="width:520px"><ui-line-chart label="l" height="260" locale="en-US" brush></ui-line-chart></div>',
    );
    const el = host.querySelector("ui-line-chart") as any;
    el.categories = Array.from({ length: 60 }, (_, i) => `d${i}`);
    el.series = [{ id: "a", name: "A", data: Array.from({ length: 60 }, (_, i) => 10 + (i % 9)) }];
    const zooms: unknown[] = [];
    el.addEventListener("zoom", (e: Event) => zooms.push((e as CustomEvent).detail));
    await vi.waitFor(() => expect(el.querySelector('[data-e17="slider"]')).not.toBeNull(), {
      timeout: 4000,
    });
    const slider = el.querySelector('[data-e17="slider"]') as HTMLElement;
    const box = slider.getBoundingClientRect();
    const fire = (type: string, x: number) =>
      slider.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: box.left + x,
          clientY: box.top + 20,
          pointerId: 7,
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    el.zoom = [10, 30];
    await vi.waitFor(() =>
      expect(el.querySelector('button[data-e17="reset"]')?.hidden).toBe(false),
    );
    zooms.length = 0;
    const from = (20 / 59) * box.width;
    await vi.waitFor(
      () => {
        // retried until the lazy brush code has attached: drag the window to the right
        fire("pointerdown", from);
        for (let i = 1; i <= 8; i++) fire("pointermove", from + i * 0.03 * box.width);
        fire("pointerup", from + 0.24 * box.width);
        expect(el.zoom[0]).toBeGreaterThan(10);
      },
      { timeout: 4000, interval: 60 },
    );
    expect(zooms.length).toBe(1);
  });
});
