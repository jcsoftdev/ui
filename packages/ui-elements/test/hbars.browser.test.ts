import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineHbars, type UiHbars } from "../src/hbars/hbars.ts";
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
  defineHbars();
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

const series = [
  { id: "cuts", label: "Cuts" },
  { id: "beards", label: "Beards" },
] as const;
const rows = [
  { id: "diego", name: "Diego Quispe", values: [12, 6] },
  { id: "mateo", name: "Mateo Flores", values: [9, 4] },
  { id: "andres", name: "Andres Paredes", values: [3, 1], tone: "danger" as const },
] as const;
const bars = async (attrs = "", inner = "") => {
  const c = await chartOf<UiHbars>(
    "ui-hbars",
    `scale-max="20" name-header="Barber" description="Cuts and beards per barber" ${attrs}`,
    420,
    inner,
  );
  c.series = series;
  c.rows = rows as unknown as UiHbars["rows"];
  c.ticks = [
    { position: 0, label: "0" },
    { position: 50, label: "10" },
    { position: 100, label: "20" },
  ];
  await settle();
  return c;
};
const bands = (c: Element) => [...c.querySelectorAll<SVGElement>("rect[data-row]")];

describe("ui-hbars", () => {
  it("sizes itself to its rows and draws a stacked bar per row with the sum as the value", async () => {
    const c = await bars();
    expect(c.getAttribute("height")).toBe("134"); // 14 + 3 rows * 22 + 2 gaps * 10 + 10 + 16 ticks + 8
    expect(bands(c)).toHaveLength(3);
    expect(c.textContent).toContain("18"); // 12 + 6
    expect(c.textContent).toContain("Diego Quis…"); // 86px name column in a narrow frame, like the React truncate
    expect(bands(c)[0]?.getAttribute("aria-label")).toBe("Diego Quispe: Cuts 12, Beards 6");
  });

  it("pairs the series on one scale and shows both numbers", async () => {
    const c = await bars('variant="paired"');
    expect(c.querySelectorAll("rect[data-fill]")).toHaveLength(6);
    expect(c.querySelectorAll("tspan")).toHaveLength(6);
    const w = [...c.querySelectorAll("rect[data-fill]")].map((r) =>
      Number(r.getAttribute("width")),
    );
    expect(w[0]).toBeGreaterThan(w[1] as number);
  });

  it("hovers a row without flicker and lists the values, with the total when stacked", async () => {
    const c = await bars("", "<ui-chart-tooltip></ui-chart-tooltip>");
    await awake(c);
    const events = hoverLog(c);
    for (let y = 8; y <= 100; y += 3) sweep(c, 200, y);
    expect(events).toEqual([0, 1, 2]);
    expect(c.hover?.rows.map((r) => r.name)).toEqual(["Cuts", "Beards", "Total"]);
    expect(c.hover?.rows[2]?.value).toBe("4");
  });

  it("is one tab stop with arrows, Home and End, and a tap pins a row", async () => {
    const c = await bars();
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(bands(c)[0]);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toBe(bands(c)[2]);
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(bands(c)[0]);
    tap(c, 200, 50);
    await wait(60);
    expect(c.selected).toBe(1);
  });

  it("draws the threshold, hides a series from the legend and keeps the data table in sync", async () => {
    const c = await bars('threshold="15"', "<ui-chart-legend></ui-chart-legend>");
    expect(c.querySelectorAll('line[stroke-dasharray="3 3"]')).toHaveLength(3);
    expect(c.chartSnapshot?.categoryHeader).toBe("Barber");
    expect(c.chartSnapshot?.series.map((s) => s.text[0])).toEqual(["12", "6"]);
    c.toggleSeries("beards");
    await settle();
    expect(c.textContent).toContain("12");
    expect(c.hover).toBeNull();
  });

  it("formats numbers in the locale and passes axe", async () => {
    const c = await bars('locale="de-DE"');
    c.rows = [{ id: "x", name: "X", values: [1234.5, 100] }];
    await settle();
    expect(c.textContent).toContain("1.334,5");
    expect(await violations(c)).toEqual([]);
  });
});
