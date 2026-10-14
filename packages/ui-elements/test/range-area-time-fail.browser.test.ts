import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineRangeAreaChart } from "../src/range-area-chart/range-area-chart.ts";
import { chart, svgOf } from "./e18-fixture.ts";

// The chunk fetch rejects, as a 404 would.
vi.mock("../src/range-area-chart/time-axis-chunk.ts", () => ({
  importTimeAxis: () => Promise.reject(new Error("chunk 404")),
}));

beforeAll(() => defineRangeAreaChart());
afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-range-area-chart when the time-axis chunk fails", () => {
  it("falls back to the point axis, warns once and does not stay blank", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = await chart("ui-range-area-chart", {
      attrs: 'value-format="integer"',
      width: 520,
      setup: (el) => {
        el.categories = [new Date(Date.UTC(2026, 0, 5)), new Date(Date.UTC(2026, 0, 6))];
        el.bands = [{ id: "a", name: "A", min: [1, 2], max: [5, 6] }];
      },
    });
    await vi.waitFor(() => expect(svgOf(c).querySelectorAll("path").length).toBeGreaterThan(0));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
