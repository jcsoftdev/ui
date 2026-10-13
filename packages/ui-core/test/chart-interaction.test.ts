// The interaction maths is a port: these pin it to the React kit's sources, value for value, with
// seeded random inputs next to hand-picked edge cases.
import { describe, expect, it } from "vitest";
import * as reactBrush from "../../ui/src/charts/core/distribution/brush.ts";
import * as reactMorph from "../../ui/src/charts/core/shape-morph.ts";
import * as reactPanZoom from "../../ui/src/charts/core/use-pan-zoom.ts";
import * as brush from "../src/chart/brush.ts";
import * as panZoom from "../src/chart/pan-zoom.ts";
import * as morph from "../src/chart/shape-morph.ts";

let seed = 11;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

describe("pan-zoom parity", () => {
  it("zoomAround keeps the anchor fixed and clamps like React", () => {
    for (let i = 0; i < 300; i++) {
      const view = { k: between(0.1, 2.5), x: between(-400, 400), y: between(-400, 400) };
      const args = [between(0.2, 5), between(0, 800), between(0, 600), 0.1, 2.5] as const;
      expect(panZoom.zoomAround(view, ...args)).toEqual(reactPanZoom.zoomAround(view, ...args));
    }
  });

  it("zoomAround leaves the point under the cursor in place", () => {
    const view = { k: 1, x: 30, y: -10 };
    const next = panZoom.zoomAround(view, 2, 200, 100, 0.1, 5);
    // content point under (200, 100) before and after
    expect((200 - view.x) / view.k).toBeCloseTo((200 - next.x) / next.k, 10);
    expect((100 - view.y) / view.k).toBeCloseTo((100 - next.y) / next.k, 10);
  });

  it("fitView matches React, including degenerate content", () => {
    for (let i = 0; i < 200; i++) {
      const args = [
        between(0, 3000),
        between(0, 3000),
        between(50, 1200),
        between(50, 900),
      ] as const;
      const opts = {
        padding: between(0, 40),
        minZoom: between(0.01, 0.2),
        maxFit: between(0.5, 3),
      };
      expect(panZoom.fitView(...args, opts)).toEqual(reactPanZoom.fitView(...args, opts));
      expect(panZoom.fitView(...args)).toEqual(reactPanZoom.fitView(...args));
    }
    expect(panZoom.fitView(0, 0, 400, 300)).toEqual(reactPanZoom.fitView(0, 0, 400, 300));
  });

  it("wheelFactor is React's exponential: pixel and line deltas", () => {
    expect(panZoom.wheelFactor(100)).toBe(Math.exp(-100 * 0.0025));
    expect(panZoom.wheelFactor(-3, 1)).toBe(Math.exp(3 * 0.05));
    expect(panZoom.wheelFactor(0)).toBe(1);
  });

  it("panZoomKey pans, zooms around the centre and ignores other keys", () => {
    const view = { k: 1, x: 0, y: 0 };
    const size = { width: 400, height: 200 };
    expect(panZoom.panZoomKey(view, "ArrowRight", size)).toEqual({ k: 1, x: -48, y: 0 });
    expect(panZoom.panZoomKey(view, "ArrowUp", { ...size, shift: true })).toEqual({
      k: 1,
      x: 0,
      y: 240,
    });
    const zoomed = panZoom.panZoomKey(view, "+", size);
    expect(zoomed).toEqual(panZoom.zoomAround(view, 1.25, 200, 100, 0.1, 2.5));
    expect(panZoom.panZoomKey({ k: 2.5, x: 0, y: 0 }, "=", size)?.k).toBe(2.5);
    expect(panZoom.panZoomKey(view, "a", size)).toBeNull();
  });
});

