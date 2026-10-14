// Unit-chart and small-multiples maths is a port: each entry is pinned to the React kit, value for
// value, with seeded random inputs next to hand-picked edge cases. The React modules load at run
// time, by path, so this package never depends on them statically.
import { beforeAll, describe, expect, it } from "vitest";
import * as grid from "../src/chart/grid.ts";
import * as units from "../src/chart/units.ts";

let reactUnits: Omit<typeof units, "capUnits" | "capGrid" | "unitRuns" | "MAX_UNITS">;
let reactGrid: typeof grid;
beforeAll(async () => {
  reactUnits = await import("../../ui/src/charts/core/units.ts");
  reactGrid = await import("../../ui/src/charts/chart-grid/grid-math.ts");
});

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T;
const list = (n: number) =>
  Array.from({ length: n }, () => pick([0, -3, Number.NaN, between(0.1, 500), between(1, 20)]));

describe("unit chart maths", () => {
  it("counts, fractions and progress", () => {
    expect(units.unitFractions(23, 5)).toEqual([1, 1, 1, 1, 0.6]);
    for (let i = 0; i < 300; i++) {
      const value = pick([0, -2, Number.NaN, between(0, 90), int(0, 40)]);
      const per = pick([0, 1, 5, between(0.1, 12)]);
      expect(units.unitCount(value, per)).toEqual(reactUnits.unitCount(value, per));
      expect(units.unitFractions(value, per)).toEqual(reactUnits.unitFractions(value, per));
      const step = pick([undefined, 0.5, 0.25, 0]);
      expect(units.roundToStep(value, step)).toBe(reactUnits.roundToStep(value, step));
      const max = pick([5, 100, 0, between(1, 9)]);
      const count = int(0, 12);
      expect(units.progressFractions(value, max, count, step)).toEqual(
        reactUnits.progressFractions(value, max, count, step),
      );
    }
  });

  it("waffle counts, grid cells and the grid fit", () => {
    for (let i = 0; i < 200; i++) {
      const values = list(int(0, 8));
      const cells = int(0, 120);
      const total = pick([undefined, between(0, 2000)]);
      expect(units.waffleCounts(values, cells, total)).toEqual(
        reactUnits.waffleCounts(values, cells, total),
      );
      const counts = Array.from({ length: int(0, 6) }, () => int(0, 9));
      expect(units.assignUnits(counts)).toEqual(reactUnits.assignUnits(counts));
      const columns = int(1, 12);
      const rows = int(1, 12);
      const index = int(0, columns * rows - 1);
      for (const order of ["row", "column"] as const)
        expect(units.gridCell(index, columns, rows, order)).toEqual(
          reactUnits.gridCell(index, columns, rows, order),
        );
      const count = int(1, 80);
      const options = {
        width: between(20, 800),
        height: between(20, 500),
        gap: pick([undefined, 0, 0.25]),
        maxSize: pick([undefined, 32, 60]),
        maxColumns: count,
        columns: pick([undefined, undefined, int(1, 10)]),
        rowsFor: (cols: number) => Math.ceil(count / cols),
      };
      expect(units.fitUnitGrid(options)).toEqual(reactUnits.fitUnitGrid(options));
    }
  });
});

describe("small multiples maths", () => {
  it("shared domains and columns", () => {
    for (let i = 0; i < 300; i++) {
      const extents = Array.from({ length: int(0, 6) }, () =>
        pick([
          null,
          undefined,
          [between(-50, 20), between(20, 400)] as const,
          [Number.NaN, 4] as const,
        ]),
      );
      const options = {
        nice: pick([true, false]),
        includeZero: pick([true, false]),
        tickCount: int(3, 6),
      };
      expect(grid.unionExtent(extents)).toEqual(reactGrid.unionExtent(extents));
      expect(grid.sharedDomain(extents, options)).toEqual(reactGrid.sharedDomain(extents, options));
      const width = between(0, 1400);
      const count = int(0, 12);
      const layout = {
        minPanelWidth: pick([0, 120, 220, 300]),
        maxColumns: pick([undefined, 2, 6]),
        gap: pick([undefined, 0, 24]),
      };
      expect(grid.gridColumns(width, count, layout)).toBe(
        reactGrid.gridColumns(width, count, layout),
      );
      const columns = int(1, 6);
      expect(grid.panelWidth(width, columns, layout.gap)).toBe(
        reactGrid.panelWidth(width, columns, layout.gap),
      );
    }
  });
});

describe("unit cap", () => {
  it("caps counts, grids and a shared run budget", () => {
    expect(units.capUnits(5)).toBe(5);
    expect(units.capUnits(120000)).toBe(units.MAX_UNITS);
    const [rows, cols] = units.capGrid(500, 500);
    expect(rows * cols).toBeLessThanOrEqual(units.MAX_UNITS);
    expect(units.capGrid(10, 10)).toEqual([10, 10]);
    expect(units.unitFractions(120000, 1)).toHaveLength(units.MAX_UNITS);
    const runs = units.unitRuns([1500, 1500], 1);
    expect(runs.reduce((sum, run) => sum + run.length, 0)).toBeLessThanOrEqual(units.MAX_UNITS);
    expect(units.unitRuns([2.5, 1], 1)).toEqual([[1, 1, 0.5], [1]]);
  });
});
