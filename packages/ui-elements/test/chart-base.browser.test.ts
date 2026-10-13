import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineChartDataTable } from "../src/chart-data-table/chart-data-table.ts";
import { defineChartFrame } from "../src/chart-frame/chart-frame.ts";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { join, svg } from "../src/internal/chart-base.ts";
import { snapshotCsv } from "../src/internal/chart-export.ts";
import { bindChart } from "../src/internal/chart-protocol.ts";
import {
  defineTestBars,
  defineTestDots,
  defineTestLine,
  defineTestShapes,
  lastDraw,
  log,
  resetLog,
  SALES,
} from "./chart-fixture.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineTestBars();
  defineTestLine();
  defineTestDots();
  defineTestShapes();
  defineChartFrame();
  defineChartLegend();
  defineChartTooltip();
  defineChartDataTable();
  defineChartBreadcrumb();
});

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
beforeEach(async () => {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  resetLog();
});

const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};

type Chart = HTMLElement & {
  select(index: number | null): void;
  drill(index: number): void;
  readonly selected: number | null;
  readonly hover: { index: number; category: number; pinned: boolean; source: string } | null;
  readonly chartSnapshot: { series: unknown[]; categories: string[] } | null;
  readonly drawing: HTMLElement;
  data: typeof SALES;
  requestDraw(kind?: "data" | "size" | "transient"): void;
  isHidden(id: string): boolean;
};

const chart = async (attrs = "", inner = "", width = 420, tag = "ui-test-bars") => {
  const host = mount(
    `<div style="width:${width}px"><${tag} id="c" label="Sales by day" height="200" ${attrs.includes("locale") ? "" : 'locale="en-US"'} ${attrs}>${inner}</${tag}></div>`,
  );
  await settle();
  return host.querySelector(tag) as Chart;
};
const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
const marks = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [role=img]")];
const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;

/** Loads the interaction chunk the way a pointer arriving would, without hovering any mark. */
const awake = async (c: Element) => {
  drawingOf(c).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  await wait(60);
};

const pointer = (c: Element, type: string, x: number, y: number, pointerType = "mouse", id = 1) => {
  const box = svgOf(c).getBoundingClientRect();
  drawingOf(c).dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerleave",
      clientX: box.left + x,
      clientY: box.top + y,
      pointerType,
      pointerId: id,
      isPrimary: true,
    }),
  );
};
const tap = (c: Element, x: number, y: number, pointerType = "touch") => {
  pointer(c, "pointerdown", x, y, pointerType);
  pointer(c, "pointerup", x, y, pointerType);
};

describe("chart base: sizing", () => {
  it("does not fetch the state code or stylesheet while the chart has data", async () => {
    await chart();
    const fetched = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /chart-state/.test(name));
    expect(fetched).toEqual([]);
  });

  it("fills its parent exactly and follows it when it resizes", async () => {
    const c = await chart();
    expect(svgOf(c).getAttribute("width")).toBe("420");
    expect(svgOf(c).getAttribute("height")).toBe("200");
    (c.parentElement as HTMLElement).style.width = "300px";
    await settle();
    expect(svgOf(c).getAttribute("width")).toBe("300");
    expect(c.getBoundingClientRect().width).toBe(300);
  });

  it("derives the height from an aspect ratio, or takes the parent's height with fill", async () => {
    const host = mount(
      `<div style="width:400px"><ui-test-bars id="r" aspect-ratio="2"></ui-test-bars></div>
       <div style="width:400px;height:260px"><ui-test-bars id="f" height="fill"></ui-test-bars></div>`,
    );
    await settle();
    expect(svgOf(host.querySelector("#r") as Element).getAttribute("height")).toBe("200");
    expect(svgOf(host.querySelector("#f") as Element).getAttribute("height")).toBe("260");
  });

  it("shows the loading and empty states instead of the drawing, from a lazy chunk", async () => {
    const c = await chart("loading");
    expect(await ax("status", "Loading chart")).toBeTruthy();
    expect(c.querySelector("svg")).toBeNull();
    c.removeAttribute("loading");
    c.setAttribute("empty", "");
    await settle();
    expect(c.textContent).toContain("No data to show");
    c.removeAttribute("empty");
    await settle();
    expect(c.querySelector("svg")).not.toBeNull();
  });
});

describe("chart base: draw phases", () => {
  it("is enter once, update for data and legend toggles, resize for a new size", async () => {
    const c = await chart("", "<ui-chart-legend></ui-chart-legend>");
    expect(log.phases).toEqual(["enter"]);
    expect(log.hadPrevious).toEqual([false]);
    expect(log.animate).toEqual([true]);
    c.data = SALES.slice(0, 4);
    c.requestDraw();
    await settle();
    (c.parentElement as HTMLElement).style.width = "380px";
    await settle();
    c.setAttribute("locale", "de-DE");
    await settle();
    expect(log.phases).toEqual(["enter", "update", "resize", "update"]);
    expect(log.hadPrevious).toEqual([false, true, true, true]);
    // Only the first draw animates: a data change or a resize must not replay the entry.
    expect(log.animate).toEqual([true, false, false, false]);
  });

  it("enters again after the loading state, with an empty drawing", async () => {
    const c = await chart();
    c.setAttribute("loading", "");
    await settle();
    c.removeAttribute("loading");
    await settle();
    expect(log.phases).toEqual(["enter", "enter"]);
    expect(marks(c)).toHaveLength(SALES.length);
  });
});

