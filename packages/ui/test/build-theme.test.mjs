import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
