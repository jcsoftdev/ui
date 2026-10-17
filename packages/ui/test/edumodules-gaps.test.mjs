import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("gaps-cases.tsx");

test("Spinner is a labelled status that follows the locale and UI string overrides", () => {
  assert.match(
    html.spinnerDefault(),
    /role="status"[^>]*aria-label="Loading"|aria-label="Loading"[^>]*role="status"/,
  );
  assert.match(html.spinnerEs(), /aria-label="Cargando"/);
  assert.match(html.spinnerOverride(), /aria-label="Un momento"/);
  assert.match(html.spinnerLabel(), /aria-label="Saving"/);
});

test("Spinner only spins when motion is allowed and can be decorative", () => {
  assert.match(html.spinnerDefault(), /motion-safe:animate-spin/);
  const decorative = html.spinnerDecorative();
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /role="status"|aria-label/);
});

test("Spinner named sizes use classes and numeric sizes use inline pixels", () => {
  assert.match(html.spinnerLabel(), /size-7/);
  const px = html.spinnerPixels();
  assert.match(px, /width:40px;height:40px/);
  assert.match(px, /color:red/);
  assert.doesNotMatch(px, /size-4/);
});

test("Kbd renders a kbd element and merges className", () => {
  const markup = html.kbd();
  assert.match(markup, /^<kbd /);
  assert.match(markup, /class="[^"]*extra"/);
  assert.match(markup, />⌘K<\/kbd>$/);
});
