// Pure layouts of the node-link charts: tidy tree (TreeChart) and sankey (SankeyChart).
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const charts = join(here, "../src/charts");

const bundle = await build({
  stdin: {
    contents: ["core/tree-layout.ts", "core/tree-fit.ts", "core/sankey.ts"]
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

const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, message ?? `${actual} != ${expected}`);

/** Uneven team: one big branch, a lone node, another big branch, plus a deep chain. */
function team() {
  const card = (id, children) => ({ id, width: 160, height: 56, children });
  return card("owner", [
    card("miraflores", [
      card("m1"),
      card("m2"),
      card("m3"),
      card("m4", [card("m4a"), card("m4b")]),
    ]),
    card("solo"),
    card("surco", [
      card("s1"),
      card("s2", [card("s2a", [card("s2a1"), card("s2a2")])]),
      card("s3"),
    ]),
    card("barranco", [card("b1")]),
  ]);
}

function overlaps(a, b, gap) {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap - 1e-6 &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 1e-6
  );
}

for (const direction of ["top", "bottom", "left", "right"]) {
  test(`tree layout (${direction}): boxes never overlap and stay inside the bounds`, () => {
    const layout = lib.treeLayout(team(), { direction, siblingGap: 20, levelGap: 40 });
    assert.equal(layout.nodes.length, 18);
    const vertical = direction === "top" || direction === "bottom";
    for (const [i, a] of layout.nodes.entries()) {
      assert.ok(a.x - a.width / 2 >= -1e-6 && a.x + a.width / 2 <= layout.width + 1e-6);
      assert.ok(a.y - a.height / 2 >= -1e-6 && a.y + a.height / 2 <= layout.height + 1e-6);
      for (const b of layout.nodes.slice(i + 1)) {
        // Same level: at least the sibling gap across the breadth axis. Any pair: no overlap.
        const [p, q] = vertical ? [a, b] : [swap(a), swap(b)];
        assert.ok(!overlaps(p, q, a.depth === b.depth ? 20 : 0), `${a.id} overlaps ${b.id}`);
      }
    }
  });
}

function swap(node) {
  return { ...node, x: node.y, y: node.x, width: node.height, height: node.width };
}

test("tree layout centres parents over their children and keeps levels apart", () => {
  const layout = lib.treeLayout(team(), { direction: "top", levelGap: 40 });
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  for (const node of layout.nodes) {
    const children = layout.nodes.filter((child) => child.parentId === node.id);
    if (children.length === 0) continue;
    close(node.x, (children[0].x + children.at(-1).x) / 2);
    for (const child of children) close(child.y - node.y, 56 + 40);
  }
  // Root at the top in "top", at the bottom in "bottom", at the left in "left".
  close(byId.get("owner").y, 28);
  const bottom = lib.treeLayout(team(), { direction: "bottom" });
  close(bottom.nodes[0].y, bottom.height - 28);
  const left = lib.treeLayout(team(), { direction: "left" });
  close(left.nodes[0].x, 80);
});

test("tree keyboard moves follow the drawing direction", () => {
  const layout = lib.treeLayout(team(), { direction: "top" });
  assert.equal(lib.treeKeyMove("ArrowDown", "top"), "child");
  assert.equal(lib.treeKeyMove("ArrowRight", "left"), "child");
  assert.equal(lib.treeKeyMove("ArrowDown", "left"), "next");
  assert.equal(lib.treeNeighbor(layout.nodes, "owner", "child"), "solo");
  assert.equal(lib.treeNeighbor(layout.nodes, "solo", "next"), "surco");
  assert.equal(lib.treeNeighbor(layout.nodes, "miraflores", "previous"), "miraflores");
  assert.equal(lib.treeNeighbor(layout.nodes, "s2a1", "parent"), "s2a");
  assert.deepEqual(lib.treePathToRoot(layout.nodes, "s2a1"), [
    "owner",
    "surco",
    "s2",
    "s2a",
    "s2a1",
  ]);
});

const origin = [
  { id: "ig", name: "Instagram" },
  { id: "ref", name: "Referidos" },
  { id: "walk", name: "Paso por la tienda" },
  { id: "corte", name: "Corte" },
  { id: "barba", name: "Barba" },
  { id: "combo", name: "Corte + barba" },
  { id: "yape", name: "Yape" },
  { id: "card", name: "Tarjeta" },
  { id: "cash", name: "Efectivo" },
];
const flows = [
  { source: "ig", target: "corte", value: 120 },
  { source: "ig", target: "combo", value: 60 },
  { source: "ref", target: "corte", value: 80 },
  { source: "ref", target: "barba", value: 40 },
  { source: "walk", target: "corte", value: 50 },
  { source: "walk", target: "barba", value: 30 },
  { source: "walk", target: "combo", value: 20 },
  { source: "corte", target: "yape", value: 140 },
  { source: "corte", target: "card", value: 60 },
  { source: "corte", target: "cash", value: 50 },
  { source: "barba", target: "yape", value: 40 },
  { source: "barba", target: "cash", value: 30 },
  { source: "combo", target: "card", value: 50 },
  { source: "combo", target: "yape", value: 30 },
];

test("sankey conserves flow: node values, band widths and both ends add up", () => {
  const graph = lib.sankeyLayout(origin, flows, { width: 600, height: 400, nodePadding: 10 });
  assert.equal(graph.columns, 3);
  assert.equal(graph.removed.length, 0);
  const total = (ids) =>
    graph.nodes.filter((n) => ids.includes(n.id)).reduce((s, n) => s + n.value, 0);
  assert.equal(total(["ig", "ref", "walk"]), 400);
  assert.equal(total(["yape", "card", "cash"]), 400);
  for (const node of graph.nodes) {
    const inSum = node.incoming.reduce((sum, link) => sum + link.value, 0);
    const outSum = node.outgoing.reduce((sum, link) => sum + link.value, 0);
    if (node.incoming.length && node.outgoing.length) assert.equal(inSum, outSum, node.id);
    close(node.y1 - node.y0, node.value * graph.ky);
    // Bands fill the node exactly on each side that has links.
    for (const side of [node.incoming, node.outgoing]) {
      if (side.length === 0) continue;
      close(
        side.reduce((sum, link) => sum + link.width, 0),
        node.y1 - node.y0,
      );
    }
    for (const link of node.outgoing) {
      assert.ok(
        link.y0 - link.width / 2 >= node.y0 - 1e-6 && link.y0 + link.width / 2 <= node.y1 + 1e-6,
      );
    }
  }
});

test("sankey columns never overlap and stay inside the box", () => {
  const graph = lib.sankeyLayout(origin, flows, { width: 600, height: 400, nodePadding: 10 });
  for (let c = 0; c < graph.columns; c++) {
    const column = graph.nodes.filter((node) => node.column === c).sort((a, b) => a.y0 - b.y0);
    for (const [i, node] of column.entries()) {
      assert.ok(node.y0 >= -1e-6 && node.y1 <= 400 + 1e-6, node.id);
      if (i > 0) assert.ok(node.y0 >= column[i - 1].y1 + 10 - 1e-6, `${node.id} overlaps`);
    }
  }
});

test("sankey cuts the light return flow of a cycle, not a main flow", () => {
  const graph = lib.sankeyLayout(origin, [...flows, { source: "yape", target: "ref", value: 30 }], {
    width: 600,
    height: 400,
  });
  assert.deepEqual(
    graph.removed.map(({ link, reason }) => `${link.source}->${link.target}:${reason}`),
    ["yape->ref:cycle"],
  );
  assert.equal(graph.links.length, flows.length);
});

test("sankey breaks cycles and drops invalid links, reporting why", () => {
  const graph = lib.sankeyLayout(
    [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ],
    [
      { source: "a", target: "b", value: 5 },
      { source: "b", target: "c", value: 5 },
      { source: "c", target: "a", value: 2 },
      { source: "a", target: "a", value: 1 },
      { source: "a", target: "z", value: 1 },
      { source: "b", target: "c", value: 0 },
    ],
    { width: 300, height: 200 },
  );
  assert.deepEqual(graph.removed.map((entry) => entry.reason).sort(), [
    "cycle",
    "invalid-value",
    "self",
    "unknown-node",
  ]);
  assert.equal(graph.links.length, 2);
  assert.deepEqual(
    graph.nodes.map((node) => node.column),
    [0, 1, 2],
  );
});

test("treeFitView contains when legible, else centres the root at a readable scale", () => {
  const layout = lib.treeLayout(team(), { direction: "top", siblingGap: 20, levelGap: 40 });
  const wide = lib.treeFitView(layout, 1600, 600, "top");
  assert.equal(wide.mode, "contain");
  assert.ok(wide.view.k >= 0.6);

  const narrow = lib.treeFitView(layout, 320, 420, "top", { inset: 36 });
  assert.equal(narrow.mode, "readable");
  assert.ok(narrow.view.k >= 0.85 && narrow.view.k <= 1);
  const root = layout.nodes[0];
  close(narrow.view.x + root.x * narrow.view.k, 160, "root is centred across");
  assert.ok(narrow.view.y + (root.y - root.height / 2) * narrow.view.k >= 36, "below the toolbar");

  assert.equal(lib.treeFitView(layout, 320, 420, "top", { mode: "contain" }).mode, "contain");
  assert.equal(lib.treeFitView(layout, 1600, 600, "top", { mode: "readable" }).mode, "readable");

  const left = lib.treeLayout(team(), { direction: "left" });
  const view = lib.treeFitView(left, 320, 420, "left", { mode: "readable" }).view;
  close(view.x + (left.nodes[0].x - left.nodes[0].width / 2) * view.k, 16, "root on the left edge");

  const radialView = lib.treeFitView(layout, 320, 420, "left", {
    mode: "readable",
    centerRoot: true,
  }).view;
  close(radialView.x + layout.nodes[0].x * radialView.k, 160, "radial root centred across");
  close(radialView.y + layout.nodes[0].y * radialView.k, 210, "radial root centred down");

  for (const direction of ["left", "right"]) {
    const side = lib.treeLayout(team(), { direction });
    const fit = lib.treeFitView(side, 320, 420, direction, { mode: "readable", inset: 36 }).view;
    const topEdge = Math.min(...side.nodes.map((node) => node.y - node.height / 2));
    assert.ok(fit.y + topEdge * fit.k >= 36, `${direction}: no card under the toolbar band`);
  }
});
