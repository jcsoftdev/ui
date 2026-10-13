// Every entry imports in Node (SSR) without a DOM: nothing is defined, nothing throws.
import assert from "node:assert/strict";
import { test } from "node:test";
import { elementEntries } from "../scripts/entries.mjs";

const entries = [{ name: ".", dist: "dist/index.js" }, ...elementEntries()];
for (const { name, dist } of entries) {
  test(`imports ${name} without a DOM`, async () => {
    const mod = await import(new URL(`../${dist}`, import.meta.url));
    const defines = Object.entries(mod).filter(([key]) => key.startsWith("define"));
    assert.ok(defines.length > 0, `${name} exports a define function`);
    for (const [key, define] of defines) {
      // `define()` registers every element and returns nothing; `defineX()` returns its tag.
      if (key === "define") assert.doesNotThrow(() => define());
      else assert.equal(typeof define(), "string", `${key}() is a no-op returning the tag`);
    }
  });
}
