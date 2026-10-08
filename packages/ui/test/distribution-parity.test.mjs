// Pure helpers added for distribution, scatter, heatmap and trellis parity.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const points = await load("../src/charts/core/distribution/points.ts");

test("jitterValues is deterministic and bounded by the reach", () => {
  const values = [10, 12, 12, 15, 40, null, Number.NaN];
  const a = points.jitterValues(values, 7, 6);
  const b = points.jitterValues(values, 7, 6);
  assert.deepEqual(a, b);
  assert.equal(a.length, 5);
  for (const item of a) assert.ok(Math.abs(item.offset) <= 6);
  const other = points.jitterValues(values, 8, 6);
  assert.notDeepEqual(a, other);
});

test("jitterValues follows a per-value reach", () => {
  const out = points.jitterValues([1, 2, 3], 3, (value) => (value === 2 ? 0 : 10));
  assert.equal(Math.abs(out[1].offset), 0);
  assert.ok(Math.abs(out[0].offset) <= 10);
});

test("groupSeed separates groups", () => {
  assert.notEqual(points.groupSeed(1, 0, 0), points.groupSeed(1, 1, 0));
  assert.notEqual(points.groupSeed(1, 0, 0), points.groupSeed(1, 0, 1));
});

const stack = await load("../src/charts/core/distribution/dot-stack.ts");

test("packDots keeps every dot inside the lane and above the baseline", () => {
  const dots = stack.packDots(23, 40, 3, 1);
  assert.equal(dots.length, 23);
  for (const dot of dots) {
    assert.ok(dot.x - 3 >= -1e-9 && dot.x + 3 <= 40 + 1e-9);
    assert.ok(dot.y >= 3);
  }
});

test("packDots never overlaps two dots", () => {
  const dots = stack.packDots(30, 36, 2.5, 1);
  for (let i = 0; i < dots.length; i += 1) {
    for (let j = i + 1; j < dots.length; j += 1) {
      const d = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
      assert.ok(d >= 5 - 1e-9, `dots ${i} and ${j} overlap`);
    }
  }
});

test("explodeBins shares one radius that fits the fullest bin", () => {
  const { radius, stacks } = stack.explodeBins(
    [
      { count: 2, width: 30, height: 30 },
      { count: 40, width: 30, height: 40 },
    ],
    { maxRadius: 6, minRadius: 1.5 },
  );
  assert.ok(radius < 6 && radius >= 1.5);
  assert.deepEqual(
    stacks.map((s) => s.length),
    [2, 40],
  );
  const top = Math.max(...stacks[1].map((dot) => dot.y + radius));
  assert.ok(top <= 40 + 1e-9);
});

test("fitRadius falls back to the minimum when nothing fits", () => {
  assert.equal(stack.fitRadius({ count: 500, width: 10, height: 10 }, { minRadius: 1.5 }), 1.5);
});

const pointIndex = await load("../src/charts/core/distribution/point-index.ts");
const layoutMod = await load("../src/charts/core/distribution/layout.ts");

test("createPointIndex matches a brute-force nearest search", () => {
  let state = 42;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  const pts = Array.from({ length: 4000 }, () => ({
    x: random() * 600,
    y: random() * 300,
    r: random() < 0.1 ? 3 + random() * 8 : 1.5,
  }));
  const index = pointIndex.createPointIndex(pts, 24);
  for (let i = 0; i < 300; i += 1) {
    const x = random() * 600;
    const y = random() * 300;
    const found = index.nearest(x, y, 16);
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestRadius = Number.POSITIVE_INFINITY;
    pts.forEach((p, n) => {
      const d = Math.max(0, Math.hypot(p.x - x, p.y - y) - p.r);
      if (d > 16) return;
      if (d < bestDistance || (d === bestDistance && p.r < bestRadius)) {
        best = n;
        bestDistance = d;
        bestRadius = p.r;
      }
    });
    assert.equal(found, best);
  }
});

test("createPointIndex returns null when nothing is in reach and skips holes", () => {
  const index = pointIndex.createPointIndex([null, { x: 10, y: 10 }, { x: Number.NaN, y: 1 }]);
  assert.equal(index.nearest(200, 200, 16), null);
  assert.equal(index.nearest(12, 11, 16), 1);
});

test("a small bubble inside a big one stays reachable", () => {
  const index = pointIndex.createPointIndex([
    { x: 50, y: 50, r: 30 },
    { x: 52, y: 50, r: 4 },
  ]);
  assert.equal(index.nearest(52, 50, 4), 1);
});

test("xyLayout with xTime places calendar ticks on midnights", () => {
  const start = new Date(2026, 9, 1, 9).getTime();
  const end = new Date(2026, 9, 21, 18).getTime();
  const layout = layoutMod.xyLayout({
    width: 640,
    height: 300,
    xExtent: [start, end],
    yExtent: [0, 100],
    xTime: true,
  });
  assert.ok(layout.xTicks.length >= 3);
  for (const tick of layout.xTicks) {
    const date = new Date(tick.key);
    assert.equal(date.getHours(), 0);
  }
  assert.equal(layout.xScale.type, "time");
});

