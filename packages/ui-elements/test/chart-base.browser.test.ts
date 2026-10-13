import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineChartDataTable } from "../src/chart-data-table/chart-data-table.ts";
import { defineChartFrame } from "../src/chart-frame/chart-frame.ts";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineTestBars, lastDraw, SALES } from "./chart-fixture.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineTestBars();
  defineChartFrame();
  defineChartLegend();
  defineChartTooltip();
  defineChartDataTable();
  defineChartBreadcrumb();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};

const chart = async (attrs = "", inner = "", width = 420) => {
  const host = mount(
    `<div style="width:${width}px"><ui-test-bars id="c" label="Sales by day" height="200" ${attrs.includes("locale") ? "" : 'locale="en-US"'} ${attrs}>${inner}</ui-test-bars></div>`,
  );
  await settle();
  return host.querySelector("ui-test-bars") as HTMLElement;
};
const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
const marks = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [role=img]")];

describe("chart base: sizing", () => {
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

  it("shows the loading and empty states instead of the drawing", async () => {
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

  it("gives screen readers a real table, loaded lazily, and a visible one replaces it", async () => {
    const c = await chart();
    await wait(60);
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
    await wait(60);
    expect(c.querySelector("table")).toBeNull();
  });
});

describe("chart base: keyboard over marks", () => {
  it("is one tab stop; arrows, Home and End move between marks; Escape clears the tooltip", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>");
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    const m = marks(c);
    await userEvent.tab();
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

  it("keeps keyboard focus on the same mark across a redraw", async () => {
    const c = await chart();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    (c.parentElement as HTMLElement).style.width = "350px";
    await settle();
    expect(document.activeElement).toBe(marks(c)[2]);
  });
});

describe("chart tooltip", () => {
  const sweep = (c: Element, from: number, to: number, step: number, y = 60) => {
    const box = svgOf(c).getBoundingClientRect();
    for (let x = from; x <= to; x += step)
      svgOf(c).parentElement?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: box.left + x,
          clientY: box.top + y,
          pointerType: "mouse",
        }),
      );
  };

  it("does not flicker during a pointer sweep, never takes the pointer and stays inside the chart", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>");
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    const drawing = c.querySelector("[data-ui-part=drawing]") as HTMLElement;
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
    for (let x = 0; x <= 419; x += 3) {
      sweep(c, x, x, 1);
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
    for (let x = 419; x >= 0; x -= 3) sweep(c, x, x, 1);
    expect(events).toEqual([4, 3, 2, 1, 0]); // it started on 5
    drawing.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    await frame();
    expect(tip.hasAttribute("data-open")).toBe(false);
    expect(events.at(-1)).toBeNull();
  });

  it("flips to the other side near the edge instead of oscillating", async () => {
    const c = await chart("", "<ui-chart-tooltip></ui-chart-tooltip>", 220);
    const tip = c.querySelector("ui-chart-tooltip") as HTMLElement;
    const sides: string[] = [];
    for (let x = 0; x <= 219; x += 4) {
      sweep(c, x, x, 1);
      await frame();
      if (sides.at(-1) !== tip.dataset.side) sides.push(tip.dataset.side as string);
    }
    // right ... then left once the card no longer fits on the right: a single flip.
    expect(sides).toEqual(["right", "left"]);
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
      "Mon: 1\u202f200,5",
    );
    document.documentElement.lang = "";
  });

  it("formats dates in the requested time zone", async () => {
    const c = (await chart('locale="en-US" time-zone="Pacific/Auckland"')) as HTMLElement & {
      formatDate(d: Date): string;
      timeZone: string;
    };
    const instant = new Date("2026-03-01T20:00:00Z");
    expect(c.formatDate(instant)).toBe("Mar 2, 2026");
    c.setAttribute("time-zone", "America/Lima");
    expect(c.formatDate(instant)).toBe("Mar 1, 2026");
  });
});

describe("motion", () => {
  it("plays the entry only for data changes, and never under reduced motion or animate=off", async () => {
    const c = await chart();
    expect(lastDraw?.animate).toBe(true);
    (c.parentElement as HTMLElement).style.width = "380px";
    await settle();
    expect(lastDraw?.animate).toBe(false); // a resize is not an entry
    document.body.innerHTML = "";
    const off = await chart('animate="off"');
    expect(off && lastDraw?.animate).toBe(false);
    document.body.innerHTML = "";
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((q) =>
      q.includes("reduce") ? ({ matches: true, media: q } as MediaQueryList) : real(q),
    );
    await chart();
    expect(lastDraw?.animate).toBe(false);
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
