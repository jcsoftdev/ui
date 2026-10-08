// Pure layout helpers of the hierarchy and matrix charts: hierarchy model,
// squarified treemap, partition (sunburst/icicle), sector paths, calendar grid and color scales.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

const bundle = await build({
  stdin: {
    contents: [
      "core/hierarchy.js",
      "core/color-scale.js",
      "heatmap-chart/calendar-layout.js",
      "heatmap-chart/heatmap-scale.js",
    ]
      .map((file) => `export * from ${JSON.stringify(join(charts, file))};`)
      .join("\n"),
    resolveDir: charts,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const close = (actual, expected, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} is not close to ${expected}`);
const area = (rect) => (rect.x1 - rect.x0) * (rect.y1 - rect.y0);

const sales = {
  name: "Ventas",
  children: [
    {
      name: "Servicios",
      children: [
        { name: "Corte clásico", value: 4200 },
        { name: "Degradado", value: 3100 },
        { name: "Barba", value: 1800 },
      ],
    },
    {
      name: "Productos",
      children: [
        { name: "Cera", value: 950 },
        { name: "Shampoo", value: 620 },
        { name: "Aceite", value: 0 },
      ],
    },
    { name: "Gift cards", value: 400 },
  ],
};

test("hierarchy sums values, drops empty branches and sorts largest first", () => {
  const root = lib.buildHierarchy(sales);
  assert.equal(root.value, 4200 + 3100 + 1800 + 950 + 620 + 400);
  assert.deepEqual(
    root.children.map((child) => child.name),
    ["Servicios", "Productos", "Gift cards"],
  );
  const products = root.children[1];
  assert.equal(products.children.length, 2, "zero-value leaf is dropped");
  assert.equal(products.value, 1570);
  assert.equal(products.children[0].branch, 1);
  assert.equal(products.children[0].depth, 2);
  assert.equal(lib.findNode(root, products.children[1].id)?.name, "Shampoo");
  assert.deepEqual(
    lib.ancestors(products.children[0]).map((node) => node.name),
    ["Ventas", "Productos", "Cera"],
  );
  assert.equal(lib.heightOf(root), 2);
  assert.equal(lib.descendants(root).length, 1 + 3 + 3 + 2);
});

test("squarify fills the rectangle with areas proportional to the values", () => {
  const values = [6, 6, 4, 3, 2, 2, 1];
  const rect = { x0: 0, y0: 0, x1: 600, y1: 400 };
  const rects = lib.squarify(values, rect);
  const total = values.reduce((sum, value) => sum + value, 0);
  close(
    rects.reduce((sum, item) => sum + area(item), 0),
    area(rect),
    1e-3,
  );
  rects.forEach((item, index) => {
    close(area(item), (area(rect) * values[index]) / total, 1e-3);
    assert.ok(
      item.x0 >= -1e-9 && item.y0 >= -1e-9 && item.x1 <= 600 + 1e-9 && item.y1 <= 400 + 1e-9,
    );
  });
  // Squarified rows stay close to squares; a slice layout of the same data would reach 17:1.
  const worst = Math.max(...rects.map(lib.aspectRatio));
  assert.ok(worst < 3, `worst aspect ratio ${worst}`);
});

test("squarify keeps zero values empty and never overlaps", () => {
  const rects = lib.squarify([5, 0, 3, 2], { x0: 10, y0: 10, x1: 110, y1: 60 });
  assert.equal(area(rects[1]), 0);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap =
        Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
        Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      assert.ok(overlap < 1e-6, `rects ${i} and ${j} overlap`);
    }
  }
});

test("nested treemap keeps every child inside its group, below the header", () => {
  const root = lib.buildHierarchy(sales);
  const cells = lib.treemapLayout(
    root,
    { x0: 0, y0: 0, x1: 800, y1: 500 },
    { maxDepth: 2, gap: 2, padding: 4, headerHeight: 22 },
  );
  const groups = cells.filter((cell) => cell.group);
  assert.ok(groups.length >= 1);
  for (const cell of cells.filter((item) => item.level === 2)) {
    const parent = cells.find((item) => item.node === cell.node.parent);
    assert.ok(parent?.group);
    assert.ok(cell.x0 >= parent.x0 && cell.x1 <= parent.x1);
    assert.ok(cell.y0 >= parent.y0 + 22 - 1e-9 && cell.y1 <= parent.y1);
  }
});

test("partition spans add up and map to a full turn", () => {
  const root = lib.buildHierarchy(sales);
  const spans = lib.partitionLayout(root);
  assert.deepEqual(spans.get(root.id), { x0: 0, x1: 1 });
  for (const node of lib.descendants(root)) {
    if (node.children.length === 0) continue;
    const parent = spans.get(node.id);
    const first = spans.get(node.children[0].id);
    const last = spans.get(node.children.at(-1).id);
    close(first.x0, parent.x0);
    close(last.x1, parent.x1);
    for (const child of node.children) {
      const span = spans.get(child.id);
      close(span.x1 - span.x0, ((parent.x1 - parent.x0) * child.value) / node.value);
    }
  }
  const angles = root.children.map((child) => {
    const span = spans.get(child.id);
    return (span.x1 - span.x0) * Math.PI * 2;
  });
  close(
    angles.reduce((sum, angle) => sum + angle, 0),
    Math.PI * 2,
  );
  close(angles[0], (Math.PI * 2 * 9100) / root.value);
});

test("zoomed view projects the focused node to the full extent", () => {
  const root = lib.buildHierarchy(sales);
  const spans = lib.partitionLayout(root);
  const services = root.children[0];
  const span = spans.get(services.id);
  const view = { x0: span.x0, x1: span.x1, depth: services.depth };
  assert.deepEqual(lib.projectSpan(span, services.depth, view), { x0: 0, x1: 1, level: 0 });
  const child = services.children[1];
  const projected = lib.projectSpan(spans.get(child.id), child.depth, view);
  close(projected.x1 - projected.x0, child.value / services.value);
  assert.equal(projected.level, 1);
  const halfway = lib.interpolateView({ x0: 0, x1: 1, depth: 0 }, view, 0.5);
  close(halfway.depth, 0.5);
  close(halfway.x1, (1 + span.x1) / 2);
});

test("sector paths draw slices, rings and nothing for empty spans", () => {
  assert.equal(lib.sectorPath(0, 0, 10, 20, 1, 1), "");
  const slice = lib.sectorPath(100, 100, 40, 80, 0, Math.PI / 2);
  assert.match(slice, /^M100\.00,20\.00A80,80 0 0 1 180\.00,100\.00L140\.00,100\.00A40,40 0 0 0/);
  const ring = lib.sectorPath(0, 0, 10, 20, 0, Math.PI * 2);
  assert.equal((ring.match(/A/g) ?? []).length, 4);
  const pie = lib.sectorPath(0, 0, 0, 20, 0, Math.PI);
  assert.ok(pie.endsWith("L0.00,0.00Z"));
});

test("calendar grid puts weeks in columns starting on Monday", () => {
  const days = [];
  for (let day = 1; day <= 31; day++) days.push({ date: new Date(2026, 6, day), value: day % 5 });
  const grid = lib.calendarGrid(days, new Date(2026, 6, 1), new Date(2026, 7, 9));
  // 1 Jul 2026 is a Wednesday: its week starts on Monday 29 Jun.
  assert.equal(grid.weeks[0].getDate(), 29);
  assert.equal(grid.weeks[0].getDay(), 1);
  assert.equal(grid.cells[0][0], undefined, "Monday 29 Jun is outside the range");
  assert.equal(grid.cells[2][0].value, 1);
  assert.equal(grid.cells[3][1].date.getDate(), 9);
  assert.equal(grid.cells[6].at(-1).value, null, "a day in range without data is null");
  assert.deepEqual(
    grid.monthStarts.map((start) => start.date.getMonth()),
    [6, 7],
  );
});

test("color scales clamp, diverge around the center and step through ranges", () => {
  assert.equal(lib.normalize(5, 0, 10), 0.5);
  assert.equal(lib.normalize(50, 0, 10), 1);
  const high = lib.sequentialColor(10, [0, 10]);
  assert.equal(high.strength, 100);
  assert.equal(high.color, "var(--accent-word)");
  assert.ok(lib.sequentialColor(0, [0, 10]).strength > 0);
  const below = lib.divergingColor(-5, [-10, 10], 0);
  assert.match(below.color, /var\(--chart-cat-1\) 50%/);
  assert.equal(lib.divergingColor(0, [-10, 10], 0).color, "var(--surface-2)");
  const ranges = [
    { to: 1, label: "Sin citas" },
    { from: 1, to: 6, label: "1-5" },
    { from: 6, label: "6+" },
  ];
  assert.equal(lib.rangeIndex(0, ranges), 0);
  assert.equal(lib.rangeIndex(5.5, ranges), 1);
  assert.equal(lib.rangeIndex(40, ranges), 2);
  const scale = lib.heatmapScale([2, 8], { ranges });
  assert.ok(scale.color(8).strength > scale.color(2).strength);
});
