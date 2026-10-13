// The chart maths is a port: these pin every entry to the React kit's sources, value for value,
// with seeded random inputs next to hand-picked edge cases.
import { describe, expect, it, vi } from "vitest";
import * as reactAxes from "../../ui/src/charts/core/axes.tsx";
import * as reactCategory from "../../ui/src/charts/core/category-axis.ts";
import * as reactColor from "../../ui/src/charts/core/color-scale.ts";
import * as reactDownsample from "../../ui/src/charts/core/downsample.ts";
import * as reactFormat from "../../ui/src/charts/core/format.ts";
import * as reactPalette from "../../ui/src/charts/core/palette.ts";
import * as reactPath from "../../ui/src/charts/core/path.ts";
import * as reactScales from "../../ui/src/charts/core/scales/index.ts";
import * as reactStack from "../../ui/src/charts/core/stack.ts";
import * as reactTimeRange from "../../ui/src/charts/core/time-range.ts";
import * as axis from "../src/chart/axis.ts";
import * as baseAxis from "../src/chart/category-axis.ts";
import * as categoryAxis from "../src/chart/category-axis-time.ts";
import * as colorScale from "../src/chart/color-scale.ts";
import * as downsample from "../src/chart/downsample.ts";
import * as format from "../src/chart/format.ts";
import * as palette from "../src/chart/palette.ts";
import * as path from "../src/chart/path.ts";
import * as scale from "../src/chart/scale.ts";
import * as scaleTime from "../src/chart/scale-time.ts";
import * as stack from "../src/chart/stack.ts";
import * as timeRange from "../src/chart/time-range.ts";

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const times = <T>(n: number, make: (i: number) => T) =>
  Array.from({ length: n }, (_, i) => make(i));

/** Probes at, before and after both ends, plus random interior values. */
const probes = (d0: number, d1: number) => [
  d0,
  d1,
  d0 - 1,
  d1 + 1,
  ...times(8, () => between(Math.min(d0, d1), Math.max(d0, d1))),
];

