import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineCrossfilter, type UiCrossfilter } from "../src/crossfilter/crossfilter.ts";
import {
  defineCrossfilterBar,
  type UiCrossfilterBar,
} from "../src/crossfilter-bar/crossfilter-bar.ts";
import { defineCrossfilterHistogram } from "../src/crossfilter-histogram/crossfilter-histogram.ts";
import { defineCrossfilterScatter } from "../src/crossfilter-scatter/crossfilter-scatter.ts";
import { defineCrossfilterSummary } from "../src/crossfilter-summary/crossfilter-summary.ts";
import { frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineCrossfilter();
  defineCrossfilterBar();
  defineCrossfilterHistogram();
  defineCrossfilterScatter();
  defineCrossfilterSummary();
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

interface Sale {
  barber: string;
  price: number;
  minutes: number;
}
const BARBERS = ["Ana", "Luis", "Marta", "Ivo"];
const SALES: Sale[] = Array.from({ length: 120 }, (_, i) => ({
  barber: BARBERS[i % 4] as string,
  price: 5 + ((i * 37) % 90),
  minutes: 15 + ((i * 11) % 60),
}));
const DIMENSIONS = {
  barber: (s: Sale) => s.barber,
  price: (s: Sale) => s.price,
  minutes: (s: Sale) => s.minutes,
};

const settle = async () => {
  await frame();
  await frame();
  await wait(60);
};

const board = async (locale = "en-US") => {
  const host = mount(`<ui-crossfilter locale="${locale}" style="display:block;width:700px">
    <ui-crossfilter-summary noun="sales"></ui-crossfilter-summary>
    <ui-crossfilter-bar dimension="barber" heading="By barber" locale="${locale}" height="200"><ui-chart-tooltip></ui-chart-tooltip></ui-crossfilter-bar>
    <ui-crossfilter-histogram dimension="price" heading="Price" domain="0,100" bins="10" locale="${locale}" height="200"></ui-crossfilter-histogram>
    <ui-crossfilter-scatter x="price" y="minutes" heading="Price and time" locale="${locale}" height="240"></ui-crossfilter-scatter>
  </ui-crossfilter>`);
  const xf = host.querySelector("ui-crossfilter") as UiCrossfilter;
  xf.dimensions = DIMENSIONS as never;
  xf.data = SALES;
  await settle();
  return {
    xf,
    bar: host.querySelector("ui-crossfilter-bar") as UiCrossfilterBar,
    hist: host.querySelector("ui-crossfilter-histogram") as HTMLElement,
    scatter: host.querySelector("ui-crossfilter-scatter") as HTMLElement,
    summary: host.querySelector("ui-crossfilter-summary") as HTMLElement,
  };
};

const drawingOf = (el: Element) => el.querySelector("[data-ui-part=drawing]") as HTMLElement;
const svgOf = (el: Element) => el.querySelector("svg") as SVGSVGElement;
const hits = (el: Element) => [...el.querySelectorAll<SVGElement>('[data-e17="hit"]')];
const centerOf = (el: Element) => {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};
const fire = (target: Element, type: string, x: number, y: number, id = 1, pointerType = "mouse") =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType,
      isPrimary: true,
      button: 0,
    }),
  );
const awake = async (el: Element) => {
  drawingOf(el).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  // Awaiting the module runs after the chart's own continuation, which attaches the layer.
  await import("../src/internal/chart-interact.ts");
  await frame();
  await frame();
};

