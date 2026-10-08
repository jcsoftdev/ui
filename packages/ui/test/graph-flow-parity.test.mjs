// Pure logic added for Gantt (critical path, year zoom), export, tree layouts and sankey/chord.
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
      "core/gantt.ts",
      "core/export.ts",
      "core/tree-layout.ts",
      "core/tree-radial.ts",
      "tree-chart/tree-model.ts",
      "core/sankey.ts",
      "core/chord.ts",
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

const day = (d) => +new Date(2026, 9, d);

test("criticalPath finds the zero-slack chain and the slack of the rest", () => {
  const tasks = [
    { id: "a", start: day(1), end: day(4) },
    { id: "b", start: day(4), end: day(10), dependencies: ["a"] },
    { id: "c", start: day(4), end: day(6), dependencies: ["a"] },
    { id: "d", start: day(10), end: day(12), dependencies: ["b", "c"] },
  ];
  const cp = lib.criticalPath(tasks);
  assert.deepEqual([...cp.tasks].sort(), ["a", "b", "d"]);
  assert.equal(cp.end, day(12));
  assert.equal(cp.slack.get("c"), day(10) - day(6));
  assert.ok(cp.links.has("a>b") && cp.links.has("b>d"));
  assert.ok(!cp.links.has("a>c") && !cp.links.has("c>d"));
});

test("criticalPath: a task waiting for its own start date gives the predecessor slack", () => {
  const tasks = [
    { id: "a", start: day(1), end: day(3) },
    { id: "b", start: day(8), end: day(10), dependencies: ["a"] },
  ];
  const cp = lib.criticalPath(tasks);
  assert.deepEqual([...cp.tasks], ["b"]);
  assert.equal(cp.slack.get("a"), day(8) - day(3));
  assert.equal(cp.links.size, 0);
});

test("criticalPath expands parent dependencies and survives cycles and missing ids", () => {
  const tasks = [
    { id: "fase", start: day(1), end: day(5) },
    { id: "f1", parentId: "fase", start: day(1), end: day(3) },
    { id: "f2", parentId: "fase", start: day(2), end: day(5) },
    { id: "z", start: day(5), end: day(7), dependencies: ["fase", "ghost"] },
    { id: "x", start: day(1), end: day(2), dependencies: ["y"] },
    { id: "y", start: day(1), end: day(2), dependencies: ["x"] },
  ];
  const cp = lib.criticalPath(tasks);
  assert.ok(cp.tasks.has("f2") && cp.tasks.has("z"));
  assert.ok(!cp.tasks.has("f1"));
  assert.ok(!cp.tasks.has("x") && !cp.tasks.has("y"));
  assert.equal(cp.slack.get("f1"), day(5) - day(3));
});

test("year zoom pads to whole years and fits quarters in the header", () => {
  const domain = lib.ganttDomain([day(3), day(20)], "year");
  assert.equal(domain[0], +new Date(2026, 0, 1));
  assert.equal(domain[1], +new Date(2027, 0, 1));
  const scale = lib.ganttScale(domain, "year");
  const header = lib.ganttHeader(scale, "year");
  assert.equal(header.top.length, 1);
  assert.equal(header.bottom.length, 4);
  assert.ok(lib.GANTT_ZOOM_ORDER.includes("year"));
});

test("exportFileName slugifies titles and stackLayout stacks drawings", () => {
  assert.equal(
    lib.exportFileName("Remodelación de la sede San Isidro", "svg"),
    "remodelacion-de-la-sede-san-isidro.svg",
  );
  assert.equal(lib.exportFileName("¡¡", "png"), "chart.png");
  const stack = lib.stackLayout(
    [
      { width: 300, height: 48 },
      { width: 280, height: 200 },
    ],
    4,
  );
  assert.deepEqual(stack.positions, [
    { x: 0, y: 0 },
    { x: 0, y: 52 },
  ]);
  assert.equal(stack.width, 300);
  assert.equal(stack.height, 252);
  assert.equal(lib.stackLayout([]).height, 0);
});

const box = (id, children) => ({ id, width: 100, height: 30, children });
const sample = box("r", [
  box("a", [box("a1"), box("a2"), box("a3")]),
  box("b", [box("b1")]),
  box("c"),
]);

