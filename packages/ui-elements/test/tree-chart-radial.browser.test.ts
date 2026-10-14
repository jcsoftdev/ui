// A radial tree lays out once per data change, however often it redraws or resizes.

import { radialTreeLayout } from "@jcsoftdev/ui-core/chart/tree-radial";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { UiTreeChart } from "../src/tree-chart/tree-chart.ts";
import { defineTreeChart } from "../src/tree-chart/tree-chart.ts";
import { frame, mount, wait } from "./setup.ts";

vi.mock("@jcsoftdev/ui-core/chart/tree-radial", { spy: true });

beforeAll(() => defineTreeChart());
afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-tree-chart radial layout", () => {
  it("runs once for a data change, not once per draw or resize", async () => {
    const host = mount(
      '<div style="width:700px"><ui-tree-chart layout="radial" label="Org" height="420" animate="off"></ui-tree-chart></div>',
    );
    const chart = host.querySelector("ui-tree-chart") as UiTreeChart;
    chart.data = {
      name: "A",
      children: [{ name: "B", children: [{ name: "C" }] }, { name: "D" }],
    } as never;
    await expect
      .poll(() => vi.mocked(radialTreeLayout).mock.calls.length, { timeout: 5000 })
      .toBeGreaterThan(0);
    await wait(100);
    const first = vi.mocked(radialTreeLayout).mock.calls.length;
    for (const width of [600, 500, 700]) {
      (host as HTMLElement).style.width = `${width}px`;
      chart.requestDraw();
      await frame();
      await frame();
      await wait(60);
    }
    expect(vi.mocked(radialTreeLayout).mock.calls.length).toBe(first);
  });
});