describe("ui-crossfilter", () => {
  it("shares one dataset: the summary, the bars and the histogram show it", async () => {
    const { summary, bar, hist } = await board();
    expect(summary.textContent).toContain("120 of 120 sales");
    expect(bar.querySelector("h3")?.textContent).toBe("By barber");
    expect(bar.series.map((s) => s.id)).toEqual(["total", "filtered"]);
    expect(bar.categories).toEqual(BARBERS);
    expect(hits(hist)).toHaveLength(10);
    expect(hist.querySelector("[data-ui-part=xf-header] button")?.hasAttribute("hidden")).toBe(
      true,
    );
  });

  it("clicking a bar filters the others, never pins, and clicking again undoes it", async () => {
    const { xf, bar, hist, summary } = await board();
    await awake(bar);
    const selects: unknown[] = [];
    bar.addEventListener("chart-select", (e) => {
      if ((e as CustomEvent).detail) selects.push((e as CustomEvent).detail);
    });
    for (let i = 0; i < 2; i += 1) {
      await userEvent.click(hits(bar)[1] as Element);
      await settle();
      if (i === 0) {
        expect(xf.filters.barber).toEqual({ kind: "set", values: ["Luis"] });
        expect(summary.textContent).toContain("30 of 120 sales");
        expect(summary.querySelector("button")?.hasAttribute("hidden")).toBe(false);
        // The histogram follows: it counts only Luis's sales in the filtered series.
        const filtered = (hist as unknown as { series: Array<{ data: number[] }> }).series[1] as {
          data: number[];
        };
        expect(filtered.data.reduce((a, b) => a + b, 0)).toBe(30);
        expect(bar.series[1]?.colors?.filter(Boolean)).toHaveLength(3);
      }
    }
    expect(xf.filters.barber).toBeUndefined();
    expect(selects).toEqual([]);
    expect(bar.selected).toBeNull();
  });

  it("keyboard: arrows pick a bar, Enter filters, and Clear restores everything", async () => {
    const { xf, bar, summary } = await board();
    await userEvent.tab();
    await expect.poll(() => document.activeElement?.closest("ui-crossfilter-bar")).toBe(bar);
    await userEvent.keyboard("{ArrowRight}{Enter}");
    await settle();
    expect(xf.filters.barber).toEqual({ kind: "set", values: ["Luis"] });
    (bar.querySelector("[data-ui-part=xf-header] button") as HTMLButtonElement).click();
    await settle();
    expect(xf.filters).toEqual({});
    expect(summary.textContent).toContain("120 of 120");
  });

  it("histogram: dragging across bins filters that interval and selects no bar; a click toggles a bin", async () => {
    const { xf, hist, bar, summary } = await board();
    await awake(hist);
    const bins = hits(hist);
    const a = centerOf(bins[2] as Element);
    const b = centerOf(bins[4] as Element);
    const selects: unknown[] = [];
    hist.addEventListener("chart-select", (e) => {
      if ((e as CustomEvent).detail) selects.push((e as CustomEvent).detail);
    });
    const root = svgOf(hist);
    fire(root, "pointerdown", a.x, a.y);
    for (const x of [a.x + 8, (a.x + b.x) / 2, b.x]) fire(root, "pointermove", x, a.y);
    fire(root, "pointerup", b.x, a.y);
    await settle();
    const range = xf.filters.price;
    expect(range?.kind).toBe("range");
    if (range?.kind === "range") {
      expect(range.min).toBe(20);
      expect(range.max).toBeCloseTo(50, 5);
    }
    expect(summary.textContent).not.toContain("120 of 120");
    expect(selects).toEqual([]);
    // The bars follow the interval.
    expect(((bar.series[1]?.data ?? []) as number[]).reduce((s, v) => s + v, 0)).toBeLessThan(120);
    // A click on a single bin selects it; the same click again clears it.
    for (let i = 0; i < 2; i += 1) {
      const c = centerOf(hits(hist)[7] as Element);
      fire(root, "pointerdown", c.x, c.y);
      fire(root, "pointerup", c.x, c.y);
      await settle();
      expect(xf.filters.price !== undefined).toBe(i === 0);
    }
    expect(selects).toEqual([]);
  });

  it("histogram keyboard: Enter on a bin toggles it", async () => {
    const { xf, hist } = await board();
    (drawingOf(hist).querySelector("[data-ui-part=proxy]") as HTMLElement | null)?.focus();
    await userEvent.tab();
    if (!hist.contains(document.activeElement)) await userEvent.tab();
    await expect.poll(() => hist.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    await settle();
    expect(xf.filters.price?.kind).toBe("range");
    await userEvent.keyboard("{Enter}");
    await settle();
    expect(xf.filters.price).toBeUndefined();
  });

  it("scatter: a brush filters both dimensions and the dots outside stay as context", async () => {
    const { xf, scatter } = await board();
    const count = () =>
      (scatter as unknown as { series: Array<{ points: unknown[] }> }).series.map(
        (s) => s.points.length,
      );
    expect(count()).toEqual([0, 120]);
    const box = svgOf(scatter).getBoundingClientRect();
    const root = drawingOf(scatter);
    const start = { x: box.left + box.width * 0.35, y: box.top + box.height * 0.3 };
    const end = { x: box.left + box.width * 0.7, y: box.top + box.height * 0.7 };
    fire(root, "pointerdown", start.x, start.y);
    for (const t of [0.3, 0.6, 1])
      fire(root, "pointermove", start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
    fire(root, "pointerup", end.x, end.y);
    await settle();
    expect(xf.filters.price?.kind).toBe("range");
    expect(xf.filters.minutes?.kind).toBe("range");
    const [out, kept] = count();
    expect(out).toBeGreaterThan(0);
    expect((out ?? 0) + (kept ?? 0)).toBe(120);
    expect(scatter.querySelector("[data-ui-part=xf-header] button")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect((scatter as unknown as { selected: number | null }).selected).toBeNull();
  });

  it("scatter: a click never pins a point and only clears the brush", async () => {
    const { xf, scatter } = await board();
    let selects = 0;
    scatter.addEventListener("chart-select", () => selects++);
    const box = svgOf(scatter).getBoundingClientRect();
    const root = drawingOf(scatter);
    const a = { x: box.left + box.width * 0.3, y: box.top + box.height * 0.3 };
    const b = { x: box.left + box.width * 0.7, y: box.top + box.height * 0.7 };
    fire(root, "pointerdown", a.x, a.y);
    for (const t of [0.5, 1])
      fire(root, "pointermove", a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    fire(root, "pointerup", b.x, b.y);
    await settle();
    expect(xf.filters.price?.kind).toBe("range");
    const dot = scatter.querySelector<SVGElement>('[data-e17="point"], circle');
    const at = dot ? centerOf(dot) : { x: b.x, y: b.y };
    await userEvent.click(document.elementFromPoint(at.x, at.y) ?? root);
    await settle();
    expect(selects).toBe(0);
    expect(scatter.querySelector("[data-selected]")).toBeNull();
    expect((scatter as unknown as { selected: number | null }).selected).toBeNull();
  });

  it("a chart appended to a populated provider draws at once", async () => {
    const { xf } = await board();
    const late = document.createElement("ui-crossfilter-bar");
    late.setAttribute("dimension", "barber");
    late.setAttribute("height", "160");
    xf.append(late);
    await settle();
    expect(late.querySelector("svg")).not.toBeNull();
    const hist = document.createElement("ui-crossfilter-histogram");
    hist.setAttribute("dimension", "price");
    hist.setAttribute("domain", "0,100");
    hist.setAttribute("height", "160");
    xf.append(hist);
    const scatter = document.createElement("ui-crossfilter-scatter");
    scatter.setAttribute("x", "price");
    scatter.setAttribute("y", "minutes");
    scatter.setAttribute("height", "160");
    xf.append(scatter);
    await settle();
    expect(hist.querySelector("svg")).not.toBeNull();
    expect(scatter.querySelector("svg")).not.toBeNull();
  });

  it("properties set before the elements upgrade survive it", async () => {
    // Elements of an inert document are not upgraded, so these are plain own properties.
    const inert = document.implementation.createHTMLDocument("");
    const make = (tag: string) => inert.createElement(tag) as HTMLElement & Record<string, unknown>;
    const xf = make("ui-crossfilter");
    const bar = make("ui-crossfilter-bar");
    const sum = make("ui-crossfilter-summary");
    xf.dimensions = DIMENSIONS;
    xf.data = SALES;
    bar.setAttribute("dimension", "barber");
    bar.setAttribute("height", "160");
    bar.keyLabel = (key: unknown) => `<${String(key)}>`;
    sum.texts = { count: () => "custom summary" };
    xf.append(sum, bar);
    const host = mount("<div style='width:600px'></div>");
    host.firstElementChild?.append(document.adoptNode(xf));
    await settle();
    const live = host.querySelector("ui-crossfilter") as UiCrossfilter;
    expect(live.data.length).toBe(120);
    expect(host.querySelector("ui-crossfilter-bar")?.textContent).toContain("<Ana>");
    expect(host.querySelector("ui-crossfilter-summary")?.textContent).toContain("custom summary");
  });

  it("a heading change renames the chart and the summary follows texts", async () => {
    const { bar, summary } = await board();
    bar.setAttribute("heading", "Per barber");
    await settle();
    expect(bar.getAttribute("label")).toBe("Per barber");
    bar.setAttribute("label", "Mine");
    bar.setAttribute("heading", "Other");
    await settle();
    expect(bar.getAttribute("label")).toBe("Mine");
    (summary as unknown as { texts: unknown }).texts = { count: () => "custom summary" };
    await settle();
    expect(summary.textContent).toContain("custom summary");
  });

  it("formats with the locale and no currency", async () => {
    const { summary, hist } = await board("de-DE");
    expect(summary.textContent).toContain("120 of 120");
    expect(hist.textContent).not.toMatch(/PEN|S\//);
  });

  it("charts defined before the provider still bind, and a missing provider draws nothing", async () => {
    const host = mount(
      '<ui-crossfilter-bar dimension="barber" heading="Lonely" height="120"></ui-crossfilter-bar>',
    );
    await settle();
    expect(host.querySelector("ui-crossfilter-bar")?.querySelector("svg")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { xf } = await board();
    xf.toggle("barber", "Ana");
    await settle();
    const result = await axe.run(xf, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(
      result.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      ),
    ).toEqual([]);
  });
});