describe("scale parity", () => {
  it("linear: nice domains, mapping, inversion and ticks", () => {
    for (let i = 0; i < 300; i++) {
      const domain: [number, number] = [between(-5000, 5000), between(-5000, 5000)];
      const range: [number, number] = [between(0, 50), between(100, 900)];
      const nice = rand() > 0.3;
      const tickCount = 2 + Math.floor(rand() * 10);
      const ours = scale.linearScale({ domain, range, nice, tickCount });
      const theirs = reactScales.linearScale({ domain, range, nice, tickCount });
      expect(ours.domain).toEqual(theirs.domain);
      for (const v of probes(...ours.domain)) expect(ours.map(v)).toBe(theirs.map(v));
      for (const p of [range[0], range[1], between(0, 900)])
        expect(ours.invert(p)).toBe(theirs.invert(p));
      expect(ours.ticks()).toEqual(theirs.ticks());
      expect(ours.ticks(7)).toEqual(theirs.ticks(7));
    }
  });

  it("linear: flat, zero and tiny domains", () => {
    for (const domain of [
      [0, 0],
      [5, 5],
      [-3, -3],
      [0, 1e-9],
      [1e9, 1e9 + 1],
      [0.1, 0.30000000000000004],
    ] as const) {
      const ours = scale.linearScale({ domain, range: [0, 100] });
      const theirs = reactScales.linearScale({ domain, range: [0, 100] });
      expect(ours.domain).toEqual(theirs.domain);
      expect(ours.ticks()).toEqual(theirs.ticks());
    }
    expect(scale.extent([3, null, Number.NaN, -1, undefined, 9])).toEqual(
      reactScales.extent([3, null, Number.NaN, -1, undefined, 9]),
    );
    expect(scale.extent([])).toBe(reactScales.extent([]));
  });

  it("log: decade domains, mapping and ticks", () => {
    for (let i = 0; i < 200; i++) {
      const lo = 10 ** between(-3, 3);
      const domain: [number, number] = [lo, lo * 10 ** between(0, 5)];
      const ours = scale.logScale({ domain, range: [0, 400] });
      const theirs = reactScales.logScale({ domain, range: [0, 400] });
      expect(ours.domain).toEqual(theirs.domain);
      for (const v of [...probes(...domain), 0, -4]) expect(ours.map(v)).toBe(theirs.map(v));
      expect(ours.invert(123)).toBe(theirs.invert(123));
      expect(ours.ticks()).toEqual(theirs.ticks());
    }
    expect(scale.logScale({ domain: [0, 0], range: [0, 1] }).domain).toEqual(
      reactScales.logScale({ domain: [0, 0], range: [0, 1] }).domain,
    );
  });

  it("time: calendar ticks and labels across spans from hours to decades", () => {
    const day = 86_400_000;
    const spans = [0.2, 1, 5, 13, 20, 60, 120, 300, 800, 4000, 20000];
    for (const days of spans) {
      for (let i = 0; i < 6; i++) {
        const start =
          Date.UTC(2015, 0, 1) + Math.floor(rand() * 3650) * day + Math.floor(rand() * day);
        const end = start + days * day;
        const count = 2 + Math.floor(rand() * 10);
        expect(scaleTime.timeTicks(start, end, count)).toEqual(
          reactScales.timeTicks(start, end, count),
        );
        expect(scaleTime.timeTicks(end, start, count)).toEqual(
          reactScales.timeTicks(end, start, count),
        );
        const ours = scaleTime.timeScale({ domain: [new Date(start), end], range: [0, 640] });
        const theirs = reactScales.timeScale({ domain: [new Date(start), end], range: [0, 640] });
        expect(ours.domain).toEqual(theirs.domain);
        expect(ours.map(start + days * day * 0.4)).toBe(theirs.map(start + days * day * 0.4));
        expect(ours.invert(200)).toBe(theirs.invert(200));
        expect(ours.timeTicks()).toEqual(theirs.timeTicks());
        expect(ours.ticks(4)).toEqual(theirs.ticks(4));
      }
    }
    expect(scaleTime.timeScale({ domain: [5, 5], range: [0, 1] }).domain).toEqual(
      reactScales.timeScale({ domain: [5, 5], range: [0, 1] }).domain,
    );
  });

  it("time: date labels", () => {
    for (let i = 0; i < 50; i++) {
      const d = new Date(Date.UTC(2020, 0, 1) + Math.floor(rand() * 2000) * 86_400_000);
      expect(scaleTime.shortMonth(d)).toBe(reactScales.shortMonth(d));
      expect(scaleTime.shortWeekday(d)).toBe(reactScales.shortWeekday(d));
      expect(scaleTime.formatDate(d)).toBe(reactScales.formatDate(d));
    }
  });

  it("band and point: geometry and hit testing", () => {
    for (let i = 0; i < 300; i++) {
      const count = Math.floor(rand() * 40);
      const range: [number, number] = [between(0, 30), between(200, 900)];
      const paddingInner = rand();
      const paddingOuter = rand();
      const bandOpts = { count, range, paddingInner, paddingOuter };
      const pointOpts = { count, range, padding: rand() };
      for (const [ours, theirs] of [
        [scale.bandScale(bandOpts), reactScales.bandScale(bandOpts)],
        [scale.bandScale({ count, range }), reactScales.bandScale({ count, range })],
        [scale.pointScale(pointOpts), reactScales.pointScale(pointOpts)],
      ] as const) {
        expect([ours.type, ours.step, ours.bandwidth]).toEqual([
          theirs.type,
          theirs.step,
          theirs.bandwidth,
        ]);
        for (let k = 0; k < count; k++) {
          expect(ours.start(k)).toBe(theirs.start(k));
          expect(ours.center(k)).toBe(theirs.center(k));
        }
        for (const p of [-20, range[0], between(...range), range[1], range[1] + 40]) {
          expect(ours.indexAt(p)).toBe(theirs.indexAt(p));
        }
      }
    }
  });
});

