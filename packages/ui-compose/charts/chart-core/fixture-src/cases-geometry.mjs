// Case generators for the geometry, sampling, colour, brush and hit-test fixtures (registry.mjs). Same seeded generator as cases.mjs.
import { between, lehmer, times } from "./cases.mjs";

/** Points with a non-finite coordinate become gaps, as chart-core treats them: this is what the web math is asked for. */
const gapify = (xs, ys) => xs.map((x, i) => (Number.isFinite(x) && Number.isFinite(ys[i]) ? { x, y: ys[i] } : null));

const path = (mod) => {
  const rand = lehmer(53);
  const curves = ["linear", "smooth", "step", "step-before", "step-after"];
  const series = {
    empty: [[], []], single: [[5], [7]], two: [[0, 10], [3, 9]], flat: [[0, 1, 2, 3], [4, 4, 4, 4]],
    peaks: [[0, 10, 20, 30, 40, 50], [0, 100, 0, 100, 100, 0]], dupX: [[0, 10, 10, 20], [1, 5, 9, 2]],
    random: [times(60, (i) => i * 7.3 + rand()), times(60, () => between(rand, -50, 400))],
    gaps: [[0, 1, 2, 3, 4, 5, 6, 7, 8], [3, Number.NaN, 5, 6, Infinity, 2, -Infinity, 4, 4]],
    gapEnds: [[0, 1, 2, 3, 4], [Number.NaN, 1, 2, Number.NaN, Number.NaN]], badX: [[0, Number.NaN, 2, Infinity, 4], [1, 2, 3, 4, 5]],
    allBad: [[Number.NaN, Number.NaN], [Number.NaN, 1]], big: [times(300, (i) => i / 3), times(300, () => between(rand, 0, 300))],
    fractional: [[0.001, 0.004, 0.0049, 12.345, 12.355], [0.005, 99.995, 0.125, 0.135, 1e-7]],
  };
  const lines = [];
  const areas = [];
  for (const [name, [xs, ys]] of Object.entries(series)) {
    for (const curve of curves) {
      lines.push({ name, curve, xs, ys, svg: mod.linePath(gapify(xs, ys), curve) });
      const top = gapify(xs, ys);
      const bottom = xs.map((x) => ({ x, y: 400 }));
      areas.push({ name, curve, xs, ys, base: 400, svg: mod.areaPath(top, bottom, curve) });
    }
  }
  const tangents = Object.entries(series).filter(([, [xs]]) => xs.length > 1 && xs.every(Number.isFinite)).map(([name, [xs, ys]]) => ({ name, xs, ys, tangents: mod.monotoneTangents(xs.map((x, i) => ({ x, y: ys[i] }))) })).filter((t) => t.ys.every(Number.isFinite));
  const bars = [];
  for (const end of ["top", "bottom", "left", "right", "all", "none"]) {
    for (const [x, y, w, h, r] of [[10, 20, 30, 100, 4], [0, 0, 8, 3, 6], [5.5, 5.5, 0, 10, 3], [1, 2, 3, 0, 2], [0, 0, 100, 40, 0], [12.345, 6.789, 20.5, 33.3, 5.55]]) {
      bars.push({ end, x, y, w, h, r, svg: mod.barPath(x, y, w, h, r, end) });
    }
  }
  const rounded = [[0, 0, 50, 20, { tl: 5, tr: 0, br: 10, bl: 2 }], [3, 4, 5, 6, { tl: 9, tr: 9, br: 9, bl: 9 }]].map(([x, y, w, h, radii]) => ({ x, y, w, h, radii, svg: mod.roundedRectPath(x, y, w, h, radii) }));
  return { lines, areas, tangents, bars, rounded };
};

const lehmerSeries = (seed, n) => {
  const rand = lehmer(seed);
  let y = 0;
  const ys = new Array(n);
  for (let i = 0; i < n; i += 1) {
    y += rand() - 0.5;
    ys[i] = y;
  }
  return ys;
};

