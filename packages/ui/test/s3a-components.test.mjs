// Pure logic behind the S3a components: kanban moves, resizable clamping, number/trend formatting,
// carousel stepping, tree navigation and TOC active section.
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

const kanban = await load("../src/containers/kanban/model.ts");
const resizable = await load("../src/containers/resizable/model.ts");
const carousel = await load("../src/containers/carousel/model.ts");
const tree = await load("../src/containers/file-tree/model.ts");
const toc = await load("../src/navigation/floating-toc/model.ts");
const numbers = await load("../src/atoms/number-value/format.ts");
const trend = await load("../src/atoms/trend-chip/trend.ts");

const ids = (column) => column.cards.map((c) => c.id);
const board = () => [
  {
    id: "todo",
    title: "Por hacer",
    cards: [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ],
  },
  { id: "doing", title: "En curso", wipLimit: 2, cards: [{ id: "c", title: "C" }] },
  { id: "done", title: "Hecho", cards: [] },
];

test("kanban: moves across columns and reorders inside one", () => {
  const across = kanban.moveCard(board(), "a", "doing", 0);
  assert.deepEqual(ids(across.columns[0]), ["b"]);
  assert.deepEqual(ids(across.columns[1]), ["a", "c"]);
  assert.deepEqual(across.move, {
    cardId: "a",
    fromColumnId: "todo",
    fromIndex: 0,
    toColumnId: "doing",
    toIndex: 0,
  });

  const within = kanban.moveCard(board(), "a", "todo", 1);
  assert.deepEqual(ids(within.columns[0]), ["b", "a"]);
});

test("kanban: no-ops return null and input is not mutated", () => {
  const original = board();
  assert.equal(kanban.moveCard(original, "a", "todo", 0), null);
  assert.equal(kanban.moveCard(original, "zzz", "todo", 0), null);
  assert.equal(kanban.moveCard(original, "a", "nope", 0), null);
  kanban.moveCard(original, "a", "done", 0);
  assert.deepEqual(ids(original[0]), ["a", "b"]);
});

test("kanban: index is clamped and WIP limit is only enforced on request", () => {
  const clamped = kanban.moveCard(board(), "a", "done", 99);
  assert.deepEqual(ids(clamped.columns[2]), ["a"]);

  const full = kanban.moveCard(board(), "a", "doing", 0).columns;
  assert.equal(kanban.moveCard(full, "b", "doing", 0).columns[1].cards.length, 3);
  assert.equal(kanban.moveCard(full, "b", "doing", 0, { enforceLimit: true }), null);
  // Reordering inside a full column is never blocked.
  assert.ok(kanban.moveCard(full, "c", "doing", 0, { enforceLimit: true }));
});

test("kanban: wip status and keyboard targets", () => {
  assert.equal(kanban.wipStatus(3), "none");
  assert.equal(kanban.wipStatus(1, 3), "ok");
  assert.equal(kanban.wipStatus(3, 3), "at-limit");
  assert.equal(kanban.wipStatus(4, 3), "over");

  const columns = board();
  assert.deepEqual(kanban.keyboardTarget(columns, "b", "ArrowRight"), {
    columnId: "doing",
    index: 1,
  });
  assert.deepEqual(kanban.keyboardTarget(columns, "a", "ArrowRight"), {
    columnId: "doing",
    index: 0,
  });
  assert.equal(kanban.keyboardTarget(columns, "a", "ArrowLeft"), null);
  assert.equal(kanban.keyboardTarget(columns, "a", "ArrowUp"), null);
  assert.deepEqual(kanban.keyboardTarget(columns, "a", "ArrowDown"), {
    columnId: "todo",
    index: 1,
  });
});

test("kanban: drop index counts the midpoints above the pointer", () => {
  assert.equal(kanban.dropIndex([], 50), 0);
  assert.equal(kanban.dropIndex([10, 30, 50], 5), 0);
  assert.equal(kanban.dropIndex([10, 30, 50], 35), 2);
  assert.equal(kanban.dropIndex([10, 30, 50], 500), 3);
});

const free = (n) => Array.from({ length: n }, () => ({ min: 0, max: 100 }));

test("resizable: default layout shares the remainder and sums to 100", () => {
  assert.deepEqual(resizable.normalizeSizes([30, undefined, undefined], free(3)), [30, 35, 35]);
  const scaled = resizable.normalizeSizes([1, 1, 2], free(3));
  assert.deepEqual(scaled, [25, 25, 50]);
  const clamped = resizable.normalizeSizes(
    [90, 10],
    [
      { min: 0, max: 70 },
      { min: 0, max: 100 },
    ],
  );
  assert.equal(clamped[0], 70);
  assert.ok(Math.abs(clamped.reduce((a, b) => a + b, 0) - 100) < 1e-9);
});

test("resizable: dragging a handle keeps the pair total and respects min/max", () => {
  const constraints = [
    { min: 20, max: 60 },
    { min: 10, max: 80 },
    { min: 10, max: 100 },
  ];
  const sizes = [30, 40, 30];
  assert.deepEqual(resizable.resizePair(sizes, constraints, 0, 10), [40, 30, 30]);
  assert.deepEqual(resizable.resizePair(sizes, constraints, 0, 500), [60, 10, 30]);
  assert.deepEqual(resizable.resizePair(sizes, constraints, 0, -500), [20, 50, 30]);
  assert.equal(resizable.resizePair(sizes, constraints, 5, 10), sizes);
  const moved = resizable.resizePair(sizes, constraints, 1, -15);
  assert.equal(moved[1] + moved[2], 70);
  assert.equal(moved[0], 30);
});