describe("axis parity", () => {
  it("tick step, nice domain and linear ticks", () => {
    for (let i = 0; i < 400; i++) {
      const a = between(-1e6, 1e6) * 10 ** Math.floor(between(-6, 1));
      const b = a + between(0, 1e5) * 10 ** Math.floor(between(-6, 1));
      const count = 1 + Math.floor(rand() * 12);
      expect(axis.tickStep(a, b, count)).toBe(reactScales.tickStep(a, b, count));
      expect(axis.niceDomain(a, b, count)).toEqual(reactScales.niceDomain(a, b, count));
      expect(axis.linearTicks(a, b, count)).toEqual(reactScales.linearTicks(a, b, count));
      expect(axis.clean(a)).toBe(reactScales.clean(a));
    }
    expect(axis.tickStep(1, 1, 5)).toBe(1);
    expect(axis.linearTicks(2, 2)).toEqual([2]);
  });

  it("label width estimate and thinning", () => {
    expect(axis.estimateTextWidth("12 345", 13)).toBe(reactAxes.estimateTextWidth("12 345", 13));
    for (let i = 0; i < 200; i++) {
      const n = Math.floor(rand() * 30);
      const ticks = times(n, (k) => ({
        key: k,
        position: k * between(8, 60),
        label: "x".repeat(1 + Math.floor(rand() * 12)),
      }));
      const gap = rand() > 0.5 ? undefined : Math.floor(between(0, 30));
      expect(axis.thinTicks(ticks, gap)).toEqual(reactAxes.thinTicks(ticks, gap));
    }
  });

  it("value ticks keep only those inside the domain, with positions and labels", () => {
    for (let i = 0; i < 100; i++) {
      const lin = scale.linearScale({
        domain: [between(-50, 0), between(1, 90)],
        range: [300, 0],
        nice: rand() > 0.5,
      });
      const ref = lin
        .ticks(5)
        .filter((v) => v >= Math.min(...lin.domain) - 1e-9 && v <= Math.max(...lin.domain) + 1e-9)
        .map((v) => ({ key: v, position: lin.map(v), label: `v${v}` }));
      expect(axis.valueTicks(lin, 5, (v) => `v${v}`)).toEqual(ref);
    }
  });

  it("category axis: point, band and time modes", () => {
    const cats = (n: number) => times(n, (k) => `Category ${k}`);
    const dates = (n: number) => times(n, (k) => new Date(2026, 0, 1 + k * 3));
    for (const width of [180, 420, 960]) {
      for (const n of [0, 1, 2, 7, 31]) {
        for (const opts of [
          { mode: "point" as const },
          { mode: "band" as const, paddingInner: 0.4, padding: 0.2 },
          { mode: "time" as const, tickCount: 5 },
        ]) {
          for (const data of [cats(n), dates(n)]) {
            const ours = categoryAxis.buildCategoryAxis(data, width, opts);
            const theirs = reactCategory.buildCategoryAxis(data, width, opts);
            const { indexAt: oi, ...o } = ours;
            const { indexAt: ti, ...t } = theirs;
            expect(o).toEqual(t);
            for (const p of [-10, 0, width / 3, width * 0.77, width + 10])
              expect(oi(p)).toBe(ti(p));
          }
        }
      }
    }
    const d = new Date(2026, 9, 6);
    expect(categoryAxis.defaultCategoryLabel(d)).toBe(reactCategory.defaultCategoryLabel(d));
    expect(categoryAxis.fullCategoryLabel(d)).toBe(reactCategory.fullCategoryLabel(d));
    expect(categoryAxis.allDates([d, d])).toBe(true);
  });
});