const downsample = (mod) => {
  const rand = lehmer(61);
  const lttb = [];
  for (const [n, threshold] of [[0, 10], [1, 10], [2, 2], [5, 3], [10, 10], [10, 4], [100, 20], [1000, 100], [1000, 999], [3000, 2], [3000, 300]]) {
    const ys = times(n, () => between(rand, -100, 100));
    lttb.push({ n, threshold, ys, indices: mod.lttbIndices(ys.map((y, x) => ({ x, y })), threshold) });
  }
  // Non-finite points are dropped before sampling; indices refer to the input.
  for (const n of [30, 400]) {
    const ys = times(n, () => between(rand, -10, 10));
    const xs = times(n, (i) => i);
    [3, 7, 8].forEach((k, j) => { ys[k * 3 + j] = [Number.NaN, Infinity, -Infinity][j]; });
    xs[n - 5] = Number.NaN;
    const keepIdx = xs.map((x, i) => i).filter((i) => Number.isFinite(xs[i]) && Number.isFinite(ys[i]));
    const picked = mod.lttbIndices(keepIdx.map((i) => ({ x: xs[i], y: ys[i] })), 12).map((k) => keepIdx[k]);
    lttb.push({ n, threshold: 12, xs, ys, indices: picked });
  }
  // A million points: only the seed and the picks are stored; Kotlin regenerates the walk with the same generator.
  const million = [{ seed: 99, n: 1_000_000, threshold: 2000 }, { seed: 7, n: 1_000_000, threshold: 3 }].map(({ seed, n, threshold }) => {
    const ys = lehmerSeries(seed, n);
    return { seed, n, threshold, indices: mod.lttbIndices(ys.map((y, x) => ({ x, y })), threshold) };
  });
  const shared = [];
  for (const [count, threshold] of [[50, 100], [200, 20], [500, 50], [1000, 10], [100, 2]]) {
    const series = times(3, (s) => times(count, (i) => (rand() < 0.04 + s * 0.02 ? null : between(rand, 0, 100))));
    const bad = series.map((data) => data.map((v, i) => (i === 7 ? Number.NaN : v)));
    shared.push({ count, threshold, series: bad.map((d) => d.map((v) => (Number.isNaN(v) ? null : v))), indices: mod.sharedSampleIndices(bad.map((d) => d.map((v) => (Number.isNaN(v) ? null : v))), threshold) });
  }
  return { lttb, million, shared };
};

const stack = (mod) => {
  const rand = lehmer(71);
  const sets = {
    simple: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], mixed: [[3, -2, 5, 0], [-1, 4, -6, 2], [2, 2, 2, -2]], gaps: [[1, null, 3, 4], [null, 2, null, 4], [5, 6, 7, null]],
    ragged: [[1, 2, 3, 4], [5, 6], [7]], empty: [], emptySeries: [[], []], single: [[4]], zeros: [[0, 0], [0, 0]],
    random: times(5, () => times(40, () => (rand() < 0.1 ? null : between(rand, -20, 60)))),
    badValues: [[1, Number.NaN, Infinity, 4], [2, 3, -Infinity, 5]],
  };
  const out = [];
  for (const [name, series] of Object.entries(sets)) {
    for (const mode of ["normal", "percent"]) {
      const clean = series.map((d) => d.map((v) => (v == null || !Number.isFinite(v) ? null : v)));
      out.push({ name, mode, series, layers: mod.stackLayers(clean, mode) });
    }
  }
  return { cases: out };
};

const pctOf = (text, base) => {
  const m = /(\d+)%/.exec(text);
  if (m) return Number(m[1]);
  return text === base ? 0 : 100;
};

