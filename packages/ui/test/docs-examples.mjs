// Keeps the primitives guide honest: every ```tsx block in the page must equal one `#region`
// of test/docs/primitives.tsx, which `tsc -p tsconfig.docs.json` type-checks against the built
// package through the public `@jcsoftdev/ui/primitives` path.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "docs/primitives.tsx"), "utf8");
const page = readFileSync(
  resolve(here, "../../../site/src/content/docs/docs/primitives.md"),
  "utf8",
);

const regions = new Map();
for (const m of source.matchAll(/\/\/ #region (\S+)\n([\s\S]*?)\/\/ #endregion/g)) {
  regions.set(m[1], m[2].trim());
}
const blocks = [...page.matchAll(/```tsx( region=(\S+))?\n([\s\S]*?)```/g)];
assert.ok(blocks.length >= 6, "the page must show the primitive examples");
const seen = new Set();
for (const [, , name, body] of blocks) {
  assert.ok(name, "every tsx block needs a region=<name> marker");
  assert.equal(body.trim(), regions.get(name), `tsx block "${name}" drifted from test/docs/primitives.tsx`);
  seen.add(name);
}
for (const name of ["dialog", "popover", "menu", "command", "command-dialog"]) {
  assert.ok(seen.has(name), `the page must include the "${name}" example`);
}
console.log(`docs-examples: ${blocks.length} blocks match the type-checked source`);