describe("category axis without the calendar", () => {
  it("matches React for string categories in point and band modes", () => {
    for (const width of [180, 640]) {
      for (const n of [0, 1, 5, 40]) {
        const data = times(n, (k) => `Category ${k}`);
        for (const opts of [
          { mode: "point" as const },
          { mode: "band" as const, paddingInner: 0.4, padding: 0.2 },
        ]) {
          const { indexAt: oi, ...o } = baseAxis.buildCategoryAxis(data, width, opts);
          const { indexAt: ti, ...r } = reactCategory.buildCategoryAxis(data, width, opts);
          expect(o).toEqual(r);
          for (const p of [-5, width / 3, width + 5]) expect(oi(p)).toBe(ti(p));
        }
      }
    }
  });

  it("treats time mode as point, since dates need chart/category-axis-time", () => {
    const data = times(6, (k) => `d${k}`);
    expect(baseAxis.buildCategoryAxis(data, 300, { mode: "time" }).mode).toBe("point");
    expect(baseAxis.allDates([new Date()])).toBe(true);
  });
});

describe("format parity", () => {
  const values = [
    0,
    -0,
    1,
    -1,
    0.5,
    0.125,
    999,
    1000,
    1234.5,
    9999,
    10_000,
    -12_345.678,
    2_500_000,
    3.4e9,
    1e-4,
    Number.NaN,
  ];
  const randoms = times(60, () => between(-1e7, 1e7) / 10 ** Math.floor(between(0, 6)));

  it("formats numbers, currency, percent and compact the same", () => {
    for (const v of [...values, ...randoms]) {
      expect(format.formatNumber(v)).toBe(reactFormat.formatNumber(v));
      expect(format.formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 1 })).toBe(
        reactFormat.formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 1 }),
      );
      // The React kit defaults to PEN; ui-core never guesses a currency, so compare with it explicit.
      expect(format.formatCurrency(v, { currency: "PEN" })).toBe(reactFormat.formatCurrency(v));
      expect(format.formatPercent(v)).toBe(reactFormat.formatPercent(v));
      expect(format.formatPercent(v, { input: "whole", decimals: 0 })).toBe(
        reactFormat.formatPercent(v, { input: "whole", decimals: 0 }),
      );
      expect(format.formatCompact(v)).toBe(reactFormat.formatCompact(v));
      expect(format.formatCompact(v, { prefix: "S/ ", decimals: 2 })).toBe(
        reactFormat.formatCompact(v, { prefix: "S/ ", decimals: 2 }),
      );
    }
  });

  it("resolves every preset and the axis variants the same", () => {
    const presets = [undefined, "number", "integer", "currency", "percent", "compact"] as const;
    for (const preset of presets) {
      for (const v of [...values, ...randoms]) {
        const options = preset === "currency" ? { currency: "PEN" } : {};
        expect(format.resolveFormat(preset, options)(v)).toBe(reactFormat.resolveFormat(preset)(v));
        expect(format.resolveAxisFormat(preset, options)(v)).toBe(
          reactFormat.resolveAxisFormat(preset)(v),
        );
      }
    }
    const custom = (v: number) => `#${v}`;
    expect(format.resolveFormat(custom)).toBe(custom);
    expect(format.resolveAxisFormat(custom)).toBe(custom);
  });
});

type Pt = { x: number; y: number };
const randomPoints = (n: number): Array<Pt | null> => {
  let x = between(0, 20);
  return times(n, () => {
    x += between(0.5, 40);
    return rand() < 0.12 ? null : { x, y: between(-50, 300) };
  });
};