const color = (mod) => {
  const rand = lehmer(83);
  const scale = { low: "LOW", mid: "MID", high: "HIGH" };
  const values = [-50, -10, 0, 1, 2.5, 5, 9.99, 10, 40, 100, 150, 1e9];
  const ranges = [[0, 10], [0, 0], [5, 5], [-100, 100], [-3, 20]];
  const sequential = ranges.flatMap(([min, max]) => values.map((value) => {
    const stop = mod.sequentialColor(value, [min, max], scale);
    return { value, min, max, strength: stop.strength, percent: pctOf(stop.color, "MID") };
  }));
  const diverging = ranges.flatMap(([min, max]) => [0, 1, -2].flatMap((center) => values.map((value) => {
    const stop = mod.divergingColor(value, [min, max], center, scale);
    return { value, min, max, center, strength: stop.strength, percent: pctOf(stop.color, "MID"), side: stop.color.includes("LOW") ? "low" : "high" };
  })));
  const normalize = ranges.flatMap(([min, max]) => values.map((value) => ({ value, min, max, result: mod.normalize(value, min, max) })));
  const stepped = [{ from: undefined, to: 0, label: "neg" }, { from: 0, to: 10, label: "low" }, { from: 10, to: 50, label: "mid" }, { from: 50, label: "high" }];
  const rangeIdx = [-5, 0, 5, 9.99, 10, 49, 50, 1e6].map((value) => ({ value, index: mod.rangeIndex(value, stepped) }));
  const rangeStrengths = [1, 2, 3, 4, 7].flatMap((count) => times(count, (index) => {
    const stop = mod.rangeColor({ label: "x" }, index, count);
    return { index, count, strength: stop.strength };
  }));
  const shades = [1, 2, 3, 5, 8].flatMap((count) => times(count + 2, (step) => ({ step: step - 1, count, percent: pctOf(mod.monochromeShade(step - 1, count, "BASE"), "NONE") })));
  const byValue = times(8, () => { const v = times(1 + Math.floor(rand() * 9), () => Math.round(between(rand, 0, 5))); return { values: v, percents: mod.monochromeByValue(v, "BASE").map((c) => pctOf(c, "NONE")) }; });
  const direction = [[1, 0], [-1, 0], [0, 0], [0.4, 0.5], [-0.6, 0.5], [0.5, 0.5], [3, 1]].map(([delta, epsilon]) => ({ delta, epsilon, result: mod.directionOf(delta, epsilon) }));
  const slots = [0, 1, 7, 8, 9, 15, 16].map((index) => ({ index, color: mod.seriesColor(index) }));
  const tints = [-5, 0, 0.4, 0.5, 12.5, 49.5, 99.4, 99.5, 100, 140].map((percent) => ({ percent, text: mod.tint("C", percent, "B") }));
  return { sequential, diverging, normalize, rangeIdx, rangeStrengths, shades, byValue, direction, slots, tints };
};

