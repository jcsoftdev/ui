import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";
import { loadCases } from "./components/render.mjs";

const bundle = await build({
  entryPoints: [join(import.meta.dirname, "../src/containers/pagination/range.ts")],
  bundle: true,
  format: "esm",
  write: false,
});
const { pageItems } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);
const { html } = await loadCases("pagination-cases.tsx");

test("pageItems lists every page when they fit and keeps a constant length otherwise", () => {
  assert.deepEqual(pageItems(1, 1), [1]);
  assert.deepEqual(pageItems(3, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pageItems(1, 10), [1, 2, 3, 4, 5, "gap", 10]);
  assert.deepEqual(pageItems(5, 10), [1, "gap", 4, 5, 6, "gap", 10]);
  assert.deepEqual(pageItems(10, 10), [1, "gap", 6, 7, 8, 9, 10]);
  for (let page = 1; page <= 30; page++) assert.equal(pageItems(page, 30).length, 7);
});

test("a gap never stands for a single page", () => {
  for (let pages = 8; pages <= 12; pages++)
    for (let page = 1; page <= pages; page++) {
      const items = pageItems(page, pages);
      items.forEach((item, i) => {
        if (item !== "gap") return;
        assert.ok(items[i + 1] - items[i - 1] > 2, `page ${page} of ${pages}: ${items}`);
      });
    }
});

test("Pagination pages shows the range, Previous, numbered pages and Next", () => {
  const markup = html.pages();
  assert.match(markup, /Showing 1–25 of 134/);
  assert.match(markup, />Previous</);
  assert.match(markup, />Next</);
  assert.match(
    markup,
    /aria-current="page"[^>]*aria-label="Page 1"|aria-label="Page 1"[^>]*aria-current="page"/,
  );
  assert.match(markup, /aria-label="Page 6"/);
  assert.doesNotMatch(markup, /First page|Rows per page/);
  assert.match(html.pagesEs(), /Mostrando 26–50 de 134/);
  assert.match(html.pagesEs(), />Anterior</);
  assert.match(html.pagesEs(), /aria-label="Página 2"/);
});

test("Pagination pages renders nothing on a single page; the default variant still renders", () => {
  assert.equal(html.pages({ total: 25 }), "");
  assert.notEqual(html.pages({ total: 25, hideOnSinglePage: false }), "");
  assert.match(html.defaultSingle(), /<nav/);
  assert.match(html.pages({ pageSizeOptions: [25, 50] }), /Rows per page/);
});

test("CursorPagination shows the open range and hides on a lone first page", () => {
  assert.match(html.cursor(), /Showing 26–50/);
  assert.doesNotMatch(html.cursor(), / disabled=""/);
  assert.match(html.cursor({ page: 1 }), /<button[^>]* disabled=""[^>]*><span[^>]*>Previous</);
  assert.equal(html.cursor({ page: 1, hasNext: false }), "");
  assert.match(html.cursorEs(), /Mostrando 51–54/);
  assert.match(html.cursorEs(), /aria-label="Paginación"/);
});
