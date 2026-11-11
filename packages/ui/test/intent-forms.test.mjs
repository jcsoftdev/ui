import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { intentCases, bareCases, render } = await loadCases("intent-forms-cases.tsx");

const attributeOf = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const openingTags = (markup) => [...markup.matchAll(/<(\w+)\s[^>]*>/g)].map((m) => m[0]);

const findTarget = (markup, expected) =>
  openingTags(markup).find(
    (tag) =>
      tag.startsWith(`<${expected.tag} `) &&
      attributeOf(tag, "data-intent") === expected.intent &&
      attributeOf(tag, "data-intent-key") === expected.key &&
      (expected.role === undefined || attributeOf(tag, "role") === expected.role),
  );

for (const { name, element, expected } of intentCases) {
  test(`${name} carries the intent attributes on its target`, () => {
    const markup = render(element);
    for (const target of expected) {
      assert.ok(
        findTarget(markup, target),
        `${name}: no <${target.tag}> for ${JSON.stringify(target)} in ${markup}`,
      );
    }
    assert.doesNotMatch(markup, /\sintent(key)?=/i);
  });
}

for (const { name, element } of bareCases) {
  test(`${name} renders no intent attributes without an intent`, () => {
    const markup = render(element);
    assert.doesNotMatch(markup, /data-intent/);
    assert.doesNotMatch(markup, /\sintent(key)?=/i);
  });
}