const brush = (mod) => {
  const rand = lehmer(97);
  const xd = [0, 100];
  const yd = [-50, 50];
  const rects = times(40, () => mod.rectFromCorners({ x: between(rand, -20, 120), y: between(rand, -80, 80) }, { x: between(rand, -20, 120), y: between(rand, -80, 80) }));
  const corner = rects.map((r, i) => ({ r, clamp: mod.clampRect(r, xd, yd), ranges: mod.rectToRanges(r), contains: [[50, 0], [r.x0, r.y0], [r.x1 + 1, r.y1]].map(([x, y]) => mod.rectContains(r, x, y)), i }));
  const unbounded = [[[10, 20], null], [null, [1, 2]], [null, null], [[20, 10], [5, -5]]].map(([x, y]) => { const r = mod.rangesToRect(x, y); return { x, y, rect: r, ranges: r ? mod.rectToRanges(r) : null }; });
  const clicks = [[0, 0, 3, 3], [0, 0, 4, 0], [0, 0, 3.99, 3.99], [5, 5, 5, 20]].map(([ax, ay, bx, by]) => ({ ax, ay, bx, by, result: mod.isClick({ x: ax, y: ay }, { x: bx, y: by }) }));
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  const steps = rects.slice(0, 12).flatMap((rect) => keys.flatMap((key) => [false, true].map((grow) => ({ rect, key, grow, result: mod.stepBrush(rect, key, grow, xd, yd) }))));
  const dflt = mod.defaultBrush([10, 50], [-4, 4]);
  const touch = [[0, 0, 0, 0, 0], [0, 0, 20, 0, 100], [0, 0, 5, 0, 349], [0, 0, 5, 0, 350], [0, 0, 50, 50, 400], [0, 0, 10, 0, 10], [0, 0, 10.5, 0, 10]].map(([fx, fy, tx, ty, elapsed]) => ({ fx, fy, tx, ty, elapsed, result: mod.touchIntent({ x: fx, y: fy }, { x: tx, y: ty }, elapsed) }));
  const clampIdx = [[0, 5, 10], [5, 0, 10], [-3, 20, 10], [4, 4, 10], [9, 9, 10], [0, 0, 1], [0, 0, 2], [7, 3, 4]].map(([a, b, count]) => ({ a, b, count, result: mod.clampIndexRange(a, b, count) }));
  const indexAt = (px) => Math.round(px / 10);
  const picks = [0, 10, 25, 50, 80, 100, 130].map((x) => ({ x, mode: mod.pickIndexDrag(x, 20, 80, indexAt, 2) }));
  const drags = [];
  for (const mode of [{ kind: "start" }, { kind: "end" }, { kind: "move", offset: 2 }, { kind: "new", anchor: 3 }]) {
    for (const index of [-2, 0, 3, 5, 9, 12]) for (const range of [[2, 6], [0, 9], [4, 5]]) drags.push({ mode, index, range, count: 10, result: mod.dragIndexRange(mode, index, range, 10) });
  }
  const idxKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "x"].flatMap((key) => [false, true].flatMap((grow) => [[2, 5], [0, 9], [8, 9], [0, 1]].map((range) => ({ key, grow, range, count: 10, result: mod.stepIndexRange(range, key, grow, 10) }))));
  const views = [{ k: 1, x: 0, y: 0 }, { k: 0.5, x: 30, y: -20 }, { k: 2, x: -100, y: 40 }];
  const zooms = views.flatMap((view) => [0.5, 0.9, 1, 1.25, 4, 100, 0.001].map((factor) => ({ view, factor, px: 120, py: 80, result: mod.zoomAround(view, factor, 120, 80, 0.1, 2.5) })));
  const fits = [[400, 300, 800, 600], [1600, 1200, 800, 600], [10, 10, 800, 600], [0, 0, 100, 100], [5000, 10, 300, 300]].map(([cw, ch, w, h]) => ({ cw, ch, w, h, result: mod.fitView(cw, ch, w, h), loose: mod.fitView(cw, ch, w, h, { padding: 0, maxFit: 4, minZoom: 0.5 }) }));
  const wheel = [[100, 0], [-100, 0], [3, 1], [-3, 1], [0, 0]].map(([dy, mode]) => ({ dy, mode, result: mod.wheelFactor(dy, mode) }));
  const panKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "q"].flatMap((key) => views.flatMap((view) => [false, true].map((shift) => ({ key, shift, view, result: mod.panZoomKey(view, key, { width: 600, height: 400, shift }) }))));
  return { corner, unbounded, clicks, steps, dflt, touch, clampIdx, picks, drags, idxKeys, zooms, fits, wheel, panKeys };
};

const hitTest = (mod) => pointIndexGenerated(mod);

// Point sets are regenerated in Kotlin from the same generator, so the fixture stores seeds, parameters and answers only.
const pointIndexGenerated = (mod) => {
  const out = [];
  for (const [seed, n, bubbles, cell] of [[5, 5000, false, 24], [6, 5000, true, 24], [7, 2000, true, 10], [8, 300, false, 4], [9, 50000, false, 24]]) {
    const rand = lehmer(seed);
    const points = times(n, () => ({ x: between(rand, -50, 800), y: between(rand, -20, 400), ...(bubbles ? { r: between(rand, 0, 12) } : {}) }));
    const index = mod.createPointIndex(points, cell);
    const queries = times(150, () => [between(rand, -80, 830), between(rand, -50, 430), [4, 12, 16, 40][Math.floor(rand() * 4)]]);
    out.push({ seed, n, bubbles, cell, queries: queries.map(([x, y, r]) => ({ x, y, r, index: index.nearest(x, y, r) ?? -1 })) });
  }
  const boxes = [];
  for (const [seed, count] of [[11, 0], [12, 1], [13, 12], [14, 200]]) {
    const rand = lehmer(seed);
    const items = times(count, () => { const x0 = between(rand, 0, 500); const y0 = between(rand, 0, 300); return { x0, y0, x1: x0 + between(rand, 1, 60), y1: y0 + between(rand, 1, 60) }; });
    const queries = times(200, () => [between(rand, -10, 560), between(rand, -10, 360), [6, 0, 20][Math.floor(rand() * 3)]]);
    boxes.push({ count, items, queries: queries.map(([x, y, r]) => ({ x, y, r, index: (() => { const hit = mod.boxAt(items, x, y, (b) => b, r); return hit ? items.indexOf(hit) : -1; })() })) });
  }
  return { points: out, boxes };
};

export const geometryCases = { path, downsample, stack, color, brush, hitTest };
