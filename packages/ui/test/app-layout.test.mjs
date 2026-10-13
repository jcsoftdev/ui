import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("app-layout-cases.tsx");

test("Grid fits columns from the minimum width unless a count is given", () => {
  assert.match(
    html.gridFluid(),
    /grid-template-columns:repeat\(auto-fill, minmax\(min\(100%, 12rem\), 1fr\)\)/,
  );
  assert.match(html.gridFixed(), /grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/);
});
