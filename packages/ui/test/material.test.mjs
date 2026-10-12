import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { material } = await loadCases("material-cases.tsx");
const has = (classes, name) => classes.split(/\s+/).includes(name);

test("cn lets a later surface material replace an earlier one", () => {
  assert.equal(material.cn("rounded surface-card", "glass"), "rounded glass");
  assert.equal(material.cn("surface-overlay", "glass-clear", "p-2"), "glass-clear p-2");
  assert.equal(material.cn("glass", "surface-card"), "surface-card");
});

test("materialClass maps the prop to a utility, and leaves the default alone", () => {
  assert.equal(material.materialClass(undefined, "surface-solid"), undefined);
  assert.equal(material.materialClass("solid", "surface-solid"), "surface-solid");
  assert.equal(material.materialClass("glass", "surface-solid"), "glass");
  assert.equal(material.materialClass("glass-clear", "surface-solid"), "glass-clear");
});

test("a card is solid by default and opts into glass with the prop or className", () => {
  assert.ok(has(material.card(), "surface-card"));
  assert.ok(has(material.card("solid"), "surface-card"));
  const glass = material.card("glass");
  assert.ok(has(glass, "glass") && !has(glass, "surface-card"));
  const clear = material.card("glass-clear");
  assert.ok(has(clear, "glass-clear") && !has(clear, "surface-card"));
  const viaClassName = material.cardClassName();
  assert.ok(has(viaClassName, "glass-clear") && !has(viaClassName, "surface-card"));
});

test("chrome keeps its overlay surface unless the prop changes it", () => {
  assert.ok(has(material.actionBar(), "surface-overlay"));
  const glass = material.actionBar("glass");
  assert.ok(has(glass, "glass") && !has(glass, "surface-overlay"));
  const solid = material.actionBar("solid");
  assert.ok(has(solid, "surface-solid") && !has(solid, "surface-overlay"));
  assert.ok(has(material.topbar(), "surface-nav"));
  assert.ok(
    has(material.topbar("glass-clear"), "glass-clear") &&
      !has(material.topbar("glass-clear"), "surface-nav"),
  );
});
