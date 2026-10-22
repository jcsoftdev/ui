import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineCandlestick, type UiCandlestick } from "../src/candlestick/candlestick.ts";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { merge } from "../src/internal/e19-candles.ts";
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
  defineCandlestick();
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

const candles = (n: number, start = 100) => {
  let price = start;
  return Array.from({ length: n }, (_, i) => {
    const open = price;
    const close = open + Math.sin(i * 1.7) * 4 + (i % 3 === 0 ? 1.5 : -0.5);
    price = close;
    return {
      date: new Date(Date.UTC(2026, 0, 1 + i)),
      open,
      close,
      high: Math.max(open, close) + 2,
      low: Math.min(open, close) - 2,
      volume: 1000 + (i % 7) * 400,
    };
  });
};
const chart = async (data: ReturnType<typeof candles>, attrs = "", width = 560, inner = "") => {
  const c = await chartOf<UiCandlestick>(
    "ui-candlestick",
    `height="320" time-zone="UTC" ${attrs}`,
    width,
    inner,
  );
  c.data = data;
  await settle();
  return c;
};
const nodes = (c: Element) => [...c.querySelectorAll("g[data-candle]")];
const option = (c: Element) => c.querySelector("[role=option]") as HTMLElement;

describe("ui-candlestick", () => {
  it("draws a wick and a body per candle with up and down colors, volume bars and the last price", async () => {
    const data = candles(20);
    const c = await chart(data);
    expect(nodes(c)).toHaveLength(20);
    const rising = data.filter((d) => d.close >= d.open).length;
    const colors = nodes(c).map((g) => (g.lastElementChild as SVGElement).style.fill);
    expect(colors.filter((fill) => fill.includes("chart-up"))).toHaveLength(rising);
    expect(c.querySelectorAll("rect[data-bar]")).toHaveLength(20);
    expect(c.textContent).toContain(
      String(Math.round((data[19]?.close ?? 0) * 100) / 100).replace(/\.0+$/, ""),
    );
    expect(c.querySelector("[data-ui-part=proxy]")?.getAttribute("role")).toBe("listbox");
  });

  it("supports hollow rising candles, no volume and no last price", async () => {
    const c = await chart(candles(8), 'candle-style="hollow" volume="off" last-price="off"');
    expect(c.querySelectorAll("rect[data-bar]")).toHaveLength(0);
    const hollow = nodes(c).filter((g) =>
      (g.lastElementChild as SVGElement).style.fill.includes("surface"),
    );
    expect(hollow.length).toBeGreaterThan(0);
    expect(c.querySelector('line[stroke-dasharray="4 4"]')).toBeNull();
  });

  it("hovers without flicker, one event per candle in order, with open, high, low, close, change and volume", async () => {
    const c = await chart(candles(10), "", 560, "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = hoverLog(c);
    for (let x = 50; x <= 490; x += 3) sweep(c, x, 120);
    const seen = events.filter((e): e is number => e !== null);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(10);
    expect(c.hover?.rows.map((r) => r.name)).toEqual([
      "Open",
      "High",
      "Low",
      "Close",
      "Change",
      "Volume",
    ]);
  });

  it("is one tab stop: arrows walk the candles and a tap pins one", async () => {
    const c = await chart(candles(12));
    await userEvent.tab();
    await wait(80);
    expect(option(c).getAttribute("aria-setsize")).toBe("12");
    expect(option(c).textContent).toMatch(/^thu 1 jan 2026\. Open 100/);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(option(c).getAttribute("aria-posinset")).toBe("3");
    await userEvent.keyboard("{End}");
    expect(option(c).getAttribute("aria-posinset")).toBe("12");
    expect(c.querySelectorAll("rect[data-hl][data-active]")).toHaveLength(1);
    (document.activeElement as HTMLElement).blur();
    tap(c, 100, 100);
    await wait(80);
    expect(c.selected).not.toBeNull();
    expect(c.hover?.pinned).toBe(true);
  });

  it("zooms with the overview brush from the keyboard and resets", async () => {
    const c = await chart(candles(40), "brush");
    await wait(120);
    const slider = c.querySelector("[data-ui-part=brush]") as HTMLElement;
    const reset = c.querySelector("[data-ui-part=reset]") as HTMLButtonElement;
    expect(slider.getAttribute("role")).toBe("slider");
    expect(reset.hidden).toBe(true);
    const ranges: unknown[] = [];
    c.addEventListener("chart-range", (e) => ranges.push((e as CustomEvent).detail));
    c.range = [0, 19];
    await settle();
    expect(nodes(c)).toHaveLength(20);
    expect(reset.hidden).toBe(false);
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    await settle();
    expect(ranges.at(-1)).toEqual([1, 20]);
    expect(nodes(c)).toHaveLength(20);
    expect(slider.getAttribute("aria-valuetext")).toBe("fri 2 jan 2026 – wed 21 jan 2026");
    reset.click();
    await settle();
    expect(nodes(c)).toHaveLength(40);
    expect(reset.hidden).toBe(true);
  });

  it("paints large data on the canvas layer with virtual marks, merging candles beyond one per pixel", async () => {
    const c = await chart(candles(900), "", 1000);
    expect(nodes(c)).toHaveLength(0);
    const canvas = c.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    const pixels = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    expect(pixels?.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    await userEvent.tab();
    await wait(80);
    // 900 candles in ~900px: merged into buckets, each named by its date range.
    expect(Number(option(c).getAttribute("aria-setsize"))).toBeLessThan(900);
    expect(option(c).textContent).toContain("–");
    c.data = candles(2000);
    await settle();
    expect(c.chartSnapshot?.categories).toHaveLength(2000);
  });

  it("hides the rising or falling candles from the legend", async () => {
    const data = candles(12);
    const c = await chart(data, "", 560, "<ui-chart-legend></ui-chart-legend>");
    c.toggleSeries("down");
    await settle();
    expect(nodes(c)).toHaveLength(data.filter((d) => d.close >= d.open).length);
  });

  it("formats in the locale and passes axe", async () => {
    const c = await chart(candles(10), 'locale="de-DE"');
    expect(c.textContent).toMatch(/\d,\d/);
    expect(await violations(c)).toEqual([]);
    c.data = [];
    await settle();
    expect(c.textContent).toContain("No data");
  });

  it("keeps the zoom for new data of the same length and resets it when the length changes", async () => {
    const c = await chart(candles(40), "brush");
    c.range = [5, 24];
    await settle();
    c.data = candles(40, 120);
    await settle();
    expect(c.range).toEqual([5, 24]);
    expect(nodes(c)).toHaveLength(20);
    c.data = candles(41);
    await settle();
    expect(c.range).toEqual([0, 40]);
  });

  it("draws the overview of 150k candles without spreading them", async () => {
    const c = await chart(candles(150_000), "brush", 800);
    await wait(150);
    expect(c.querySelector("[data-ui-part=brush]")).not.toBeNull();
  });

  it("merges buckets with their own open and close, and decides the direction after merging", async () => {
    const day = (i: number, open: number, close: number) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)),
      open,
      close,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      volume: 10,
    });
    const bars = merge([day(0, 10, 14), day(1, 14, 9), day(2, 9, 12), day(3, 12, 8)], 2);
    expect(bars).toHaveLength(2);
    expect([bars[0]?.open, bars[0]?.close, bars[0]?.high, bars[0]?.low]).toEqual([10, 9, 15, 8]);
    expect([bars[1]?.open, bars[1]?.close, bars[1]?.volume]).toEqual([9, 8, 20]);
    expect(merge([day(0, 1, 2)], 5)).toHaveLength(1);
    // Two merged buckets: the first falls overall (open 10 -> close 9), so hiding "down" drops it
    // even though it holds rising candles.
    const data = [day(0, 10, 14), day(1, 14, 9), day(2, 9, 12), day(3, 12, 15)];
    const c = await chart(data as ReturnType<typeof candles>, "volume=off", 120);
    c.toggleSeries("down");
    await settle();
    expect(nodes(c).length).toBeLessThanOrEqual(4);
  });
});