test("radialTreeLayout: rings by depth, leaves spread over the circle, parents between their leaves", () => {
  const layout = lib.radialTreeLayout(sample, { levelGap: 100 });
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const center = layout.center;
  const radius = (id) => Math.hypot(byId.get(id).x - center.x, byId.get(id).y - center.y);
  assert.ok(radius("r") < 1e-6);
  assert.ok(radius("a") >= 100 - 1e-6 && radius("a1") > radius("a"));
  assert.ok(Math.abs(radius("a") - radius("b")) < 1e-6);
  const angles = ["a1", "a2", "a3", "b1", "c"].map((id) => byId.get(id).angle);
  for (let i = 1; i < angles.length; i += 1) assert.ok(angles[i] > angles[i - 1]);
  assert.ok(Math.abs(byId.get("a").angle - byId.get("a2").angle) < 1e-9);
  assert.ok(layout.nodes.every((n) => n.x - n.width / 2 >= -1e-6 && n.y - n.height / 2 >= -1e-6));
});

test("radialTreeLayout pushes crowded rings outwards so boxes do not overlap", () => {
  const wide = box(
    "r",
    Array.from({ length: 40 }, (_, i) => box(`n${i}`)),
  );
  const layout = lib.radialTreeLayout(wide, { levelGap: 20, siblingGap: 10 });
  const ring = layout.nodes.filter((n) => n.depth === 1);
  const r = Math.hypot(ring[0].x - layout.center.x, ring[0].y - layout.center.y);
  assert.ok(r * 2 * Math.PI >= 40 * 30);
});

test("radialEdgePath starts at the parent and ends at the child for every style", () => {
  const center = { x: 100, y: 100 };
  const parent = { x: 100, y: 40 };
  const child = { x: 160, y: 100 };
  for (const style of ["curved", "step", "straight"]) {
    const d = lib.radialEdgePath(parent, child, center, style);
    assert.ok(d.startsWith("M100,40"), style);
    assert.ok(d.endsWith("160,100"), style);
  }
  assert.ok(lib.radialEdgePath(parent, child, center, "step").includes("A60,60"));
  const around = lib.toPolar(child, center);
  assert.ok(Math.abs(around.angle - Math.PI / 2) < 1e-9 && Math.abs(around.radius - 60) < 1e-9);
});

test("dendrogramLayout puts every leaf on the last level and centres parents", () => {
  const layout = lib.dendrogramLayout(sample, { direction: "top", siblingGap: 10, levelGap: 40 });
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const leafY = byId.get("a1").y;
  for (const id of ["a2", "a3", "b1", "c"]) assert.equal(byId.get(id).y, leafY);
  assert.ok(byId.get("a").y < leafY && byId.get("r").y < byId.get("a").y);
  assert.equal(byId.get("a").x, (byId.get("a1").x + byId.get("a3").x) / 2);
  assert.equal(byId.get("r").x, (byId.get("a").x + byId.get("c").x) / 2);
  const left = lib.dendrogramLayout(sample, { direction: "left" });
  const leftById = new Map(left.nodes.map((n) => [n.id, n]));
  assert.equal(leftById.get("c").x, leftById.get("a1").x);
  assert.ok(leftById.get("r").x < leftById.get("a1").x);
  const sorted = [...layout.nodes].filter((n) => n.y === leafY).sort((p, q) => p.x - q.x);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(sorted[i].x - sorted[i - 1].x >= 100 + 10 - 1e-9);
  }
});

const person = (id, name, children, extra = {}) => ({ id, name, children, ...extra });
const org = person("o", "Carlos", [
  person("m", "Lucía Paredes", [
    person("k1", "Kevin"),
    person("k2", "Diego"),
    person("k3", "Andrea"),
    person("k4", "Mateo", [person("p1", "Piero")]),
  ]),
  person("s", "Jorge", [person("l1", "Luis"), person("l2", "Renzo")]),
]);

test("groupLeaves folds runs of leaf siblings into a collapsed group and keeps other children", () => {
  const grouped = lib.groupLeaves(org, 3, (n) => `${n} más`);
  const lucia = grouped.children[0];
  assert.deepEqual(
    lucia.children.map((c) => c.id),
    ["k4", "m~leaves"],
  );
  const group = lucia.children[1];
  assert.equal(group.name, "3 más");
  assert.equal(group.group, true);
  assert.equal(group.collapsed, true);
  assert.deepEqual(
    group.children.map((c) => c.id),
    ["k1", "k2", "k3"],
  );
  assert.equal(group.subtitle, "Kevin, Diego, Andrea");
  // below the threshold nothing changes
  assert.deepEqual(
    grouped.children[1].children.map((c) => c.id),
    ["l1", "l2"],
  );
  assert.equal(lib.groupLeaves(org, 10).children[0].children.length, 4);
});

