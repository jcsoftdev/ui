// DOM-free cores of the overlay primitives: layer stack, ref-counted lock, Tab wrap.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  stdin: {
    contents: `
      export { createLayerStack } from "./layer-stack.ts";
      export { createRefCountedLock } from "./scroll-lock.ts";
      export { resolveTabWrap } from "./focusable.ts";`,
    resolveDir: join(here, "../src/primitives"),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { createLayerStack, createRefCountedLock, resolveTabWrap } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

test("layer stack: only the last pushed layer is on top, removal reveals the one below", () => {
  const stack = createLayerStack();
  const a = {};
  const b = {};
  const removeA = stack.push(a);
  const removeB = stack.push(b);
  assert.equal(stack.isTop(b), true);
  assert.equal(stack.isTop(a), false);
  removeB();
  assert.equal(stack.isTop(a), true);
  removeA();
  removeA();
  assert.equal(stack.size(), 0);
});

test("ref-counted lock applies once and restores on the last release only", () => {
  const log = [];
  const acquire = createRefCountedLock(() => {
    log.push("apply");
    return () => log.push("restore");
  });
  const r1 = acquire();
  const r2 = acquire();
  assert.deepEqual(log, ["apply"]);
  r1();
  r1();
  assert.deepEqual(log, ["apply"]);
  r2();
  assert.deepEqual(log, ["apply", "restore"]);
  acquire()();
  assert.deepEqual(log, ["apply", "restore", "apply", "restore"]);
});

test("resolveTabWrap wraps at the ends and enters from the matching end", () => {
  const items = ["a", "b", "c"];
  assert.equal(resolveTabWrap(items, "c", false), "a");
  assert.equal(resolveTabWrap(items, "a", true), "c");
  assert.equal(resolveTabWrap(items, "b", false), null);
  assert.equal(resolveTabWrap(items, "b", true), null);
  assert.equal(resolveTabWrap(items, null, false), "a");
  assert.equal(resolveTabWrap(items, "container", true), "c");
  assert.equal(resolveTabWrap([], "x", false), null);
});

test("global singleton returns one shared instance per key across module copies", async () => {
  const bundleSingleton = await build({
    stdin: {
      contents: `export { globalSingleton } from "./global-singleton.ts";`,
      resolveDir: join(here, "../src/primitives"),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const source = Buffer.from(bundleSingleton.outputFiles[0].contents).toString();
  const copy = async (tag) =>
    import(`data:text/javascript;base64,${Buffer.from(`${source}\n// ${tag}`).toString("base64")}`);
  const first = (await copy("one")).globalSingleton;
  const second = (await copy("two")).globalSingleton;
  const shared = first("test/shared", () => ({}));
  assert.equal(
    second("test/shared", () => ({ other: true })),
    shared,
  );
});
