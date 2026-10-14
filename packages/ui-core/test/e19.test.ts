// Golden parity of the E19 chart maths with the React kit: the React sources are imported at run
// time by path (never statically), and every ui-core entry must agree with them value for value.
import { describe, expect, it } from "vitest";
import { datetimeColumnLabels } from "../src/chart/datetime-columns.ts";
import { categoryLayout } from "../src/chart/distribution-layout.ts";
import { heatmapScale } from "../src/chart/heatmap-scale.ts";
import { hexLayout, hexPath } from "../src/chart/hex-layout.ts";
import { streamLayout } from "../src/chart/stream.ts";
import { beeswarm } from "../src/chart/swarm.ts";

const react = (path: string) =>
  import(/* @vite-ignore */ new URL(`../../ui/src/charts/${path}`, import.meta.url).pathname);

let seed = 11;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

describe("stream layout", () => {
  it("matches the React layout for every offset and order, with gaps and negatives", async () => {
    const reactLayout = (await react("stream-graph/stream-layout.ts")) as {
      streamLayout: typeof streamLayout;
    };
    for (const offset of ["wiggle", "silhouette", "zero", "expand"] as const)
      for (const order of ["inside-out", "ascending", "none"] as const)
        for (let round = 0; round < 6; round += 1) {
          const series = Array.from({ length: 2 + (round % 4) }, () =>
            Array.from({ length: 3 + round * 3 }, () =>
              rand() < 0.1 ? null : rand() < 0.05 ? between(-5, 0) : between(0, 40),
            ),
          );
          expect(streamLayout(series, offset, order)).toEqual(
            reactLayout.streamLayout(series, offset, order),
          );
        }
    expect(streamLayout([], "wiggle", "inside-out").domain).toEqual([0, 1]);
  });
});

describe("beeswarm", () => {
  it("matches the React offsets for random swarms, both sides and one side", async () => {
    const stats = (await react("core/distribution/stats.ts")) as { beeswarm: typeof beeswarm };
    for (let round = 0; round < 12; round += 1) {
      const items = Array.from({ length: 5 + round * 20 }, () => ({
        position: between(0, 300),
        radius: between(1.5, 9),
      }));
      for (const side of ["both", "positive"] as const)
        for (const gap of [undefined, 0, 2.5])
          expect(beeswarm(items, { gap, side })).toEqual(stats.beeswarm(items, { gap, side }));
    }
    expect(beeswarm([])).toEqual([]);
  });

  it("never overlaps two dots", () => {
    const items = Array.from({ length: 150 }, () => ({ position: between(0, 100), radius: 4 }));
    const offsets = beeswarm(items, { gap: 1 });
    for (let i = 0; i < items.length; i += 1)
      for (let j = i + 1; j < items.length; j += 1) {
        const [a, b] = [items[i], items[j]] as [(typeof items)[number], (typeof items)[number]];
        const d = Math.hypot(a.position - b.position, (offsets[i] ?? 0) - (offsets[j] ?? 0));
        expect(d).toBeGreaterThanOrEqual(a.radius + b.radius + 1 - 1e-6);
      }
  });
});

