import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("states-cases.tsx");

test("EmptyState draws a domain icon by name and keeps it decorative", () => {
  for (const name of ["inbox", "search", "lock"]) {
    assert.match(html.emptyIcon(name), /<span aria-hidden="true"[^>]*><svg/, name);
  }
  assert.doesNotMatch(html.emptyIcon("none"), /<svg/);
});

test("EmptyState size sm is an inline row; the default keeps its centered layout", () => {
  const sm = html.emptyIcon("inbox", "sm");
  assert.match(sm, /data-size="sm"/);
  assert.match(sm, /flex-wrap items-center/);
  assert.match(sm, /size-4/);
  assert.match(sm, /data-action/);
  const md = html.emptyIcon("inbox");
  assert.match(md, /flex-col items-center/);
  assert.match(md, /size-8/);
});
