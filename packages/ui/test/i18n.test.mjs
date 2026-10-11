import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("cases.tsx");

test("without a provider the English defaults stay in place", () => {
  assert.match(html.skeletonDefault(), /aria-label="Loading"/);
});

test("the es preset localizes every default string it reaches", () => {
  assert.match(html.skeletonEs(), /aria-label="Cargando"/);
});

test("strings override the preset and an explicit prop still wins", () => {
  assert.match(html.skeletonOverride(), /aria-label="Un momento"/);
  assert.match(html.skeletonProp(), /aria-label="Buscando"/);
});

test("a nested provider inherits its parent preset and overrides one key", () => {
  assert.match(html.skeletonNested(), /aria-label="Espera"/);
});
