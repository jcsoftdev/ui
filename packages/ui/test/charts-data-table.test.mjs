import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { charts } = await loadCases("charts-data-table-cases.tsx");

for (const [name, render] of Object.entries(charts)) {
  if (name === "Sparkline") continue;
  test(`${name} renders a data table as its text alternative`, () => {
    assert.match(render(), /<table/);
  });
}

test("Sparkline stays a labelled image without a table", () => {
  const markup = charts.Sparkline();
  assert.match(markup, /role="img"[^>]*aria-label="[^"]+"/);
  assert.doesNotMatch(markup, /<table/);
});
