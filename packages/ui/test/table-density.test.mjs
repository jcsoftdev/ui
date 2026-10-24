import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("table-density-cases.tsx");

const tableClass = (markup) =>
  (markup.match(/<table[^>]*class="([^"]*)"/)?.[1] ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&gt;", ">");

test("a table is comfortable by default: 48px rows and 8px cell padding through variables", () => {
  const markup = html.table();
  assert.match(markup, /data-table-density="comfortable"/);
  assert.match(tableClass(markup), /\[--row-min-h:48px\]/);
  assert.match(tableClass(markup), /\[&>tbody>tr\]:h-\(--row-min-h\)/);
  assert.match(markup, /<td class="[^"]*py-\[var\(--table-cell-py/);
  assert.match(markup, /<td class="[^"]*align-middle/);
});

test("compact density sets 40px rows", () => {
  const markup = html.table({ density: "compact" });
  assert.match(markup, /data-table-density="compact"/);
  assert.match(tableClass(markup), /\[--row-min-h:40px\]/);
  assert.doesNotMatch(tableClass(markup), /--row-min-h:48px/);
});

test("stickyActions pins the last column only when asked", () => {
  assert.doesNotMatch(tableClass(html.table()), /:sticky/);
  assert.match(
    tableClass(html.table({ stickyActions: true })),
    /@sm\/table:\[&_:is\(th,td\):last-child\]:sticky/,
  );
});
