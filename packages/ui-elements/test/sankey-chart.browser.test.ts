import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineSankeyChart } from "../src/sankey-chart/sankey-chart.ts";
import {
  animateCalls,
  awake,
  axeViolations,
  focusChart,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  settle,
  svgOf,
  sweep,
  tap,
} from "./flow-helpers.ts";
import { ax, wait } from "./setup.ts";

beforeAll(() => {
  defineSankeyChart();
  defineChartTooltip();
});
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const NODES = [
  { id: "a", name: "Visits" },
  { id: "b", name: "Ads" },
  { id: "c", name: "Signup" },
  { id: "d", name: "Browse" },
  { id: "e", name: "Paid" },
];
const LINKS = [
  { source: "a", target: "c", value: 50 },
  { source: "a", target: "d", value: 20 },
  { source: "b", target: "d", value: 30 },
  { source: "c", target: "e", value: 50 },
  { source: "d", target: "e", value: 50 },
];
// Mark order: the nodes column by column (top to bottom), then the links in input order.
const sankey = (attrs = "", props: Record<string, unknown> = {}) =>
  mountChart("ui-sankey-chart", `label="Funnel flows" height="320" ${attrs}`, {
    nodes: NODES,
    links: LINKS,
    ...props,
  });

const nodeRects = (c: Element) =>
  [...c.querySelectorAll<SVGRectElement>("rect[data-node]")].map((r) => ({
    mark: Number(r.getAttribute("data-mark")),
    x: Number(r.getAttribute("x")),
    y: Number(r.getAttribute("y")),
    w: Number(r.getAttribute("width")),
    h: Number(r.getAttribute("height")),
  }));

