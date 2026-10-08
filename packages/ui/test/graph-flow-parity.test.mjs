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
    contents: ["core/gantt.ts", "core/export.ts"]
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
