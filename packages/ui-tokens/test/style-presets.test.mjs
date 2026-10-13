import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildTheme, stylesOf } from "../scripts/build-theme.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const theme = JSON.parse(readFileSync(join(here, "../tokens/default.json"), "utf8"));
const { "tokens.css": css, "theme.css": themeCss } = buildTheme(theme);

/** Declarations of the first rule whose selector list starts with `head`. */
function rule(head) {
  const start = css.indexOf(head);
  assert.notEqual(start, -1, `missing rule ${head}`);
  const open = css.indexOf("{", start);
  const body = css.slice(open + 1, css.indexOf("}", open));
  return new Map(
    [...body.matchAll(/--([\w-]+): ([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const PRESETS = ["soft", "bordered", "elevated", "flat", "glass", "brutal"];

test("every preset has a complete block that also matches nested elements", () => {
  const governed = stylesOf(theme).presetGoverned;
  for (const id of PRESETS) {
    const head = `:root[data-style="${id}"],\n[data-style="${id}"] {`;
    assert.ok(css.includes(head), `${id} must match :root and a nested element`);
    assert.deepEqual([...rule(head).keys()], governed, `${id} declares the whole governed set`);
  }
});

test("the default preset reproduces the base tokens", () => {
  const soft = rule(':root[data-style="soft"]');
  const root = rule(":root {");
  assert.equal(soft.get("shadow-flat"), root.get("shadow-flat"));
  assert.equal(soft.get("border-width-card"), "0px");
  assert.equal(soft.get("shadow-card"), "var(--shadow-flat)");
  assert.equal(soft.get("radius-button"), "var(--radius-button-override, 999px)");
});

test("themed preset values get dark blocks, with and without an explicit data-theme", () => {
  for (const id of ["glass", "elevated"]) {
    const explicit = rule(
      `:root[data-theme="dark"][data-style="${id}"],\n:root[data-theme="dark"] [data-style="${id}"]`,
    );
    const media = rule(`  :root:not([data-theme="light"])[data-style="${id}"],`);
    assert.deepEqual(explicit, media);
    assert.ok(explicit.has("shadow-card"));
  }
  const glassDark = rule(':root[data-theme="dark"][data-style="glass"]');
  assert.equal(
    glassDark.get("shadow-card"),
    "0 0 0 1px rgba(255,255,255,.08), 0 6px 20px rgba(0,0,0,.5)",
  );
  assert.equal(
    rule(':root[data-style="glass"]').get("shadow-card"),
    "0 0 0 1px rgba(255,255,255,.7), 0 6px 20px -8px rgba(17,17,26,.14)",
  );
  // A themed base token is restored for dark even in a preset that does not override it.
  assert.equal(
    rule(':root[data-theme="dark"][data-style="soft"]').get("shadow-flat"),
    "0 0 0 1px rgba(255,255,255,.09)",
  );
});

test("source order sets precedence: theme < accent < style < density < radius", () => {
  const at = (s) => css.indexOf(s);
  const order = [
    ':root[data-theme="dark"] {',
    ':root[data-accent="menta"]',
    ':root[data-style="soft"]',
    ':root[data-style="brutal"]',
    ':root[data-density="compact"]',
    ':root[data-radius="none"]',
  ].map(at);
  assert.ok(order.every((i) => i !== -1));
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.doesNotMatch(css, /!important/);
});

test("data-radius beats a preset radius, including a preset nested below it", () => {
  const brutal = rule(':root[data-style="brutal"]');
  assert.equal(brutal.get("radius-card"), "var(--radius-card-override, 0px)");
  const lg = rule(':root[data-radius="lg"]');
  assert.equal(lg.get("radius-card-override"), "20px");
  assert.equal(lg.get("radius-card"), "20px");
  assert.ok(!lg.has("radius-avatar"), "avatars keep their shape under data-radius");
});

test("density scales heights and paddings through a unitless factor", () => {
  const compact = rule(':root[data-density="compact"]');
  assert.equal(compact.get("density"), "0.875");
  assert.equal(compact.get("control-height"), "calc(36px * var(--density))");
  assert.equal(compact.get("pad-card"), "calc(16px * var(--density))");
  assert.equal(rule(":root {").get("density"), "1");
});

test("the touch density gives every control a 44px hit area and inputs 48px", () => {
  const touch = rule(':root[data-density="touch"]');
  assert.equal(touch.get("density"), "1.125");
  assert.equal(touch.get("control-height"), "44px");
  assert.equal(touch.get("control-height-sm"), "44px");
  assert.equal(touch.get("control-height-lg"), "52px");
  assert.equal(touch.get("input-height"), "48px");
  assert.equal(touch.get("pad-control-x"), "calc(16px * var(--density))");
  assert.deepEqual([...touch.keys()], [...rule(':root[data-density="compact"]').keys()]);
  assert.ok(css.includes('[data-density="touch"] {'), "matches a nested element too");
  assert.ok(
    css.indexOf(':root[data-density="touch"]') > css.indexOf(':root[data-density="comfortable"]'),
  );
});

test("a density level cannot override a token density does not scale", () => {
  const bad = structuredClone(theme);
  bad.styles.density.levels.find((l) => l.id === "touch").values["radius-card"] = "4px";
  assert.throws(() => buildTheme(bad), /not scaled/);
});

test("info tones are themed tokens exposed as utilities", () => {
  assert.ok(rule(":root {").has("info"));
  assert.ok(rule(":root {").has("info-soft"));
  assert.ok(rule(':root[data-theme="dark"] {').has("info"));
  assert.match(themeCss, /--color-info: var\(--info\);/);
  assert.match(themeCss, /--color-info-soft: var\(--info-soft\);/);
  assert.match(themeCss, /--spacing-control-lg: var\(--control-height-lg\);/);
});

test("theme.css maps the semantic tokens to Tailwind utilities", () => {
  for (const line of [
    "--radius-button: var(--radius-button);",
    "--shadow-card: var(--shadow-card);",
    "--color-surface-card: var(--surface-card);",
    "--spacing-control: var(--control-height);",
    "--spacing-card: var(--pad-card);",
    "--spacing-density: var(--gap-density);",
  ]) {
    assert.ok(themeCss.includes(line), line);
  }
  assert.match(themeCss, /@utility border-card \{\n {2}border-width: var\(--border-width-card\);/);
  assert.match(
    themeCss,
    /@utility pressable \{[\s\S]*&:active:not\(:disabled\) \{\n {4}scale: var\(--press-scale\);/,
  );
});

test("inconsistent style definitions are rejected", () => {
  const clone = () => structuredClone(theme);
  const withDefaultValues = clone();
  withDefaultValues.styles.presets[0].values = { "shadow-card": "none" };
  assert.throws(() => buildTheme(withDefaultValues), /default preset/);

  const densityInPreset = clone();
  densityInPreset.styles.presets[1].values["control-height"] = "40px";
  assert.throws(() => buildTheme(densityInPreset), /data-density/);

  const unknown = clone();
  unknown.styles.presets[1].values["radius-nope"] = "1px";
  assert.throws(() => buildTheme(unknown), /unknown token/);

  const themedRadius = clone();
  themedRadius.styles.presets[1].values["radius-card"] = { light: "1px", dark: "2px" };
  assert.throws(() => buildTheme(themedRadius), /themes radius/);
});

test("a theme without styles emits no style blocks", () => {
  const { styles: _ignored, ...plain } = theme;
  const out = buildTheme(plain);
  assert.doesNotMatch(out["tokens.css"], /data-(style|density|radius)/);
  assert.doesNotMatch(out["theme.css"], /@utility/);
});
