import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html, joinIds } = await loadCases("tooltip-cases.tsx");

const describedBy = (markup) => markup.match(/<button[^>]*aria-describedby="([^"]*)"/)?.[1];

test("joinIds joins, trims, dedupes and drops empties", () => {
  const table = [
    [[], undefined],
    [[undefined, undefined], undefined],
    [["", "  "], undefined],
    [["a"], "a"],
    [["a", "b"], "a b"],
    [["a b", "b c"], "a b c"],
    [[" a ", undefined, "a"], "a"],
  ];
  for (const [ids, expected] of table) assert.equal(joinIds(...ids), expected, JSON.stringify(ids));
});

test("persistent description renders while closed", () => {
  const markup = html.persistent();
  const id = describedBy(markup);
  assert.ok(id, "trigger has aria-describedby");
  assert.match(markup, new RegExp(`<span id="${id}" hidden="">Duplicates the order</span>`));
});

test("persistent description keeps the trigger's own describedby", () => {
  const markup = html.persistentWithOwn();
  assert.match(describedBy(markup), /^err \S+$/);
  assert.equal(describedBy(markup).split(" ").length, 2);
});

test("whileOpen keeps the trigger's own describedby when open", () => {
  const ids = describedBy(html.openWithOwn()).split(" ");
  assert.equal(ids[0], "err");
  assert.equal(ids.length, 2);
});

test("whileOpen stays undescribed while closed and renders no hidden span", () => {
  const markup = html.closedDefault();
  assert.equal(describedBy(markup), undefined);
  assert.doesNotMatch(markup, /hidden/);
});