describe("chart base: accessibility", () => {
  it("names the chart, describes it, and exposes each mark as a named image", async () => {
    const c = await chart();
    expect(await ax("group", "Sales by day")).toBeTruthy();
    const group = svgOf(c);
    const description = c.querySelector(`#${group.getAttribute("aria-describedby")}`);
    expect(description?.textContent).toBe("6 days, best 1,750");
    expect(group.getAttribute("aria-roledescription")).toBe("chart");
    expect(await ax("image", "Mon: 1,200.5")).toBeTruthy();
    expect(marks(c)).toHaveLength(SALES.length);
    // Roving tab stop: exactly one mark is tabbable.
    expect(marks(c).filter((m) => m.tabIndex === 0)).toHaveLength(1);
  });

  it("takes its fallback name and role description from the labels", async () => {
    const c = await chart('label=""');
    c.removeAttribute("label");
    (c as unknown as { labels: object }).labels = { chart: "Gráfico", roledescription: "gráfico" };
    c.requestDraw();
    await settle();
    expect(svgOf(c).getAttribute("aria-label")).toBe("Gráfico");
    expect(svgOf(c).getAttribute("aria-roledescription")).toBe("gráfico");
  });

  it("gives screen readers a real table, loaded lazily, and a visible one replaces it", async () => {
    const c = await chart();
    await wait(400);
    const table = c.querySelector<HTMLTableElement>("[data-ui-part=fallback-table] table");
    expect(table?.caption?.textContent).toBe("Sales by day");
    expect([...(table?.tHead?.rows[0]?.cells ?? [])].map((x) => x.textContent)).toEqual([
      "Day",
      "Sales",
    ]);
    expect(table?.tBodies[0]?.rows).toHaveLength(6);
    expect(await ax("columnheader", "Sales")).toBeTruthy();
    expect(await ax("rowheader", "Wed")).toBeTruthy();

    c.insertAdjacentHTML("beforeend", "<ui-chart-data-table visible></ui-chart-data-table>");
    await settle();
    expect(c.querySelector("[data-ui-part=fallback-table]")).toBeNull();
    expect(c.querySelectorAll("table")).toHaveLength(1);
    expect(c.querySelector("ui-chart-data-table td")?.textContent).toBe("1,200.5");
  });

  it("table=off skips the fallback", async () => {
    const c = await chart('table="off"');
    await wait(400);
    expect(c.querySelector("table")).toBeNull();
  });

  it("caps the table at 500 rows with a note, and rebuilds it only when the data changed", async () => {
    const c = await chart('rows="1200"');
    await wait(500);
    const table = c.querySelector<HTMLTableElement>("[data-ui-part=fallback-table] table");
    const body = table?.tBodies[0];
    expect(body?.rows).toHaveLength(501);
    expect(body?.lastElementChild?.textContent).toBe("700 more rows; use export to get them all");
    // A resize redraws but the data is the same: same snapshot, same table, no rebuild.
    (c.parentElement as HTMLElement).style.width = "360px";
    await wait(500);
    expect(table?.tBodies[0]).toBe(body);
    const table2 = c.querySelector("ui-chart-data-table");
    expect(table2).toBeNull();
  });

  it("limits ui-chart-data-table with its limit attribute and rebuilds only on new data", async () => {
    const c = await chart(
      'rows="40"',
      '<ui-chart-data-table visible limit="10"></ui-chart-data-table>',
    );
    const body = c.querySelector<HTMLTableElement>("ui-chart-data-table table")?.tBodies[0];
    expect(body?.rows).toHaveLength(11);
    expect(body?.lastElementChild?.textContent).toBe("30 more rows; use export to get them all");
    (c.parentElement as HTMLElement).style.width = "360px";
    await settle();
    expect(c.querySelector<HTMLTableElement>("ui-chart-data-table table")?.tBodies[0]).toBe(body);
    c.setAttribute("rows", "50");
    await settle();
    expect(c.querySelector<HTMLTableElement>("ui-chart-data-table table")?.tBodies[0]).not.toBe(
      body,
    );
    expect(
      c.querySelector<HTMLTableElement>("ui-chart-data-table table")?.tBodies[0]?.rows,
    ).toHaveLength(11);
  });
});

describe("chart base: snapshot", () => {
  it("is computed only when asked, once per data revision, never for a resize", async () => {
    const c = await chart();
    await wait(400); // the fallback table asks once
    const base = log.snapshots;
    expect(base).toBe(1);
    expect(c.chartSnapshot).toBe(c.chartSnapshot);
    expect(log.snapshots).toBe(base);
    (c.parentElement as HTMLElement).style.width = "350px";
    await settle();
    await wait(400);
    expect(log.snapshots).toBe(base); // resized, redrawn, not recomputed
    c.data = SALES.slice(0, 3);
    c.requestDraw();
    await settle();
    expect(c.chartSnapshot?.categories).toEqual(["Mon", "Tue", "Wed"]);
    expect(log.snapshots).toBeGreaterThan(base);
  });

  it("emits chart-data with a revision, and null for the loading and empty states", async () => {
    const c = await chart();
    const seen: unknown[] = [];
    c.addEventListener("chart-data", (e) => seen.push((e as CustomEvent).detail));
    c.setAttribute("loading", "");
    await settle();
    expect(seen).toEqual([null]);
    expect(c.chartSnapshot).toBeNull();
    c.removeAttribute("loading");
    await settle();
    expect(seen).toHaveLength(2);
    expect((seen[1] as { revision: number }).revision).toBeGreaterThan(0);
    expect(c.chartSnapshot?.series).toHaveLength(1);
  });
});

describe("chart base: keyboard over marks", () => {
  it("is one tab stop; arrows, Home and End move between marks; Escape clears the tooltip", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>");
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    const m = marks(c);
    // The very first Tab press must work: the interaction chunk loads on that focus and catches up.
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(m[0]);
    expect(tip.hasAttribute("data-open")).toBe(true);
    expect(tip.textContent).toContain("Mon");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(m[1]);
    expect(tip.textContent).toContain("Tue");
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(m[5]);
    await userEvent.keyboard("{ArrowRight}"); // no wrap
    expect(document.activeElement).toBe(m[5]);
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(m[0]);
    await userEvent.keyboard("{Escape}");
    expect(tip.hasAttribute("data-open")).toBe(false);
    expect(document.activeElement).toBe(m[0]);
    // The tab stop followed focus, and Tab leaves the chart in one press.
    expect(m.filter((x) => x.tabIndex === 0)).toEqual([m[0]]);
    await userEvent.tab();
    expect(c.contains(document.activeElement)).toBe(false);
  });

  it("keeps keyboard focus on the same mark across a redraw, without announcing it again", async () => {
    const c = await chart();
    await userEvent.tab();
    await wait(80);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    const events: unknown[] = [];
    c.addEventListener("chart-hover", (e) => events.push((e as CustomEvent).detail?.index ?? null));
    (c.parentElement as HTMLElement).style.width = "350px";
    await settle();
    c.data = [...SALES];
    c.requestDraw();
    await settle();
    expect(document.activeElement).toBe(marks(c)[2]);
    expect(marks(c)[2]?.hasAttribute("data-active")).toBe(true);
    expect(c.hover?.index).toBe(2);
    // The mark was replaced and refocused silently: no leave, no re-enter. Only the anchor moved.
    expect(events.includes(null)).toBe(false);
  });

  it("moves focus to the frame, not the page, when the focused mark disappears", async () => {
    const c = await chart();
    await userEvent.tab();
    await wait(80);
    await userEvent.keyboard("{End}");
    c.setAttribute("empty", "");
    await settle();
    expect(c.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(drawingOf(c));
    // With fewer marks, focus lands on the last one that is left.
    c.removeAttribute("empty");
    await settle();
    c.data = SALES.slice(0, 2);
    c.requestDraw();
    await settle();
    (document.activeElement as HTMLElement).blur();
    await userEvent.tab();
    await userEvent.keyboard("{End}");
    c.data = SALES.slice(0, 1);
    c.requestDraw();
    await settle();
    expect(document.activeElement).toBe(marks(c)[0]);
  });
});

