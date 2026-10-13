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

test("FormError is an assertive alert and FormStatus a polite status", () => {
  assert.match(html.formError("Card declined"), /^<p role="alert"[^>]*>Card declined<\/p>$/);
  assert.match(html.formStatus("Saved"), /^<p role="status"[^>]*>Saved<\/p>$/);
});

test("FormError and FormStatus render nothing without a message", () => {
  for (const empty of [null, undefined, ""]) {
    assert.equal(html.formError(empty), "");
    assert.equal(html.formStatus(empty), "");
  }
});

test("Form keeps its attributes and merges className", () => {
  const markup = html.form();
  assert.match(markup, /<form[^>]*action="\/save"/);
  assert.match(markup, /class="[^"]*flex-col[^"]*extra"/);
});
