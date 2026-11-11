import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { charts, excluded, componentExports } = await loadCases("charts-data-table-cases.tsx");

test("every component exported from charts is rendered here or explicitly excluded", () => {
  const classified = new Set([...Object.keys(charts), ...excluded]);
  assert.deepEqual(
    componentExports.filter((name) => !classified.has(name)),
    [],
  );
  assert.deepEqual(
    [...classified].filter((name) => !componentExports.includes(name)),
    [],
  );
  assert.deepEqual(
    excluded.filter((name) => name in charts),
    [],
  );
});

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
