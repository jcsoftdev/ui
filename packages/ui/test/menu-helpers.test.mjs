// DOM-free menu helpers: typeahead matching, roving index maths, submenu grace area.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, "../src/primitives/menu", file)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}
const { nextTypeaheadIndex } = await load("typeahead.ts");
const { moveIndex } = await load("navigation.ts");
const { graceArea, isPointInPolygon } = await load("grace.ts");

test("typeahead matches by prefix, case-insensitively", () => {
  assert.equal(nextTypeaheadIndex(["Apple", "Banana", "Cherry"], "ch", 0), 2);
  assert.equal(nextTypeaheadIndex(["Apple", "Banana"], "x", 0), -1);
  assert.equal(nextTypeaheadIndex([], "a", -1), -1);
  assert.equal(nextTypeaheadIndex(["a"], "", -1), -1);
});

test("typeahead cycles through a repeated single letter", () => {
  const values = ["Pera", "Pina", "Papaya", "Uva"];
  assert.equal(nextTypeaheadIndex(values, "p", 0), 1);
  assert.equal(nextTypeaheadIndex(values, "pp", 1), 2);
  assert.equal(nextTypeaheadIndex(values, "ppp", 2), 0);
  assert.equal(nextTypeaheadIndex(values, "p", -1), 0);
});

test("typeahead keeps the current item while a longer search still matches it", () => {
  assert.equal(nextTypeaheadIndex(["Pera", "Pina"], "pi", 1), 1);
});

test("moveIndex loops, clamps and enters from the menu itself", () => {
  assert.equal(moveIndex(3, 2, "next"), 0);
  assert.equal(moveIndex(3, 0, "prev"), 2);
  assert.equal(moveIndex(3, 2, "next", false), 2);
  assert.equal(moveIndex(3, -1, "next"), 0);
  assert.equal(moveIndex(3, -1, "prev"), 2);
  assert.equal(moveIndex(3, 1, "first"), 0);
  assert.equal(moveIndex(3, 1, "last"), 2);
  assert.equal(moveIndex(0, -1, "next"), -1);
});

test("grace area covers the path from the trigger to the submenu, not the rest", () => {
  const box = { left: 200, right: 400, top: 100, bottom: 300 };
  const area = graceArea({ x: 190, y: 120 }, "right", box);
  assert.equal(isPointInPolygon({ x: 195, y: 150 }, area), true);
  assert.equal(isPointInPolygon({ x: 300, y: 200 }, area), true);
  assert.equal(isPointInPolygon({ x: 150, y: 400 }, area), false);
  assert.equal(isPointInPolygon({ x: 500, y: 200 }, area), false);
  const leftBox = { left: 0, right: 100, top: 100, bottom: 300 };
  const left = graceArea({ x: 110, y: 120 }, "left", leftBox);
  assert.equal(isPointInPolygon({ x: 50, y: 200 }, left), true);
  assert.equal(isPointInPolygon({ x: 300, y: 200 }, left), false);
});