describe("ui-sankey-chart", () => {
  it("lays out like the React chart and exposes nodes then links as named images", async () => {
    const c = await sankey();
    // Golden: the drawn nodes sit where the React layout puts them (imported by path at run time).
    const react = await import(/* @vite-ignore */ "../../ui/src/charts/core/sankey.ts");
    const graph = react.sankeyLayout(NODES, LINKS, {
      width: 520,
      height: 320,
      nodeWidth: 12,
      nodePadding: 14,
      iterations: 6,
      align: "justify",
      relax: true,
    });
    const drawn = nodeRects(c).sort((p, q) => p.mark - q.mark);
    const expected = [...graph.nodes].sort((p, q) => p.column - q.column || p.y0 - q.y0);
    expect(drawn).toHaveLength(expected.length);
    drawn.forEach((r, i) => {
      expect(r.x).toBeCloseTo((expected[i] as { x0: number }).x0, 3);
      expect(r.y).toBeCloseTo((expected[i] as { y0: number }).y0, 3);
    });
    expect(marksOf(c)).toHaveLength(NODES.length + LINKS.length);
    expect(await ax("group", "Funnel flows")).toBeTruthy();
    expect(await ax("image", "Signup: 50, Share of total 50%. Paid 50")).toBeTruthy();
    expect(c.chartSnapshot?.categories).toHaveLength(NODES.length + LINKS.length);
    expect(c.chartSnapshot?.legend?.map((l) => l.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("passes axe", async () => {
    const c = await sankey('columns="Source,Step,Result"');
    expect(await axeViolations(c)).toEqual([]);
  });

  it("hover never blinks: marks come in order and the gutters snap to the nearest mark", async () => {
    const c = await sankey();
    await awake(c);
    const rects = nodeRects(c)
      .filter((r) => r.x === 0)
      .sort((p, q) => p.y - q.y);
    const top = (rects[0] as { y: number }).y;
    const last = rects[rects.length - 1] as { y: number; h: number };
    // Down the first column, across the padding between its two nodes.
    const down = sweep(c, [6, top + 1], [6, last.y + last.h - 1]);
    expect(down).toEqual(rects.map((r) => r.mark));
    expect(down.includes(null)).toBe(false);
    // Just right of the nodes the bands are stacked; the gap between the two groups of bands snaps.
    const beside = sweep(c, [15, top + 1], [15, last.y + last.h - 1]);
    expect(beside.includes(null)).toBe(false);
    expect(new Set(beside).size).toBe(beside.length);
    expect(beside.every((i) => (i as number) >= NODES.length)).toBe(true);
    // Leaving the plot is the only way to -1.
    expect(sweep(c, [6, last.y + last.h - 1], [6, 330]).at(-1)).toBeNull();
  });

  it("keeps the hover across a redraw, through the element under the pointer", async () => {
    const c = await sankey();
    await awake(c);
    const [first] = nodeRects(c)
      .filter((r) => r.x === 0)
      .sort((p, q) => p.y - q.y);
    pointer(
      c,
      "pointermove",
      6,
      (first as { y: number; h: number }).y + (first as { h: number }).h / 2,
    );
    const index = c.hover?.index;
    expect(index).toBe(0);
    const seen: unknown[] = [];
    c.addEventListener("chart-hover", (e) => seen.push((e as CustomEvent).detail?.index ?? null));
    (c as unknown as { links: unknown }).links = [...LINKS];
    await settle();
    expect(c.hover?.index).toBe(0);
    expect(seen.includes(null)).toBe(false);
  });

  it("follows the paths with the arrow keys: along the flow, between siblings, to the ends", async () => {
    const c = await sankey();
    await focusChart();
    const at = () => (c.hover as { index: number }).index;
    const mark = (i: number) => (c.describe as (i: number) => { kind: string; id: string })(i);
    expect(mark(at())).toEqual({ kind: "node", id: expect.any(String), name: expect.any(String) });
    const start = (mark(at()) as { id: string }).id;
    await userEvent.keyboard("{ArrowRight}");
    const link = mark(at()) as unknown as { kind: string; source: string; target: string };
    expect(link).toMatchObject({ kind: "link", source: start });
    await userEvent.keyboard("{ArrowRight}");
    expect(mark(at())).toMatchObject({ kind: "node", id: link.target });
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(mark(at())).toMatchObject({ kind: "node", id: start });
    await userEvent.keyboard("{ArrowDown}");
    expect((mark(at()) as { id: string }).id).not.toBe(start);
    await userEvent.keyboard("{ArrowUp}");
    expect(mark(at())).toMatchObject({ kind: "node", id: start });
    await userEvent.keyboard("{End}");
    expect(at()).toBe(NODES.length - 1);
    await userEvent.keyboard("{Home}");
    expect(at()).toBe(0);
    // Shift+Enter drills; Backspace from a link returns to its source.
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Backspace}");
    expect(at()).toBe(0);
  });

  it("a tap pins a node, and the pinned selection is reported by mark index", async () => {
    const c = await sankey();
    await awake(c);
    const [first] = nodeRects(c)
      .filter((r) => r.x === 0)
      .sort((p, q) => p.y - q.y);
    const picked: unknown[] = [];
    c.addEventListener("chart-select", (e) => picked.push((e as CustomEvent).detail));
    tap(c, 6, (first as { y: number; h: number }).y + 4);
    expect(c.selected).toBe(0);
    expect(c.hover).toMatchObject({ pinned: true, source: "touch" });
    expect(picked).toEqual([{ index: 0, category: 0 }]);
    expect((c.describe as (i: number) => unknown)(0)).toMatchObject({ kind: "node" });
  });

  it("dims what the hovered node does not touch, and honours hidden nodes", async () => {
    const c = await sankey();
    await awake(c);
    const column1 = nodeRects(c)
      .filter((r) => r.x === 0)
      .sort((p, q) => p.y - q.y);
    pointer(c, "pointermove", 6, (column1[1] as { y: number; h: number }).y + 2);
    expect(c.querySelectorAll("rect[data-node][data-dim]").length).toBeGreaterThan(0);
    pointer(c, "pointerleave", 0, 0);
    expect(c.querySelectorAll("[data-dim]").length).toBe(0);
    (c as unknown as { toggleSeries(id: string): void }).toggleSeries("b");
    await wait(80);
    await settle();
    expect(c.querySelectorAll("rect[data-node]")).toHaveLength(4);
  });

  it("drops links that close a cycle and reports them; the diff view shows the change", async () => {
    const c = await sankey();
    const removed: unknown[] = [];
    c.addEventListener("removed-links", (e) => removed.push((e as CustomEvent).detail));
    (c as unknown as { links: unknown }).links = [...LINKS, { source: "e", target: "a", value: 6 }];
    await settle();
    expect(removed).toHaveLength(1);
    const diff = await sankey("", { compare: LINKS.map((l) => ({ ...l, value: l.value / 2 })) });
    // The diff view is a lazy chunk: the chart redraws with it once it lands.
    await expect
      .poll(() => diff.chartSnapshot?.series.map((s) => s.id))
      .toEqual(["before", "after", "change", "source", "total"]);
    await expect.poll(() => diff.querySelectorAll("[data-ghost]").length).toBe(LINKS.length);
  });

  it("uses the locale attribute for numbers and percentages and never es-PE", async () => {
    const c = await sankey("", {
      links: LINKS.map((l) => ({ ...l, value: l.value * 100 })),
    });
    c.setAttribute("locale", "de-DE");
    c.setAttribute("value-format", "number");
    await settle();
    const names = marksOf(c).map((m) => m.getAttribute("aria-label"));
    expect(names.some((n) => /5\.000/.test(n ?? ""))).toBe(true);
    expect(names.join()).not.toMatch(/S\//);
    expect(svgOf(c)).toBeTruthy();
  });

  it("plays the entry animation only when motion is allowed", async () => {
    expect(await animateCalls(() => sankey(), true)).toBe(0);
    expect(await animateCalls(() => sankey(), false)).toBeGreaterThan(0);
  });

  it("writes no height and no custom property on the host", async () => {
    const c = await mountChart("ui-sankey-chart", 'label="Funnel flows" link-opacity=".6"', {
      nodes: NODES,
      links: LINKS,
    });
    expect(c.hasAttribute("height")).toBe(false);
    expect(c.style.getPropertyValue("--ui-sankey-link-opacity")).toBe("");
    expect(svgOf(c).style.getPropertyValue("--ui-sankey-link-opacity")).toBe("0.6");
  });

  it("keeps the first node of a duplicate id, resolves links to it and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = await sankey("", {
      nodes: [...NODES, { id: "a", name: "Visits again", color: "red" }],
    });
    expect(c.querySelectorAll("rect[data-node]")).toHaveLength(NODES.length);
    expect(marksOf(c).some((m) => /Visits again/.test(m.getAttribute("aria-label") ?? ""))).toBe(
      false,
    );
    expect(
      marksOf(c).filter((m) => /^Visits:/.test(m.getAttribute("aria-label") ?? "")),
    ).toHaveLength(1);
    expect(warn.mock.calls.some(([message]) => /duplicate node id/.test(String(message)))).toBe(
      true,
    );
    warn.mockRestore();
  });

  it("pauses the particles of a dimmed link", async () => {
    const c = await sankey("particles");
    // The particles are a lazy chunk: the chart redraws with them once it lands.
    await expect
      .poll(() => c.querySelectorAll("[data-particles] circle").length)
      .toBeGreaterThan(0);
    await awake(c);
    const dots = [...c.querySelectorAll<SVGCircleElement>("[data-particles] circle")];
    const running = () => dots.map((d) => d.getAnimations()[0]?.playState);
    expect(new Set(running())).toEqual(new Set(["running"]));
    const nodeCount = c.querySelectorAll("rect[data-node]").length;
    (c as unknown as { select(i: number | null): void }).select(nodeCount); // first link
    await settle();
    const lit = dots.filter((d) => !d.hasAttribute("data-dim"));
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(dots.length);
    for (const d of dots)
      expect(d.getAnimations()[0]?.playState).toBe(
        d.hasAttribute("data-dim") ? "paused" : "running",
      );
  });
});
