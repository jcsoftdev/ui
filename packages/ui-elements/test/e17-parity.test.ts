// Golden parity: the ported math must agree with the React kit's. The React modules are imported by
// path at runtime, never statically, so ui-elements does not depend on packages/ui.
import { describe, expect, it } from "vitest";
import { barKit } from "../src/internal/e17-bars.ts";
import {
  type CartesianLayout,
  computeLayout,
  type LayoutInput,
} from "../src/internal/e17-layout.ts";
import { lineKit } from "../src/internal/e17-lines.ts";
import * as mine from "../src/internal/e17-stats.ts";
import { xyLayout } from "../src/internal/e17-xy-layout.ts";

const react = async (rel: string) => {
  const url = new URL(`../../ui/src/charts/core/${rel}`, import.meta.url).href;
  return import(/* @vite-ignore */ url);
};

const round = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)),
  );

const SAMPLE = [3, 4, 4, 5, 7, 8, 8, 8, 9, 12, 13, 13, 14, 21, 22, 35, 36, null, Number.NaN];

describe("e17 stats parity with the React kit", () => {
  it("bins, counts and quantiles agree for every rule", async () => {
    const theirs = await react("distribution/stats.ts");
    for (const options of [
      {},
      { bins: "sturges" },
      { bins: 7 },
      { binWidth: 5 },
      { domain: [0, 40] },
    ]) {
      const edges = mine.binEdges(SAMPLE, options as never);
      expect(edges).toEqual(theirs.binEdges(SAMPLE, options));
      expect(mine.binCounts(SAMPLE, edges)).toEqual(theirs.binCounts(SAMPLE, edges));
    }
    expect(mine.quantile(SAMPLE, 0.37)).toBe(theirs.quantile(SAMPLE, 0.37));
    expect(mine.standardDeviation([1, 2, 3, 9])).toBe(theirs.standardDeviation([1, 2, 3, 9]));
    expect(mine.normalPdf(1.5, 1, 2)).toBe(theirs.normalPdf(1.5, 1, 2));
  });

  it("regression and the seeded random stream agree", async () => {
    const theirs = await react("distribution/stats.ts");
    const points = Array.from({ length: 30 }, (_, i) => ({ x: i, y: i * 2.5 + ((i * 7) % 5) }));
    const a = mine.linearRegression(points);
    const b = theirs.linearRegression(points);
    expect(a?.slope).toBe(b.slope);
    expect(a?.intercept).toBe(b.intercept);
    expect(a?.r2).toBe(b.r2);
    const r1 = mine.seededRandom(17);
    const r2 = theirs.seededRandom(17);
    expect(Array.from({ length: 8 }, r1)).toEqual(Array.from({ length: 8 }, r2));
  });

  it("the point index finds the same nearest mark", async () => {
    const theirs = await react("distribution/point-index.ts");
    const points = Array.from({ length: 500 }, (_, i) => ({
      x: (i * 37) % 400,
      y: (i * 91) % 300,
      r: 3 + (i % 5),
    }));
    const a = mine.createPointIndex(points);
    const b = theirs.createPointIndex(points);
    for (const [x, y] of [
      [10, 10],
      [200, 150],
      [399, 299],
      [123, 77],
    ])
      expect(a.nearest(x as number, y as number, 12)).toBe(b.nearest(x as number, y as number, 12));
  });
});