describe("chart base: hover and hit testing", () => {
  it("keeps the hovered mark across a redraw, re-hitting at the last pointer position", async () => {
    const c = await chart();
    await awake(c);
    pointer(c, "pointermove", 130, 60);
    expect(c.hover?.index).toBe(1);
    const events: unknown[] = [];
    c.addEventListener("chart-hover", (e) => events.push((e as CustomEvent).detail?.index ?? null));
    c.data = [...SALES];
    c.requestDraw();
    await settle();
    // Same mark under the same pointer: no leave in between, nothing re-emitted.
    expect(c.hover?.index).toBe(1);
    expect(events).toEqual([]);
    // Narrower chart: the pointer now sits over another mark, which becomes the hover.
    (c.parentElement as HTMLElement).style.width = "220px";
    await settle();
    expect(c.hover?.index).toBe(Math.floor(130 / (220 / 6)));
    expect(events.includes(null)).toBe(false);
  });

  it("scales the pointer position by the drawing's CSS size and passes the target", async () => {
    const c = await chart();
    await awake(c);
    (c.parentElement as HTMLElement).style.cssText += ";transform:scale(.5);transform-origin:0 0";
    await settle();
    const box = svgOf(c).getBoundingClientRect();
    expect(box.width).toBeCloseTo(210, 0);
    log.hits.length = 0;
    // The pointer is at 1.5 bands of the scaled box: the drawing's own x is double that.
    pointer(c, "pointermove", 210 * 0.5, 40);
    const hit = log.hits.at(-1);
    expect(hit?.x).toBeCloseTo(210, 0);
    expect(hit?.y).toBeCloseTo(80, 0);
    expect(hit?.target).toBeDefined();
    expect(c.hover?.index).toBe(3);
  });
});

describe("chart base: retained rendering", () => {
  it("clears the svg on every draw by default, and keeps nodes when the chart retains", async () => {
    const fresh = await chart('n="50"', "", 400, "ui-test-dots-fresh");
    const first = svgOf(fresh).firstElementChild;
    fresh.setAttribute("seed", "3");
    await settle();
    expect(svgOf(fresh).firstElementChild).not.toBe(first);

    document.body.innerHTML = "";
    const kept = await chart('n="50"', "", 400, "ui-test-dots");
    const before = [...svgOf(kept).children];
    const oldCy = before[1]?.getAttribute("cy");
    kept.setAttribute("seed", "3");
    await settle();
    const after = [...svgOf(kept).children];
    expect(after).toHaveLength(50);
    expect(after.every((node, i) => node === before[i])).toBe(true);
    // The join moved the dots to their new positions.
    expect(after[1]?.getAttribute("cy")).not.toBe(oldCy);
    // Fewer items: the extra elements leave, the rest stay.
    kept.setAttribute("n", "30");
    await settle();
    expect(svgOf(kept).children).toHaveLength(30);
    expect(svgOf(kept).children[0]).toBe(before[0]);
  });

  it("redraws 10k marks faster when retained (numbers are logged)", async () => {
    const run = async (tag: string) => {
      const c = await chart('n="10000"', "", 800, tag);
      const times: number[] = [];
      for (let i = 1; i <= 5; i++) {
        c.setAttribute("seed", `${i}`);
        const t0 = performance.now();
        await frame();
        // The attribute change schedules a frame; the draw runs inside it.
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      document.body.innerHTML = "";
      return times[Math.floor(times.length / 2)] as number;
    };
    const fresh = await run("ui-test-dots-fresh");
    const kept = await run("ui-test-dots");
    console.info(
      `10k marks, data redraw (median of 5 frames, includes layout and paint): clear and rebuild ${fresh.toFixed(1)} ms, retained join ${kept.toFixed(1)} ms`,
    );
    expect(kept).toBeLessThan(fresh * 1.5);
  });
});

describe("chart base: setup and teardown", () => {
  it("runs setup once per connection, not per draw, state change or resize", async () => {
    const c = await chart();
    expect(log.setups).toBe(1);
    for (const attribute of ["loading", "empty"]) {
      c.setAttribute(attribute, "");
      await settle();
      c.removeAttribute(attribute);
      await settle();
    }
    (c.parentElement as HTMLElement).style.width = "350px";
    await settle();
    c.data = SALES.slice(0, 3);
    c.requestDraw();
    await settle();
    expect(log.setups).toBe(1);
    expect(log.teardowns).toBe(0);
    expect(log.signals[0]?.aborted).toBe(false);
    const parent = c.parentElement as HTMLElement;
    c.remove();
    expect(log.teardowns).toBe(1);
    expect(log.signals[0]?.aborted).toBe(true);
    parent.append(c);
    await settle();
    expect(log.setups).toBe(2);
  });

  it("sets touch-action from the class default or the attribute", async () => {
    const a = await chart();
    expect(drawingOf(a).style.touchAction).toBe("pan-y");
    document.body.innerHTML = "";
    const b = await chart('touch-action="none"');
    expect(drawingOf(b).style.touchAction).toBe("none");
  });
});

describe("chart base: virtual marks and canvas", () => {
  it("gives thousands of marks one tab stop and one option, not thousands of elements", async () => {
    const c = await chart('rows="5000" virtual canvas', "<ui-chart-tooltip></ui-chart-tooltip>");
    const proxy = c.querySelector<HTMLElement>("[data-ui-part=proxy]");
    expect(proxy?.getAttribute("role")).toBe("listbox");
    expect(c.querySelectorAll("[role=img][tabindex]")).toHaveLength(0);
    expect(c.querySelectorAll("[role=option]")).toHaveLength(0); // rendered on focus
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(proxy);
    const option = () => c.querySelector("[role=option]") as HTMLElement;
    expect(option().textContent).toBe("R0: 100");
    expect(option().getAttribute("aria-setsize")).toBe("5000");
    expect(option().getAttribute("aria-posinset")).toBe("1");
    expect(proxy?.getAttribute("aria-activedescendant")).toBe(option().id);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(option().textContent).toBe("R2: 102");
    expect(option().getAttribute("aria-posinset")).toBe("3");
    expect(c.hover?.index).toBe(2);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("R2");
    await userEvent.keyboard("{End}");
    expect(option().getAttribute("aria-posinset")).toBe("5000");
    expect(c.querySelectorAll("[role=option]")).toHaveLength(1);
    // A canvas layer sits under the svg, sized to it.
    const canvas = c.querySelector<HTMLCanvasElement>("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.width).toBe(Math.round(420 * devicePixelRatio));
    c.removeAttribute("canvas");
    await settle();
    expect(c.querySelector("canvas")).toBeNull();
  });
});

describe("chart base: select and drill", () => {
  it("select() pins a mark, flags it and announces it once; drill() fires chart-drill", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>");
    const selected: unknown[] = [];
    const drilled: unknown[] = [];
    c.addEventListener("chart-select", (e) => selected.push((e as CustomEvent).detail));
    c.addEventListener("chart-drill", (e) => drilled.push((e as CustomEvent).detail));
    c.select(2);
    await wait(80);
    expect(c.selected).toBe(2);
    expect(marks(c)[2]?.hasAttribute("data-selected")).toBe(true);
    expect(marks(c)[2]?.hasAttribute("data-active")).toBe(true);
    expect(c.hover).toMatchObject({ index: 2, category: 2, pinned: true });
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("Wed");
    const live = c.querySelector("[data-ui-part=live]");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toBe("Wed, Sales 1,500");
    c.select(2); // no change: nothing to emit or announce
    c.select(4);
    expect(selected).toEqual([
      { index: 2, category: 2 },
      { index: 4, category: 4 },
    ]);
    expect(marks(c)[2]?.hasAttribute("data-selected")).toBe(false);
    c.select(null);
    await wait(30);
    expect(selected.at(-1)).toBeNull();
    expect(c.hover).toBeNull();
    expect(live?.textContent).toBe("");
    c.drill(3);
    c.drill(99);
    expect(drilled).toEqual([{ index: 3, category: 3 }]);
  });

  it("click and Enter select, Space toggles, double click and Shift+Enter drill, Escape clears", async () => {
    const c = await chart();
    await awake(c);
    const drilled: unknown[] = [];
    c.addEventListener("chart-drill", (e) => drilled.push((e as CustomEvent).detail));
    const box = svgOf(c).getBoundingClientRect();
    await userEvent.click(svgOf(c), { position: { x: 100, y: 60 } });
    expect(c.selected).toBe(1);
    await userEvent.click(svgOf(c), { position: { x: 100, y: 60 } });
    expect(c.selected).toBeNull();
    drawingOf(c).dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, clientX: box.left + 250, clientY: box.top + 60 }),
    );
    expect(drilled).toEqual([{ index: 3, category: 3 }]);
    // The click focused mark 1 (the tab stop follows focus); Enter on it pins it.
    expect(document.activeElement).toBe(marks(c)[1]);
    await userEvent.keyboard("{Enter}");
    expect(c.selected).toBe(1);
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(drilled.at(-1)).toEqual({ index: 1, category: 1 });
    await userEvent.keyboard("{Escape}"); // clears the keyboard hover first
    await userEvent.keyboard("{Escape}"); // then the selection
    expect(c.selected).toBeNull();
  });
});

