import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadCases } from "./components/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const theme = readFileSync(join(here, "../styles/theme.css"), "utf8");
const tokens = readFileSync(join(here, "../styles/tokens.css"), "utf8");
const golden = readFileSync(join(here, "golden/frosted-utilities.css"), "utf8");
const { material } = await loadCases("material-cases.tsx");
const glass = await loadCases("glass-cases.ts");

const utility = (name) => {
  const start = theme.indexOf(`@utility ${name} {`);
  assert.notEqual(start, -1, `missing @utility ${name}`);
  const end = theme.indexOf("\n}\n", start);
  return theme.slice(start, end + 3);
};

/** The current utility with everything liquid taken out: what the frosted material has to be. */
function frostedView(name) {
  return utility(name)
    .replace(
      / {2}@supports \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\n[\s\S]*?\n {2}\}\n(?= {2}:where| {2}&\[| {2}@media)/,
      "",
    )
    .replace(
      /:where\(\.glass, \.glass-clear, \.liquid, \.liquid-clear, /g,
      ":where(.glass, .glass-clear, ",
    )
    .replace(/ *--glass-lens: 0;\n/g, "");
}

test("the frosted utilities render exactly as in 0.2 (liquid is additive)", () => {
  const expected = golden.split(/\n(?=@utility )/).map((block) => block.trimEnd());
  const names = ["glass", "glass-clear", "surface-overlay", "surface-nav", "surface-side"];
  names.forEach((name, i) => {
    assert.equal(frostedView(name).trimEnd(), expected[i], `${name} changed`);
  });
});

test("liquid tokens exist, themed where light and dark differ", () => {
  for (const name of [
    "liquid-regular-blur",
    "liquid-clear-blur",
    "liquid-saturate",
    "liquid-regular-filter",
    "liquid-clear-filter",
    "liquid-regular-tint",
    "liquid-regular-dim",
    "liquid-clear-tint",
    "liquid-clear-dim",
    "liquid-rim",
    "liquid-depth",
    "liquid-depth-active",
  ]) {
    assert.match(tokens, new RegExp(`--${name}:`), name);
  }
  // Dark overrides exist for the tinted ones.
  assert.match(tokens, /:root\[data-theme="dark"\] \{[\s\S]*--liquid-regular-dim: rgba\(0,0,0,/);
});

test("liquid and liquid-clear are plain utilities with the lens flag and fallbacks", () => {
  for (const [name, variant] of [
    ["liquid", "regular"],
    ["liquid-clear", "clear"],
  ]) {
    const css = utility(name);
    assert.ok(
      css.indexOf(`background-color: var(--glass-${variant}-fallback)`) < css.indexOf("@supports"),
    );
    // The filter is composed from the variant's tokens and the per-surface options.
    assert.match(
      css,
      new RegExp(
        `backdrop-filter: blur\\(var\\(--liquid-frost, var\\(--liquid-${variant}-blur\\)\\)\\) saturate\\(var\\(--liquid-saturation, var\\(--liquid-saturate\\)\\)\\) var\\(--liquid-brightness-fn, `,
      ),
    );
    assert.match(css, /--glass-lens: 1/);
    assert.match(css, /--glass-lens-dim: var\(--liquid-\w+-dim\)/);
    assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
    assert.match(css, /@media \(prefers-contrast: more\)/);
    assert.match(css, /@media \(forced-colors: active\) \{[^}]*Canvas/);
    assert.match(css, /--glass-lens: 0/);
  }
});

test("the global switch is gated on data-glass=liquid (or a liquid preset) and never touches the content layer", () => {
  assert.match(utility("glass"), /:where\(\[data-glass\^="liquid"\]\) & \{/);
  assert.match(utility("glass-clear"), /:where\(\[data-glass\^="liquid"\]\) & \{/);
  for (const name of ["surface-overlay", "surface-nav", "surface-side"])
    assert.match(utility(name), /\[data-glass\^="liquid"\]\[data-style="glass"\]/);
  assert.doesNotMatch(utility("surface-card"), /liquid/);
});

test("press flex only exists for interactive liquid surfaces and respects reduced motion", () => {
  const css = utility("liquid");
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /button, a, \[role="button"\], \[data-glass-interactive\]/);
  assert.doesNotMatch(css, /transition:[^;]*backdrop/);
  assert.doesNotMatch(
    utility("glass").replace(/\[data-glass\^="liquid"\][\s\S]*?\n {2}:where\(\.glass/, ""),
    /scale:/,
  );
});

test("materialClass maps liquid values and cn treats them as one surface group", () => {
  assert.equal(material.materialClass("liquid", "surface-solid"), "liquid");
  assert.equal(material.materialClass("liquid-clear", "surface-solid"), "liquid-clear");
  assert.equal(material.cn("surface-card", "liquid"), "liquid");
  assert.equal(material.cn("glass", "liquid-clear", "p-2"), "liquid-clear p-2");
  assert.equal(material.cn("liquid", "surface-solid"), "surface-solid");
  assert.ok(material.card("liquid").split(" ").includes("liquid"));
});

test("the liquid utilities read every option variable and keep the theme look when none is set", () => {
  const css = utility("liquid");
  for (const name of [
    "--liquid-glow",
    "--liquid-tint-fill",
    "--liquid-veil-fill",
    "--liquid-rim-custom",
    "--liquid-shadow-custom",
    "--liquid-shadow-auto",
  ])
    assert.ok(css.includes(name), name);
  // Every option falls back to the token it replaces, so an unset option changes nothing.
  assert.match(css, /var\(--liquid-rim-custom, var\(--liquid-rim\)\)/);
  assert.match(
    css,
    /var\(--liquid-shadow-custom, var\(--liquid-shadow-auto, var\(--liquid-shadow\)\)\)/,
  );
  assert.match(css, /calc\(var\(--liquid-opacity, 1\) \* 100%\)/);
  assert.match(css, /calc\(var\(--liquid-tint-amount, 0\) \* 100%\)/);
});

test("base.css presets are the LIQUID_PRESETS, variable for variable", async () => {
  const base = readFileSync(join(here, "../styles/base.css"), "utf8");
  for (const name of ["clear", "thick"]) {
    const block = new RegExp(`\\[data-glass="liquid-${name}"\\] \\{([^}]*)\\}`).exec(base)?.[1];
    assert.ok(block, `base.css misses the ${name} preset`);
    const declared = Object.fromEntries(
      [...block.matchAll(/(--[\w-]+): ([^;]+);/g)].map(([, key, value]) => [key, value]),
    );
    assert.deepEqual(declared, glass.liquidVars(glass.LIQUID_PRESETS[name]), name);
  }
  assert.deepEqual(glass.liquidVars(glass.LIQUID_PRESETS.regular), {});
});
