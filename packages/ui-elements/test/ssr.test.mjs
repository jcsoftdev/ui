// Every element entry imports in Node (SSR) without a DOM: nothing is defined, nothing throws.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
for (const [key, target] of Object.entries(pkg.exports)) {
  if (typeof target === "string") continue;
  test(`imports ${key} without a DOM`, async () => {
    const mod = await import(new URL(`../${target.import}`, import.meta.url));
    const defines = Object.entries(mod).filter(([name]) => name.startsWith("define"));
    assert.ok(defines.length > 0, `${key} exports a define function`);
    for (const [name, define] of defines) {
      // `define()` registers every element and returns nothing; `defineX()` returns its tag.
      if (name === "define") assert.doesNotThrow(() => define());
      else assert.equal(typeof define(), "string", `${name}() is a no-op returning the tag`);
    }
  });
}
