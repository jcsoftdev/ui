// WCAG AA for brand-colored text: `--accent-ink` on `--accent-soft` chips (and the page surfaces)
// in light and dark, for the default accent and every `data-accent` palette that ships.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../../ui-tokens/src/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { contrastRatio, createTheme, auditTheme } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const css = readFileSync(join(here, "../styles/tokens.css"), "utf8");

/** Declarations of the first rule that starts with `opener`, up to its closing brace. */
function declarations(opener) {
  const start = css.indexOf(opener);
  assert.notEqual(start, -1, `${opener} not found in tokens.css`);
  const end = css.indexOf("\n}", start);
  const inner = css.slice(start + opener.length, end);
  const map = new Map();
  for (const [, name, value] of inner.matchAll(/--([\w-]+):\s*([^;]+);/g))
    map.set(name, value.trim());
  return map;
}

const schemes = {
  light: declarations(":root {"),
  "dark (system)": declarations(
    '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {',
  ),
  "dark (data-theme)": declarations(':root[data-theme="dark"] {'),
};
const palettes = [...css.matchAll(/:root\[data-accent="([\w-]+)"\] \{/g)].map((m) => m[1]);

const hex = (map, name) => {
  const value = map.get(name);
  assert.match(value ?? "", /^#[0-9a-f]{6}$/i, `--${name} is a hex color`);
  return value;
};

test("the shipped accent palettes are the ones this test covers", () => {
  assert.deepEqual(palettes, ["durazno", "menta", "cielo", "lavanda", "orquidea", "grafito"]);
});

test("accent-ink meets 4.5:1 on accent-soft, bg, surface and surface-2 in every scheme", () => {
  for (const [scheme, tokens] of Object.entries(schemes)) {
    const targets = [
      ["default", hex(tokens, "accent-ink"), hex(tokens, "accent-soft")],
      ...palettes.map((name) => [
        name,
        hex(tokens, `pal-${name}-ink`),
        hex(tokens, `pal-${name}-soft`),
      ]),
    ];
    for (const [name, ink, soft] of targets) {
      const grounds = {
        "accent-soft": soft,
        bg: hex(tokens, "bg"),
        surface: hex(tokens, "surface"),
        "surface-2": hex(tokens, "surface-2"),
      };
      for (const [ground, color] of Object.entries(grounds)) {
        const ratio = contrastRatio(ink, color);
        assert.ok(
          ratio >= 4.5,
          `${scheme} ${name}: accent-ink ${ink} on ${ground} ${color} is ${ratio.toFixed(2)}:1`,
        );
      }
    }
  }
});

test("a generated theme keeps accent-ink AA on accent-soft in dark for any brand, teal included", () => {
  for (const brand of [
    "#0d9488",
    "#14b8a6",
    "#0f766e",
    "#2dd4bf",
    "#e11d48",
    "#7c3aed",
    "#facc15",
    "#1e3a8a",
  ]) {
    const theme = createTheme({ brand });
    const violations = auditTheme(theme).filter((v) => v.fg === "accent-ink");
    assert.deepEqual(violations, [], `${brand}: ${JSON.stringify(violations)}`);
    const ink = theme.color.tokens.find((t) => t.name === "accent-ink").value.dark;
    const soft = theme.color.tokens.find((t) => t.name === "accent-soft").value.dark;
    assert.ok(contrastRatio(ink, soft) >= 4.5, `${brand} dark ${ink} on ${soft}`);
  }
});
