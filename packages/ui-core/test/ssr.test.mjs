// Every public entry imports in Node with no DOM globals (SSR), and touches nothing at import time.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const files = [];
for (const [key, target] of Object.entries(pkg.exports)) {
  if (key.endsWith(".json")) continue;
  if (!key.includes("*")) {
    files.push([key, target.import]);
    continue;
  }
  const [dir] = target.import.split("*");
  for (const name of readdirSync(new URL(`../${dir}`, import.meta.url)))
    if (name.endsWith(".js")) files.push([key.replace("*", name.slice(0, -3)), `${dir}${name}`]);
}

test("no DOM globals in this process", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
});

for (const [key, file] of files) {
  test(`imports ${key} without a DOM`, async () => {
    const mod = await import(new URL(`../${file}`, import.meta.url));
    assert.ok(Object.keys(mod).length > 0, `${key} exports something`);
  });
}

test("attachLiquid is a no-op without a DOM", async () => {
  const { attachLiquid } = await import("../dist/liquid/attach.js");
  const style = new Map();
  const element = {
    style: {
      getPropertyValue: (name) => style.get(name) ?? "",
      setProperty: (name, value) => style.set(name, value),
      removeProperty: (name) => style.delete(name),
    },
    isConnected: true,
    parentElement: null,
  };
  const stop = attachLiquid(element, { frost: 4 });
  assert.equal(style.get("--liquid-frost"), "4px");
  stop();
  assert.equal(style.size, 0);
});
