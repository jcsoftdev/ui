// cn() must match the tailwind-merge output the library shipped with before T8 replaced it.
// test/golden/class-merge.jsonl holds [args, expected] rows captured from tailwind-merge 3.7.0
// (extended with the kit's tokens): every distinct cn(...) call in src, hand-picked edge cases,
// and seeded random mixes of the class vocabulary used across src. The rows were also run
// against the new implementation over a 44k case superset before tailwind-merge was removed.
// T8b deliberately changed exactly two rows: `h-control-lg` is a theme token (--spacing-control-lg)
// the hand-written list had missed, so it now conflicts with other heights instead of passing
// through (`h-16 h-control-lg` -> `h-control-lg`, `h-control-lg h-2` -> `h-2`).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const load = async (entry) => {
  const bundle = await build({
    entryPoints: [join(here, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
};
const { cn } = await load("../src/utils/cn.ts");
const { TEXT_SIZES, RADII, SHADOWS, SPACINGS } = await load("../src/utils/class-groups.ts");

const rows = readFileSync(join(here, "golden/class-merge.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

test("golden table is large and exercises real merges", () => {
  assert.ok(rows.length > 2500);
  const merged = rows.filter(([args, out]) => out !== args.join(" ").trim().replace(/\s+/g, " "));
  assert.ok(merged.length > 300, `only ${merged.length} rows change`);
});

test("cn matches the tailwind-merge golden table", () => {
  const failures = [];
  for (const [args, expected] of rows) {
    const actual = cn(...args);
    if (actual !== expected) failures.push({ args, expected, actual });
  }
  assert.deepEqual(failures.slice(0, 10), []);
});

test("cn is stable when applied to its own output", () => {
  for (const [, expected] of rows) assert.equal(cn(expected), expected);
});

test("theme.css tokens are known to the merge table", () => {
  const css = readFileSync(join(here, "../styles/theme.css"), "utf8");
  const names = (ns, skip) =>
    [...css.matchAll(new RegExp(`--${ns}-([a-z0-9-]+):`, "g"))]
      .map((m) => m[1])
      .filter((n) => !n.includes("--") && !skip.test(n));
  const missing = (list, known) => list.filter((n) => !known.includes(n));
  assert.deepEqual(missing(names("text", /^$/), TEXT_SIZES), []);
  assert.deepEqual(missing(names("radius", /^$/), RADII), []);
  assert.deepEqual(missing(names("shadow", /^$/), SHADOWS), []);
  assert.deepEqual(missing(names("spacing", /^$/), SPACINGS), []);
});

test("generated token file is in sync with theme.css", async () => {
  const { render } = await import("../scripts/build-class-tokens.mjs");
  const css = readFileSync(join(here, "../styles/theme.css"), "utf8");
  const file = readFileSync(join(here, "../src/utils/class-tokens.generated.ts"), "utf8");
  assert.equal(file, render(css), "run `pnpm build:class-tokens`");
});
