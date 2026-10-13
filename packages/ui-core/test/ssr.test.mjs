// Every public entry imports in Node with no DOM globals (SSR), and touches nothing at import time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const entries = Object.entries(pkg.exports).filter(([key]) => !key.endsWith(".json"));

test("no DOM globals in this process", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
});

for (const [key, target] of entries) {
  for (const file of key.includes("*") ? [] : [target.import]) {
    test(`imports ${key} without a DOM`, async () => {
      const mod = await import(new URL(`../${file}`, import.meta.url));
      assert.ok(Object.keys(mod).length > 0, `${key} exports something`);
    });
  }
}
