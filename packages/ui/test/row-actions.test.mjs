import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("row-actions-cases.tsx");

test("RowActions renders the primary action and a 30px menu trigger named by label", () => {
  const markup = html.full();
  assert.match(markup, /data-slot="row-actions"/);
  assert.match(markup, />Open<\/button>/);
  assert.match(
    markup,
    /<button[^>]*aria-label="Actions for Ana"[^>]*aria-haspopup="menu"|<button[^>]*aria-haspopup="menu"[^>]*aria-label="Actions for Ana"/,
  );
  assert.match(
    markup,
    /aria-label="Actions for Ana"[^>]*class="[^"]*h-control-sm[^"]*w-control-sm|class="[^"]*h-control-sm[^"]*w-control-sm[^"]*"[^>]*aria-label="Actions for Ana"/,
  );
});

test("RowActions never wraps", () => {
  const wrapper = html.full().match(/data-slot="row-actions"[^>]*class="([^"]*)"/)?.[1] ?? "";
  assert.match(wrapper, /\bflex-nowrap\b/);
  assert.match(wrapper, /\bwhitespace-nowrap\b/);
});

test("RowActions without items renders no menu trigger", () => {
  const markup = html.primaryOnly();
  assert.doesNotMatch(markup, /aria-haspopup/);
  assert.doesNotMatch(markup, /Actions for Ana/);
});