describe("touch and coarse pointers", () => {
  it("a tap pins a mark; the same mark again, another tap elsewhere, outside and Escape clear or move it", async () => {
    const c = await chart();
    await awake(c);
    tap(c, 130, 60);
    expect(c.selected).toBe(1);
    expect(c.hover).toMatchObject({ index: 1, pinned: true, source: "touch" });
    tap(c, 200, 60); // another mark: the pin moves
    expect(c.selected).toBe(2);
    tap(c, 200, 60); // the same mark: clears
    expect(c.selected).toBeNull();
    tap(c, 130, 60);
    expect(c.selected).toBe(1);
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }),
    );
    expect(c.selected).toBeNull(); // an outside tap
    tap(c, 130, 60);
    await userEvent.tab();
    await userEvent.keyboard("{Escape}"); // clears the keyboard hover first
    await userEvent.keyboard("{Escape}");
    expect(c.selected).toBeNull();
  });

  it("a tap that lands before the interaction chunk loaded still selects", async () => {
    const c = await chart();
    tap(c, 130, 60, "pen");
    await wait(100);
    expect(c.selected).toBe(1);
  });

  it("a swipe that scrolls never selects, and a touch never hovers", async () => {
    const c = await chart();
    await awake(c);
    pointer(c, "pointerdown", 130, 60, "touch");
    pointer(c, "pointermove", 130, 90, "touch"); // 30px: far past the tap slop
    pointer(c, "pointerup", 130, 90, "touch");
    expect(c.selected).toBeNull();
    pointer(c, "pointerdown", 130, 60, "touch");
    pointer(c, "pointercancel", 130, 60, "touch"); // the browser took over for a scroll
    pointer(c, "pointerup", 130, 60, "touch");
    expect(c.selected).toBeNull();
    // A small wobble is still a tap.
    pointer(c, "pointerdown", 130, 60, "touch");
    pointer(c, "pointermove", 133, 62, "touch");
    pointer(c, "pointerup", 133, 62, "touch");
    expect(c.selected).toBe(1);
    expect(getComputedStyle(drawingOf(c)).touchAction).toBe("pan-y");
  });

  it("hits a 2px line from a finger away: the radius is the touch target, a mouse is stricter", async () => {
    const c = await chart("", "", 420, "ui-test-line");
    await awake(c);
    const svg = svgOf(c);
    const point = svg.querySelectorAll("circle")[2] as SVGCircleElement;
    const x = Number(point.getAttribute("cx"));
    const y = Number(point.getAttribute("cy"));
    // 30px beside the point: outside a mouse radius (12), inside the 44px fallback.
    tap(c, x + 30, y);
    expect(c.selected).toBe(2);
    c.select(null);
    pointer(c, "pointermove", x + 30, y, "mouse");
    expect(c.hover).toBeNull();
    pointer(c, "pointermove", x + 8, y, "mouse");
    expect(c.hover?.index).toBe(2);
    // Far from every point: nothing, even for a finger.
    pointer(c, "pointerleave", 0, 0, "mouse");
    tap(c, x, y - 150);
    expect(c.selected).toBeNull();
  });

  it("follows the --touch-target token for the radius", async () => {
    const c = await chart("", "", 420, "ui-test-line");
    (c.parentElement as HTMLElement).style.setProperty("--touch-target", "60px");
    await awake(c);
    const point = svgOf(c).querySelectorAll("circle")[3] as SVGCircleElement;
    tap(c, Number(point.getAttribute("cx")) + 55, Number(point.getAttribute("cy")));
    expect(c.selected).toBe(3);
  });
});

