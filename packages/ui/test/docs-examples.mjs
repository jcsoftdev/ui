// Keeps the primitives and glass guides honest: every ```tsx block in a page must equal one `#region`
// of test/docs/primitives.tsx, which `tsc -p tsconfig.docs.json` type-checks against the built
// package through the public `@jcsoftdev/ui/primitives` path.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Every ```tsx block of `page` must equal one `#region` of `source`; returns the region names. */
function check(sourceFile, pageFile, { min, required }) {
  const source = readFileSync(resolve(here, sourceFile), "utf8");
  const page = readFileSync(resolve(here, pageFile), "utf8");
  const regions = new Map();
  for (const m of source.matchAll(/\/\/ #region (\S+)\n([\s\S]*?)\/\/ #endregion/g)) {
    regions.set(m[1], m[2].trim());
  }
  const blocks = [...page.matchAll(/```tsx( region=(\S+))?\n([\s\S]*?)```/g)];
  assert.ok(blocks.length >= min, `${pageFile} must show its examples`);
  const seen = new Set();
  for (const [, , name, body] of blocks) {
    assert.ok(name, "every tsx block needs a region=<name> marker");
    assert.equal(body.trim(), regions.get(name), `tsx block "${name}" drifted from ${sourceFile}`);
    seen.add(name);
  }
  for (const name of required) assert.ok(seen.has(name), `${pageFile} must include "${name}"`);
  return blocks.length;
}

const primitives = check(
  "docs/primitives.tsx",
  "../../../site/src/content/docs/docs/primitives.md",
  { min: 6, required: ["dialog", "popover", "menu", "command", "command-dialog"] },
);
const glass = check("docs/glass.tsx", "../../../site/src/content/docs/docs/glass.md", {
  min: 3,
  required: ["opt-in", "liquid", "liquid-options", "crystal", "lens"],
});
const blocks = check("docs/blocks.tsx", "../../../site/src/content/docs/docs/blocks.md", {
  min: 6,
  required: [
    "atoms",
    "overlays",
    "testing",
    "forms",
    "control-sizes",
    "wizard",
    "containers",
    "states",
  ],
});
const auth = check("docs/auth.tsx", "../../../site/src/content/docs/docs/auth.md", {
  min: 3,
  required: ["login", "controlled", "solid", "looks", "statement"],
});
const data = check("docs/data.tsx", "../../../site/src/content/docs/docs/data-and-dashboards.md", {
  min: 4,
  required: ["dashboard", "sortable", "pagination", "filter-bar"],
});
const motion = check("docs/motion.tsx", "../../../site/src/content/docs/docs/motion.md", {
  min: 6,
  required: ["reveal", "stagger", "cross-fade", "presence", "count-up", "highlight-row"],
});
console.log(
  `docs-examples: ${primitives} primitives, ${glass} glass, ${blocks} building-block, ${auth} sign-in, ${data} data and ${motion} motion blocks match the type-checked source`,
);
