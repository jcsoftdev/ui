import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const editCases = await loadCases("floor-plan-cases.tsx");
const { html, labelPlacement, groupOutlines } = editCases;

test("table surface patterns map to classes", () => {
  assert.match(
    html.glyph({ shape: "square", seats: 2, pattern: "dashed" }),
    /fill-transparent[^"]*"[^>]*stroke-dasharray="5 4"/,
  );
  assert.match(
    html.glyph({ shape: "square", seats: 2, pattern: "solid" }),
    /data-part="body" class="stroke-current fill-surface"/,
  );
  assert.match(html.glyph({ shape: "square", seats: 2, pattern: "soft" }), /fill-current\/10/);
  assert.match(html.glyph({ shape: "square", seats: 2, pattern: "strong" }), /fill-current\/35/);
});

test("rings are a uniform ring on the whole item, never a one-sided border", () => {
  const markup = html.plan();
  assert.match(
    markup,
    /data-item="t2"[^>]*data-ring="late"[^>]*ring-2 ring-danger|ring-2 ring-danger[^>]*data-item="t2"/,
  );
  assert.match(html.plan({ selectedId: "t1" }), /ring-2 ring-accent/);
  assert.doesNotMatch(markup, /border-l-|border-s-|\bborder-l\b/);
});

test("the selected item is pressed and the others are not", () => {
  const markup = html.plan({ selectedId: "t1" });
  assert.equal(markup.match(/aria-pressed="true"/g)?.length, 1);
  assert.equal(markup.match(/aria-pressed="false"/g)?.length, 3);
  assert.doesNotMatch(html.plan(), /aria-pressed/);
});

test("items are buttons in array order with one roving tab stop", () => {
  const markup = html.plan({ selectedId: "t3" });
  const ids = [...markup.matchAll(/<button[^>]*data-item="(t\d)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["t1", "t2", "t3", "t4"]);
  assert.equal(markup.match(/tabindex="0"/g)?.length, 1);
  assert.match(markup, /data-item="t3"[^>]*|tabindex="0"[^>]*data-item="t3"/);
});

test("the state is text and an icon slot, and the plan is a named group", () => {
  const markup = html.plan();
  assert.match(markup, /Seated/);
  assert.match(markup, /role="group"[^>]*aria-label="Floor plan"/);
  assert.match(html.planEs(), /aria-label="Plano de sala"/);
  assert.match(markup, /4 seats/);
  assert.match(
    html.plan({
      items: [{ id: "x", x: 0, y: 0, width: 1, height: 1, shape: "round", seats: 1, label: "X" }],
    }),
    /1 seat</,
  );
});

test("the canvas keeps its aspect ratio and places everything in percentages", () => {
  const markup = html.plan();
  assert.match(markup, /aspect-ratio:12 \/ 8/);
  assert.match(markup, /left:8\.33[0-9]*%;top:12\.5%;width:33\.3[0-9]*%;height:50%/);
  assert.match(markup, /@container\/floor/);
  assert.doesNotMatch(markup, /style="[^"]*(transform|translate|scale|[0-9]px)/);
});

test("landmarks are drawn with a hatch and a text label", () => {
  const markup = html.plan();
  assert.match(markup, /data-kind="stairs"/);
  assert.match(markup, /repeating-linear-gradient/);
  assert.match(markup, />Stairs</);
});

test("merged items share one group outline", () => {
  const [outline, ...rest] = groupOutlines([
    { x: 7, y: 1, width: 1, height: 1, groupId: "g" },
    { x: 8, y: 1, width: 1, height: 1, groupId: "g" },
    { x: 0, y: 0, width: 1, height: 1, groupId: "solo" },
    { x: 3, y: 3, width: 1, height: 1 },
  ]);
  assert.equal(rest.length, 0);
  assert.deepEqual(outline, { groupId: "g", x: 6.8, y: 0.8, width: 2.4, height: 1.4 });
  assert.equal(html.plan().match(/data-group="g"/g)?.length, 1);
});

test("the label sits under small shapes and inside large ones", () => {
  assert.equal(labelPlacement({ width: 1, height: 1, shape: "square" }), "below");
  assert.equal(labelPlacement({ width: 4, height: 4, shape: "round" }), "inside");
  assert.equal(labelPlacement({ width: 4, height: 2, shape: "rect" }), "inside");
  assert.equal(labelPlacement({ width: 4, height: 1, shape: "bar" }), "below");
  assert.equal(labelPlacement({ width: 4, height: 4, shape: "round" }, 12), "below");
  const markup = html.plan();
  assert.match(markup, /data-item="t1"[^>]*data-label="inside"/);
  assert.match(markup, /data-item="t2"[^>]*data-label="below"/);
});

const bounds = { width: 12, height: 8, snap: 1, minSize: 1 };
const box = (x, y, width, height) => ({ x, y, width, height });

test("moving snaps to the grid and stays inside the canvas", () => {
  assert.deepEqual(editCases.moveBox(box(2, 2, 2, 2), 1.4, -0.6, bounds), box(3, 1, 2, 2));
  assert.deepEqual(editCases.moveBox(box(2, 2, 2, 2), -9, -9, bounds), box(0, 0, 2, 2));
  assert.deepEqual(editCases.moveBox(box(2, 2, 2, 2), 99, 99, bounds), box(10, 6, 2, 2));
  assert.deepEqual(
    editCases.moveBox(box(2, 2, 2, 2), 0.3, 0.3, { ...bounds, snap: 0.5 }),
    box(2.5, 2.5, 2, 2),
  );
});

test("resizing moves only the dragged edges and respects the minimum size", () => {
  assert.deepEqual(editCases.resizeBox(box(2, 2, 2, 2), "se", 1, 2, bounds), box(2, 2, 3, 4));
  assert.deepEqual(editCases.resizeBox(box(2, 2, 2, 2), "nw", -1, -1, bounds), box(1, 1, 3, 3));
  assert.deepEqual(editCases.resizeBox(box(2, 2, 2, 2), "ne", 1, -1, bounds), box(2, 1, 3, 3));
  assert.deepEqual(editCases.resizeBox(box(2, 2, 2, 2), "se", -5, -5, bounds), box(2, 2, 1, 1));
  assert.deepEqual(editCases.resizeBox(box(2, 2, 2, 2), "nw", 5, 5, bounds), box(3, 3, 1, 1));
  assert.deepEqual(editCases.resizeBox(box(9, 5, 2, 2), "se", 9, 9, bounds), box(9, 5, 3, 3));
  assert.deepEqual(editCases.resizeBox(box(2, 2, 2, 2), "e", 2.4, 9, bounds), box(2, 2, 4, 2));
});

test("rotating swaps width and height around the centre and stays inside", () => {
  assert.deepEqual(editCases.rotateBox(box(4, 3, 4, 2), bounds), box(5, 2, 2, 4));
  assert.deepEqual(editCases.rotateBox(box(5, 2, 2, 4), bounds), box(4, 3, 4, 2));
  assert.deepEqual(editCases.rotateBox(box(0, 0, 4, 1), bounds), box(2, 0, 1, 4));
  assert.deepEqual(editCases.rotateBox(box(8, 7, 4, 1), bounds), box(10, 4, 1, 4));
});

test("keyboard edits: Alt nudges, Alt and Shift resize, r rotates, the rest is ignored", () => {
  const start = box(4, 3, 2, 2);
  const key = (key, mods = {}) =>
    editCases.editKey(start, { key, altKey: false, shiftKey: false, ...mods }, bounds);
  assert.deepEqual(key("ArrowRight", { altKey: true })?.box, box(5, 3, 2, 2));
  assert.deepEqual(key("ArrowUp", { altKey: true })?.box, box(4, 2, 2, 2));
  assert.deepEqual(key("ArrowRight", { altKey: true, shiftKey: true })?.box, box(4, 3, 3, 2));
  assert.deepEqual(key("ArrowUp", { altKey: true, shiftKey: true })?.box, box(4, 3, 2, 1));
  assert.deepEqual(key("r")?.box, box(4, 3, 2, 2));
  assert.equal(key("ArrowRight"), undefined);
  assert.equal(key("ArrowRight", { shiftKey: true }), undefined);
  assert.equal(key("a", { altKey: true }), undefined);
  assert.equal(key("r", { ctrlKey: true }), undefined);
});

test("an editable plan exposes a keyboard hint, a grid, the rotate button and handles on the selection only", () => {
  const markup = html.editable();
  assert.match(markup, /data-editable/);
  assert.match(markup, /Alt with arrows moves/);
  assert.match(markup, /aria-label="Rotate 90°"/);
  assert.equal(markup.match(/data-handle=/g)?.length, 4);
  assert.match(markup, /data-edit-overlay="t2"/);
  assert.match(markup, /<button[^>]*data-landmark="l1"/);
  assert.match(markup, /touch-none/);
  assert.doesNotMatch(html.plan({ selectedId: "t2" }), /data-handle|data-editable|Rotate/);
});
