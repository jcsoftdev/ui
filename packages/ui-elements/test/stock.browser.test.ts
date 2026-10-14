import axe from "axe-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineStock, type StockInputBar, type UiStock } from "../src/stock/stock.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineStock();
  defineChartTooltip();
});
beforeEach(async () => {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
});
afterEach(async () => {
  document.body.innerHTML = "";
  await commands.timezone(null);
});

function walk(n: number, start = new Date(2025, 0, 1)): StockInputBar[] {
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let price = 100;
  return Array.from({ length: n }, (_, i) => {
    const open = price;
    const close = open + (rand() - 0.48) * 3;
    price = close;
    return {
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
      open,
      high: Math.max(open, close) + rand() * 1.5,
      low: Math.min(open, close) - rand() * 1.5,
      close,
      volume: 1000 + Math.round(rand() * 5000),
    };
  });
}

const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};

/** Waits (up to two seconds) for a lazy part of the chart to load and draw. */
const until = async (check: () => unknown) => {
  for (let i = 0; i < 40 && !check(); i += 1) await wait(50);
};

const stock = async (attrs = "", bars: StockInputBar[] = walk(120), width = 800) => {
  const host = mount(
    `<div style="width:${width}px"><ui-stock label="ACME" ${attrs.includes("locale") ? "" : 'locale="en-US"'} ${attrs.includes("toolbar") ? "" : 'toolbar="off"'} ${attrs}><ui-chart-tooltip></ui-chart-tooltip></ui-stock></div>`,
  );
  const el = host.querySelector("ui-stock") as UiStock;
  el.data = bars;
  await settle();
  return el;
};

const svgOf = (el: Element) => el.querySelector("svg") as SVGSVGElement;
const drawingOf = (el: Element) => el.querySelector("[data-ui-part=drawing]") as HTMLElement;
const proxyOf = (el: Element) => el.querySelector("[data-ui-part=proxy]") as HTMLElement;

const pointer = (
  el: Element,
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  id = 1,
) => {
  const box = svgOf(el).getBoundingClientRect();
  (type === "pointerdown" && pointerType === "mouse" ? svgOf(el) : drawingOf(el)).dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerleave",
      cancelable: true,
      clientX: box.left + x,
      clientY: box.top + y,
      pointerType,
      pointerId: id,
      isPrimary: true,
      button: 0,
    }),
  );
};
const awake = async (el: Element) => {
  drawingOf(el).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  await wait(60);
};
/** Tab stops: the navigator slider comes first in the DOM, then the bars. */
const focusBars = async (el: UiStock) => {
  await userEvent.tab();
  if (document.activeElement !== proxyOf(el)) await userEvent.tab();
  await wait(80);
};
const barX = (el: UiStock, offset: number) => {
  const w = el.window;
  const span = w.end - w.start + 1;
  const innerW = Number(svgOf(el).querySelector("[data-track]")?.getAttribute("width"));
  return ((offset + 0.5) / span) * innerW;
};