describe("category layout", () => {
  it("matches the React geometry for both orientations", async () => {
    const layout = (await react("core/distribution/layout.ts")) as {
      categoryLayout: (input: Record<string, unknown>) => ReturnType<typeof categoryLayout>;
    };
    const format = (value: number) => `${value}u`;
    for (const orientation of ["horizontal", "vertical"] as const)
      for (const fixed of [false, true])
        for (let round = 0; round < 5; round += 1) {
          const categories = Array.from({ length: 1 + round * 2 }, (_, i) => `Category ${i + 1}`);
          const common = {
            width: 320 + round * 90,
            height: 200 + round * 40,
            orientation,
            categories,
            seriesCount: 1 + (round % 3),
            extent: [between(-20, 10), between(20, 400)] as [number, number],
            padding: round % 2 ? 0.1 : undefined,
          };
          const axis = fixed ? { min: -5, max: 500, tickCount: 4 } : {};
          const ours = categoryLayout({ ...common, format, axis, title: round % 2 === 1 });
          const theirs = layout.categoryLayout({
            ...common,
            valueFormat: format,
            axis: { ...axis, title: round % 2 === 1 ? "t" : undefined },
          });
          expect(ours.margin).toEqual(theirs.margin);
          expect(ours.innerWidth).toBe(theirs.innerWidth);
          expect(ours.innerHeight).toBe(theirs.innerHeight);
          expect(ours.valueTicks).toEqual(theirs.valueTicks);
          expect(ours.categoryTicks).toEqual(theirs.categoryTicks);
          for (const v of [-10, 0, 25, 133, 480])
            expect(ours.valueScale.map(v)).toBe(theirs.valueScale.map(v));
          categories.forEach((_, c) => {
            for (let s = 0; s < common.seriesCount; s += 1)
              expect(ours.slot(c, s)).toEqual(theirs.slot(c, s));
          });
        }
  });
});

describe("robustness and cost", () => {
  it("stream layout treats NaN and Infinity as zero instead of blanking every stream", () => {
    const clean = streamLayout(
      [
        [1, 2, 3],
        [4, 0, 6],
      ],
      "zero",
    );
    const dirty = streamLayout(
      [
        [1, 2, 3],
        [4, Number.NaN, 6],
        [Number.POSITIVE_INFINITY, 1, 1],
      ],
      "zero",
      "none",
    );
    expect(dirty.domain.every(Number.isFinite)).toBe(true);
    expect(JSON.stringify(dirty).includes("null")).toBe(false);
    expect(clean.domain.every(Number.isFinite)).toBe(true);
    const wiggle = streamLayout(
      [
        [1, Number.NaN, 3],
        [2, 2, 2],
      ],
      "wiggle",
    );
    expect(wiggle.domain.every(Number.isFinite)).toBe(true);
  });

  it("lays 10k spread points out in under 100 ms and survives a tight cluster", () => {
    const spread = Array.from({ length: 10000 }, () => ({
      position: between(0, 600),
      radius: 4.5,
    }));
    // CPU time of the fastest of a few passes: a busy machine inflates wall time, not this.
    let fastest = Number.POSITIVE_INFINITY;
    let offsets: number[] = [];
    for (let pass = 0; pass < 6; pass += 1) {
      const t0 = process.cpuUsage();
      offsets = beeswarm(spread, { gap: 1.25 });
      const spent = process.cpuUsage(t0);
      fastest = Math.min(fastest, (spent.user + spent.system) / 1000);
    }
    expect(fastest).toBeLessThan(100);
    expect(offsets.every(Number.isFinite)).toBe(true);
    const cluster = Array.from({ length: 2500 }, () => ({
      position: between(100, 112),
      radius: 3,
    }));
    const t1 = performance.now();
    expect(beeswarm(cluster, { gap: 1 }).every(Number.isFinite)).toBe(true);
    expect(performance.now() - t1).toBeLessThan(3000);
  });
});

