import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { cases, emptyIntentMarkup } = await loadCases("intent-containers-cases.tsx");

const openingTag = (markup) => markup.match(/<(\w+)\b[^>]*\sdata-intent="probe"[^>]*>/);

for (const [name, { tag, markup }] of Object.entries(cases)) {
  test(`${name} carries the intent on its ${tag}`, () => {
    const html = markup();
    const found = openingTag(html);
    assert.ok(found, `${name} rendered no data-intent`);
    assert.equal(found[1], tag);
    assert.match(found[0], /data-intent-key="k1"/);
    assert.doesNotMatch(html, /\sintent(key)?=/i);
  });
}

const roles = { kanbanDraggable: "button", fileTree: "treeitem" };

for (const [name, role] of Object.entries(roles)) {
  test(`${name} keeps the role ${role} on the intent element`, () => {
    assert.match(openingTag(cases[name].markup())[0], new RegExp(`role="${role}"`));
  });
}

test("an empty intent renders nothing even with a key", () => {
  assert.doesNotMatch(emptyIntentMarkup(), /data-intent/);
});
