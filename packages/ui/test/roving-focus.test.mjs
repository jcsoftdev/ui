// getRovingIntent / findRovingTarget are the pure core of roving focus.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/utils/roving-focus.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { getRovingIntent, findRovingTarget } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

test("arrows follow the axis and flip horizontally in rtl", () => {
  assert.equal(getRovingIntent("ArrowRight", {}), "next");
  assert.equal(getRovingIntent("ArrowLeft", {}), "prev");
  assert.equal(getRovingIntent("ArrowDown", {}), "next");
  assert.equal(getRovingIntent("ArrowUp", {}), "prev");
  assert.equal(getRovingIntent("ArrowRight", { dir: "rtl" }), "prev");
  assert.equal(getRovingIntent("ArrowLeft", { dir: "rtl" }), "next");
  assert.equal(getRovingIntent("ArrowDown", { dir: "rtl" }), "next");
});

test("orientation ignores the other axis", () => {
  assert.equal(getRovingIntent("ArrowDown", { orientation: "horizontal" }), undefined);
  assert.equal(getRovingIntent("ArrowRight", { orientation: "vertical" }), undefined);
  assert.equal(getRovingIntent("ArrowDown", { orientation: "vertical" }), "next");
  assert.equal(getRovingIntent("ArrowLeft", { orientation: "horizontal", dir: "rtl" }), "next");
});

test("home, end, page keys and unrelated keys", () => {
  assert.equal(getRovingIntent("Home", {}), "first");
  assert.equal(getRovingIntent("PageUp", { orientation: "horizontal" }), "first");
  assert.equal(getRovingIntent("End", {}), "last");
  assert.equal(getRovingIntent("PageDown", {}), "last");
  assert.equal(getRovingIntent("a", {}), undefined);
});

test("findRovingTarget steps, wraps with loop and stops without it", () => {
  const items = ["a", "b", "c"];
  assert.equal(findRovingTarget(items, "a", "next", true), "b");
  assert.equal(findRovingTarget(items, "c", "next", true), "a");
  assert.equal(findRovingTarget(items, "a", "prev", true), "c");
  assert.equal(findRovingTarget(items, "c", "next", false), undefined);
  assert.equal(findRovingTarget(items, "a", "prev", false), undefined);
  assert.equal(findRovingTarget(items, "b", "prev", false), "a");
  assert.equal(findRovingTarget(items, "b", "first", false), "a");
  assert.equal(findRovingTarget(items, "b", "last", false), "c");
});
