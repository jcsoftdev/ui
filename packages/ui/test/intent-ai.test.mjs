import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { cases, messageActionMarkup } = await loadCases("intent-ai-cases.tsx");

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

test("each MessageActions button carries its own intent", () => {
  const html = messageActionMarkup();
  for (const action of ["copy", "regenerate", "like", "dislike"]) {
    const found = html.match(new RegExp(`<button\\b[^>]*\\sdata-intent="${action}"[^>]*>`));
    assert.ok(found, `${action} rendered no data-intent`);
    assert.match(found[0], /data-intent-key="m1"/);
  }
  assert.doesNotMatch(html, /actionIntents|actionintents/i);
});