test("resizable: keyboard deltas follow the orientation", () => {
  assert.equal(resizable.keyboardDelta("ArrowRight", "horizontal"), 5);
  assert.equal(resizable.keyboardDelta("ArrowLeft", "horizontal", true), -10);
  assert.equal(resizable.keyboardDelta("ArrowDown", "vertical"), 5);
  assert.equal(resizable.keyboardDelta("ArrowDown", "horizontal"), null);
});

test("number formatting uses es-PE by default and honours Intl options", () => {
  assert.match(numbers.formatNumber(35, { style: "currency", currency: "PEN" }), /S\/\s?35\.00/);
  assert.equal(
    numbers.formatNumber(0.784, { style: "percent", maximumFractionDigits: 1 }),
    "78.4%",
  );
  assert.equal(numbers.formatNumber(1234.5, { locale: "en-US" }), "1,234.5");
  assert.equal(numbers.tweenValue(0, 100, 0), 0);
  assert.equal(numbers.tweenValue(0, 100, 1), 100);
  assert.ok(numbers.tweenValue(0, 100, 0.5) > 50);
  assert.equal(numbers.easeOutCubic(-1), 0);
});

test("trend direction, tone and text", () => {
  assert.equal(trend.trendDirection(3), "up");
  assert.equal(trend.trendDirection(-3), "down");
  assert.equal(trend.trendDirection(0.2, 0.5), "flat");
  assert.equal(trend.trendDirection(Number.NaN), "flat");
  assert.equal(trend.trendTone("up"), "positive");
  assert.equal(trend.trendTone("down"), "negative");
  assert.equal(trend.trendTone("down", true), "positive");
  assert.equal(trend.trendTone("flat", true), "neutral");
  assert.equal(trend.formatTrend(12.5, "en-US"), "+12.5%");
  assert.equal(trend.formatTrend(-4, "en-US"), "-4%");
  assert.equal(trend.formatTrend(0, "en-US"), "0%");
});

test("carousel stepping and nearest slide", () => {
  assert.equal(carousel.stepIndex(0, 4, -1, false), 0);
  assert.equal(carousel.stepIndex(3, 4, 1, false), 3);
  assert.equal(carousel.stepIndex(3, 4, 1, true), 0);
  assert.equal(carousel.stepIndex(0, 4, -1, true), 3);
  assert.equal(carousel.nearestIndex(310, [0, 300, 600]), 1);
  assert.equal(carousel.nearestIndex(0, []), 0);
});

const files = [
  {
    id: "src",
    name: "src",
    children: [
      { id: "app", name: "app.tsx" },
      { id: "lib", name: "lib", children: [{ id: "util", name: "util.ts" }] },
    ],
  },
  { id: "readme", name: "README.md" },
];

test("file tree: only expanded folders contribute rows", () => {
  const closed = tree.flattenTree(files, new Set());
  assert.deepEqual(
    closed.map((r) => r.node.id),
    ["src", "readme"],
  );
  const open = tree.flattenTree(files, new Set(["src", "lib"]));
  assert.deepEqual(
    open.map((r) => [r.node.id, r.depth]),
    [
      ["src", 1],
      ["app", 2],
      ["lib", 2],
      ["util", 3],
      ["readme", 1],
    ],
  );
  const lib = open.find((r) => r.node.id === "lib");
  assert.equal(lib.position, 2);
  assert.equal(lib.setSize, 2);
  assert.equal(lib.parentId, "src");
});

test("file tree: arrow navigation follows the WAI-ARIA tree pattern", () => {
  const rows = tree.flattenTree(files, new Set(["src"]));
  assert.deepEqual(tree.treeStep(rows, "readme", "ArrowRight"), null);
  assert.deepEqual(tree.treeStep(rows, "src", "ArrowRight"), { type: "focus", id: "app" });
  assert.deepEqual(tree.treeStep(rows, "lib", "ArrowRight"), { type: "expand", id: "lib" });
  assert.deepEqual(tree.treeStep(rows, "src", "ArrowLeft"), { type: "collapse", id: "src" });
  assert.deepEqual(tree.treeStep(rows, "app", "ArrowLeft"), { type: "focus", id: "src" });
  assert.deepEqual(tree.treeStep(rows, "app", "Home"), { type: "focus", id: "src" });
  assert.deepEqual(tree.treeStep(rows, "app", "End"), { type: "focus", id: "readme" });
  assert.equal(tree.treeStep(rows, "readme", "ArrowDown"), null);
});

test("file tree: typeahead wraps, helpers list folders and ancestors", () => {
  const rows = tree.flattenTree(files, new Set(["src", "lib"]));
  assert.equal(tree.typeahead(rows, "src", "r"), "readme");
  assert.equal(tree.typeahead(rows, "readme", "a"), "app");
  assert.equal(tree.typeahead(rows, "src", "zz"), null);
  assert.deepEqual(tree.folderIds(files), ["src", "lib"]);
  assert.deepEqual(tree.ancestorsOf(files, "util"), ["src", "lib"]);
  assert.deepEqual(tree.ancestorsOf(files, "nope"), []);
});

test("toc: first visible heading wins and the previous one sticks when none is visible", () => {
  const order = ["a", "b", "c"];
  assert.equal(toc.pickActive(order, new Set(["b", "c"]), "a"), "b");
  assert.equal(toc.pickActive(order, new Set(), "c"), "c");
  assert.equal(toc.pickActive(order, new Set(), null), "a");
  assert.equal(toc.pickActive(order, new Set(), "gone"), "a");
  assert.equal(toc.pickActive([], new Set(), null), null);
});