test("searchTree matches name, subtitle and badge without accents, in document order", () => {
  const model = lib.buildTreeModel(
    person("o", "Carlos", [
      person("a", "Lucía Paredes", [], { subtitle: "Encargada", badge: "Miraflores" }),
      person("b", "Luis Núñez", [], { subtitle: "Barbero" }),
    ]),
  );
  assert.deepEqual(
    lib.searchTree(model, "lucia").map((n) => n.id),
    ["o/a"],
  );
  assert.deepEqual(
    lib.searchTree(model, "LU").map((n) => n.id),
    ["o/a", "o/b"],
  );
  assert.deepEqual(
    lib.searchTree(model, "nunez barbero").map((n) => n.id),
    ["o/b"],
  );
  assert.deepEqual(
    lib.searchTree(model, "miraflores encargada").map((n) => n.id),
    ["o/a"],
  );
  assert.deepEqual(lib.searchTree(model, "   "), []);
  const node = model.byId.get("o/b");
  assert.deepEqual(lib.ancestorIds(node), ["o"]);
});

test("buildTreeModel takes lazily loaded children and flags nodes still to load", () => {
  const data = person("o", "Carlos", [
    person("x", "Rosa", undefined, { lazy: true, childCount: 2 }),
  ]);
  const before = lib.buildTreeModel(data);
  assert.equal(before.byId.get("o/x").lazy, true);
  const loaded = new Map([["o/x", [person("y1", "Héctor"), person("y2", "Iván")]]]);
  const after = lib.buildTreeModel(data, loaded);
  const rosa = after.byId.get("o/x");
  assert.equal(rosa.lazy, false);
  assert.deepEqual(
    rosa.children.map((c) => c.id),
    ["o/x/y1", "o/x/y2"],
  );
  assert.equal(lib.subtreeSize(after.root), 3);
});

test("edgeColorOf: branch uses the node color, depth cycles the palette, neutral is the line token", () => {
  const model = lib.buildTreeModel(org);
  const kevin = model.byId.get("o/m/k1");
  assert.equal(lib.edgeColorOf(kevin, "branch"), kevin.color);
  assert.equal(lib.edgeColorOf(kevin, "neutral"), "var(--line-strong)");
  assert.notEqual(lib.edgeColorOf(kevin, "depth"), lib.edgeColorOf(model.byId.get("o/m"), "depth"));
});

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("chordLayout: arcs are proportional to the row sums and ribbons pair the two ends", () => {
  const matrix = [
    [0, 10, 5],
    [4, 0, 6],
    [2, 3, 0],
  ];
  const pad = 0.1;
  const layout = lib.chordLayout(matrix, { padAngle: pad });
  const total = 15 + 10 + 5;
  const k = (2 * Math.PI - pad * 3) / total;
  layout.groups.forEach((group, i) => {
    assert.ok(near(group.endAngle - group.startAngle, [15, 10, 5][i] * k));
  });
  assert.ok(near(layout.groups[1].startAngle - layout.groups[0].endAngle, pad));
  assert.equal(layout.chords.length, 3);
  const pair = layout.chords.find((c) => c.source.index + c.target.index === 1);
  assert.equal(pair.source.value, 10);
  assert.equal(pair.target.value, 4);
  assert.ok(near(pair.source.endAngle - pair.source.startAngle, 10 * k));
  for (const chord of layout.chords) {
    for (const end of [chord.source, chord.target]) {
      const group = layout.groups[end.index];
      assert.ok(end.startAngle >= group.startAngle - 1e-9 && end.endAngle <= group.endAngle + 1e-9);
    }
  }
});

test("chordLayout sorts groups, ignores bad numbers and handles empty input", () => {
  const sorted = lib.chordLayout(
    [
      [0, 1],
      [5, 0],
    ],
    { sortGroups: "descending", padAngle: 0 },
  );
  assert.ok(sorted.groups[1].startAngle < sorted.groups[0].startAngle);
  assert.deepEqual(lib.chordLayout([]), { groups: [], chords: [] });
  assert.deepEqual(
    lib.chordLayout([
      [0, -1],
      [Number.NaN, 0],
    ]),
    { groups: [], chords: [] },
  );
  const loop = lib.chordLayout([[4]], { padAngle: 0 });
  assert.equal(loop.chords.length, 1);
  assert.equal(loop.chords[0].source.index, loop.chords[0].target.index);
});

