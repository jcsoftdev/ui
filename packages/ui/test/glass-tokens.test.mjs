import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildTheme, glassOf, stylesOf } from "../scripts/build-theme.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const theme = JSON.parse(readFileSync(join(here, "../tokens/default.json"), "utf8"));
const out = buildTheme(theme, { kotlinPackage: "com.example", kotlinLibrary: true });
const css = out["tokens.css"];

const GLASS = stylesOf(theme).presetGoverned.filter((n) => n.startsWith("glass-"));

function declarations(head) {
  const start = css.indexOf(head);
  assert.notEqual(start, -1, `missing ${head}`);
  const open = css.indexOf("{", start);
  return new Map(
    [...css.slice(open + 1, css.indexOf("}", open)).matchAll(/--([\w-]+): ([^;]+);/g)].map(
      ([, k, v]) => [k, v.trim()],
    ),
  );
}

test("glass material tokens exist for both variants and are declared in every preset", () => {
  for (const variant of ["regular", "clear"]) {
    for (const part of [
      "tint",
      "blur",
      "saturate",
      "filter",
      "border",
      "edge",
      "shadow",
      "dim",
      "fallback",
    ]) {
      assert.ok(GLASS.includes(`glass-${variant}-${part}`), `glass-${variant}-${part}`);
    }
  }
  for (const id of ["soft", "bordered", "elevated", "flat", "glass", "brutal"]) {
    const block = declarations(`:root[data-style="${id}"],\n[data-style="${id}"] {`);
    for (const name of GLASS) assert.ok(block.has(name), `${id} must declare --${name}`);
  }
});

test("only the glass preset tunes the material; the others keep the base values", () => {
  const root = declarations(":root {");
  assert.equal(root.get("glass-regular-blur"), "20px");
  assert.equal(declarations(':root[data-style="soft"]').get("glass-regular-blur"), "20px");
  assert.equal(declarations(':root[data-style="glass"]').get("glass-regular-blur"), "24px");
});

test("clear glass carries a dimming layer, regular glass does not", () => {
  const root = declarations(":root {");
  assert.equal(root.get("glass-regular-dim"), "rgba(0,0,0,0)");
  assert.match(root.get("glass-clear-dim"), /^rgba\(\d+,\d+,\d+,\.\d+\)$/);
});

test("legacy surface tokens still resolve and content stays opaque in every preset", () => {
  for (const id of ["soft", "bordered", "elevated", "flat", "glass", "brutal"]) {
    const block = declarations(`:root[data-style="${id}"],\n[data-style="${id}"] {`);
    for (const name of [
      "surface-alpha",
      "surface-blur",
      "surface-filter",
      "surface-card",
      "surface-control",
      "surface-overlay",
    ]) {
      assert.ok(block.has(name), `${id} keeps --${name}`);
    }
    assert.doesNotMatch(block.get("surface-card"), /color-mix|rgba/, `${id}: cards are opaque`);
  }
  const glass = declarations(':root[data-style="glass"]');
  assert.equal(glass.get("surface-filter"), "var(--glass-regular-filter)");
  assert.equal(glass.get("surface-overlay"), "var(--glass-regular-tint)");
  assert.equal(declarations(":root {").get("surface-filter"), "none");
});

test("glass tokens are themed with dark values", () => {
  const dark = declarations(':root[data-theme="dark"] {');
  assert.equal(dark.get("glass-regular-tint"), "rgba(30,30,36,.58)");
  assert.equal(dark.get("glass-clear-dim"), "rgba(0,0,0,.3)");
});

test("Theme.kt exports the materials per theme in both flavours", () => {
  const lib = out["Theme.kt"];
  assert.match(lib, /@Immutable\npublic class GlassMaterial\(/);
  assert.match(lib, /public val RegularDark: GlassMaterial = GlassMaterial\(/);
  assert.match(lib, /public val ClearLight: GlassMaterial/);
  assert.match(lib, /blur = 20\.dp,/);
  assert.match(lib, /saturate = 1\.8f,/);
  const plain = buildTheme(theme)["Theme.kt"];
  assert.match(plain, /^class GlassMaterial\(/m);
  assert.doesNotMatch(plain, /public |@Immutable/);
});

test("a theme without glass tokens generates no glass output", () => {
  const { styles: _s, ...bare } = theme;
  assert.deepEqual(glassOf(bare), []);
  assert.doesNotMatch(buildTheme(bare)["Theme.kt"], /Glass/);
});

test("a glass variant with a missing part is rejected", () => {
  const broken = structuredClone(theme);
  broken.styles.tokens = broken.styles.tokens.filter((t) => t.name !== "glass-clear-dim");
  assert.throws(() => glassOf(broken), /glass-clear-dim/);
});

const themeCss = out["theme.css"];
const utility = (name) => {
  const start = themeCss.indexOf(`@utility ${name} {`);
  assert.notEqual(start, -1, `missing @utility ${name}`);
  const next = themeCss.indexOf("\n@utility ", start + 1);
  return themeCss.slice(start, next === -1 ? undefined : next);
};

test("glass and glass-clear gate the blur and fall back to an opaque fill", () => {
  for (const [name, variant] of [
    ["glass", "regular"],
    ["glass-clear", "clear"],
  ]) {
    const css = utility(name);
    // The opaque fill is the base; the translucent one only exists inside @supports.
    assert.ok(
      css.indexOf(`background-color: var(--glass-${variant}-fallback)`) < css.indexOf("@supports"),
    );
    assert.match(
      css,
      /@supports \(\(-webkit-backdrop-filter: blur\(1px\)\) or \(backdrop-filter: blur\(1px\)\)\) \{[^}]*--glass-\w+-tint/,
    );
    assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
    assert.match(css, /@media \(prefers-contrast: more\)/);
    assert.match(css, /@media \(forced-colors: active\) \{[^}]*Canvas/);
    assert.match(
      css,
      /:where\(\.glass, \.glass-clear, \.surface-overlay\) & \{[^}]*--glass-nested-tint/,
    );
  }
  assert.match(utility("glass-clear"), /linear-gradient\(var\(--glass-clear-dim\)/);
});

test("surface-card never blurs; surface-overlay keeps the alias and gets fallbacks", () => {
  assert.doesNotMatch(utility("surface-card"), /backdrop-filter/);
  const overlay = utility("surface-overlay");
  assert.match(overlay, /backdrop-filter: var\(--surface-filter\)/);
  assert.match(overlay, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(overlay, /@supports not/);
});
