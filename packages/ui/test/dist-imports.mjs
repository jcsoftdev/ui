// Verifies the unbundled dist is loadable by plain Node ESM.
// Run after `pnpm build`: node test/dist-imports.mjs
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
assert.ok(existsSync(dist), "dist missing: run pnpm build first");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
}

const spec = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']*)["']/g;
const problems = [];
const files = walk(dist);
for (const file of files) {
  const code = readFileSync(file, "utf8");
  for (const m of code.matchAll(spec)) {
    const target = resolve(dirname(file), m[1]);
    if (!existsSync(target) || statSync(target).isDirectory()) {
      problems.push(`${file.slice(dist.length + 1)}: unresolved "${m[1]}"`);
    }
  }
}
assert.deepEqual(problems, [], `unresolvable relative imports:\n${problems.join("\n")}`);
console.log(`dist-imports: ${files.length} files, all relative imports resolve`);

for (const entry of [
  "utils/index.js",
  "utils/cn.js",
  "atoms/button/index.js",
  "primitives/index.js",
  "overlays/dialog/index.js",
]) {
  const p = join(dist, entry);
  assert.ok(existsSync(p), `entry missing: ${entry}`);
  await import(pathToFileURL(p).href);
  console.log(`  loaded ${entry}`);
}

// The published `./theme-builder` entry, shipped inside this package (no ui-tokens at runtime).
const builder = await import("@jcsoftdev/ui/theme-builder");
for (const name of [
  "buildTheme",
  "buildTokensCss",
  "buildThemeCss",
  "buildFontsCss",
  "buildThemeKt",
]) {
  assert.equal(typeof builder[name], "function", `theme-builder exports ${name}`);
}
const defaults = JSON.parse(readFileSync(resolve(dist, "../tokens/default.json"), "utf8"));
const oklchTokens = {
  ...defaults,
  color: {
    ...defaults.color,
    tokens: [{ name: "brand", value: "oklch(0.7 0.1 200)" }, ...defaults.color.tokens.slice(1)],
  },
};
const built = builder.buildTheme(oklchTokens, { kotlin: false });
assert.match(built["tokens.css"], /oklch\(0\.7 0\.1 200\)/);
assert.ok(!("Theme.kt" in built), "kotlin: false skips Theme.kt");
console.log("  theme-builder: buildTheme({ kotlin: false }) ok");

// The published `./primitives` entry, resolved the way a consumer (and this package) sees it.
const barrel = await import("@jcsoftdev/ui/primitives");
assert.deepEqual(
  Object.keys(barrel).sort(),
  [
    "CommandPrimitive",
    "DialogPrimitive",
    "LAYER_BRANCH_ATTRIBUTE",
    "MenuPrimitive",
    "PopoverPrimitive",
    "PopperPrimitive",
    "Portal",
    "commandScore",
    "computePlacement",
    "useDismissableLayer",
    "useFocusScope",
    "useLayer",
    "usePresence",
  ],
  "the primitives barrel exposes exactly the public set",
);
for (const deep of ["hide-others", "scroll-lock", "focusable", "menu/typeahead"]) {
  await assert.rejects(
    () => import(`@jcsoftdev/ui/primitives/${deep}`),
    { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" },
    deep,
  );
}
console.log("  @jcsoftdev/ui/primitives: public set only, internals not importable");