test("ribbonPath closes and groupAt finds the arc under an angle", () => {
  const layout = lib.chordLayout(
    [
      [0, 3],
      [2, 0],
    ],
    { padAngle: 0.2 },
  );
  const d = lib.ribbonPath(layout.chords[0], 100);
  assert.ok(d.startsWith("M") && d.endsWith("Z"));
  assert.equal((d.match(/A100,100/g) ?? []).length, 2);
  const g0 = layout.groups[0];
  assert.equal(lib.groupAt(layout, (g0.startAngle + g0.endAngle) / 2), 0);
  assert.equal(lib.groupAt(layout, g0.endAngle + 0.1), -1);
  assert.equal(lib.chordsOf(layout, 0).length, 1);
});

const sankeyNodes = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id }));
const sankeyLinks = [
  { source: "a", target: "c", value: 4 },
  { source: "b", target: "c", value: 2 },
  { source: "c", target: "d", value: 4 },
  { source: "c", target: "e", value: 2 },
];

test("sankeyTraceOf lights everything upstream of the source and downstream of the target", () => {
  const graph = lib.sankeyLayout(sankeyNodes, sankeyLinks, { width: 400, height: 200 });
  const link = graph.links.find((l) => l.id === "a->c");
  const trace = lib.sankeyTraceOf(link);
  assert.deepEqual([...trace.nodes].sort(), ["a", "c", "d", "e"]);
  assert.deepEqual([...trace.links].sort(), ["a->c", "c->d", "c->e"]);
  const tail = lib.sankeyTraceOf(graph.links.find((l) => l.id === "c->d"));
  assert.deepEqual([...tail.nodes].sort(), ["a", "b", "c", "d"]);
  assert.ok(tail.links.has("b->c") && !tail.links.has("c->e"));
});

test("sankeyDiff merges two periods, summing repeated pairs and reserving the larger width", () => {
  const diff = lib.sankeyDiff(
    [
      { source: "a", target: "c", value: 5 },
      { source: "a", target: "c", value: 1 },
      { source: "b", target: "c", value: 3 },
    ],
    [
      { source: "a", target: "c", value: 4 },
      { source: "c", target: "d", value: 2 },
      { source: "x", target: "y", value: -3 },
    ],
  );
  const by = Object.fromEntries(diff.map((d) => [`${d.source}>${d.target}`, d]));
  assert.equal(diff.length, 3);
  const ac = by["a>c"];
  assert.deepEqual([ac.before, ac.after, ac.delta, ac.value], [6, 4, -2, 6]);
  const bc = by["b>c"];
  assert.deepEqual([bc.before, bc.after, bc.delta], [3, 0, -3]);
  const cd = by["c>d"];
  assert.deepEqual([cd.before, cd.after, cd.value], [0, 2, 2]);
});

test("alluvial: nodes are pinned to their stage, in category order, with a stable color", () => {
  const input = {
    stages: ["Jul", "Ago", "Sep"],
    categories: [
      { id: "vip", name: "VIP", color: "red" },
      { id: "nuevo", name: "Nuevos", color: "blue" },
    ],
    flows: [
      [
        { from: "vip", to: "vip", value: 5 },
        { from: "nuevo", to: "vip", value: 2 },
      ],
      [{ from: "vip", to: "vip", value: 7 }],
    ],
  };
  const { nodes, links } = lib.alluvialGraph(input);
  assert.deepEqual(
    nodes.map((n) => [n.id, n.column]),
    [
      ["0:vip", 0],
      ["0:nuevo", 0],
      ["1:vip", 1],
      ["2:vip", 2],
    ],
  );
  assert.ok(nodes.every((n) => (n.id.endsWith("vip") ? n.color === "red" : n.color === "blue")));
  assert.equal(links.length, 3);
  const graph = lib.sankeyLayout(nodes, links, {
    width: 300,
    height: 200,
    align: "left",
    relax: false,
  });
  const col = (id) => graph.nodes.find((n) => n.id === id).column;
  assert.deepEqual(["0:nuevo", "1:vip", "2:vip"].map(col), [0, 1, 2]);
  const first = graph.nodes.find((n) => n.id === "0:vip");
  const second = graph.nodes.find((n) => n.id === "0:nuevo");
  assert.ok(first.y1 <= second.y0);
});
