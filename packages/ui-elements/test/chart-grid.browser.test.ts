import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { type ChartGridContext, defineChartGrid } from "../src/chart-grid/chart-grid.ts";
import { ax, frame, mount, wait } from "./setup.ts";
import { violations } from "./unit-chart-helpers.ts";

beforeAll(() => defineChartGrid());
afterEach(() => {
  document.body.innerHTML = "";
});

type Grid = HTMLElement & {
  panels: unknown;
  render: unknown;
  legend: unknown;
  readonly columns: number;
};

const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};
const PANELS = [
  { id: "ana", title: "Ana", subtitle: "S/ 1,200", extent: [0, 87] as const },
  { id: "ben", title: "Ben", extent: [10, 120] as const },
  { id: "caro", title: "Caro", extent: [5, 64] as const },
  { id: "dan", title: "Dan", extent: [0, 40] as const },
];

const grid = async (attrs = "", width = 720, setup?: (grid: Grid) => void) => {
  const host = mount(
    `<div style="width:${width}px"><ui-chart-grid label="By barber" ${attrs}></ui-chart-grid></div>`,
  );
  const el = host.querySelector("ui-chart-grid") as Grid;
  setup?.(el);
  await settle();
  return el;
};
const withCharts = (el: Grid) => {
  el.panels = PANELS;
  el.render = () => {
    const chart = document.createElement("div");
    chart.setAttribute("data-ui-chart", "");
    return chart;
  };
};

describe("ui-chart-grid", () => {
  it("fits the columns to its own width, never the viewport, and follows a resize", async () => {
    const el = await grid("", 720, withCharts);
    // (720 + 16) / (220 + 16) = 3 columns.
    expect(el.columns).toBe(3);
    expect(el.querySelector<HTMLElement>("[data-ui-part=panels]")?.style.gridTemplateColumns).toBe(
      "repeat(3, minmax(0px, 1fr))",
    );
    (el.parentElement as HTMLElement).style.width = "400px";
    await settle();
    expect(el.columns).toBe(1);
    (el.parentElement as HTMLElement).style.width = "1400px";
    await settle();
    expect(el.columns).toBe(4);
  });

  it("shares one nice value domain and one height with every panel", async () => {
    const seen: ChartGridContext[] = [];
    const el = await grid('include-zero panel-height="200"', 720, (g) => {
      g.panels = PANELS;
      g.render = () => {
        const chart = document.createElement("div");
        chart.setAttribute("data-ui-chart", "");
        chart.addEventListener("chart-grid-context", (event) =>
          seen.push((event as CustomEvent<ChartGridContext>).detail),
        );
        return chart;
      };
    });
    const last = PANELS.map((_, i) => seen.filter((ctx) => ctx.index === i).at(-1));
    expect(
      last.every((ctx) => ctx?.valueDomain?.[0] === 0 && (ctx.valueDomain[1] ?? 0) >= 120),
    ).toBe(true);
    expect(new Set(last.map((ctx) => ctx?.valueDomain?.join())).size).toBe(1);
    expect(last.every((ctx) => ctx?.height === 200)).toBe(true);
    expect(el.querySelectorAll("[data-ui-chart]")[0]?.getAttribute("height")).toBe("200");
    el.setAttribute("shared-value-domain", "off");
    await settle();
    expect(seen.at(-1)?.valueDomain).toBeUndefined();
  });

  it("names each panel by its heading and takes panels from its children", async () => {
    const host = mount(`<div style="width:720px"><ui-chart-grid label="By barber" bordered>
      <div data-title="Ana" data-subtitle="S/ 1,200" data-extent="0,87"><b>chart a</b></div>
      <div data-title="Ben" data-extent="10,120"><b>chart b</b></div>
    </ui-chart-grid></div>`);
    await settle();
    const el = host.querySelector("ui-chart-grid") as Grid;
    expect(el.querySelectorAll("article")).toHaveLength(2);
    expect(el.querySelector("article h3")?.textContent).toBe("Ana");
    expect(el.querySelector("article")?.getAttribute("aria-labelledby")).toBe(
      el.querySelector("article h3")?.id,
    );
    expect(el.querySelector("article [data-ui-part=body] b")?.textContent).toBe("chart a");
    expect(await ax("group", "By barber")).toBeTruthy();
  });

  it("highlights from the shared legend and shows the empty text without panels", async () => {
    const seen: Array<string | null> = [];
    const ctxs: Array<string | null> = [];
    const el = await grid("", 720, (g) => {
      withCharts(g);
      g.legend = [
        { id: "cuts", name: "Cuts", color: "var(--chart-cat-1)" },
        { id: "beards", name: "Beards", color: "var(--chart-cat-2)" },
      ];
      g.addEventListener("chart-grid-highlight", (event) =>
        seen.push((event as CustomEvent).detail.id),
      );
    });
    el.querySelector("[data-ui-chart]")?.addEventListener("chart-grid-context", (event) =>
      ctxs.push((event as CustomEvent<ChartGridContext>).detail.highlight),
    );
    const beards = el.querySelectorAll<HTMLElement>(
      "[data-ui-part=legend] button",
    )[1] as HTMLElement;
    beards.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    await settle();
    expect(seen).toEqual(["beards"]);
    expect(ctxs.at(-1)).toBe("beards");
    el.querySelector("[data-ui-part=legend]")?.dispatchEvent(new PointerEvent("pointerleave"));
    expect(seen).toEqual(["beards", null]);
    el.panels = [];
    await settle();
    expect(el.querySelector("[data-ui-part=empty]")?.textContent).toBe("No data");
  });

  it("passes axe", async () => {
    const el = await grid("bordered", 720, withCharts);
    expect(await violations(el)).toEqual([]);
  });
});
