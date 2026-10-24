// Table sorting and column hiding, standalone Pagination, FilterBar and the dashboard blocks.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { loadCases } from "./components/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));

async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const sort = await load("../src/containers/table/sort.ts");
const range = await load("../src/containers/pagination/range.ts");
const { html } = await loadCases("data-cases.tsx");

test("a sort cycles ascending, descending, off and restarts on another column", () => {
  const asc = sort.nextTableSort(null, "name");
  assert.deepEqual(asc, { columnId: "name", direction: "ascending" });
  const desc = sort.nextTableSort(asc, "name");
  assert.deepEqual(desc, { columnId: "name", direction: "descending" });
  assert.equal(sort.nextTableSort(desc, "name"), null);
  assert.deepEqual(sort.nextTableSort(desc, "stock"), {
    columnId: "stock",
    direction: "ascending",
  });
});

test("only the sorted column reports a direction", () => {
  const current = { columnId: "stock", direction: "descending" };
  assert.equal(sort.ariaSortFor(current, "stock"), "descending");
  assert.equal(sort.ariaSortFor(current, "name"), "none");
  assert.equal(sort.ariaSortFor(null, "name"), "none");
});

test("sortable headers expose aria-sort and a button; without sort props they stay plain", () => {
  const sorted = html.sorted();
  assert.match(sorted, /<th[^>]*aria-sort="descending"[^>]*>[\s\S]*Stock/);
  assert.match(sorted, /<th[^>]*aria-sort="none"[^>]*>[\s\S]*Name/);
  assert.equal((sorted.match(/<th[^>]*><button/g) ?? []).length, 2);
  const plain = html.noSortProps();
  assert.ok(!plain.includes("aria-sort"));
  assert.ok(!plain.includes("<button"));
});

test("hiddenColumns drops the header and the cells of a column", () => {
  const out = html.hiddenStock();
  assert.ok(out.includes("Name") && out.includes("Pomade"));
  assert.ok(!out.includes("Stock") && !out.includes(">24<"));
});

test("TableEmpty spans the columns and TableLoading announces once", () => {
  assert.match(html.empty(), /<td[^>]*colSpan="3"|<td[^>]*colspan="3"/i);
  assert.ok(html.empty().includes("No rows to show"));
  const loading = html.loading();
  assert.equal((loading.match(/role="status"/g) ?? []).length, 1);
  assert.equal((loading.match(/<tr/g) ?? []).length, 3);
});

test("page range covers the first, middle, last and empty pages", () => {
  assert.deepEqual(range.pageRange(1, 10, 134), { first: 1, last: 10 });
  assert.deepEqual(range.pageRange(14, 10, 134), { first: 131, last: 134 });
  assert.deepEqual(range.pageRange(99, 10, 134), { first: 131, last: 134 });
  assert.deepEqual(range.pageRange(1, 10, 0), { first: 0, last: 0 });
  assert.equal(range.pageCount(134, 10), 14);
  assert.equal(range.pageCount(0, 10), 1);
  assert.equal(range.clampPage(0, 5), 1);
  assert.equal(range.clampPage(9, 5), 5);
});

test("Pagination renders the localized range and disables the ends", () => {
  const en = html.pagination();
  assert.ok(en.includes("11–20 of 134"));
  assert.ok(en.includes('aria-label="Next page"') && en.includes('aria-label="Pagination"'));
  const es = html.paginationEs();
  assert.ok(es.includes("51–75 de 1,340"));
  assert.ok(es.includes("Filas por página"));
});

test("FilterBar shows chips with a named remove, clear all and the count", () => {
  const out = html.filterBar();
  assert.ok(out.includes('aria-label="Active filters"'));
  assert.ok(out.includes("Remove filter Status: A"));
  assert.ok(out.includes("Clear all filters"));
  assert.match(out, /role="status"[^>]*>1,240 results/);
});

test("FilterBar folds the quick chips and extra filters by container width, not viewport", () => {
  const out = html.filterBar();
  assert.ok(out.includes("@container/filter-bar"));
  assert.ok(out.includes("@min-[40rem]/filter-bar:inline-flex"), "More filters only when wide");
  assert.ok(out.includes("@min-[40rem]/filter-bar:hidden"), "Filters button only when narrow");
  assert.ok(!/[\s"](sm|md|lg):/.test(out), "no viewport breakpoints");
});

test("FilterBar singular count and the bare bar", () => {
  assert.ok(html.filterBarOne().includes("1 result<"));
  const bare = html.filterBarEmpty();
  assert.ok(!bare.includes("Filters") && !bare.includes('role="status"'));
});

test("dashboard blocks are named landmarks with container-query grids", () => {
  const out = html.dashboard();
  assert.match(
    out,
    /role="group"[^>]*aria-label="Key figures"|aria-label="Key figures"[^>]*role="group"/,
  );
  assert.match(out, /<section aria-labelledby="([^"]+)"[\s\S]*?<h3 id="\1"[^>]*>Revenue/);
  assert.match(out, /<h2 id="[^"]+"[^>]*>Payments/);
  assert.ok(out.includes("@min-[1180px]/page:grid-cols-3"));
});

test("barrels export every documented component folder (BottomNav, BulletChart, LollipopChart)", async () => {
  const { readFileSync } = await import("node:fs");
  const barrel = (path) => readFileSync(join(here, "../src", path, "index.ts"), "utf8");
  assert.ok(barrel("shell").includes('"./bottom-nav/index.js"'));
  assert.ok(barrel("charts").includes('"./bullet-chart/index.js"'));
  assert.ok(barrel("charts").includes('"./lollipop-chart/index.js"'));
});