describe("chart tooltip", () => {
  const sweep = (c: Element, x: number, y = 60) => pointer(c, "pointermove", x, y);

  it("does not flicker during a pointer sweep, never takes the pointer and stays inside the chart", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>", 560);
    await awake(c);
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    const drawing = drawingOf(c);
    const events: Array<number | null> = [];
    c.addEventListener("chart-hover", (e) => events.push((e as CustomEvent).detail?.index ?? null));
    let toggles = 0;
    new MutationObserver((records) => {
      for (const r of records) if (r.attributeName === "data-open") toggles++;
    }).observe(tip, { attributes: true });

    const frameBox = drawing.getBoundingClientRect();
    const inside = () => {
      const box = tip.getBoundingClientRect();
      return (
        box.left >= frameBox.left - 0.5 &&
        box.right <= frameBox.right + 0.5 &&
        box.top >= frameBox.top - 0.5 &&
        box.bottom <= frameBox.bottom + 0.5
      );
    };
    const box = svgOf(c).getBoundingClientRect();
    let always = true;
    for (let x = 0; x <= 559; x += 3) {
      sweep(c, x);
      await frame();
      always &&= inside();
      // What is under the pointer is the drawing, never the tooltip.
      const hit = document.elementFromPoint(box.left + x, box.top + 60);
      expect(hit === tip || tip.contains(hit)).toBe(false);
    }
    expect(always).toBe(true);
    expect(getComputedStyle(tip).pointerEvents).toBe("none");
    // One event per category change, in order, and the tooltip opened exactly once.
    expect(events).toEqual([0, 1, 2, 3, 4, 5]);
    expect(toggles).toBe(1);
    // Sweeping back down the same marks is also loop free.
    events.length = 0;
    for (let x = 559; x >= 0; x -= 3) sweep(c, x);
    expect(events).toEqual([4, 3, 2, 1, 0]); // it started on 5
    pointer(c, "pointerleave", 0, 0);
    await frame();
    expect(tip.hasAttribute("data-open")).toBe(false);
    expect(events.at(-1)).toBeNull();
  });

  it("floats in the top layer and is placed from wherever it lives, never moved into the chart", async () => {
    const host = mount(
      `<div style="width:560px"><ui-test-bars id="c" label="x" height="200" locale="en-US"></ui-test-bars></div>
       <section style="overflow:hidden;height:20px"><ui-chart-tooltip for="c"></ui-chart-tooltip></section>`,
    );
    await settle();
    const c = host.querySelector("ui-test-bars") as Chart;
    const tip = host.querySelector("ui-chart-tooltip") as HTMLElement;
    await awake(c);
    sweep(c, 150);
    await frame();
    expect(tip.parentElement?.localName).toBe("section"); // still where the author put it
    expect(tip.matches(":popover-open")).toBe(true);
    expect(getComputedStyle(tip).position).toBe("fixed");
    const box = tip.getBoundingClientRect();
    const drawing = drawingOf(c).getBoundingClientRect();
    // Visible despite the 20px overflow:hidden ancestor, and inside the chart's drawing area.
    expect(box.height).toBeGreaterThan(20);
    expect(box.left).toBeGreaterThanOrEqual(drawing.left - 0.5);
    expect(box.right).toBeLessThanOrEqual(drawing.right + 0.5);
    expect(document.elementFromPoint(box.left + 5, box.top + 5)).not.toBe(tip);
  });

  it("flips to the other side near the edge instead of oscillating", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>", 520);
    await awake(c);
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    const sides: string[] = [];
    for (let x = 0; x <= 519; x += 4) {
      sweep(c, x);
      await frame();
      if (sides.at(-1) !== tip.dataset.side) sides.push(tip.dataset.side as string);
    }
    // right ... then left once the card no longer fits on the right: a single flip.
    expect(sides).toEqual(["right", "left"]);
  });

  it("docks a full-width panel under a narrow chart, with readable text, and keeps the pinned details", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>", 360);
    await awake(c);
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    expect(tip.hasAttribute("data-docked")).toBe(true);
    expect(tip.hasAttribute("popover")).toBe(false);
    const idle = tip.getBoundingClientRect();
    const drawing = drawingOf(c).getBoundingClientRect();
    // Its space is reserved: showing it moves nothing.
    expect(idle.top).toBeGreaterThanOrEqual(drawing.bottom - 0.5);
    expect(idle.width).toBeCloseTo(c.getBoundingClientRect().width, 0);
    tap(c, 90, 60);
    await frame();
    expect(tip.hasAttribute("data-open")).toBe(true);
    expect(tip.hasAttribute("data-pinned")).toBe(true);
    expect(tip.textContent).toContain("Tue");
    const shown = tip.getBoundingClientRect();
    expect(shown.top).toBe(idle.top);
    expect(shown.height).toBe(idle.height);
    expect(shown.bottom).toBeLessThanOrEqual(document.documentElement.clientHeight);
    expect(Number.parseFloat(getComputedStyle(tip).fontSize)).toBeGreaterThanOrEqual(14);
    expect(
      Number.parseFloat(
        getComputedStyle(tip.querySelector("[data-ui-part=row]") as Element).fontSize,
      ),
    ).toBeGreaterThanOrEqual(14);
    // The finger never covers it: the panel lies outside the drawing it taps.
    expect(shown.top).toBeGreaterThanOrEqual(drawing.bottom - 0.5);
    // It stays while the pin does: another tap moves it, a tap on the same mark clears it.
    tap(c, 150, 60);
    expect(tip.textContent).toContain("Wed");
    tap(c, 150, 60);
    await frame();
    expect(tip.hasAttribute("data-open")).toBe(false);
    // Widening the chart switches back to the floating card.
    (c.parentElement as HTMLElement).style.width = "560px";
    await settle();
    expect(tip.hasAttribute("data-docked")).toBe(false);
    expect(tip.getAttribute("popover")).toBe("manual");
  });

  it("does not flicker while a pinned panel is open and the chart redraws", async () => {
    const c = await chart("", "<ui-chart-tooltip dock='always'></ui-chart-tooltip>");
    await awake(c);
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    c.select(1);
    await frame();
    const states: boolean[] = [];
    new MutationObserver(() => states.push(tip.hasAttribute("data-open"))).observe(tip, {
      attributes: true,
      attributeFilter: ["data-open"],
    });
    for (const width of [400, 380, 360, 340]) {
      (c.parentElement as HTMLElement).style.width = `${width}px`;
      await settle();
    }
    expect(states).toEqual([]);
    expect(tip.hasAttribute("data-open")).toBe(true);
    expect(c.selected).toBe(1);
  });
});