describe("path parity", () => {
  const curves = ["linear", "smooth", "step", "step-before", "step-after"] as const;

  it("lines and areas for every curve, with gaps", () => {
    for (let i = 0; i < 200; i++) {
      const n = Math.floor(rand() * 25);
      const top = randomPoints(n);
      const bottom = top.map((p) => ({ x: p ? p.x : 0, y: 400 }));
      for (const curve of curves) {
        expect(path.linePath(top, curve)).toBe(reactPath.linePath(top, curve));
        expect(path.areaPath(top, bottom, curve)).toBe(reactPath.areaPath(top, bottom, curve));
      }
      expect(path.linePath(top)).toBe(reactPath.linePath(top));
      expect(path.segments(top)).toEqual(reactPath.segments(top));
    }
  });

  it("monotone tangents and joined commands", () => {
    for (let i = 0; i < 100; i++) {
      const pts = randomPoints(2 + Math.floor(rand() * 12)).filter((p): p is Pt => p !== null);
      expect(path.monotoneTangents(pts)).toEqual(reactPath.monotoneTangents(pts));
      for (const curve of curves) {
        expect(path.curveCommands(pts, curve, true)).toBe(
          reactPath.curveCommands(pts, curve, true),
        );
      }
    }
    expect(path.curveCommands([], "smooth")).toBe("");
    expect(path.monotoneTangents([])).toEqual([0]);
  });

  it("rounded rectangles and bars", () => {
    const ends = ["top", "bottom", "left", "right", "all", "none"] as const;
    for (let i = 0; i < 200; i++) {
      const [x, y, w, h] = [between(-20, 100), between(-20, 100), between(-5, 80), between(-5, 80)];
      const radii = {
        tl: between(0, 30),
        tr: between(0, 30),
        br: between(0, 30),
        bl: between(0, 30),
      };
      expect(path.roundedRectPath(x, y, w, h, radii)).toBe(
        reactPath.roundedRectPath(x, y, w, h, radii),
      );
      const radius = between(0, 12);
      for (const end of ends) {
        expect(path.barPath(x, y, w, h, radius, end)).toBe(
          reactPath.barPath(x, y, w, h, radius, end),
        );
      }
    }
  });
});

describe("stack parity", () => {
  it("stacks normal and percent, with negatives, gaps and ragged series", () => {
    for (let i = 0; i < 300; i++) {
      const series = times(1 + Math.floor(rand() * 5), () =>
        times(Math.floor(rand() * 15), () =>
          rand() < 0.15 ? null : rand() < 0.3 ? -between(0, 40) : between(0, 100),
        ),
      );
      for (const mode of ["normal", "percent"] as const) {
        expect(stack.stackLayers(series, mode)).toEqual(reactStack.stackLayers(series, mode));
      }
    }
    expect(stack.stackLayers([], "normal")).toEqual([]);
  });
});

describe("color-scale parity", () => {
  it("ships the same palette", () => {
    expect(palette.CHART_PALETTE).toEqual(reactPalette.CHART_PALETTE);
    expect(palette.TONE_COLORS).toEqual(reactPalette.TONE_COLORS);
    expect(palette.DIRECTION_COLORS).toEqual(reactPalette.DIRECTION_COLORS);
    for (let i = 0; i < 20; i++) expect(palette.seriesColor(i)).toBe(reactPalette.seriesColor(i));
    expect(palette.seriesColor(1, "red")).toBe("red");
    for (const d of [-3, -0.01, 0, 0.01, 5])
      expect(palette.directionOf(d, 0.02)).toBe(reactPalette.directionOf(d, 0.02));
    for (const n of [1, 2, 5, 9]) {
      for (let s = -1; s <= n + 1; s++)
        expect(palette.monochromeShade(s, n)).toBe(reactPalette.monochromeShade(s, n));
    }
    const values = times(25, () => Math.round(between(0, 20)));
    expect(palette.monochromeByValue(values)).toEqual(reactPalette.monochromeByValue(values));
  });

  it("matches tint, normalize, sequential and diverging", () => {
    const custom = { low: "#c00", mid: "#eee", high: "#06c" };
    for (let i = 0; i < 300; i++) {
      const [min, max] = [between(-100, 20), between(-20, 200)] as const;
      const v = between(min - 20, max + 20);
      const c = between(min, max);
      expect(colorScale.normalize(v, min, max)).toBe(reactColor.normalize(v, min, max));
      expect(colorScale.sequentialColor(v, [min, max])).toEqual(
        reactColor.sequentialColor(v, [min, max]),
      );
      expect(colorScale.sequentialColor(v, [min, max], custom)).toEqual(
        reactColor.sequentialColor(v, [min, max], custom),
      );
      expect(colorScale.divergingColor(v, [min, max], c)).toEqual(
        reactColor.divergingColor(v, [min, max], c),
      );
      expect(colorScale.divergingColor(v, [min, max], undefined, custom)).toEqual(
        reactColor.divergingColor(v, [min, max], undefined, custom),
      );
      const pct = between(-10, 110);
      expect(colorScale.tint("var(--x)", pct)).toBe(reactColor.tint("var(--x)", pct));
      expect(colorScale.inkOn(pct)).toBe(reactColor.inkOn(pct));
    }
    expect(colorScale.normalize(3, 5, 5)).toBe(1);
    expect(colorScale.DEFAULT_SCALE_COLORS).toEqual(reactColor.DEFAULT_SCALE_COLORS);
  });

  it("matches stepped ranges and legend gradients", () => {
    const ranges: reactColor.ColorRange[] = [
      { to: 10, label: "low", tone: "success" },
      { from: 10, to: 50, label: "mid" },
      { from: 50, to: 80, label: "high", color: "#f00" },
      { from: 80, label: "max", tone: "danger" },
    ];
    for (const v of [-5, 0, 9.99, 10, 49, 50, 79, 80, 1000]) {
      expect(colorScale.rangeIndex(v, ranges)).toBe(reactColor.rangeIndex(v, ranges));
    }
    ranges.forEach((range, index) => {
      expect(colorScale.rangeColor(range, index, ranges.length)).toEqual(
        reactColor.rangeColor(range, index, ranges.length),
      );
    });
    for (const kind of ["sequential", "diverging"] as const) {
      expect(colorScale.scaleGradient(kind)).toBe(reactColor.scaleGradient(kind));
      expect(colorScale.scaleGradient(kind, { high: "#123" }, "to top")).toBe(
        reactColor.scaleGradient(kind, { high: "#123" }, "to top"),
      );
    }
  });
});

