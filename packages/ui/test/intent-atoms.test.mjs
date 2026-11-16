import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("intent-atoms-cases.tsx");

const tagOf = (markup, pattern) => markup.match(pattern)?.[0] ?? "";
const carriesProbe = (tag) =>
  tag.includes('data-intent="probe"') && tag.includes('data-intent-key="k1"');

const rolePattern = (role) => new RegExp(`<[a-z]+[^>]*role="${role}"[^>]*>`);

test("every intent-aware atom carries both attributes on its role element", () => {
  const cases = [
    ["checkbox", rolePattern("checkbox")],
    ["switch", rolePattern("switch")],
    ["button", /<button[^>]*>/],
    ["iconButton", /<button[^>]*>/],
    ["buttonLink", /<a [^>]*>/],
    ["chip", /<span[^>]*>/],
    ["pressableFeedback", /<span[^>]*>/],
  ];
  for (const [name, pattern] of cases) {
    assert.ok(carriesProbe(tagOf(html[name], pattern)), name);
  }
});

test("radio items default the key to the option value and keep an explicit key", () => {
  const radios = html.radioGroup.match(/<button[^>]*role="radio"[^>]*>/g);
  assert.equal(radios.length, 3);
  assert.match(radios[0], /data-intent="pick-a"/);
  assert.match(radios[0], /data-intent-key="a"/);
  assert.match(radios[1], /data-intent="pick-b"/);
  assert.match(radios[1], /data-intent-key="custom"/);
  assert.doesNotMatch(radios[2], /data-intent/);
});

test("intent props never reach the DOM as raw attributes", () => {
  for (const [name, markup] of Object.entries(html)) {
    assert.doesNotMatch(markup, /\sintent(key)?=/i, name);
  }
});

test("no intent, or an empty one, renders no intent attribute", () => {
  assert.doesNotMatch(html.buttonPlain, /data-intent/);
  assert.doesNotMatch(html.buttonEmptyIntent, /data-intent/);
});

test("a consumer data-intent wins over the prop", () => {
  assert.match(html.buttonOverride, /data-intent="mine"/);
  assert.doesNotMatch(html.buttonOverride, /data-intent="probe"/);
});
