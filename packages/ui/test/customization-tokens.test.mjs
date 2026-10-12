// Guards the customization contract: component source must not hardcode colours or
// font sizes. Styling goes through theme tokens (bg-surface, text-fs-120, ...), so a
// consumer's variable overrides reach every component.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../src");

// Files that legitimately carry literals, with the reason. Everything else must use tokens.
const ALLOW = new Map([
  ["brand/palettes.ts", "brand palette definitions are data"],
  ["brand/generate.ts", "brand asset generator computes colours"],
  ["brand/logo-forge.tsx", "logo preview renders user-chosen brand colours"],
  ["charts/core/export.ts", "PNG/SVG export needs an opaque fallback background"],
  ["charts/globe-chart/globe-chart.tsx", "sphere shading gradient (white/black highlights)"],
  [
    "glass/displacement-map.ts",
    "channel encoding of the displacement map (data, not a theme colour)",
  ],
  ["showcase/shell.tsx", "swatch fallback inside var(--pal-*, #...)"],
  ["showcase/controls-bento.tsx", "swatch fallback inside var(--pal-*, #...)"],
]);

const SKIP_DIRS = new Set(["primitives", "tokens"]);
const SKIP_FILE = /(\.stories\.tsx?|\.test\.tsx?|\.generated\.ts)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

const PATTERNS = [
  ["hex colour", /#[0-9a-fA-F]{3,8}\b(?![\w-])/g],
  ["rgb()/rgba()/hsl() colour", /\b(?:rgba?|hsla?)\(/g],
  ["arbitrary pixel font size (use text-fs-*)", /\btext-\[\d+(?:\.\d+)?px\]/g],
];

test("component source has no hardcoded colours or arbitrary font sizes", () => {
  const found = [];
  for (const file of walk(src)) {
    const rel = relative(src, file).split("\\").join("/");
    if (ALLOW.has(rel)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const [label, re] of PATTERNS) {
        for (const m of line.matchAll(re)) found.push(`${rel}:${i + 1} ${label}: ${m[0]}`);
      }
    });
  }
  assert.deepEqual(found, [], `Use theme tokens instead of literals:\n${found.join("\n")}`);
});

test("allowlisted files still exist (remove stale entries)", () => {
  const all = new Set([...walk(src)].map((f) => relative(src, f).split("\\").join("/")));
  for (const rel of ALLOW.keys()) assert.ok(all.has(rel), `${rel} is allowlisted but missing`);
});