test("xyLayout with xTime falls back to clock ticks inside one day", () => {
  const start = new Date(2026, 9, 1, 9).getTime();
  const end = new Date(2026, 9, 1, 18).getTime();
  const layout = layoutMod.xyLayout({
    width: 640,
    height: 300,
    xExtent: [start, end],
    yExtent: [0, 100],
    xTime: true,
  });
  assert.ok(layout.xTicks.length >= 2);
  assert.match(layout.xTicks[0].label, /\d/);
});

const hex = await load("../src/charts/heatmap-chart/hex-layout.ts");
const datetime = await load("../src/charts/heatmap-chart/datetime-columns.ts");

test("hexLayout fits the area and hit-tests every cell centre", () => {
  const layout = hex.hexLayout({ rows: 7, columns: 12, width: 520, height: 260 });
  assert.ok(layout.radius > 0);
  const right = layout.originX + layout.stepX * 12.5;
  const bottom = layout.originY + layout.stepY * 6 + 2 * layout.radius;
  assert.ok(right <= 520 + 1e-6);
  assert.ok(bottom <= 260 + 1e-6);
  for (let row = 0; row < 7; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const c = layout.center(row, column);
      assert.deepEqual(layout.cellAt(c.x, c.y), { row, column });
    }
  }
});

test("hexLayout hit-testing is nearest-centre and null outside", () => {
  const layout = hex.hexLayout({ rows: 5, columns: 8, width: 400, height: 240 });
  let state = 9;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  for (let i = 0; i < 300; i += 1) {
    const x = random() * 400;
    const y = random() * 240;
    const hit = layout.cellAt(x, y);
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const c = layout.center(row, column);
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bestDistance) {
          best = { row, column };
          bestDistance = d;
        }
      }
    }
    if (hit) {
      const c = layout.center(hit.row, hit.column);
      assert.ok(
        Math.hypot(c.x - x, c.y - y) <= bestDistance + 1e-6,
        JSON.stringify({ x, y, hit, best }),
      );
    }
  }
  assert.equal(layout.cellAt(-50, -50), null);
  assert.equal(layout.cellAt(5000, 5000), null);
});

test("hexPath draws six vertices", () => {
  const path = hex.hexPath(10, 10, 5);
  assert.equal(path.split("L").length, 6);
  assert.ok(path.startsWith("M") && path.endsWith("Z"));
});

test("datetimeColumnLabels labels calendar boundaries only", () => {
  const dates = Array.from({ length: 60 }, (_, i) => new Date(2026, 8, 1 + i));
  const labels = datetime.datetimeColumnLabels(dates);
  const shown = labels.filter(Boolean);
  assert.ok(shown.length >= 2 && shown.length <= 12);
  labels.forEach((label, index) => {
    if (label) assert.ok(dates[index].getDay() === 1 || dates[index].getDate() === 1);
  });
});

test("datetimeColumnLabels falls back to clock times inside a day", () => {
  const dates = Array.from({ length: 6 }, (_, i) => new Date(2026, 9, 1, 9 + i));
  const labels = datetime.datetimeColumnLabels(dates);
  assert.equal(labels.length, 6);
  assert.ok(labels.every((label) => /\d/.test(label)));
});

const grid = await load("../src/charts/chart-grid/grid-math.ts");

test("gridColumns follows the container width", () => {
  const options = { minPanelWidth: 220, maxColumns: 4, gap: 16 };
  assert.equal(grid.gridColumns(320, 6, options), 1);
  assert.equal(grid.gridColumns(480, 6, options), 2);
  assert.equal(grid.gridColumns(760, 6, options), 3);
  assert.equal(grid.gridColumns(2000, 6, options), 4);
  assert.equal(grid.gridColumns(2000, 2, options), 2);
  assert.equal(grid.gridColumns(100, 0, options), 1);
});

test("panelWidth subtracts the gaps", () => {
  assert.equal(grid.panelWidth(748, 3, 16), 238.66666666666666);
  assert.equal(grid.panelWidth(300, 1, 16), 300);
});

test("sharedDomain unions extents and rounds to ticks", () => {
  assert.deepEqual(grid.unionExtent([[3, 9], null, [1, 4], [Number.NaN, 2]]), [1, 9]);
  assert.equal(grid.unionExtent([null, undefined]), null);
  const domain = grid.sharedDomain([
    [123, 480],
    [90, 310],
  ]);
  assert.ok(domain[0] <= 90 && domain[1] >= 480);
  assert.deepEqual(grid.sharedDomain([[12, 40]], { includeZero: true, nice: false }), [0, 40]);
});
