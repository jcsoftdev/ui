import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../styles/base.css"), "utf8");

function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} rule exists`);
  return css.slice(start, css.indexOf("}", start));
}

function block(header) {
  const start = css.indexOf(header);
  assert.ok(start >= 0, `${header} block exists`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`${header} is not closed`);
}

test("the highlight is a solid outline and the changed marker a dashed one", () => {
  assert.match(rule("[data-intent-highlight]"), /outline:[^;]*\bsolid\b/);
  assert.match(rule("[data-intent-changed]"), /outline:[^;]*\bdashed\b/);
});

test("the highlight animation is declared", () => {
  assert.match(css, /@keyframes intent-highlight/);
  assert.match(rule("[data-intent-highlight]"), /animation:\s*intent-highlight/);
});

test("reduced motion removes the animation and keeps the outline", () => {
  const reduced = block("@media (prefers-reduced-motion: reduce) {\n  [data-intent-highlight]");
  assert.match(reduced, /\[data-intent-highlight\]\s*{\s*animation:\s*none/);
  assert.doesNotMatch(reduced, /outline:\s*none/);
});

test("forced colors paint the outline with Highlight", () => {
  assert.match(block("@media (forced-colors: active) {\n  [data-intent-highlight]"), /Highlight/);
});

test("the default highlight width is at least 2px", () => {
  const width = css.match(/var\(--intent-highlight-width,\s*(\d+)px\)/);
  assert.ok(width, "width default exists");
  assert.ok(Number(width[1]) >= 2);
});
