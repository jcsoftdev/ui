import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildTheme, toKotlinColor } from "../scripts/build-theme.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, "fixture.tokens.json"), "utf8"));
const update = process.env.UPDATE_GOLDEN === "1";

for (const [name, content] of Object.entries(buildTheme(tokens))) {
  test(`golden output: ${name}`, () => {
    const file = join(here, "golden", name);
    if (update || !existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    assert.equal(content, readFileSync(file, "utf8"));
  });
}

test("kotlin color conversion", () => {
  assert.equal(toKotlinColor("#000"), "Color(0xFF000000)");
  assert.equal(toKotlinColor("#faa2a2"), "Color(0xFFFAA2A2)");
  assert.equal(toKotlinColor("rgba(0,0,0,.11)"), "Color(0x1C000000)");
});

test("an accent palette swaps its look-alike chart category for the reserve", () => {
  const theme = JSON.parse(readFileSync(join(here, "../tokens/default.json"), "utf8"));
  const css = buildTheme(theme)["tokens.css"];
  const menta = css.slice(css.indexOf(':root[data-accent="menta"]'));
  assert.match(menta.slice(0, menta.indexOf("}")), /--chart-cat-2: var\(--chart-cat-reserve\);/);
  const { chartSwaps: _ignored, ...plain } = theme;
  assert.doesNotMatch(buildTheme(plain)["tokens.css"], /var\(--chart-cat-reserve\)/);
});

test("--kotlin-library flavour is explicit-API and immutable; the default stays untouched", () => {
  const lib = buildTheme(tokens, { kotlinPackage: "com.jcsoftdev.ui.theme", kotlinLibrary: true })[
    "Theme.kt"
  ];
  assert.match(lib, /^package com\.jcsoftdev\.ui\.theme$/m);
  assert.match(lib, /@Immutable\npublic class ThemeColors\(/);
  assert.match(lib, /@Immutable\npublic class AccentPalette\(/);
  assert.match(lib, /@Immutable\npublic object UiPalettes \{/);
  assert.doesNotMatch(lib, /Map</);
  const declarations = lib
    .split("\n")
    .filter((l) => /^\s*(val|class|object|const val|fun)\s/.test(l));
  assert.deepEqual(
    declarations.filter((l) => !/^\s*(private)\s/.test(l)),
    [],
    "every non-private declaration must carry an explicit visibility",
  );
  const plain = buildTheme(tokens)["Theme.kt"];
  assert.equal(plain, buildTheme(tokens, { kotlinLibrary: false })["Theme.kt"]);
  assert.doesNotMatch(plain, /public |@Immutable/);
});

test("the size-only font scale is emitted as UiFontSizes in both Kotlin flavours", () => {
  const scaled = {
    ...tokens,
    type: {
      ...tokens.type,
      sizeScale: [
        { name: "fs-95", fontSize: "9.5px" },
        { name: "fs-160", fontSize: "16px" },
        { name: "fs-440", fontSize: "44px" },
      ],
    },
  };
  const lib = buildTheme(scaled, { kotlinPackage: "com.jcsoftdev.ui.theme", kotlinLibrary: true })[
    "Theme.kt"
  ];
  assert.match(lib, /public object UiFontSizes \{/);
  assert.match(lib, /public val fs95: TextUnit = 9\.5\.sp/);
  assert.match(lib, /public val fs440: TextUnit = 44\.sp/);
  assert.doesNotMatch(buildTheme(tokens, { kotlinLibrary: true })["Theme.kt"], /UiFontSizes/);
  const plain = buildTheme(scaled)["Theme.kt"];
  assert.match(plain, /object UiFontSizes \{/);
  assert.match(plain, /val fs160 = 16\.sp/);
});

const withColor = (value) => ({
  ...tokens,
  color: {
    ...tokens.color,
    tokens: [{ name: "brand", value }, ...tokens.color.tokens.slice(1)],
  },
});
const cssFiles = ["fonts.css", "tailwind.css", "theme.css", "tokens.css"];

test("kotlin: false builds only the CSS, even with var() and oklch() colors", () => {
  const files = buildTheme(withColor("oklch(0.7 0.1 200)"), { kotlin: false });
  assert.deepEqual(Object.keys(files).sort(), cssFiles);
  assert.match(files["tokens.css"], /oklch\(0\.7 0\.1 200\)/);
  assert.deepEqual(
    Object.keys(buildTheme(withColor("var(--brand-500)"), { kotlin: false })).sort(),
    cssFiles,
  );
});

test("kotlin colors that are not hex or rgb(a) name the token and suggest --no-kotlin", () => {
  assert.throws(() => buildTheme(withColor("oklch(0.7 0.1 200)")), /"brand".*oklch.*--no-kotlin/);
  assert.throws(() => buildTheme(withColor("var(--brand-500)")), /"brand".*var\(--brand-500\)/);
  assert.ok("Theme.kt" in buildTheme(withColor("#336699")));
});

test("ui-theme build --no-kotlin writes only CSS and succeeds with oklch() colors", () => {
  const dir = mkdtempSync(join(tmpdir(), "ui-theme-"));
  try {
    const input = join(dir, "tokens.json");
    writeFileSync(input, JSON.stringify(withColor("oklch(0.7 0.1 200)")));
    const bin = join(here, "../bin/ui-theme.mjs");
    const out = join(dir, "out");
    execFileSync("node", [bin, "build", input, "--out", out, "--no-kotlin"]);
    assert.deepEqual(readdirSync(out).sort(), cssFiles);
    assert.throws(() =>
      execFileSync("node", [bin, "build", input, "--out", out], { stdio: "pipe" }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const withTones = (tonePalettes) => ({ ...tokens, tonePalettes });

test("tonePalettes emit --tone-<name>, -soft and -ink for light and dark", () => {
  const built = buildTheme(
    withTones({
      yape: {
        fill: { light: "#722ea5", dark: "#b98ae0" },
        soft: { light: "#f1e6fa", dark: "#2a1a3a" },
        ink: { light: "#5a2384", dark: "#d9bdf2" },
      },
      "pay-2": { fill: "#123456", soft: "#abcdef" },
    }),
    { kotlin: false },
  );
  const css = built["tokens.css"];
  const root = css.slice(0, css.indexOf("}"));
  assert.match(root, /--tone-yape: #722ea5;/);
  assert.match(root, /--tone-yape-soft: #f1e6fa;/);
  assert.match(root, /--tone-yape-ink: #5a2384;/);
  assert.match(root, /--tone-pay-2: #123456;/);
  assert.match(root, /--tone-pay-2-ink: #123456;/);
  const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
  const darkBlock = dark.slice(0, dark.indexOf("}"));
  assert.match(darkBlock, /--tone-yape: #b98ae0;/);
  assert.match(darkBlock, /--tone-yape-soft: #2a1a3a;/);
  assert.doesNotMatch(darkBlock, /--tone-pay-2/);
  assert.match(built["theme.css"], /--color-tone-yape-soft: var\(--tone-yape-soft\);/);
});

test("tonePalettes reject names that are not kebab-case and incomplete palettes", () => {
  assert.throws(() => buildTheme(withTones({ Yape: { fill: "#000", soft: "#fff" } })), /kebab/);
  assert.throws(() => buildTheme(withTones({ "a b": { fill: "#000", soft: "#fff" } })), /kebab/);
  assert.throws(() => buildTheme(withTones({ yape: { fill: "#000" } })), /"soft" is required/);
  assert.throws(
    () => buildTheme(withTones({ yape: { fill: "#000", soft: "#fff", line: "#111" } })),
    /unknown role/,
  );
});

test("a theme without tonePalettes builds exactly as before", () => {
  assert.doesNotMatch(buildTheme(tokens)["tokens.css"], /--tone-/);
});

test("containers emit literal --container-<name> widths in theme.css", () => {
  const css = buildTheme({ ...tokens, containers: { "page-m": "720px", "page-w": "80rem" } })[
    "theme.css"
  ];
  assert.match(css, /--container-page-m: 720px;/);
  assert.match(css, /--container-page-w: 80rem;/);
});

test("containers reject non-kebab names and non-literal widths", () => {
  assert.throws(() => buildTheme({ ...tokens, containers: { Page: "720px" } }), /kebab/);
  assert.throws(() => buildTheme({ ...tokens, containers: { page: "var(--x)" } }), /literal/);
});

test("a theme without containers builds exactly as before", () => {
  assert.doesNotMatch(buildTheme(tokens)["theme.css"], /--container-/);
});
