import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { gridHtml, gridWithoutRowIds, loadingGridHtml, detailGridHtml, groupedGridHtml } =
  await loadCases("data-grid-intent-cases.tsx");

const count = (html, pattern) => (html.match(pattern) ?? []).length;
const all = (html, pattern) => [...html.matchAll(pattern)].map((match) => match[1]);

test("root receives rest props and data attributes", () => {
  const html = gridHtml({ id: "orders-grid", "data-testid": "orders" });
  assert.match(html, /^<div id="orders-grid" data-testid="orders" class="@container\/grid/);
  assert.equal(count(html, /data-testid="orders"/g), 1);
  assert.match(html, /<table[^>]*role="grid"/);
  assert.doesNotMatch(html.match(/<table[^>]*>/)[0], /data-testid|id="orders-grid"/);
});

test("grid intent sits on the role=grid table", () => {
  const html = gridHtml({ intent: "order-grid", intentKey: "today" });
  const table = html.match(/<table[^>]*>/)[0];
  assert.match(table, /data-intent="order-grid"/);
  assert.match(table, /data-intent-key="today"/);
  assert.match(table, /role="grid"/);
  assert.equal(count(html, /data-intent="order-grid"/g), 1);
  assert.doesNotMatch(gridHtml(), /data-intent/);
});

test("data rows carry their getRowId", () => {
  assert.deepEqual(all(gridHtml(), /data-row-id="([^"]*)"/g), ["a", "b", "c"]);
});

test("no getRowId, no row ids", () => {
  const html = gridWithoutRowIds({ rowIntent: "order-row" });
  assert.equal(count(html, /data-row-id/g), 0);
  assert.equal(count(html, /data-intent/g), 0);
});

test("every header and gridcell carries its column id", () => {
  const html = gridHtml();
  assert.equal(count(html, /<th[^>]*data-col-id="customer"/g), 1);
  assert.equal(count(html, /<th[^>]*data-col-id="total"/g), 1);
  assert.equal(
    count(
      html,
      /<td[^>]*role="gridcell"[^>]*data-col-id="customer"|<td[^>]*data-col-id="customer"[^>]*role="gridcell"/g,
    ),
    3,
  );
  assert.equal(count(html, /<td[^>]*data-col-id="total"/g), 3);
});

test("row intents use the row id as key", () => {
  const html = gridHtml({ rowIntent: "order-row" });
  assert.deepEqual(all(html, /<tr[^>]*data-intent-key="([^"]*)"/g), ["a", "b", "c"]);
  assert.equal(count(html, /<tr[^>]*data-intent="order-row"/g), 3);
});

test("a pinned row carries its row id once", () => {
  const html = gridHtml({
    rowPinning: true,
    pinnedRows: { top: ["b"], bottom: [] },
    rowIntent: "order-row",
  });
  assert.equal(count(html, /data-row-id="b"/g), 1);
  assert.equal(count(html, /data-intent-key="b"/g), 1);
  assert.deepEqual(all(html, /data-row-id="([^"]*)"/g), ["b", "a", "c"]);
});

test("group, detail and skeleton rows carry no data-row-id", () => {
  const grouped = groupedGridHtml();
  assert.ok(count(grouped, /<tr/g) > count(grouped, /data-row-id/g) + 1);
  assert.ok(count(grouped, /aria-expanded/g) >= 2);
  assert.deepEqual(all(grouped, /data-row-id="([^"]*)"/g).sort(), ["a", "b", "c"]);
  const detail = detailGridHtml();
  assert.equal(count(detail, /data-row-id/g), 3);
  assert.equal(count(loadingGridHtml(), /data-row-id/g), 0);
});
