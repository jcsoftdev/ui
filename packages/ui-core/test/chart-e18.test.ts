// Slope, waterfall and bullet layout maths are ports: each export is pinned to the
// React kit's source value for value. The React modules are imported at runtime, by path.
import { describe, expect, it } from "vitest";
import * as bullet from "../src/chart/bullet.ts";
import { spreadSlopeLabels } from "../src/chart/slope.ts";
import * as waterfall from "../src/chart/waterfall.ts";

// Literal paths keep the bundler happy; the import() still runs inside each test, never at load.
const react = {
  slope: () => import("../../ui/src/charts/slope-chart/label-layout.ts"),
  waterfall: () => import("../../ui/src/charts/waterfall-chart/waterfall-layout.ts"),
  bullet: () => import("../../ui/src/charts/bullet-chart/bullet-layout.ts"),
};
const load = <T>(name: keyof typeof react): Promise<T> => react[name]() as Promise<T>;

let seed = 17;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const sample = (n: number, lo = 0, hi = 100) => Array.from({ length: n }, () => between(lo, hi));

describe("slope labels", () => {
  it("matches the React spread, including the too-tight fallback", async () => {
    const react = await load<{ spreadSlopeLabels: typeof spreadSlopeLabels }>("slope");
    for (let run = 0; run < 40; run += 1) {
      const positions = sample(int(0, 14), -10, 200);
      const gap = between(4, 24);
      expect(spreadSlopeLabels(positions, gap, 0, 190)).toEqual(
        react.spreadSlopeLabels(positions, gap, 0, 190),
      );
    }
    expect(spreadSlopeLabels([5, 5, 5, 5], 20, 0, 30)).toEqual(
      react.spreadSlopeLabels([5, 5, 5, 5], 20, 0, 30),
    );
  });
});

describe("waterfall layout", () => {
  it("matches the React running totals and label picking", async () => {
    const react = await load<typeof waterfall>("waterfall");
    const types = ["start", "delta", "delta", "delta", "subtotal", "total"] as const;
    for (let run = 0; run < 30; run += 1) {
      const steps = Array.from({ length: int(1, 9) }, (_, i) => ({
        label: `s${i}`,
        value: rand() < 0.1 ? undefined : between(-80, 120),
        type: types[int(0, types.length - 1)],
      }));
      expect(waterfall.waterfallLayout(steps)).toEqual(react.waterfallLayout(steps));
      const boxes = steps.map(() => ({
        center: between(0, 300),
        width: between(10, 60),
        y: between(0, 80),
      }));
      expect(waterfall.pickLabels(boxes)).toEqual(react.pickLabels(boxes));
      expect(waterfall.pickLabels(boxes, 8, 20)).toEqual(react.pickLabels(boxes, 8, 20));
    }
    expect(waterfall.waterfallLayout([])).toEqual(react.waterfallLayout([]));
  });
});

describe("bullet layout", () => {
  it("matches the React bands, domain, level and opacity", async () => {
    const react = await load<typeof bullet>("bullet");
    for (let run = 0; run < 30; run += 1) {
      const ranges = rand() < 0.2 ? undefined : sample(int(0, 5), -10, 150);
      const row = {
        actual: between(-5, 160),
        target: rand() < 0.3 ? undefined : between(0, 150),
        ranges,
      };
      expect(bullet.bulletBands(ranges)).toEqual(react.bulletBands(ranges));
      expect(bullet.bulletMax(row)).toBe(react.bulletMax(row));
      expect(bullet.bulletLevel(row.actual, ranges)).toBe(react.bulletLevel(row.actual, ranges));
      const count = int(0, 6);
      for (let i = 0; i < count; i += 1)
        expect(bullet.bandOpacity(i, count)).toBe(react.bandOpacity(i, count));
    }
  });
});