describe("ui-stock", () => {
  it("draws candles, volume and the navigator, and names the chart", async () => {
    const el = await stock();
    expect(await ax("group", "ACME")).toBeTruthy();
    expect(svgOf(el).querySelectorAll(".bars .bar")).toHaveLength(120);
    expect(svgOf(el).querySelectorAll(".volume .vol")).toHaveLength(120);
    expect(svgOf(el).querySelector("[role=slider]")?.getAttribute("aria-label")).toBe(
      "Visible range",
    );
    expect(el.getAttribute("height")).toBe("476");
    expect(el.chartSnapshot?.series.map((s) => s.id)).toContain("close");
    expect(el.chartSnapshot?.categories).toHaveLength(120);
  });

  it("hover: one event per bar in order, none per pixel, and the tooltip shows OHLC", async () => {
    const el = await stock("", walk(120), 800);
    await awake(el);
    const seen: number[] = [];
    el.addEventListener("chart-hover", (e) => {
      const d = (e as CustomEvent).detail;
      if (d) seen.push(d.index);
    });
    const step = Number(svgOf(el).querySelector("[data-track]")?.getAttribute("width")) / 120;
    for (let bar = 10; bar < 14; bar += 1)
      for (const dx of [0.2, 0.5, 0.8]) pointer(el, "pointermove", (bar + dx) * step, 120);
    await wait(30);
    expect(seen).toEqual([10, 11, 12, 13]);
    const tip = el.querySelector("ui-chart-tooltip") as HTMLElement;
    expect(tip.textContent).toContain("Open");
    expect(tip.textContent).toContain("Close");
    expect(svgOf(el).querySelector(".cross")?.getAttribute("style") ?? "").not.toContain("none");
  });

  it("keyboard: bars are one tab stop; arrows move, keys zoom and pan the window", async () => {
    const el = await stock('range="3m"');
    await focusBars(el);
    expect(document.activeElement).toBe(proxyOf(el));
    const first = el.hover?.index;
    expect(first).toBe(0);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(el.hover?.index).toBe(2);
    const span = () => el.window.end - el.window.start + 1;
    const before = span();
    await userEvent.keyboard("+");
    await settle();
    expect(span()).toBeLessThan(before);
    await userEvent.keyboard("-");
    await settle();
    expect(span()).toBe(before);
    const start = el.window.start;
    await userEvent.keyboard("{PageUp}");
    await settle();
    expect(el.window.start).toBeLessThan(start);
    // Moving past the left edge scrolls the window instead of stopping.
    await userEvent.keyboard("{Home}{ArrowLeft}");
    await settle();
    expect(el.window.start).toBeLessThan(start);
    await userEvent.tab();
    expect(el.contains(document.activeElement)).toBe(false);
  });

  it("touch: a tap pins the bar; a swipe pans the window and selects nothing", async () => {
    const el = await stock('range="3m"');
    pointer(el, "pointerdown", barX(el, 20), 120, "touch");
    pointer(el, "pointerup", barX(el, 20), 120, "touch");
    await wait(80);
    expect(Math.abs((el.selected ?? -9) - 20)).toBeLessThanOrEqual(1);
    el.select(null);
    await wait(20);
    const selects: unknown[] = [];
    el.addEventListener("chart-select", (e) => selects.push((e as CustomEvent).detail));
    const before = el.window.start;
    pointer(el, "pointerdown", 300, 120, "touch", 7);
    for (const x of [320, 380, 440]) pointer(el, "pointermove", x, 120, "touch", 7);
    pointer(el, "pointerup", 440, 120, "touch", 7);
    await settle();
    expect(el.window.start).toBeLessThan(before);
    expect(selects).toEqual([]);
    expect(el.selected).toBeNull();
  });

  it("drag pans and Ctrl+wheel zooms, both without selecting", async () => {
    const el = await stock('range="3m"');
    await awake(el);
    const selects: unknown[] = [];
    el.addEventListener("chart-select", (e) => selects.push((e as CustomEvent).detail));
    const before = el.window.start;
    pointer(el, "pointerdown", 300, 120);
    for (const x of [320, 380, 440]) pointer(el, "pointermove", x, 120);
    pointer(el, "pointerup", 440, 120);
    await settle();
    expect(el.window.start).toBeLessThan(before);
    expect(selects).toEqual([]);
    const span = el.window.end - el.window.start;
    drawingOf(el).dispatchEvent(
      new WheelEvent("wheel", {
        ctrlKey: true,
        deltaY: -300,
        clientX: 400,
        clientY: 120,
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    expect(el.window.end - el.window.start).toBeLessThan(span);
  });

  it("the navigator brush moves the window and reports it", async () => {
    const el = await stock();
    const seen: Array<{ start: number; end: number }> = [];
    el.addEventListener("stock-window", (e) => seen.push((e as CustomEvent).detail));
    el.window = { start: 40, end: 100 };
    await settle();
    const track = svgOf(el).querySelector("[data-track]") as SVGElement;
    track.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await settle();
    expect(el.window.start).toBeLessThan(40);
    expect(seen.length).toBeGreaterThan(0);
  });

  it("drawing tools: a trend line is created by dragging, selected, and deleted from the keyboard", async () => {
    const el = await stock("");
    const events: number[] = [];
    el.addEventListener("stock-drawings", (e) =>
      events.push((e as CustomEvent).detail.drawings.length),
    );
    el.tool = "trend";
    await settle();
    // The drawing tools are a lazy chunk: let it land before the gesture starts.
    await wait(200);
    const before = el.window.start;
    pointer(el, "pointerdown", 200, 150);
    for (const [x, y] of [
      [260, 130],
      [320, 100],
    ] as const)
      pointer(el, "pointermove", x, y);
    pointer(el, "pointerup", 320, 100);
    await settle();
    expect(el.drawings).toHaveLength(1);
    expect(el.drawings[0]?.type).toBe("trend");
    expect(el.tool).toBe("cursor");
    expect(el.window.start).toBe(before);
    expect(el.selected).toBeNull();
    await focusBars(el);
    await userEvent.keyboard("{Delete}");
    await settle();
    expect(el.drawings).toHaveLength(0);
    expect(events).toEqual([1, 0]);
  });

  it("indicators, an oscillator, comparisons and flags render and take part in the tooltip", async () => {
    const bars = walk(120);
    const el = await stock('oscillator="rsi"', bars);
    el.overlays = [{ type: "sma", period: 10 }, { type: "bollinger" }];
    el.flags = [{ date: bars[60]?.date as Date, label: "P", text: "Product launch" }];
    await until(() => svgOf(el).querySelector(".flag"));
    await settle();
    expect(svgOf(el).querySelectorAll(".overlays .ov").length).toBeGreaterThanOrEqual(4);
    expect(svgOf(el).querySelectorAll(".flag")).toHaveLength(1);
    expect(svgOf(el).querySelector(".osc .osc-line")).toBeTruthy();
    expect(el.chartSnapshot?.legend?.map((l) => l.name)).toEqual(["SMA 10", "Bollinger 20, 2"]);
    el.comparisons = [{ id: "idx", name: "Index", values: bars.map((b) => b.close * 0.9) }];
    await settle();
    expect(svgOf(el).querySelector(".cmp")).toBeTruthy();
    expect(svgOf(el).querySelector(".bars .bar")).toBeNull();
  });

  it("a long series paints on the canvas layer and the series types switch", async () => {
    const el = await stock('range="all"', walk(5000), 800);
    expect(el.querySelector("canvas")).toBeTruthy();
    expect(svgOf(el).querySelectorAll(".bars .bar")).toHaveLength(0);
    el.setAttribute("range", "1m");
    await settle();
    expect(el.querySelector("canvas")).toBeNull();
    expect(svgOf(el).querySelectorAll(".bars .bar").length).toBeGreaterThan(20);
    for (const type of ["ohlc", "line", "area", "column", "heikin-ashi", "renko"]) {
      el.setAttribute("series-type", type);
      await wait(120);
      await settle();
      expect(svgOf(el).querySelector("[role=slider]")).toBeTruthy();
    }
    el.setAttribute("series-type", "line");
    await settle();
    expect(svgOf(el).querySelector(".price-line")).toBeTruthy();
  });

  it("live bars: pushBars follows the tail and keeps the zoom", async () => {
    const bars = walk(60);
    const el = await stock('range="1m"', bars);
    const span = el.window.end - el.window.start;
    el.pushBars({
      date: new Date(2025, 5, 1),
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      volume: 10,
    });
    await settle();
    expect(el.data).toHaveLength(61);
    expect(el.window.end).toBe(60);
    expect(el.window.end - el.window.start).toBe(span);
  });

  it("formats with the locale and shows no currency unless asked", async () => {
    const big = walk(120).map((b) => ({
      ...b,
      open: b.open * 15,
      high: b.high * 15,
      low: b.low * 15,
      close: b.close * 15,
    }));
    const en = await stock('locale="en-US" value-format="integer"', big);
    const de = await stock('locale="de-DE" value-format="integer"', big);
    const axisText = (el: Element) =>
      [...svgOf(el).querySelectorAll(".yt")].map((t) => t.textContent).join(" ");
    expect(axisText(en)).not.toMatch(/PEN|S\//);
    expect(axisText(en)).not.toBe("");
    expect(axisText(de)).not.toBe(axisText(en));
  });

  it("200 000 bars render with the volume strip and a MACD pane (no argument-spread crash)", async () => {
    const el = await stock('oscillator="macd"', walk(200_000), 800);
    await until(() => svgOf(el).querySelector(".osc path"));
    expect(el.data).toHaveLength(200_000);
    expect(svgOf(el).querySelector(".osc path")).toBeTruthy();
    expect(svgOf(el).querySelectorAll(".osc .hist").length).toBeLessThan(500);
    expect(el.querySelector("canvas")).toBeTruthy();
  });

  it("an ISO date-only string is a local date, not UTC midnight", async () => {
    await commands.timezone("America/Lima");
    const bars = walk(30).map((bar, i) => ({
      ...bar,
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    }));
    const el = await stock("", bars);
    expect(el.data[0]?.date.getDate()).toBe(1);
    expect(el.data[0]?.date.getHours()).toBe(0);
    // Not read as intraday: the dates carry no clock.
    expect(el.chartSnapshot?.categories[0]).toBe("Mar 1, 2026");
    const zoned = await stock('time-zone="America/New_York"', bars);
    expect(zoned.chartSnapshot?.categories[0]).toBe("Mar 1, 2026");
  });

  it("the crosshair price tag follows the chart locale", async () => {
    const big = walk(60).map((b) => ({ ...b, open: 1234.5, high: 1300, low: 1200, close: 1234.5 }));
    const el = await stock('locale="de-DE" value-format="integer"', big);
    await awake(el);
    const step = Number(svgOf(el).querySelector("[data-track]")?.getAttribute("width")) / 60;
    pointer(el, "pointermove", 20.5 * step, 120);
    await wait(40);
    const tags = [...svgOf(el).querySelectorAll(".cross .tag text")].map((t) => t.textContent);
    expect(tags[0]).toContain("1.23");
  });

  it("a property set before the element upgrades is not lost", async () => {
    const host = document.createElement("div");
    host.style.width = "800px";
    const plain = document.createElement("ui-stock") as UiStock;
    Object.defineProperty(plain, "data", { value: walk(40), configurable: true, writable: true });
    plain.setAttribute("toolbar", "off");
    host.append(plain);
    document.body.append(host);
    await settle();
    expect(svgOf(plain).querySelectorAll(".bars .bar").length).toBeGreaterThan(0);
  });

  it("toolbar: ranges, series types and tools, on by default", async () => {
    const el = await stock('toolbar="on" tools="all" range="all"');
    await wait(150);
    const bar = el.querySelector("[data-ui-part=toolbar]") as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.nextElementSibling).toBe(drawingOf(el));
    const click = async (selector: string) => {
      (bar.querySelector(selector) as HTMLButtonElement).click();
      await settle();
    };
    const all = el.window.end - el.window.start;
    await click('[data-range="1m"]');
    expect(el.getAttribute("range")).toBe("1m");
    expect(el.window.end - el.window.start).toBeLessThan(all);
    expect(bar.querySelector('[data-range="1m"]')?.getAttribute("aria-pressed")).toBe("true");
    await click('[data-type="line"]');
    expect(el.seriesType).toBe("line");
    await click('[data-tool="trend"]');
    expect(el.tool).toBe("trend");
    expect(bar.querySelector('[data-tool="trend"]')?.getAttribute("aria-pressed")).toBe("true");
    el.setAttribute("toolbar", "off");
    await settle();
    expect(el.querySelector("[data-ui-part=toolbar]")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const el = await stock('oscillator="macd"');
    el.overlays = [{ type: "ema", period: 12 }];
    await settle();
    await focusBars(el);
    const result = await axe.run(el, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(
      result.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      ),
    ).toEqual([]);
  });
});