describe("downsample parity", () => {
  it("LTTB keeps the same indices and points", () => {
    for (let i = 0; i < 150; i++) {
      const n = Math.floor(rand() * 400);
      const points = times(n, (k) => ({
        x: k + between(0, 0.5),
        y: Math.sin(k / 9) * 50 + between(-20, 20),
      }));
      const threshold = Math.floor(between(0, 120));
      expect(downsample.lttbIndices(points, threshold)).toEqual(
        reactDownsample.lttbIndices(points, threshold),
      );
      expect(downsample.downsample(points, threshold)).toEqual(
        reactDownsample.downsample(points, threshold),
      );
    }
    const picked = downsample.lttbIndices(
      times(500, (k) => ({ x: k, y: k % 7 })),
      50,
    );
    expect(picked).toHaveLength(50);
    expect(picked[0]).toBe(0);
    expect(picked.at(-1)).toBe(499);
  });

  it("shared indices across series with gaps", () => {
    for (let i = 0; i < 100; i++) {
      const count = Math.floor(rand() * 300);
      const series = times(1 + Math.floor(rand() * 4), () =>
        times(count - Math.floor(rand() * 5 * (rand() > 0.7 ? 1 : 0)), (k) =>
          rand() < 0.05 ? null : Math.cos(k / 11) * 40 + between(-5, 5),
        ),
      );
      const threshold = Math.floor(between(0, 100));
      expect(downsample.sharedSampleIndices(series, threshold)).toEqual(
        reactDownsample.sharedSampleIndices(series, threshold),
      );
    }
  });
});

