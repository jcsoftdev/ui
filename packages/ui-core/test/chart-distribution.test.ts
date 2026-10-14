// The distribution maths (quartiles, Tukey whiskers, Gaussian KDE, jitter, violin outline and the
// category layout) is a port: each export is pinned to the React kit's source value for value. The
// React modules are imported at runtime, by path.
import { describe, expect, it } from "vitest";
import * as distribution from "../src/chart/distribution.ts";

// Literal paths keep the bundler happy; the import() still runs inside each test, never at load.
const react = {
  stats: () => import("../../ui/src/charts/core/distribution/stats.ts"),
  points: () => import("../../ui/src/charts/core/distribution/points.ts"),
  geometry: () => import("../../ui/src/charts/core/distribution/geometry.ts"),
  layout: () => import("../../ui/src/charts/core/distribution/layout.ts"),
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

describe("distribution maths", () => {
  type React = typeof distribution & Record<string, unknown>;
  it("matches the React statistics", async () => {
    const stats = await load<React>("stats");
    for (let run = 0; run < 30; run += 1) {
      const raw: Array<number | null> = sample(int(0, 60), -50, 400);
      if (raw.length > 3) raw[1] = null;
      const whisker = rand() < 0.2 ? Number.POSITIVE_INFINITY : between(0.5, 3);
      expect(distribution.boxStats(raw, whisker)).toEqual(
        (stats.boxStats as typeof distribution.boxStats)(raw, whisker),
      );
      expect(distribution.silvermanBandwidth(raw)).toBe(
        (stats.silvermanBandwidth as typeof distribution.silvermanBandwidth)(raw),
      );
      expect(distribution.gaussianKde(raw, { points: 72 })).toEqual(
        (stats.gaussianKde as typeof distribution.gaussianKde)(raw, { points: 72 }),
      );
      const p = rand();
      expect(distribution.quantile(raw, p)).toEqual(
        (stats.quantile as typeof distribution.quantile)(raw, p),
      );
      expect(distribution.standardDeviation(distribution.sortedFinite(raw))).toBe(
        (stats.standardDeviation as typeof distribution.standardDeviation)(
          (stats.sortedFinite as typeof distribution.sortedFinite)(raw),
        ),
      );
    }
    const kde = { bandwidth: 3, extent: [0, 50] as const, points: 9, cut: 1 };
    expect(distribution.gaussianKde([4, 8, 15, 16, 23, 42], kde)).toEqual(
      (stats.gaussianKde as typeof distribution.gaussianKde)([4, 8, 15, 16, 23, 42], kde),
    );
    expect(distribution.boxStats([])).toBeNull();
    expect(distribution.boxStats([7])).toEqual(
      (stats.boxStats as typeof distribution.boxStats)([7]),
    );
  });

  it("pins the quartiles and the KDE to known values", () => {
    const box = distribution.boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    expect(box).toMatchObject({
      q1: 3.25,
      median: 5.5,
      q3: 7.75,
      lowerWhisker: 1,
      upperWhisker: 9,
      outliers: [100],
    });
    const curve = distribution.gaussianKde([0], { bandwidth: 1, extent: [-1, 1], points: 3 });
    expect(curve[1]?.density).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 12);
    const area = distribution.gaussianKde([0, 1, 2], { bandwidth: 0.5, points: 400, cut: 6 });
    const step = (area[1]?.value ?? 0) - (area[0]?.value ?? 0);
    expect(area.reduce((sum, p) => sum + p.density * step, 0)).toBeCloseTo(1, 2);
  });

  it("matches the React jitter and violin outline", async () => {
    const points = await load<React>("points");
    const geometry = await load<React>("geometry");
    const stats = await load<React>("stats");
    const values = sample(40, 0, 90);
    expect(distribution.jitterValues(values, 11, 14)).toEqual(
      (points.jitterValues as typeof distribution.jitterValues)(values, 11, 14),
    );
    const reach = (v: number) => v / 10;
    expect(distribution.jitterValues(values, 3, reach)).toEqual(
      (points.jitterValues as typeof distribution.jitterValues)(values, 3, reach),
    );
    expect(distribution.groupSeed(11, 2, 1)).toBe(
      (points.groupSeed as typeof distribution.groupSeed)(11, 2, 1),
    );
    expect(distribution.seededRandom(5)()).toBe(
      (stats.seededRandom as typeof distribution.seededRandom)(5)(),
    );
    const density = distribution.gaussianKde(values, { points: 72 });
    const max = Math.max(...density.map((p) => p.density));
    const map = (v: number) => 200 - v * 1.5;
    for (const horizontal of [false, true])
      for (const side of ["both", "start", "end"] as const) {
        const input = {
          density,
          map,
          center: 60,
          halfWidth: 33,
          maxDensity: max,
          horizontal,
          side,
          domain: [0, 100] as const,
        };
        expect(distribution.violinPath(input)).toBe(
          (geometry.violinPath as typeof distribution.violinPath)(input),
        );
      }
    expect(
      distribution.violinPath({
        density: [],
        map,
        center: 0,
        halfWidth: 1,
        maxDensity: 1,
        horizontal: false,
      }),
    ).toBe("");
  });

  it("matches the React category layout", async () => {
    const layout = await load<{ categoryLayout: typeof distribution.categoryLayout }>("layout");
    const names = ["Ana", "Beto", "Carlos Eduardo", "Dina"];
    for (let run = 0; run < 24; run += 1) {
      const input = {
        width: between(260, 800),
        height: between(180, 500),
        orientation: rand() < 0.5 ? ("vertical" as const) : ("horizontal" as const),
        categories: names.slice(0, int(1, 4)),
        seriesCount: int(1, 3),
        extent: [between(-20, 20), between(30, 400)] as [number, number],
        axis: rand() < 0.3 ? { min: 0, max: 400, title: "min" } : {},
        padding: rand() < 0.5 ? 0.18 : undefined,
        locale: "es-PE",
      };
      const mine = distribution.categoryLayout(input);
      const theirs = layout.categoryLayout(input);
      expect(mine.margin).toEqual(theirs.margin);
      expect(mine.valueTicks).toEqual(theirs.valueTicks);
      // Deliberate deviation: React's float round-trip (`labelWidth + 18 - 18`) truncated the widest
      // label even though it fits. Everything else, positions included, is identical.
      expect(mine.categoryTicks.map((tick) => tick.position)).toEqual(
        theirs.categoryTicks.map((tick) => tick.position),
      );
      mine.categoryTicks.forEach((tick, i) => {
        const other = theirs.categoryTicks[i]?.label as string;
        expect(
          tick.label === other || (other.endsWith("…") && tick.label.length >= other.length),
        ).toBe(true);
      });
      expect(mine.valueScale.domain).toEqual(theirs.valueScale.domain);
      expect(mine.slot(0, 0)).toEqual(theirs.slot(0, 0));
      expect(mine.band.bandwidth).toBe(theirs.band.bandwidth);
    }
  });

  it("never truncates the widest category label when the margin was sized for it", () => {
    const names = ["Ana", "Carlos Eduardo Fernandez", "Dina"];
    for (let width = 300; width < 900; width += 7) {
      const layout = distribution.categoryLayout({
        width,
        height: 300,
        orientation: "horizontal",
        categories: names,
        seriesCount: 1,
        extent: [0, 10],
      });
      const left = layout.margin.left;
      const widest = Math.max(...names.map((n) => n.length * 12 * 0.58));
      if (widest + 18 <= width * 0.34) expect(layout.categoryTicks[1]?.label).toBe(names[1]);
      expect(left).toBeGreaterThanOrEqual(36);
    }
  });

  it("accepts a tick formatter and a boolean title, and sorts once with the *Sorted variants", () => {
    const base = {
      width: 400,
      height: 300,
      orientation: "vertical" as const,
      categories: ["a"],
      seriesCount: 1,
      extent: [0, 100] as [number, number],
    };
    const layout = distribution.categoryLayout({ ...base, format: (v) => `<${v}>` });
    expect(layout.valueTicks.every((tick) => /^<.*>$/.test(tick.label))).toBe(true);
    expect(distribution.categoryLayout({ ...base, axis: { title: true } }).margin.top).toBe(24);
    expect(distribution.categoryLayout(base).margin.top).toBe(10);
    const raw = sample(80, -5, 90);
    const sorted = distribution.sortedFinite(raw);
    expect(distribution.boxStatsSorted(sorted)).toEqual(distribution.boxStats(raw));
    expect(distribution.silvermanBandwidthSorted(sorted)).toBe(
      distribution.silvermanBandwidth(raw),
    );
    expect(distribution.gaussianKdeSorted(sorted, { points: 20 })).toEqual(
      distribution.gaussianKde(raw, { points: 20 }),
    );
  });

  it("handles 200k samples without spreading them", () => {
    const big = sample(200_000, 0, 1000);
    expect(distribution.boxStats(big)?.count).toBe(200_000);
  });
});
