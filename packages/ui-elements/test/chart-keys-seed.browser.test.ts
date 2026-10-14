import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineChartLegend } from "../src/chart-legend/chart-legend.ts";
import { defineChartTooltip } from "../src/chart-tooltip/chart-tooltip.ts";
import { defineTestKeyed } from "./chart-fixture.ts";
import { frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineTestKeyed();
  defineChartTooltip();
  defineChartLegend();
});
afterEach(() => {
  document.body.innerHTML = "";
});
const settle = async () => {
  for (let i = 0; i < 4; i++) await frame();
  await wait(60);
};
type Keyed = HTMLElement & {
  names: string[];
  drawn: string[];
  selected: number | null;
  select(i: number | null): void;
  requestDraw(): void;
  isHidden(id: string): boolean;
};
const rects = (c: HTMLElement) => [...c.querySelectorAll("rect")];

describe("markKey", () => {
  it("keeps pin, tooltip, data-active and the roving tab stop on the same entity after a reorder", async () => {
    const host = mount(
      '<div style="width:200px"><ui-test-keyed height="60" id="k"><ui-chart-tooltip></ui-chart-tooltip></ui-test-keyed></div>',
    );
    const c = host.querySelector("#k") as Keyed;
    await settle();
    const selects: unknown[] = [];
    c.addEventListener("chart-select", (e) => selects.push((e as CustomEvent).detail));
    c.select(1); // "b"
    await settle();
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("b");
    c.names = ["d", "c", "b", "a"];
    c.requestDraw();
    await settle();
    expect(c.selected).toBe(2);
    expect(rects(c)[2]?.hasAttribute("data-selected")).toBe(true);
    expect(rects(c)[2]?.hasAttribute("data-active")).toBe(true);
    expect(c.querySelector("ui-chart-tooltip")?.textContent).toContain("b");
    expect(rects(c).map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "-1", "-1", "0"]); // the tab stop was on "a"
    expect(selects).toEqual([{ index: 1, category: 1 }]);
  });
});

describe("initial-hidden", () => {
  it("seeds the hidden set before the first draw, silently", async () => {
    const events: unknown[] = [];
    const host = mount(
      `<div style="width:200px"><ui-test-keyed height="60" id="k" initial-hidden='["hid"]'></ui-test-keyed></div>`,
    );
    const c = host.querySelector("#k") as Keyed;
    c.addEventListener("chart-series", (e) => events.push(e));
    await settle();
    expect(c.isHidden("hid")).toBe(true);
    expect(c.drawn).toEqual(["no-hid"]);
    expect(events).toEqual([]);
  });
});