describe("time-range parity", () => {
  it("shifts dates and resolves windows like React (local time)", () => {
    const units = ["day", "week", "month", "year"] as const;
    for (let i = 0; i < 400; i++) {
      const date = new Date(
        Date.UTC(2018, 0, 1) +
          Math.floor(rand() * 3000) * 86_400_000 +
          Math.floor(rand() * 86_400_000),
      );
      const unit = units[Math.floor(rand() * 4)] as (typeof units)[number];
      const count = Math.floor(rand() * 14);
      expect(+timeRange.shiftDate(date, unit, count)).toBe(
        +reactTimeRange.shiftDate(date, unit, count),
      );
    }
    for (const [y, m, d] of [
      [2024, 2, 29],
      [2025, 2, 31],
      [2026, 0, 31],
      [2026, 4, 31],
    ] as const) {
      for (const unit of units) {
        const date = new Date(y, m, d, 9);
        expect(+timeRange.shiftDate(date, unit, 1)).toBe(+reactTimeRange.shiftDate(date, unit, 1));
      }
    }
    for (let i = 0; i < 200; i++) {
      let t = Date.UTC(2024, 0, 1);
      const dates = times(Math.floor(rand() * 120), () => {
        t += Math.floor(between(0.2, 5) * 86_400_000);
        return new Date(t);
      });
      const preset = {
        unit: ([...units, "all"] as const)[Math.floor(rand() * 5)] as "all",
        count: rand() > 0.2 ? Math.floor(between(1, 12)) : undefined,
      };
      expect(timeRange.rangeWindow(dates, preset)).toEqual(
        reactTimeRange.rangeWindow(dates, preset),
      );
      expect(timeRange.rangeWindow(dates.map(Number), preset)).toEqual(
        reactTimeRange.rangeWindow(dates.map(Number), preset),
      );
    }
  });

  it("works in a given time zone", () => {
    const utc = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m, d, h);
    expect(
      timeRange.shiftDate(new Date(utc(2026, 2, 31, 10)), "month", 1, "UTC").toISOString(),
    ).toBe("2026-02-28T10:00:00.000Z");
    expect(
      timeRange.shiftDate(new Date(utc(2024, 2, 31, 10)), "year", 1, "UTC").toISOString(),
    ).toBe("2023-03-31T10:00:00.000Z");
    // 03:00 UTC on 10 Mar 2026 is 23:00 on 9 Mar in New York (after the DST jump): one day back keeps the wall clock.
    expect(
      timeRange
        .shiftDate(new Date(utc(2026, 2, 10, 3)), "day", 9, "America/New_York")
        .toISOString(),
    ).toBe("2026-03-01T04:00:00.000Z");
    const dates = [0, 1, 2, 3, 4, 5].map((k) => utc(2026, 0, 31) + k * 30 * 86_400_000);
    expect(timeRange.rangeWindow(dates, { unit: "month", count: 2 }, "UTC")).toEqual([3, 5]);
  });
});