describe("brush parity", () => {
  const domain = (): [number, number] => [between(-100, 100), between(-100, 100)];
  const rect = () =>
    reactBrush.rectFromCorners(
      { x: between(-150, 150), y: between(-150, 150) },
      { x: between(-150, 150), y: between(-150, 150) },
    );

  it("rect maths: corners, clamp, ranges and containment", () => {
    for (let i = 0; i < 300; i++) {
      const a = { x: between(-9, 9), y: between(-9, 9) };
      const b = { x: between(-9, 9), y: between(-9, 9) };
      expect(brush.rectFromCorners(a, b)).toEqual(reactBrush.rectFromCorners(a, b));
      const [xd, yd, r] = [domain(), domain(), rect()];
      expect(brush.clampRect(r, xd, yd)).toEqual(reactBrush.clampRect(r, xd, yd));
      expect(brush.rectToRanges(r)).toEqual(reactBrush.rectToRanges(r));
      const x = between(-150, 150);
      const y = between(-150, 150);
      expect(brush.rectContains(r, x, y)).toBe(reactBrush.rectContains(r, x, y));
      expect(brush.defaultBrush(xd, yd)).toEqual(reactBrush.defaultBrush(xd, yd));
      expect(brush.isClick(a, b, 3)).toBe(reactBrush.isClick(a, b, 3));
    }
    const open = [null, [1, 5], [5, 1]] as const;
    for (const x of open)
      for (const y of open) {
        expect(brush.rangesToRect(x, y)).toEqual(reactBrush.rangesToRect(x, y));
        const r = reactBrush.rangesToRect(x, y);
        if (r) expect(brush.rectToRanges(r)).toEqual(reactBrush.rectToRanges(r));
      }
  });

  it("stepBrush moves and resizes like React in every direction", () => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const;
    for (let i = 0; i < 400; i++) {
      const [xd, yd] = [domain(), domain()];
      const r = brush.clampRect(rect(), xd, yd);
      const key = keys[i % 4] as (typeof keys)[number];
      const grow = i % 8 < 4;
      expect(brush.stepBrush(r, key, grow, xd, yd)).toEqual(
        reactBrush.stepBrush(r, key, grow, xd, yd),
      );
    }
  });

  it("touchIntent matches React around the delay and slop", () => {
    for (const [dx, dy, elapsed] of [
      [0, 0, 0],
      [3, 4, 100],
      [20, 0, 100],
      [0, 0, 349],
      [0, 0, 350],
      [40, 40, 500],
    ] as const) {
      const to = { x: dx, y: dy };
      expect(brush.touchIntent({ x: 0, y: 0 }, to, elapsed)).toBe(
        reactBrush.touchIntent({ x: 0, y: 0 }, to, elapsed),
      );
    }
  });

  // The index window is ported from the stock navigator (`ChartBrush`), which keeps this logic
  // inside the component, so the goldens are written out from its rules.
  describe("index window", () => {
    const count = 20;
    it("clamps and keeps at least one step", () => {
      expect(brush.clampIndexRange(5, 2, count)).toEqual([2, 5]);
      expect(brush.clampIndexRange(-4, 3, count)).toEqual([0, 3]);
      expect(brush.clampIndexRange(7, 7, count)).toEqual([7, 8]);
      expect(brush.clampIndexRange(19, 19, count)).toEqual([18, 19]);
      expect(brush.clampIndexRange(10, 99, count)).toEqual([10, 19]);
    });

    it("picks the handle, body or a new window", () => {
      const at = (px: number) => Math.round(px / 10);
      expect(brush.pickIndexDrag(52, 50, 120, at, 5)).toEqual({ kind: "start" });
      expect(brush.pickIndexDrag(113, 50, 120, at, 5)).toEqual({ kind: "end" });
      expect(brush.pickIndexDrag(80, 50, 120, at, 5)).toEqual({ kind: "move", offset: 3 });
      expect(brush.pickIndexDrag(200, 50, 120, at, 5)).toEqual({ kind: "new", anchor: 20 });
    });

    it("drags each mode", () => {
      expect(brush.dragIndexRange({ kind: "start" }, 9, [4, 8], count)).toEqual([7, 8]);
      expect(brush.dragIndexRange({ kind: "start" }, 2, [4, 8], count)).toEqual([2, 8]);
      expect(brush.dragIndexRange({ kind: "end" }, 1, [4, 8], count)).toEqual([4, 5]);
      expect(brush.dragIndexRange({ kind: "end" }, 30, [4, 8], count)).toEqual([4, 19]);
      expect(brush.dragIndexRange({ kind: "new", anchor: 12 }, 6, [4, 8], count)).toEqual([6, 12]);
      expect(brush.dragIndexRange({ kind: "move", offset: 2 }, 12, [4, 8], count)).toEqual([
        10, 14,
      ]);
      expect(brush.dragIndexRange({ kind: "move", offset: 2 }, 40, [4, 8], count)).toEqual([
        15, 19,
      ]);
      expect(brush.dragIndexRange({ kind: "move", offset: 2 }, 6, [4, 8], count)).toBeNull();
    });

    it("steps with the keyboard", () => {
      expect(brush.stepIndexRange([4, 8], "ArrowRight", false, count)).toEqual([5, 9]);
      expect(brush.stepIndexRange([4, 8], "ArrowLeft", false, count)).toEqual([3, 7]);
      expect(brush.stepIndexRange([0, 4], "ArrowDown", false, count)).toEqual([0, 4]);
      expect(brush.stepIndexRange([15, 19], "ArrowUp", false, count)).toEqual([15, 19]);
      expect(brush.stepIndexRange([4, 8], "ArrowRight", true, count)).toEqual([4, 9]);
      expect(brush.stepIndexRange([4, 5], "ArrowLeft", true, count)).toEqual([4, 5]);
      expect(brush.stepIndexRange([4, 8], "Home", false, count)).toEqual([0, 4]);
      expect(brush.stepIndexRange([4, 8], "End", false, count)).toEqual([15, 19]);
      expect(brush.stepIndexRange([4, 8], "Tab", false, count)).toBeNull();
    });
  });
});