describe("timeline lanes", () => {
  it("matches the React lanes, clock ticks and lane fit", async () => {
    const lanes = await import("../src/chart/lanes.ts");
    const theirs = (await react("timeline-chart/timeline-lanes.ts")) as typeof lanes;
    for (let round = 0; round < 10; round += 1) {
      const items = Array.from({ length: 4 + round * 6 }, () => {
        const start = Math.floor(between(0, 600)) * 60_000;
        return { start, end: start + Math.floor(between(1, 200)) * 60_000 };
      });
      expect(lanes.assignLanes(items)).toEqual(theirs.assignLanes(items));
    }
    expect(lanes.assignLanes([]).count).toBe(0);
    // Touching intervals share a lane.
    expect(
      lanes.assignLanes([
        { start: 0, end: 5 },
        { start: 5, end: 9 },
      ]).lanes,
    ).toEqual([0, 0]);
    const day = new Date(2026, 5, 12, 8, 0).getTime();
    for (const hours of [1, 3, 9, 30, 90, 400])
      for (const count of [2, 5, 8, 12]) {
        const options = { locale: "es-PE" };
        expect(lanes.clockTicks(day, day + hours * 3_600_000, count, options)).toEqual(
          theirs.clockTicks(day, day + hours * 3_600_000, count),
        );
      }
    expect(lanes.formatClock(day, { locale: "es-PE" })).toBe(theirs.formatClock(day));
    const fit = { counts: [1, 3, 2], available: 300, gap: 3, rowPad: 8 };
    expect(lanes.fitLaneHeight(fit)).toBe(theirs.fitLaneHeight(fit));
    expect(lanes.fitLaneHeight({ ...fit, counts: [] })).toBe(
      theirs.fitLaneHeight({ ...fit, counts: [] }),
    );
  });

  it("keeps the ticks on the wall clock across a daylight-saving change", async () => {
    const { clockTicks } = await import("../src/chart/lanes.ts");
    const zone = { locale: "en-US", timeZone: "America/New_York" };
    // 2026-03-08 loses an hour at 02:00; every 6-hour tick must still read 00, 06, 12 or 18.
    const ticks = clockTicks(Date.UTC(2026, 2, 7, 12), Date.UTC(2026, 2, 10, 12), 12, zone);
    expect(ticks.length).toBeGreaterThan(8);
    for (const tick of ticks) expect(tick.label).toMatch(/^(00|06|12|18):00$/);
    expect(new Set(ticks.map((t) => t.value)).size).toBe(ticks.length);
    expect(ticks.map((t) => t.value)).toEqual([...ticks.map((t) => t.value)].sort((a, b) => a - b));
  });

  it("rounds to the hours of a +05:30 or +05:45 zone and labels days in the locale", async () => {
    const { hourEdge, clockTicks } = await import("../src/chart/lanes.ts");
    for (const timeZone of ["Asia/Kolkata", "Asia/Kathmandu", "UTC"]) {
      const at = Date.UTC(2026, 0, 10, 8, 20);
      const clock = (ms: number) =>
        new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, minute: "2-digit" }).format(ms);
      expect(clock(hourEdge(at, "floor", timeZone))).toMatch(/^0+$/);
      expect(clock(hourEdge(at, "ceil", timeZone))).toMatch(/^0+$/);
      expect(hourEdge(at, "ceil", timeZone) - hourEdge(at, "floor", timeZone)).toBe(3_600_000);
      expect(hourEdge(hourEdge(at, "floor", timeZone), "ceil", timeZone)).toBe(
        hourEdge(at, "floor", timeZone),
      );
    }
    const days = clockTicks(Date.UTC(2026, 2, 1), Date.UTC(2026, 2, 12), 12, {
      locale: "de-DE",
      timeZone: "UTC",
    });
    expect(days[0]?.label).toBe(
      new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "UTC" })
        .format(days[0]?.value)
        .replace(".", ""),
    );
    expect(days[0]?.label).toMatch(/M(ä|a)r/);
  });

  it("aligns ticks to midnight of the requested zone and labels them in its locale", async () => {
    const { clockTicks } = await import("../src/chart/lanes.ts");
    const start = Date.UTC(2026, 0, 10, 3, 10);
    const lima = clockTicks(start, start + 6 * 3_600_000, 6, {
      locale: "en-US",
      timeZone: "America/Lima",
    });
    expect(lima[0]?.label).toBe("23:00"); // 03:10 UTC is 22:10 in Lima, so the first hourly tick is 23:00
    expect(lima.map((t) => t.value % 3_600_000)).toEqual(lima.map(() => 0));
  });
});

