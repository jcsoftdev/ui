// The shared body of the hierarchy charts, through the sunburst: breadcrumb binding, swipes, the
// node behind a mark, legend hiding and the cost of a large tree.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineChartBreadcrumb } from "../src/chart-breadcrumb/chart-breadcrumb.ts";
import { defineSunburstChart } from "../src/sunburst-chart/sunburst-chart.ts";
import {
  awake,
  centerOf,
  type HierarchyEl,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  settle,
  tap,
} from "./hierarchy-helpers.ts";
import { mount, wait } from "./setup.ts";

type Chart = HierarchyEl & {
  toggleSeries(id: string): void;
  isHidden(id: string): boolean;
  nodeAt(index: number): { id: string; name: string; depth: number; value: number } | undefined;
};

beforeAll(() => defineSunburstChart());
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const TAG = "ui-sunburst-chart";
const crumbItems = (id: string) =>
  ((document.getElementById(id) as unknown as { items?: Array<{ id: string }> }).items ?? []).map(
    (item) => item.id,
  );

describe("hierarchy charts: breadcrumb", () => {
  it("is wired whichever is defined first, and follows every zoom at once", async () => {
    // The breadcrumb element exists in the page but its class is not defined yet.
    const host = mount(
      `<div style="width:480px"><ui-sunburst-chart label="Headcount" height="320" locale="en-US" breadcrumb="late-crumb"></ui-sunburst-chart><ui-chart-breadcrumb id="late-crumb"></ui-chart-breadcrumb></div>`,
    );
    const c = host.querySelector(TAG) as Chart;
    c.data = (await mountChart(TAG)).data;
    await settle();
    defineChartBreadcrumb();
    await expect.poll(() => crumbItems("late-crumb")).toEqual(["root"]);
    c.zoomTo("root/Engineering");
    // No draw has run yet: the path is pushed by the zoom itself.
    expect(crumbItems("late-crumb")).toEqual(["root", "root/Engineering"]);
    c.zoomOut();
    expect(crumbItems("late-crumb")).toEqual(["root"]);
  });
});

describe("hierarchy charts: touch", () => {
  it("does not open a pinned node when a swipe ends on it", async () => {
    const c = (await mountChart(TAG, 'animate="off"')) as Chart;
    await awake(c);
    const [x, y] = centerOf(c, "Sales:");
    tap(c, x, y);
    await settle();
    expect(c.selected).not.toBeNull();
    pointer(c, "pointerdown", x - 8, y, "touch");
    pointer(c, "pointerup", x + 8, y, "touch");
    await settle();
    expect(c.focusId).toBe("root");
    tap(c, x, y);
    await settle();
    expect(c.focusId).toBe("root/Sales");
  });

  it("says the second tap opens, not a double click", async () => {
    const c = (await mountChart(TAG, 'animate="off"')) as Chart;
    await awake(c);
    const [x, y] = centerOf(c, "Sales:");
    tap(c, x, y);
    await settle();
    const rows = (c.hover as unknown as { rows: Array<{ name: string }> }).rows;
    expect(rows.some((row) => /tap again/i.test(row.name))).toBe(true);
  });
});

describe("hierarchy charts: the node behind a mark", () => {
  it("names the node of the selected mark", async () => {
    const c = (await mountChart(TAG)) as Chart;
    await awake(c);
    const [x, y] = centerOf(c, "Sales:");
    pointer(c, "pointermove", x, y);
    c.select(c.hover?.index ?? null);
    await settle();
    expect(c.nodeAt(c.selected as number)).toMatchObject({
      id: "root/Sales",
      name: "Sales",
      depth: 1,
      value: 400,
    });
    expect(c.nodeAt(99)).toBeUndefined();
  });
});

describe("hierarchy charts: hiding a branch", () => {
  it("keeps the real share of the parent and the other branches' labels", async () => {
    const c = (await mountChart(TAG)) as Chart;
    await awake(c);
    const label = (name: string) =>
      marksOf(c)
        .map((m) => m.getAttribute("aria-label"))
        .find((l) => l?.startsWith(name));
    expect(label("Engineering:")).toBe("Engineering: 900 (63%)");
    c.toggleSeries("root/Support");
    await settle();
    expect(c.isHidden("root/Support")).toBe(true);
    expect(label("Support")).toBeUndefined();
    // Shares are of the whole Company (1,420), not renormalized to the 1,300 left.
    expect(label("Engineering:")).toBe("Engineering: 900 (63%)");
  });

  it("shows hidden branches again once the open node changes", async () => {
    const c = (await mountChart(TAG, 'animate="off"')) as Chart;
    await awake(c);
    c.toggleSeries("root/Support");
    await settle();
    expect(c.isHidden("root/Support")).toBe(true);
    c.zoomTo("root/Sales");
    await settle();
    expect(c.isHidden("root/Support")).toBe(false);
    c.zoomOut();
    await settle();
    expect(marksOf(c).some((m) => m.getAttribute("aria-label")?.startsWith("Support"))).toBe(true);
  });
});

describe("hierarchy charts: a large tree", () => {
  const tree = (groups: number) => ({
    name: "Big",
    children: Array.from({ length: groups }, (_, g) => ({
      name: `G${g}`,
      children: Array.from({ length: 15 }, (_, h) => ({
        name: `H${g}.${h}`,
        children: Array.from({ length: 20 }, (_, l) => ({ name: `L${g}.${h}.${l}`, value: 1 + l })),
      })),
    })),
  });
  /** Best of three frames, in ms, to draw `groups` x 300 nodes. */
  const drawTime = async (groups: number) => {
    const c = (await mountChart(TAG, 'animate="off" levels="3"')) as Chart;
    c.data = tree(groups);
    await settle();
    await wait(100);
    const spans: number[] = [];
    for (let run = 0; run < 3; run += 1) {
      let start = 0;
      requestAnimationFrame(() => {
        start = performance.now();
      });
      c.requestDraw();
      spans.push(
        await new Promise<number>((resolve) =>
          requestAnimationFrame(() => resolve(performance.now() - start)),
        ),
      );
      await wait(50);
    }
    document.body.innerHTML = "";
    return Math.min(...spans);
  };

  it("draws in near-linear time: four times the nodes costs far less than sixteen times", async () => {
    // A quadratic colour lookup would cost 16x for 4x the nodes; a linear draw costs about 4x.
    // The ratio does not depend on how fast or loaded the machine is.
    const small = await drawTime(5);
    const large = await drawTime(20);
    expect(large / Math.max(small, 1)).toBeLessThan(9);
  });
});