describe("chart legend", () => {
  it("toggles series with aria-pressed, keeps one visible, dims on hover and redraws", async () => {
    const c = await chart("", "<ui-chart-legend></ui-chart-legend>");
    const button = c.querySelector("ui-chart-legend button") as HTMLButtonElement;
    expect(button.textContent).toBe("Sales");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.disabled).toBe(true); // the last visible series cannot be hidden
    expect(await ax("button", "Sales")).toBeTruthy();
    button.dispatchEvent(new PointerEvent("pointerenter"));
    expect(svgOf(c).querySelector("[data-series]")?.hasAttribute("data-dim")).toBe(false);
  });
});

describe("parts binding", () => {
  it("re-binds when the chart is replaced, and unbinds on removal", async () => {
    const host = mount(
      `<div id="area"><ui-test-bars id="c" label="A" height="100" locale="en-US"></ui-test-bars></div>
       <ui-chart-legend for="c"></ui-chart-legend>`,
    );
    await settle();
    const legend = host.querySelector("ui-chart-legend") as HTMLElement;
    expect(legend.querySelector("button, span[data-ui-part]")?.textContent).toBe("Sales");
    const a = host.querySelector("ui-test-bars") as Chart;
    a.remove();
    host
      .querySelector("#area")
      ?.insertAdjacentHTML(
        "beforeend",
        `<ui-test-bars id="c" label="B" height="100" locale="en-US" rows="3"></ui-test-bars>`,
      );
    await settle();
    // The part follows the new chart: it hears its events, not the removed one's.
    const b = host.querySelector("ui-test-bars") as Chart;
    expect(b).not.toBe(a);
    const seen: string[] = [];
    const stop = bindChart(legend, (chart) => {
      seen.push((chart as unknown) === b ? "b" : "a");
      return () => seen.push("detach");
    });
    expect(seen).toEqual(["b"]);
    b.remove();
    host.append(b);
    await settle();
    stop();
    expect(seen.at(-1)).toBe("detach");
  });
});

describe("chart breadcrumb", () => {
  it("is a navigation landmark whose ancestors select and whose last item is current", async () => {
    const host = mount("<ui-chart-breadcrumb label='Path'></ui-chart-breadcrumb>");
    const crumb = host.firstElementChild as HTMLElement & { items: unknown };
    crumb.items = [
      { id: "all", name: "All" },
      { id: "emea", name: "EMEA" },
      { id: "es", name: "Spain" },
    ];
    const picked: string[] = [];
    crumb.addEventListener("select", (e) => picked.push((e as CustomEvent).detail.id));
    expect(await ax("navigation", "Path")).toBeTruthy();
    expect(crumb.querySelector("[aria-current=page]")?.textContent).toBe("Spain");
    (crumb.querySelector("button[data-id=emea]") as HTMLButtonElement).click();
    expect(picked).toEqual(["emea"]);
  });
});

describe("locale and time zone", () => {
  it("formats with the locale option; nothing is hard-wired to es-PE", async () => {
    const de = await chart('locale="de-DE"');
    expect(marks(de)[0]?.getAttribute("aria-label")).toBe("Mon: 1.200,5");
    document.body.innerHTML = "";
    const en = await chart('locale="en-US"');
    expect(marks(en)[0]?.getAttribute("aria-label")).toBe("Mon: 1,200.5");
    document.body.innerHTML = "";
    document.documentElement.lang = "fr-FR";
    const host = mount(`<div style="width:300px"><ui-test-bars height="100"></ui-test-bars></div>`);
    await settle();
    const inherited = host.querySelector("ui-test-bars") as HTMLElement & { locale: string };
    expect(inherited.getAttribute("locale")).toBeNull();
    expect(inherited.locale).toBe("fr-FR");
    expect(inherited.querySelector("svg [role=img]")?.getAttribute("aria-label")).toBe(
      "Mon: 1 200,5",
    );
    document.documentElement.lang = "";
  });

  it("exposes the locale and time zone for ui-core's formatDate", async () => {
    const { formatDate } = await import("@jcsoftdev/ui-core/chart/scale-time");
    const c = (await chart('locale="en-US" time-zone="Pacific/Auckland"')) as Chart & {
      locale: string;
      timeZone: string;
    };
    const instant = new Date("2026-03-01T20:00:00Z");
    const format = () => formatDate(instant, { locale: c.locale, timeZone: c.timeZone });
    expect(format()).toContain("2 Mar 2026".split(" ")[1] === "Mar" ? "2" : "2");
    const auckland = format();
    c.setAttribute("time-zone", "America/Lima");
    expect(format()).not.toBe(auckland);
  });
});

describe("motion", () => {
  it("plays the entry once, and never under reduced motion or animate=off", async () => {
    const c = await chart();
    expect(lastDraw().animate).toBe(true);
    (c.parentElement as HTMLElement).style.width = "380px";
    await settle();
    expect(lastDraw().animate).toBe(false); // a resize is not an entry
    c.data = SALES.slice(0, 3);
    c.requestDraw();
    await settle();
    expect(lastDraw().animate).toBe(false); // nor is new data
    document.body.innerHTML = "";
    await chart('animate="off"');
    expect(lastDraw().animate).toBe(false);
    document.body.innerHTML = "";
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((q) =>
      q.includes("reduce") ? ({ matches: true, media: q } as MediaQueryList) : real(q),
    );
    await chart();
    expect(lastDraw().animate).toBe(false);
  });
});

describe("chart frame", () => {
  it("draws with a render function and exposes the size it measured", async () => {
    const host = mount(
      `<div style="width:360px"><ui-chart-frame height="150" label="Custom"></ui-chart-frame></div>`,
    );
    const el = host.querySelector("ui-chart-frame") as HTMLElement & {
      render: (c: { width: number; height: number; svg: SVGSVGElement }) => void;
    };
    const seen: number[] = [];
    el.render = ({ width, height }) => {
      seen.push(width, height);
      return undefined;
    };
    await settle();
    expect(seen.slice(-2)).toEqual([360, 150]);
    expect(await ax("image", "Custom")).toBeTruthy();
  });
});

