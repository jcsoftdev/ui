// The map family's ported math is pinned to the React kit's sources, value for value.
import type { AreaGeometry } from "@jcsoftdev/ui-core/geo/topology";
import { describe, expect, it, vi } from "vitest";
import { heatmapScale } from "../../ui/src/charts/heatmap-chart/heatmap-scale.ts";
import { geometryContains } from "../src/internal/e24-features.ts";
import { directionalNav, loadGeoMap, resolveRoutes } from "../src/internal/e24-geo.ts";
import { colorScale, legendFor } from "../src/internal/e24-scale.ts";

const RANGES = [
  { from: 0, to: 100, label: "Low" },
  { from: 100, to: 500, label: "Mid" },
  { from: 500, to: 1000, label: "High" },
];
const VALUES = [3, 40, 250, 480, 900];
const OPTIONS = [
  {},
  { scale: "diverging" as const, center: 200 },
  { domain: [0, 2000] as const },
  { ranges: RANGES },
  { scale: "diverging" as const, domain: [-50, 950] as const, center: 0 },
];

describe("e24 colorScale", () => {
  it.each(OPTIONS.map((o, i) => [i, o] as const))(
    "matches heatmapScale (case %i)",
    (_i, options) => {
      const mine = colorScale(VALUES, options);
      const react = heatmapScale(VALUES, options);
      expect(mine.domain).toEqual(react.domain);
      for (const value of [-10, 0, 3, 99, 100, 250, 600, 999, 1200])
        expect(mine.color(value)).toEqual(react.color(value));
    },
  );

  it("falls back to 0..1 without values", () => {
    expect(colorScale([], {}).domain).toEqual(heatmapScale([], {}).domain);
  });

  it("publishes a gradient for continuous scales and items for ranges", () => {
    const format = (v: number) => `${v}`;
    expect(legendFor({}, [0, 900], format, "x").scale).toMatchObject({ min: 0, max: 900 });
    const diverging = legendFor({ scale: "diverging", center: 100 }, [0, 400], format, "x");
    expect(diverging.scale?.stops?.[1]).toBeCloseTo(0.25);
    expect(legendFor({ ranges: RANGES }, [0, 1000], format, "x").legend?.map((i) => i.id)).toEqual([
      "range-0",
      "range-1",
      "range-2",
    ]);
  });
});

describe("e24 directionalNav", () => {
  const anchors: Array<[number, number] | null> = [[0, 0], [10, 0], [0, 10], [10, 10], null];
  it("moves to the nearest anchor ahead and stays put at the edge", () => {
    expect(directionalNav(anchors, 0, "right")).toBe(1);
    expect(directionalNav(anchors, 0, "down")).toBe(2);
    expect(directionalNav(anchors, 3, "left")).toBe(2);
    expect(directionalNav(anchors, 0, "left")).toBeUndefined();
  });
  it("home and end skip empty anchors", () => {
    expect(directionalNav(anchors, 1, "home")).toBe(0);
    expect(directionalNav(anchors, 1, "end")).toBe(3);
  });
});

describe("e24 geometry and routes", () => {
  const square: AreaGeometry = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ],
  };
  it("excludes holes", () => {
    expect(geometryContains(square, 2, 2)).toBe(true);
    expect(geometryContains(square, 5, 5)).toBe(false);
    expect(geometryContains(square, 20, 2)).toBe(false);
  });
  it("resolves point ids and coordinates and drops unknown ends", () => {
    const points = [{ id: "a", name: "A", lon: 1, lat: 2 }];
    const routes = resolveRoutes(
      [
        { id: "ok", from: "a", to: { lon: 3, lat: 4, name: "B" } },
        { id: "bad", from: "a", to: "zzz" },
      ],
      points,
    );
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ name: "A → B", from: [1, 2], to: [3, 4] });
  });
});

const calls = vi.hoisted(() => ({ count: 0 }));
vi.mock("@jcsoftdev/ui-core/geo/maps", () => ({
  MAP_IDS: ["world", "peru"],
  loadMap: (id: string) => {
    calls.count += 1;
    return calls.count === 1
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ id, name: id });
  },
}));

describe("e24 loadGeoMap", () => {
  it("forgets a failed fetch so the next call retries, and caches a success", async () => {
    await expect(loadGeoMap("world")).rejects.toThrow("offline");
    const map = await loadGeoMap("world");
    expect(map).toMatchObject({ id: "world" });
    expect(await loadGeoMap("world")).toBe(map);
    expect(calls.count).toBe(2);
  });
  it("resolves null for an unknown id and for nothing", async () => {
    expect(await loadGeoMap("atlantis")).toBeNull();
    expect(await loadGeoMap(null)).toBeNull();
  });
});
