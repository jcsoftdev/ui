// The glyph modules are generated from the React kit's SVG sources: every one must match its source
// markup, and every registry entry must load. Run after `pnpm build`.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { glyphs, SHORTHANDS } from "../scripts/build-icons.mjs";

const { registry } = await import(new URL("../dist/icon/registry.js", import.meta.url));

test("every glyph module equals its React kit SVG source", async () => {
  const expected = glyphs();
  assert.deepEqual(Object.keys(registry).sort(), [...expected.keys()].sort());
  assert.equal(
    readdirSync(new URL("../dist/icon/glyphs/", import.meta.url)).filter((f) => f.endsWith(".js"))
      .length,
    expected.size,
  );
  for (const [id, markup] of expected) assert.equal((await registry[id]()).default, markup, id);
});

test("the React <Icon name> shorthands resolve to their glyph", async () => {
  for (const [short, id] of Object.entries(SHORTHANDS))
    assert.equal((await registry[short]()).default, (await registry[id]()).default, short);
});

test("the plain file glyph stays reachable beside the file shorthand", async () => {
  assert.notEqual((await registry["file-plain"]()).default, (await registry.file()).default);
});