describe("heatmap scale and honeycomb", () => {
  it("matches the React color scale for sequential, diverging and stepped options", async () => {
    const reactScale = (await react("heatmap-chart/heatmap-scale.ts")) as {
      heatmapScale: typeof heatmapScale;
    };
    const values = Array.from({ length: 40 }, () => between(-30, 90));
    const ranges = [
      { to: 0, label: "Low", tone: "danger" as const },
      { from: 0, to: 50, label: "Mid" },
      { from: 50, label: "High", color: "red" },
    ];
    const options = [
      {},
      { scale: "diverging" as const, center: 10 },
      { scale: "diverging" as const, domain: [-50, 50] as const },
      { domain: [0, 200] as const, colors: { high: "teal" } },
      { ranges },
    ];
    for (const option of options) {
      const a = heatmapScale(values, option);
      const b = reactScale.heatmapScale(values, option);
      expect(a.domain).toEqual(b.domain);
      for (const v of [...values.slice(0, 12), -100, 0, 50, 500])
        expect(a.color(v)).toEqual(b.color(v));
    }
    expect(heatmapScale([], {}).domain).toEqual([0, 1]);
  });

  it("matches the React honeycomb geometry, hit test and path", async () => {
    const reactHex = (await react("heatmap-chart/hex-layout.ts")) as {
      hexLayout: typeof hexLayout;
      hexPath: typeof hexPath;
    };
    for (const [rows, columns, width, height] of [
      [5, 7, 300, 200],
      [1, 1, 40, 40],
      [12, 30, 640, 360],
      [0, 0, 100, 100],
    ] as const) {
      const a = hexLayout({ rows, columns, width, height });
      const b = reactHex.hexLayout({ rows, columns, width, height });
      expect({ ...a, center: 0, cellAt: 0 }).toEqual({ ...b, center: 0, cellAt: 0 });
      for (let i = 0; i < 40; i += 1) {
        const x = between(-10, width + 10);
        const y = between(-10, height + 10);
        expect(a.cellAt(x, y)).toEqual(b.cellAt(x, y));
      }
      if (rows && columns)
        expect(a.center(rows - 1, columns - 1)).toEqual(b.center(rows - 1, columns - 1));
    }
    expect(hexPath(10, 20, 8)).toBe(reactHex.hexPath(10, 20, 8));
  });
});

describe("heatmap date columns", () => {
  it("matches the React labels for hourly, daily and monthly columns", async () => {
    const theirs = (await react("heatmap-chart/datetime-columns.ts")) as {
      datetimeColumnLabels: typeof datetimeColumnLabels;
    };
    const series = (count: number, every: number) =>
      Array.from({ length: count }, (_, i) => new Date(2026, 0, 1, 0, 0).getTime() + i * every);
    for (const [count, every, max] of [
      [24, 3_600_000, 8],
      [52, 7 * 86_400_000, 6],
      [90, 86_400_000, 8],
      [60, 86_400_000, 3],
      [1, 1, 8],
    ] as const) {
      const dates = series(count, every);
      expect(datetimeColumnLabels(dates, max, { locale: "es-PE" })).toEqual(
        theirs.datetimeColumnLabels(dates, max),
      );
    }
    expect(datetimeColumnLabels([], 8)).toEqual([]);
  });

  it("reads the clock and the boundaries in the requested time zone", () => {
    const hours = Array.from({ length: 6 }, (_, i) => Date.UTC(2026, 0, 10, 3 + i));
    expect(
      datetimeColumnLabels(hours, 8, { locale: "en-US", timeZone: "America/Lima" })[0],
    ).toMatch(/10:00 PM|22:00/);
    const days = Array.from({ length: 40 }, (_, i) => Date.UTC(2026, 0, 1 + i, 12));
    const lima = datetimeColumnLabels(days, 6, { locale: "en-US", timeZone: "America/Lima" });
    expect(lima.filter(Boolean).length).toBeGreaterThan(1);
  });
});
