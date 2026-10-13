// Golden parity of the E19 chart maths with the React kit: the React sources are imported at run
// time by path (never statically), and every ui-core entry must agree with them value for value.
import { describe, expect, it } from "vitest";
import { categoryLayout } from "../src/chart/distribution-layout.ts";
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
