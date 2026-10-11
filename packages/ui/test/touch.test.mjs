import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("cases.tsx");

test("checkbox and switch grow their hit area to 44px under data-density=touch only", () => {
  for (const markup of [html.checkbox(), html.switch()]) {
    assert.match(markup, /size-10/);
    assert.match(markup, /in-data-\[density=touch\]:size-11/);
  }
});

test("radio options keep a 44px row under touch", () => {
  assert.match(html.radio(), /in-data-\[density=touch\]:min-h-11/);
});

test("only an interactive chip enlarges under touch", () => {
  assert.match(html.chipInteractive(), /in-data-\[density=touch\]:min-h-11/);
  assert.doesNotMatch(html.chipStatic(), /min-h-11/);
});