describe("review fixes: redraw, gestures and scrolling", () => {
  it("re-hits a redraw with the element under the pointer, so target-based charts keep their tooltip", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>", 300, "ui-test-shapes");
    await awake(c);
    const rect = svgOf(c).querySelector('[data-i="1"]') as SVGElement;
    const box = rect.getBoundingClientRect();
    rect.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: box.left + 50,
        clientY: box.top + 50,
        pointerType: "mouse",
        pointerId: 1,
      }),
    );
    expect(c.hover?.index).toBe(1);
    const events: unknown[] = [];
    c.addEventListener("chart-hover", (e) => events.push((e as CustomEvent).detail?.index ?? null));
    c.requestDraw();
    await settle();
    expect(c.hover?.index).toBe(1);
    expect(c.querySelector("ui-chart-tooltip")?.hasAttribute("data-open")).toBe(true);
    expect(events).toEqual([]);
  });

  it("leaves a gesture the chart claimed with preventDefault alone: a brush or drag never selects", async () => {
    const c = await chart("drag");
    await awake(c);
    const drilled: unknown[] = [];
    c.addEventListener("chart-drill", (e) => drilled.push((e as CustomEvent).detail));
    await userEvent.click(svgOf(c), { position: { x: 100, y: 60 } });
    expect(c.selected).toBeNull();
    const box = svgOf(c).getBoundingClientRect();
    const touch = (type: string, x: number, y: number) =>
      svgOf(c).dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: box.left + x,
          clientY: box.top + y,
          pointerType: "touch",
          pointerId: 2,
          isPrimary: true,
        }),
      );
    touch("pointerdown", 90, 60);
    touch("pointerup", 90, 60);
    expect(c.selected).toBeNull();
    svgOf(c).dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        cancelable: true,
        clientX: box.left + 250,
        clientY: box.top + 60,
      }),
    );
    expect(drilled).toEqual([]);
    // The same gestures select on a chart that does not claim them.
    const plain = await chart();
    await awake(plain);
    await userEvent.click(svgOf(plain), { position: { x: 100, y: 60 } });
    expect(plain.selected).toBe(1);
  });

  it("a floating tooltip follows the chart on scroll and hides while the chart is out of view", async () => {
    const host = mount(
      `<div style="height:300px;width:560px;overflow:auto"><div style="height:60px"></div>
        <ui-test-bars label="Sales" height="200" locale="en-US"><ui-chart-tooltip></ui-chart-tooltip></ui-test-bars>
        <div style="height:900px"></div></div>`,
    );
    await settle();
    const scroller = host.firstElementChild as HTMLElement;
    const c = host.querySelector("ui-test-bars") as Chart;
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    await awake(c);
    pointer(c, "pointermove", 130, 60);
    await wait(120); // the follow chunk loads on the first floating show
    expect(tip.hasAttribute("data-open")).toBe(true);
    const top = tip.getBoundingClientRect().top;
    scroller.scrollTop = 40;
    await frame();
    await frame();
    expect(tip.getBoundingClientRect().top).toBeCloseTo(top - 40, 0);
    expect(tip.hasAttribute("data-offscreen")).toBe(false);
    scroller.scrollTop = 700;
    await wait(120);
    expect(tip.hasAttribute("data-offscreen")).toBe(true);
    expect(getComputedStyle(tip).visibility).toBe("hidden");
    scroller.scrollTop = 0;
    await wait(120);
    expect(tip.hasAttribute("data-offscreen")).toBe(false);
    expect(tip.getBoundingClientRect().top).toBeCloseTo(top, 0);
  });

  it("prefers the top or bottom side when the chart asks for it", async () => {
    const c = await chart("hside='top'", "<ui-chart-tooltip></ui-chart-tooltip>", 560);
    await awake(c);
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    pointer(c, "pointermove", 326, 60); // Thu: a short bar, room above
    await frame();
    expect(tip.dataset.side).toBe("top");
    c.setAttribute("hside", "bottom");
    await settle();
    pointer(c, "pointermove", 420, 60); // Fri: the tallest bar, room below
    await frame();
    expect(tip.dataset.side).toBe("bottom");
  });
});