describe("e17 layout parity with the React kit", () => {
  const categories = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const fmt = (value: number) => `#${value}`;
  const mk = (id: string, kind: string, data: Array<number | null>, extra = {}) => ({
    id,
    name: id.toUpperCase(),
    kind,
    axis: "left",
    color: `var(--${id})`,
    dashed: false,
    format: fmt,
    data,
    ...extra,
  });
  const base = {
    width: 640,
    height: 320,
    categories,
    orientation: "vertical" as const,
    stack: "none" as const,
    curve: "linear" as const,
    dataLabels: false,
    barRadius: 4,
    xScale: "auto" as const,
    xLabel: (v: unknown) => String(v),
    yAxis: {},
    rightAxis: {},
    annotations: [],
    locale: "es-PE",
  };
  const both = async (variant: Record<string, unknown>, series: unknown[]) => {
    const theirs = await react("cartesian/layout.ts");
    const axisFormat = (await react("format.ts")).resolveAxisFormat;
    const input = { ...base, ...variant, series };
    const a = computeLayout({
      ...input,
      axisFormat,
      bars: barKit,
      lines: lineKit,
    } as unknown as LayoutInput);
    const b = theirs.computeLayout(input);
    return { a, b };
  };
  const same = (a: CartesianLayout, b: CartesianLayout) => {
    expect(round(a.margin)).toEqual(round(b.margin));
    expect(round(a.positions)).toEqual(round(b.positions));
    expect(round(a.valueScale.domain)).toEqual(round(b.valueScale.domain));
    expect(a.valueTicks.map((t) => t.position.toFixed(3))).toEqual(
      b.valueTicks.map((t) => t.position.toFixed(3)),
    );
    expect(a.geometry.length).toBe(b.geometry.length);
    a.geometry.forEach((ga, i) => {
      const gb = b.geometry[i] as (typeof b.geometry)[number];
      expect(ga.kind).toBe(gb.kind);
      expect(round(ga.points)).toEqual(round(gb.points));
      expect(ga.line).toBe(gb.line);
      expect(ga.area).toBe(gb.area);
      expect(round(ga.labels)).toEqual(round(gb.labels));
      expect(round(ga.bars ?? [])).toEqual(round(gb.bars ?? []));
    });
  };

  it("columns, lines and areas agree: grouped, stacked, horizontal, with labels and negatives", async () => {
    const data = {
      a: [10, 22, -14, 30, 18],
      b: [4, 9, 6, null, 7],
      c: [3, 5, 8, 2, 6],
    };
    const series = () => [
      mk("a", "column", data.a),
      mk("b", "line", data.b, { axis: "right" }),
      mk("c", "column", data.c, { stackGroup: "x" }),
    ];
    for (const variant of [
      {},
      { dataLabels: true },
      { orientation: "horizontal" as const, dataLabels: true },
      { stack: "normal" as const },
      { stack: "normal" as const, orientation: "horizontal" as const, dataLabels: true },
      { stack: "percent" as const },
    ]) {
      const { a, b } = await both(variant, series());
      same(a, b);
      expect(a.geometry.some((g) => (g.bars?.length ?? 0) > 0)).toBe(true);
    }
  });

  it("areas and floating bars agree", async () => {
    const { a, b } = await both({ curve: "smooth", stack: "normal" }, [
      mk("a", "area", [3, 6, 4, 9, 5]),
      mk("b", "area", [2, 2, 5, 1, 4]),
      mk("r", "column", [8, 9, 7, 12, 10], { from: [5, 4, 3, 8, 6], axis: "right" }),
    ]);
    same(a, b);
  });

  it("annotations widen the value domain like React", async () => {
    const note = [{ type: "line", axis: "y", value: 500, label: "Goal" }];
    const theirs = await react("cartesian/layout.ts");
    const axisFormat = (await react("format.ts")).resolveAxisFormat;
    const input = { ...base, annotations: note, series: [mk("a", "column", [10, 20, 30, 40, 50])] };
    const a = computeLayout({
      ...input,
      axisFormat,
      bars: barKit,
      lines: lineKit,
    } as unknown as LayoutInput);
    const b = theirs.computeLayout(input);
    expect(round(a.valueScale.domain)).toEqual(round(b.valueScale.domain));
    expect(a.valueScale.domain[1]).toBeGreaterThanOrEqual(500);
  });
  it("xyLayout agrees for a linear plot", async () => {
    const theirs = await react("distribution/layout.ts");
    const text = (v: number) => String(v);
    const a = xyLayout({
      width: 500,
      height: 300,
      xExtent: [0, 97],
      yExtent: [3, 480],
      xText: text,
      yText: text,
    });
    const b = theirs.xyLayout({
      width: 500,
      height: 300,
      xExtent: [0, 97],
      yExtent: [3, 480],
      xFormat: text,
      yFormat: text,
    });
    expect(round(a.margin)).toEqual(round(b.margin));
    expect(round(a.xScale.domain)).toEqual(round(b.xScale.domain));
    expect(round(a.yScale.domain)).toEqual(round(b.yScale.domain));
    expect(a.xTicks.map((t) => t.key)).toEqual(b.xTicks.map((t: { key: number }) => t.key));
  });
});
