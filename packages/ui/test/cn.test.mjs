// cn() must resolve conflicts between the role tokens that style presets remap.
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
const { cn } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

test("role radii replace each other and the stock scale", () => {
  assert.equal(cn("rounded-button", "rounded-input"), "rounded-input");
  assert.equal(cn("rounded-card", "rounded-none"), "rounded-none");
  assert.equal(cn("rounded-pill", "rounded-badge"), "rounded-badge");
});

test("role shadows replace each other and the stock scale, not colors", () => {
  assert.equal(cn("shadow-card", "shadow-overlay"), "shadow-overlay");
  assert.equal(cn("shadow-pop", "shadow-md"), "shadow-md");
  assert.equal(cn("shadow-card", "shadow-accent/20"), "shadow-card shadow-accent/20");
});

test("density sizes replace stock sizes of the same property only", () => {
  assert.equal(cn("h-control", "h-12"), "h-12");
  assert.equal(cn("h-input", "h-control-sm"), "h-control-sm");
  assert.equal(cn("p-card", "p-2"), "p-2");
  assert.equal(cn("h-control", "px-control-x"), "h-control px-control-x");
});

test("preset edges keep their color override", () => {
  assert.equal(cn("border-control", "border-accent"), "border-control border-accent");
  assert.equal(cn("border-card", "border-0"), "border-0");
});
