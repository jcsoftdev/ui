// Golden parity: the crossfilter engine in `src/internal/e23-crossfilter-engine.ts` is the React
// kit's engine. The React module is imported by path at runtime, never statically.
import { describe, expect, it } from "vitest";
import * as mine from "../src/internal/e23-crossfilter-engine.ts";

const react = (await import(
  "../../ui/src/charts/crossfilter/crossfilter-engine.ts"
)) as typeof mine;

interface Sale {
  barber: string;
  price: number;
  minutes: number;
}
const SALES: Sale[] = Array.from({ length: 200 }, (_, i) => ({
  barber: ["Ana", "Luis", "Marta", "Ivo"][i % 4] as string,
  price: 10 + ((i * 37) % 90),
  minutes: 15 + ((i * 11) % 60),
}));
const accessors = {
  barber: (s: Sale) => s.barber,
  price: (s: Sale) => s.price,
  minutes: (s: Sale) => s.minutes,
} as mine.Accessors<Sale>;

describe("crossfilter engine matches the React kit", () => {
  const filters: mine.CrossfilterFilters = {
    barber: { kind: "set", values: ["Ana", "Marta"] },
    price: { kind: "range", min: 30, max: 70 },
  };

  it("filters, groups and bins with every other filter applied", () => {
    expect(mine.filterRecords(SALES, accessors, filters)).toEqual(
      react.filterRecords(SALES, accessors, filters),
    );
    expect(mine.filterRecords(SALES, accessors, filters, "price")).toEqual(
      react.filterRecords(SALES, accessors, filters, "price"),
    );
    for (const options of [
      undefined,
      { keys: ["Ivo", "Ana", "Zed"] },
      { value: (s: Sale) => s.price },
    ]) {
      expect(mine.groupRecords(SALES, accessors, filters, "barber", options)).toEqual(
        react.groupRecords(SALES, accessors, filters, "barber", options),
      );
    }
    const edges = mine.evenEdges(0, 100, 10);
    expect(edges).toEqual(react.evenEdges(0, 100, 10));
    expect(mine.binRecords(SALES, accessors, filters, "price", edges)).toEqual(
      react.binRecords(SALES, accessors, filters, "price", edges),
    );
    for (const v of [-1, 0, 9.99, 10, 55, 100, 101])
      expect(mine.binIndex(edges, v)).toBe(react.binIndex(edges, v));
  });

  it("edits filters and maps ranges to bins the same way", () => {
    const edges = mine.evenEdges(0, 100, 10);
    let a: mine.CrossfilterFilters = mine.NO_FILTERS;
    let b: mine.CrossfilterFilters = react.NO_FILTERS;
    for (const value of ["Ana", "Luis", "Ana"]) {
      a = mine.toggleValue(a, "barber", value);
      b = react.toggleValue(b, "barber", value);
      expect(a).toEqual(b);
    }
    a = mine.setRangeFilter(a, "price", [70, 30]);
    b = react.setRangeFilter(b, "price", [70, 30]);
    expect(a).toEqual(b);
    expect(mine.isSelected(a, "price", 50)).toBe(react.isSelected(b, "price", 50));
    expect(mine.isSelected(a, "price", 80)).toBe(react.isSelected(b, "price", 80));
    expect(mine.binsInRange(edges, 25, 61)).toEqual(react.binsInRange(edges, 25, 61));
    expect(mine.rangeOfBins(edges, 2, 5)).toEqual(react.rangeOfBins(edges, 2, 5));
    expect(mine.rangeOfBins(edges, 8, 9)).toEqual(react.rangeOfBins(edges, 8, 9));
    expect(mine.clearFilters(a, "price")).toEqual(react.clearFilters(b, "price"));
    expect(mine.activeFilterCount(a)).toBe(react.activeFilterCount(b));
  });
});
