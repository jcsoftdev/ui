// Consumer-configurable cn: createCn / extendCn add theme tokens without touching the default cn.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/utils/cn.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { cn, createCn, extendCn } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

test("kit theme tokens merge (width, height, agenda, text)", () => {
  assert.equal(cn("w-4 w-side-width"), "w-side-width");
  assert.equal(cn("w-side-width w-4"), "w-4");
  assert.equal(cn("h-top-height h-10"), "h-10");
  assert.equal(cn("h-8 h-control-height-lg"), "h-control-height-lg");
  assert.equal(cn("h-agenda-hour h-agenda-col"), "h-agenda-col");
  assert.equal(cn("text-sm text-m-button"), "text-m-button");
  assert.equal(cn("text-m-button text-red-500"), "text-m-button text-red-500");
});

test("a consumer text size conflicts with sizes but not with colours", () => {
  const mine = createCn({ theme: { text: ["hero"] } });
  assert.equal(mine("text-lg text-hero"), "text-hero");
  assert.equal(mine("text-hero text-lg"), "text-lg");
  assert.equal(mine("text-hero text-red-500"), "text-hero text-red-500");
  assert.equal(mine("text-hero md:text-lg"), "text-hero md:text-lg");
});

test("consumer spacing tokens merge across spacing utilities", () => {
  const mine = createCn({ theme: { spacing: ["gutter"] } });
  assert.equal(mine("p-gutter p-2"), "p-2");
  assert.equal(mine("p-2 p-gutter"), "p-gutter");
  assert.equal(mine("w-4 w-gutter"), "w-gutter");
  assert.equal(mine("gap-2 gap-x-gutter"), "gap-2 gap-x-gutter");
  assert.equal(mine("px-gutter p-2"), "p-2");
});

test("consumer radius and shadow tokens merge", () => {
  const mine = createCn({ theme: { radius: ["blob"], shadow: ["glow"] } });
  assert.equal(mine("rounded-md rounded-blob"), "rounded-blob");
  assert.equal(mine("rounded-blob rounded-t-lg"), "rounded-blob rounded-t-lg");
  assert.equal(mine("shadow-md shadow-glow"), "shadow-glow");
  assert.equal(mine("shadow-glow shadow-red-500"), "shadow-glow shadow-red-500");
});

test("consumer class groups and conflicts", () => {
  const mine = createCn({
    classGroups: [["brand-glow", "glow", ["sm", "lg"]]],
    conflicts: { "brand-glow": ["shadow"] },
  });
  assert.equal(mine("glow-sm glow-lg"), "glow-lg");
  assert.equal(mine("shadow-md glow-sm"), "glow-sm");
});

test("the default cn is unaffected by another instance", () => {
  const mine = createCn({ theme: { text: ["hero"], spacing: ["gutter"] } });
  assert.equal(mine("text-lg text-hero"), "text-hero");
  assert.equal(cn("text-lg text-hero"), "text-lg text-hero");
  assert.equal(cn("p-gutter p-2"), "p-gutter p-2");
  assert.equal(createCn()("text-lg text-hero"), "text-lg text-hero");
});

test("extendCn layers config without mutating its base", () => {
  const base = createCn({ theme: { text: ["hero"] } });
  const more = extendCn(base, { theme: { text: ["mega"], spacing: ["gutter"] } });
  assert.equal(more("text-hero text-mega"), "text-mega");
  assert.equal(more("text-lg text-hero"), "text-hero");
  assert.equal(more("p-gutter p-2"), "p-2");
  assert.equal(base("text-hero text-mega"), "text-hero text-mega");
  assert.equal(base("p-gutter p-2"), "p-gutter p-2");
});

test("an instance caches results and keeps clsx input handling", () => {
  const mine = createCn({ theme: { text: ["hero"] } });
  const first = mine("text-lg", ["text-hero", { "p-2": true, "p-4": false }]);
  assert.equal(first, "text-hero p-2");
  assert.equal(mine("text-lg", ["text-hero", { "p-2": true, "p-4": false }]), first);
});