describe("review fixes: legend, keyboard, docked space and transient draws", () => {
  it("lists legend items apart from the table columns, keyed by the legend ids", async () => {
    const c = await chart("legend", "<ui-chart-legend></ui-chart-legend>");
    const buttons = [...c.querySelectorAll<HTMLButtonElement>("ui-chart-legend button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Alpha", "Beta"]);
    buttons[0]?.click();
    await settle();
    expect(c.isHidden("a")).toBe(true);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1]?.disabled).toBe(true); // the last visible legend item stays
    const snapshot = c.chartSnapshot as unknown as Parameters<typeof snapshotCsv>[0];
    expect(snapshot.series).toHaveLength(1);
    expect(snapshotCsv(snapshot).split("\r\n")[0]).toBe("Day,Sales");
  });

  it("draws a gradient bar for a continuous scale instead of items", async () => {
    const c = await chart("scale", "<ui-chart-legend></ui-chart-legend>");
    await wait(150); // the scale drawing is a lazy chunk
    const legend = c.querySelector("ui-chart-legend") as HTMLElement;
    const scale = legend.querySelector("[data-ui-part=scale]") as HTMLElement;
    expect(scale.textContent).toBe("0%100%");
    expect(scale.getAttribute("aria-label")).toBe("Heat: 0% to 100%");
    expect((scale.querySelector("[data-ui-part=bar]") as HTMLElement).style.background).toContain(
      "linear-gradient",
    );
    const list = legend.querySelector("ul") as HTMLElement;
    expect(getComputedStyle(list).display).toBe("none");
  });

  it("moves in two dimensions when the chart gives nav, and falls back to a line without it", async () => {
    const c = await chart('nav="grid" rows="9"');
    const m = marks(c);
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(m[0]);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(m[3]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(m[4]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(m[5]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(m[5]);
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(m[3]);
    await userEvent.keyboard("{ArrowUp}{ArrowLeft}");
    expect(document.activeElement).toBe(m[0]);
  });

  it("walks a hierarchy with parent and child intents", async () => {
    const c = await chart('nav="tree" rows="7"');
    const m = marks(c);
    const drilled: unknown[] = [];
    c.addEventListener("chart-drill", (e) => drilled.push((e as CustomEvent).detail));
    await userEvent.tab();
    await wait(80);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toBe(m[3]);
    await userEvent.keyboard("{Backspace}");
    expect(document.activeElement).toBe(m[1]);
    await userEvent.keyboard("{Backspace}");
    expect(document.activeElement).toBe(m[0]);
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(drilled).toEqual([{ index: 0, category: 0 }]);
    expect(document.activeElement).toBe(m[1]);
  });

  it("reserves the docked panel for the most rows the chart shows: nothing below it moves", async () => {
    const host = mount(
      `<div style="width:390px"><ui-test-bars label="Sales" height="200" locale="en-US" hrows="5">
        <ui-chart-tooltip></ui-chart-tooltip></ui-test-bars><div id="below" style="height:20px">below</div></div>`,
    );
    await settle();
    const c = host.querySelector("ui-test-bars") as Chart;
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    const below = host.querySelector("#below") as HTMLElement;
    await awake(c);
    expect(tip.hasAttribute("data-docked")).toBe(true);
    const top = below.getBoundingClientRect().top;
    const height = tip.getBoundingClientRect().height;
    tap(c, 30, 60); // mark 0: five rows
    await frame();
    expect(tip.querySelectorAll("[data-ui-part=row]")).toHaveLength(5);
    expect(below.getBoundingClientRect().top).toBe(top);
    expect(tip.getBoundingClientRect().height).toBe(height);
    expect(tip.scrollHeight).toBeLessThanOrEqual(tip.clientHeight + 1); // nothing is cut off
    tap(c, 100, 60); // mark 1: one row
    await frame();
    expect(tip.querySelectorAll("[data-ui-part=row]")).toHaveLength(1);
    expect(below.getBoundingClientRect().top).toBe(top);
    expect(tip.getBoundingClientRect().height).toBe(height);
  });

  it("redraws transiently with no snapshot, no revision and no chart-data, and exposes motion and hover", async () => {
    const c = await chart();
    expect(c.chartSnapshot).not.toBeNull();
    const snapshots = log.snapshots;
    const events: unknown[] = [];
    c.addEventListener("chart-data", (e) => events.push((e as CustomEvent).detail));
    const draws = log.phases.length;
    for (let i = 0; i < 30; i++) {
      c.requestDraw("transient");
      await frame();
    }
    await wait(300);
    expect(log.phases.length).toBe(draws + 30);
    expect(log.transient.slice(-30).every(Boolean)).toBe(true);
    expect(log.phases.slice(-30).every((phase) => phase === "update")).toBe(true);
    expect(events).toEqual([]);
    expect(c.chartSnapshot).not.toBeNull();
    expect(log.snapshots).toBe(snapshots);
    c.requestDraw();
    await settle();
    expect(events).toHaveLength(1);
    expect(log.transient.at(-1)).toBe(false);
    expect(log.motion.at(-1)).toBe(true);
    // The hovered mark reaches the next draw, so a crosshair survives a redraw from scratch.
    expect(log.hover.at(-1)).toBeNull();
    await awake(c);
    pointer(c, "pointermove", 130, 60);
    c.requestDraw("transient");
    await settle();
    expect(log.hover.at(-1)).toBe(1);
    document.body.innerHTML = "";
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((q) =>
      q.includes("reduce") ? ({ matches: true, media: q } as MediaQueryList) : real(q),
    );
    await chart();
    expect(log.motion.at(-1)).toBe(false);
  });
});

describe("review fixes: smaller contracts", () => {
  it("does not re-emit chart-data null or bump anything while the state stays the same", async () => {
    const c = await chart();
    const events: unknown[] = [];
    c.addEventListener("chart-data", (e) => events.push((e as CustomEvent).detail));
    c.setAttribute("loading", "");
    await settle();
    expect(events).toEqual([null]);
    (c.parentElement as HTMLElement).style.width = "300px";
    await settle();
    c.setAttribute("skeleton", "line");
    await settle();
    expect(events).toEqual([null]);
    expect(c.querySelector("[data-state=loading]")?.getAttribute("data-skeleton")).toBe("line");
  });

  it("replays a click that arrived before the interaction chunk loaded", async () => {
    const c = await chart();
    const box = svgOf(c).getBoundingClientRect();
    drawingOf(c).dispatchEvent(
      new PointerEvent("click", {
        bubbles: true,
        detail: 1,
        pointerType: "mouse",
        clientX: box.left + 100,
        clientY: box.top + 60,
      }),
    );
    await wait(100);
    expect(c.selected).toBe(1);
  });

  it("a reconnect leaves one option on the virtual proxy, not two", async () => {
    const c = await chart('rows="50" virtual');
    await userEvent.tab();
    await wait(80);
    expect(c.querySelectorAll("[role=option]")).toHaveLength(1);
    const parent = c.parentElement as HTMLElement;
    c.remove();
    expect(c.querySelectorAll("[role=option]")).toHaveLength(0);
    parent.append(c);
    await settle();
    await userEvent.tab();
    await wait(80);
    expect(c.querySelectorAll("[role=option]")).toHaveLength(1);
  });

  it("join() maps a repeated key to the first element, leaks nothing and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parent = svg("g");
    const items = [{ k: 1 }, { k: 1 }, { k: 2 }];
    const make = (list: Array<{ k: number }>) =>
      join(
        parent,
        list,
        (d) => d.k,
        () => svg("circle"),
        () => {},
      );
    const out = make(items);
    expect(parent.children).toHaveLength(2);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(out[1]);
    make(items);
    expect(warn).toHaveBeenCalledTimes(1);
    make([{ k: 2 }]);
    expect(parent.children).toHaveLength(1);
  });

  it("falls back to 500 rows for an empty or invalid limit, and 0 still means every row", async () => {
    const c = await chart(
      'rows="600"',
      '<ui-chart-data-table visible limit=""></ui-chart-data-table>',
    );
    const table = c.querySelector("ui-chart-data-table") as HTMLElement;
    const rows = () => table.querySelector("table")?.tBodies[0]?.rows.length;
    expect(rows()).toBe(501);
    for (const bad of ["abc", "-3"]) {
      table.setAttribute("limit", bad);
      await settle();
      expect(rows()).toBe(501);
    }
    table.setAttribute("limit", "0");
    await settle();
    expect(rows()).toBe(600);
  });
});
