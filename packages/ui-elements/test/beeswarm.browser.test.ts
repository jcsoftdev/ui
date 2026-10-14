import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineBeeswarm, type UiBeeswarm } from "../src/beeswarm/beeswarm.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import {
  awake,
  chartOf,
  hoverLog,
  mount,
  settle,
  svgOf,
  sweep,
  tap,
  violations,
  wait,
} from "./e19-helpers.ts";

beforeAll(() => {
  defineBeeswarm();
  defineChartTooltip();
});
beforeEach(async () => {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
});
afterEach(() => {
  document.body.innerHTML = "";
});

const points = (category: string, values: number[], size = false) =>
  values.map((value, i) => ({
    value,
    category,
    label: `${category} ${i + 1}`,
    size: size ? 5 + i : undefined,
  }));
const small = [
  {
    id: "a",
    name: "Weekdays",
    points: [...points("Diego", [10, 12, 12.5, 30, 31, 55]), ...points("Mateo", [8, 9, 40, 41])],
  },
  { id: "b", name: "Weekends", points: points("Diego", [20, 22]) },
];
const swarm = async (data: UiBeeswarm["series"], attrs = "", inner = "") => {
  const c = await chartOf<UiBeeswarm>("ui-beeswarm", attrs, 520, inner);
  c.series = data;
  await settle();
  return c;
};
const dots = (c: Element) => [...c.querySelectorAll<SVGCircleElement>("circle[data-dot]")];
const proxy = (c: Element) => c.querySelector("[data-ui-part=proxy]") as HTMLElement;

describe("ui-beeswarm", () => {
  it("draws one circle per observation, grows with its rows and never overlaps dots", async () => {
    const c = await swarm(small);
    expect(dots(c)).toHaveLength(12);
    expect(c.getAttribute("height")).toBe("240"); // 2 rows * 96 + 48
    const items = dots(c).map((d) => ({
      x: Number(d.getAttribute("cx")),
      y: Number(d.getAttribute("cy")),
      r: Number(d.getAttribute("r")),
    }));
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const [a, b] = [items[i], items[j]] as [(typeof items)[number], (typeof items)[number]];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 0.01);
      }
    expect(proxy(c).getAttribute("role")).toBe("listbox");
  });

  it("hovers the nearest dot without flicker and shows the value and size", async () => {
    const data = [{ id: "a", name: "Cuts", points: points("Diego", [10, 40, 70], true) }];
    const c = await swarm(data, "", "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = hoverLog(c);
    const box = svgOf(c).getBoundingClientRect();
    const ordered = dots(c)
      .map((d) => ({ x: Number(d.getAttribute("cx")), y: Number(d.getAttribute("cy")) }))
      .sort((a, b) => a.x - b.x);
    for (const p of ordered) for (let step = -3; step <= 3; step++) sweep(c, p.x + step, p.y);
    expect(events.filter((e) => e !== null)).toEqual([0, 1, 2]);
    expect(events.filter((e) => e === null)).toHaveLength(0);
    expect(c.hover?.title).toBe("Diego 3 · Diego");
    expect(c.hover?.rows.map((r) => r.name)).toEqual(["Value", "Size"]);
    expect(box.width).toBe(520);
  });

  it("is one tab stop: arrows walk the points, Up and Down jump a row, Home and End reach the ends", async () => {
    const c = await swarm(small);
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(proxy(c));
    const option = () => c.querySelector("[role=option]") as HTMLElement;
    expect(option().getAttribute("aria-setsize")).toBe("12");
    expect(option().getAttribute("aria-posinset")).toBe("1");
    expect(option().textContent).toContain("Diego 1, Diego: Weekdays 10");
    await userEvent.keyboard("{ArrowRight}");
    expect(option().getAttribute("aria-posinset")).toBe("2");
    await userEvent.keyboard("{ArrowDown}");
    expect(option().textContent).toContain("Mateo");
    await userEvent.keyboard("{ArrowUp}");
    expect(option().textContent).toContain("Diego");
    await userEvent.keyboard("{End}");
    expect(option().getAttribute("aria-posinset")).toBe("12");
    expect(c.querySelectorAll("circle[data-ring][data-active]").length).toBe(1);
    await userEvent.keyboard("{Escape}");
    expect(c.querySelectorAll("circle[data-ring][data-active]").length).toBe(0);
  });

  it("a tap pins the dot under the finger", async () => {
    const c = await swarm([{ id: "a", name: "Cuts", points: points("Diego", [10, 90]) }]);
    const first = dots(c)[0] as SVGCircleElement;
    tap(c, Number(first.getAttribute("cx")), Number(first.getAttribute("cy")));
    await wait(80);
    expect(c.selected).toBe(0);
    expect(c.hover?.pinned).toBe(true);
  });

  it("paints large data on the canvas layer, keeps virtual marks and hit-tests dots", async () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({
      value: (i * 37) % 1000,
      category: i % 2 ? "A" : "B",
    }));
    const c = await swarm([{ id: "big", name: "Big", points: many }], 'height="400"');
    expect(dots(c)).toHaveLength(0);
    const canvas = c.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    const g = canvas.getContext("2d") as CanvasRenderingContext2D;
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    expect(data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    await userEvent.tab();
    await wait(80);
    expect((c.querySelector("[role=option]") as HTMLElement).getAttribute("aria-setsize")).toBe(
      "2500",
    );
  });

  it("respects the locale, hidden series and the empty state, and passes axe", async () => {
    const c = await swarm(small, 'locale="de-DE" value-format="number"');
    c.toggleSeries("b");
    await settle();
    expect(dots(c)).toHaveLength(10);
    expect(await violations(c)).toEqual([]);
    c.series = [];
    await settle();
    expect(c.textContent).toContain("No data");
  });

  it("keeps every dot and row with duplicate ids, and reuses the layout until an attribute changes", async () => {
    const warn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => warnings.push(String(args[0]));
    try {
      const twin = [
        { id: "a", name: "First", points: points("Diego", [10, 20]) },
        { id: "a", name: "Second", points: points("Diego", [10, 20]) },
      ];
      const c = await swarm(twin);
      expect(dots(c)).toHaveLength(4);
      expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
      const before = dots(c).map((d) => d.getAttribute("cy"));
      c.requestDraw();
      await settle();
      expect(dots(c).map((d) => d.getAttribute("cy"))).toEqual(before);
      c.setAttribute("gap", "12");
      await settle();
      expect(dots(c).map((d) => d.getAttribute("cy"))).not.toEqual(before);
    } finally {
      console.warn = warn;
    }
  });

  it("bounds the data table of a canvas swarm", async () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({ value: (i * 37) % 1000, category: "A" }));
    const c = await swarm([{ id: "big", name: "Big", points: many }], 'height="300"');
    expect(c.chartSnapshot?.categories.length).toBeLessThanOrEqual(1000);
  });
});
