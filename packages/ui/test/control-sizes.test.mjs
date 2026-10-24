// One height per control size: every control at `sm` carries `--control-height-sm` (30px) and at `md`
// `--control-height-md` (38px), so a button lines up with a field in a toolbar or a table row. The
// markup cannot be measured here, so the contract is the token class each control renders.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("control-size-cases.tsx");

const HEIGHT = { sm: /\bh-control-sm\b/, md: /\bh-control-md\b/ };

/** The class attribute of the first element carrying a height token. */
function heights(markup) {
  return [...markup.matchAll(/class="([^"]*)"/g)]
    .map((m) => m[1].split(/\s+/).filter((name) => /^h-(control(-\w+)?|input)$/.test(name)))
    .filter((list) => list.length > 0);
}

test("Button and IconButton take the shared height at sm and md", () => {
  for (const size of ["sm", "md"]) {
    assert.match(html.button(size), HEIGHT[size]);
    assert.match(html.iconButton(size), HEIGHT[size]);
  }
  assert.match(html.button(), HEIGHT.md, "md is the default");
  assert.match(html.iconButton(), /\bw-control-md\b/, "the md icon button is a 38px square");
  assert.match(html.iconButton("sm"), /\bw-control-sm\b/);
  assert.deepEqual(heights(html.button("md")), [["h-control-md"]]);
});