describe("shape-morph parity", () => {
  it("rectRing, sectorRing, blendRings, ringPath and ringCenter match React", () => {
    for (let i = 0; i < 100; i++) {
      const rectArgs = [
        between(0, 200),
        between(0, 200),
        between(200, 500),
        between(200, 500),
      ] as const;
      const samples = 1 + Math.floor(rand() * 30);
      const ours = morph.rectRing(...rectArgs, samples);
      expect(ours).toEqual(reactMorph.rectRing(...rectArgs, samples));
      const a0 = between(0, 3);
      const sectorArgs = [
        between(0, 300),
        between(0, 300),
        between(5, 60),
        between(70, 200),
        a0,
        a0 + between(0.01, 3),
      ] as const;
      const sector = morph.sectorRing(...sectorArgs, samples);
      expect(sector).toEqual(reactMorph.sectorRing(...sectorArgs, samples));
      const t = rand();
      const blend = morph.blendRings(ours, sector, t);
      expect(blend).toEqual(reactMorph.blendRings(ours, sector, t));
      expect(morph.ringPath(blend)).toBe(reactMorph.ringPath(blend));
      expect(morph.ringCenter(blend)).toEqual(reactMorph.ringCenter(blend));
      expect(morph.morphPath(ours, sector, t)).toBe(reactMorph.ringPath(blend));
    }
  });

  it("matches React at the defaults and on degenerate input", () => {
    expect(morph.EDGE_SAMPLES).toBe(reactMorph.EDGE_SAMPLES);
    expect(morph.rectRing(0, 0, 10, 10)).toEqual(reactMorph.rectRing(0, 0, 10, 10));
    expect(morph.rectRing(5, 5, 5, 5)).toEqual(reactMorph.rectRing(5, 5, 5, 5));
    expect(morph.ringPath([])).toBe("");
    expect(
      morph.ringPath([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe("");
    expect(morph.ringCenter([])).toEqual({ x: 0, y: 0 });
    const ring = morph.rectRing(0, 0, 10, 10, 2);
    expect(morph.blendRings(ring, morph.rectRing(0, 0, 4, 4, 5), 0.5)).toHaveLength(8);
  });

  it("endpoints: t=0 is the rectangle, t=1 the sector", () => {
    const rect = morph.rectRing(0, 0, 100, 40);
    const sector = morph.sectorRing(50, 50, 10, 40, 0, 1);
    expect(morph.blendRings(rect, sector, 0)).toEqual(rect);
    expect(morph.blendRings(rect, sector, 1)).toEqual(sector);
  });

  it("tween reports the target synchronously when immediate", () => {
    const seen: number[] = [];
    morph.tween(1, (value) => seen.push(value), { immediate: true });
    expect(seen).toEqual([1]);
    expect(morph.easeOutCubic(0)).toBe(0);
    expect(morph.easeOutCubic(1)).toBe(1);
  });
});
