import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineHeatmap, type UiHeatmap } from "../src/heatmap/heatmap.ts";
import {
  awake,
  chartOf,
  hoverLog,
  mount,
  settle,
  sweep,
  tap,
  violations,
  wait,
} from "./e19-helpers.ts";

beforeAll(() => {
  defineHeatmap();
  defineChartLegend();
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

const rows = ["Mon", "Tue", "Wed", "Thu"];
const columns = ["9h", "10h", "11h", "12h", "13h"];
/** 4 x 5 with a hole at (1, 2) and an empty cell at (0, 4). */
const values = rows.map((_, r) =>
  columns.map((_, c) => (r === 1 && c === 2 ? undefined : r === 0 && c === 4 ? null : r * 10 + c)),
);

const map = async (attrs = "", inner = "", width = 480) => {
  const c = await chartOf<UiHeatmap>("ui-heatmap", `height="200" ${attrs}`, width, inner);
  c.rows = rows;
  c.columns = columns;
  c.values = values;
  await settle();
  return c;
};
const proxy = (c: Element) => c.querySelector("[data-ui-part=proxy]") as HTMLElement;
const option = (c: Element) => c.querySelector("[role=option]") as HTMLElement;
const ringOf = (c: Element) => {
  const r = c.querySelector("[data-ring][data-active]") as SVGRectElement;
  return { x: Number(r.getAttribute("x")), y: Number(r.getAttribute("y")) };
};
/** Pixel centre of cell (row, column), measured from the focus ring. */
const geometry = async (c: Element) => {
  await userEvent.tab();
  await wait(80);
  const a = ringOf(c);
  await userEvent.keyboard("{ArrowRight}");
  const b = ringOf(c);
  await userEvent.keyboard("{ArrowDown}");
  const d = ringOf(c);
  await userEvent.keyboard("{Escape}");
  const stepX = b.x - a.x;
  const stepY = d.y - b.y;
  return (row: number, column: number) => ({
    x: a.x + 1 + column * stepX + stepX / 2 - 1,
    y: a.y + 1 + row * stepY + stepY / 2 - 1,
  });
};

describe("ui-heatmap", () => {
  it("paints the cells on the canvas layer and names them with virtual marks", async () => {
    const c = await map();
    const canvas = c.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    const g = canvas.getContext("2d") as CanvasRenderingContext2D;
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    expect(data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    expect(c.querySelectorAll("rect[data-cell]")).toHaveLength(0);
    expect(c.textContent).toContain("Mon");
    expect(c.textContent).toContain("10h");
    await userEvent.tab();
    await wait(80);
    expect(option(c).getAttribute("aria-setsize")).toBe("19");
    expect(option(c).textContent).toContain("Mon · 9h: 0");
  });

  it("hovers cells without flicker, skips holes and tells empty cells apart", async () => {
    const c = await map("", "<ui-chart-tooltip></ui-chart-tooltip>");
    const at = await geometry(c);
    await awake(c);
    const events = hoverLog(c);
    for (const column of [0, 1, 2]) {
      const p = at(0, column);
      for (let s = -3; s <= 3; s += 1) sweep(c, p.x + s, p.y);
    }
    expect(events.filter((e) => e !== null)).toEqual([0, 1, 2]);
    expect(events).not.toContain(null);
    expect(c.hover?.title).toBe("Mon · 11h");
    const hole = at(1, 2);
    sweep(c, hole.x, hole.y);
    expect(events.at(-1)).toBeNull();
    const empty = at(0, 4);
    sweep(c, empty.x, empty.y);
    await wait(40);
    expect(c.hover?.rows[0]?.value).toBe("No data");
  });

  it("moves in 2D with the arrows, skipping holes, and Home and End reach the row ends", async () => {
    const c = await map();
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(proxy(c));
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(option(c).textContent).toContain("Mon · 11h");
    await userEvent.keyboard("{ArrowDown}");
    expect(option(c).textContent).toContain("Wed · 11h");
    await userEvent.keyboard("{ArrowUp}");
    expect(option(c).textContent).toContain("Mon · 11h");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(option(c).textContent).toContain("Mon · 9h");
    await userEvent.keyboard("{End}");
    expect(option(c).textContent).toContain("Mon · 13h");
    await userEvent.keyboard("{Home}{ArrowDown}{ArrowRight}{ArrowRight}");
    expect(option(c).textContent).toContain("Tue · 12h");
    expect(c.querySelectorAll("[data-ring][data-active]")).toHaveLength(1);
    let selected = -1;
    c.addEventListener("chart-select", (e) => {
      selected = (e as CustomEvent).detail?.index ?? -1;
    });
    await userEvent.keyboard("{Enter}");
    expect(selected).toBe(7);
  });

  it("a tap pins the cell under the finger", async () => {
    const c = await map("", "<ui-chart-tooltip></ui-chart-tooltip>");
    const at = await geometry(c);
    await userEvent.hover(document.getElementById("park") as Element);
    const p = at(2, 3);
    tap(c, p.x, p.y);
    await wait(80);
    expect(c.selected).toBe(12);
    expect(c.hover?.pinned).toBe(true);
  });

  it("publishes a continuous gradient scale, diverging colors and stepped ranges", async () => {
    const c = await map('scale="diverging" center="20" domain="-10,50"');
    const scale = c.chartSnapshot?.scale;
    expect([scale?.min, scale?.max, scale?.colors.length]).toEqual([-10, 50, 3]);
    c.ranges = [
      { to: 20, label: "Quiet" },
      { from: 20, label: "Busy", color: "red" },
    ];
    await settle();
    const legend = c.chartSnapshot?.legend;
    expect(legend?.map((item) => item.name)).toEqual(["Quiet", "Busy"]);
    c.toggleSeries("range-1");
    await settle();
    expect(c.isHidden("range-1")).toBe(true);
  });

  it("lays out a honeycomb, respects the locale and the empty state, and passes axe", async () => {
    const c = await map('shape="hex" cell-labels locale="de-DE" value-format="number"');
    await userEvent.tab();
    await wait(80);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    const ring = c.querySelector("path[data-ring][data-active]") as SVGPathElement;
    const points = [...(ring.getAttribute("d") ?? "").matchAll(/(-?[\d.]+),(-?[\d.]+)/g)];
    const centre = {
      x: points.reduce((sum, m) => sum + Number(m[1]), 0) / points.length,
      y: points.reduce((sum, m) => sum + Number(m[2]), 0) / points.length,
    };
    await userEvent.keyboard("{Escape}");
    const events = hoverLog(c);
    await awake(c);
    sweep(c, centre.x, centre.y);
    expect(events.at(-1)).toBe(10);
    expect(await violations(c)).toEqual([]);
    c.values = [];
    await settle();
    expect(c.textContent).toContain("No data");
  });
});