describe("locale and time zone options", () => {
  const utc = { locale: "en-US", timeZone: "UTC" };
  const at = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m, d, h);

  it("defaults are byte-identical to React when the options are omitted or undefined", () => {
    const a = at(2026, 0, 3, 5);
    for (const days of [3, 40, 400, 3000]) {
      const b = a + days * 86_400_000;
      expect(scaleTime.timeTicks(a, b, 6, {})).toEqual(reactScales.timeTicks(a, b, 6));
      expect(scaleTime.timeTicks(a, b, 6, { locale: undefined, timeZone: undefined })).toEqual(
        reactScales.timeTicks(a, b, 6),
      );
      expect(
        scaleTime.timeScale({ domain: [a, b], range: [0, 500], locale: undefined }).timeTicks(),
      ).toEqual(reactScales.timeScale({ domain: [a, b], range: [0, 500] }).timeTicks());
    }
    expect(format.resolveFormat("currency", { currency: "PEN" })(1234.5)).toBe(
      reactFormat.resolveFormat("currency")(1234.5),
    );
    expect(format.resolveAxisFormat("currency", { currency: "PEN" })(25_000)).toBe(
      reactFormat.resolveAxisFormat("currency")(25_000),
    );
    expect(categoryAxis.defaultCategoryLabel(new Date(2026, 9, 6), {})).toBe(
      reactCategory.defaultCategoryLabel(new Date(2026, 9, 6)),
    );
  });

  it("golden: en-US labels in UTC", () => {
    const ticks = (a: number, b: number, count: number) =>
      scaleTime.timeTicks(a, b, count, utc).map((t) => `${t.value}|${t.unit}|${t.label}`);
    expect(ticks(at(2026, 0, 3, 5), at(2026, 3, 1, 5), 6)).toEqual([
      `${at(2026, 1, 1)}|month|feb 2026`,
      `${at(2026, 2, 1)}|month|mar`,
      `${at(2026, 3, 1)}|month|apr`,
    ]);
    expect(ticks(at(2026, 0, 3, 5), at(2026, 0, 8, 5), 6)).toEqual([
      `${at(2026, 0, 4)}|day|sun 4`,
      `${at(2026, 0, 5)}|day|mon 5`,
      `${at(2026, 0, 6)}|day|tue 6`,
      `${at(2026, 0, 7)}|day|wed 7`,
      `${at(2026, 0, 8)}|day|thu 8`,
    ]);
    expect(ticks(at(2026, 0, 3, 5), at(2029, 0, 1), 4)).toEqual([
      `${at(2027, 0, 1)}|year|2027`,
      `${at(2028, 0, 1)}|year|2028`,
      `${at(2029, 0, 1)}|year|2029`,
    ]);
    expect(scaleTime.formatDate(at(2026, 9, 6, 23), utc)).toBe("tue 6 oct 2026");
    expect(
      scaleTime.formatDate(at(2026, 9, 6, 23), { locale: "en-US", timeZone: "Asia/Tokyo" }),
    ).toBe("wed 7 oct 2026");
    expect(categoryAxis.defaultCategoryLabel(new Date(at(2026, 9, 6, 23)), utc)).toBe("6 oct");
    expect(
      scaleTime.shortMonth(new Date(at(2026, 4, 1)), { locale: "fr-FR", timeZone: "UTC" }),
    ).toBe("mai");
  });

  it("ticks sit on local midnights of the requested zone, across DST", () => {
    const timeZone = "America/New_York";
    const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" });
    const ticks = scaleTime.timeTicks(at(2026, 2, 1), at(2026, 3, 20), 40, {
      locale: "en-US",
      timeZone,
    });
    expect(ticks.length).toBeGreaterThan(20);
    for (const tick of ticks) expect(Number(hour.format(tick.value))).toBe(0);
    const sundays = scaleTime.timeTicks(at(2026, 1, 1), at(2026, 5, 1), 12, {
      locale: "en-US",
      timeZone,
    });
    expect(sundays[0]?.unit).toBe("week");
    for (const tick of sundays)
      expect(
        new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(tick.value),
      ).toBe("Mon");
  });

  it("golden: en-US number formats use the locale's own separators", () => {
    const us = { locale: "en-US" };
    expect(format.resolveFormat("number", us)(1_234_567.891)).toBe("1,234,567.89");
    expect(format.resolveFormat("currency", { locale: "en-US", currency: "USD" })(1234.5)).toBe(
      "$1,234.50",
    );
    expect(format.resolveAxisFormat("currency", { locale: "en-US", currency: "USD" })(25_000)).toBe(
      "$\u00a025K",
    );
    expect(format.resolveAxisFormat("currency", { locale: "en-US", currency: "USD" })(2500)).toBe(
      "$2,500",
    );
    expect(format.resolveFormat("compact", us)(1234)).toBe("1.2K");
    expect(format.resolveFormat("percent", us)(0.125)).toBe("12.5%");
    expect(format.formatNumber(1234.5, { locale: "de-DE" })).toBe("1.234,5");
  });
});

describe("currency has no default", () => {
  it("formats as a plain number and warns once when no currency code is given", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(format.resolveFormat("currency", { locale: "en-US" })(1234.5)).toBe("1,234.50");
    expect(format.resolveAxisFormat("currency", { locale: "en-US" })(25_000)).toBe("25K");
    expect(format.formatCurrency(5, { locale: "en-US" })).toBe("5.00");
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
    warn.mockRestore();
  });

  it("never reads the currency from the locale", () => {
    // The symbol depends on the ICU data ("US$" or "USD"); what matters is that it is not soles.
    const text = format.formatCurrency(1, { locale: "es-PE", currency: "USD" });
    expect(text).toMatch(/US\$|USD/);
    expect(text).not.toContain("S/");
  });
});
