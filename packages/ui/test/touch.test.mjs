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

test("checkbox is a square box filled with the accent, not a round success badge", () => {
  const markup = html.checkbox();
  assert.match(markup, /rounded-xs/);
  assert.doesNotMatch(markup, /rounded-pill|success/);
  assert.match(markup, /group-data-\[state=checked\]:bg-accent/);
  assert.match(markup, /group-data-\[state=indeterminate\]:bg-accent/);
  assert.match(html.radio(), /rounded-pill/);
});

test("checkbox dims and blocks the cursor when disabled, and draws a dash when indeterminate", () => {
  assert.match(html.checkbox(), /disabled:opacity-50/);
  assert.match(html.checkbox(), /disabled:cursor-not-allowed/);
  assert.match(html.checkboxIndeterminate(), /d="M5 12h14"/);
  assert.match(html.checkboxChecked(), /d="M20 6 9 17l-5-5"/);
  assert.match(html.checkboxIndeterminate(), /aria-checked="mixed"/);
  assert.notEqual(html.checkboxIndeterminate(), html.checkboxChecked());
});
