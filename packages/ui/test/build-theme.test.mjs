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

const withColor = (value) => ({
  ...tokens,
  color: {
    ...tokens.color,
    tokens: [{ name: "brand", value }, ...tokens.color.tokens.slice(1)],
  },
});

test("kotlin: false builds only the CSS, even with var() and oklch() colors", () => {
  const files = buildTheme(withColor("oklch(0.7 0.1 200)"), { kotlin: false });
  assert.deepEqual(Object.keys(files), ["tokens.css", "theme.css", "fonts.css"]);
  assert.match(files["tokens.css"], /oklch\(0\.7 0\.1 200\)/);
  assert.deepEqual(Object.keys(buildTheme(withColor("var(--brand-500)"), { kotlin: false })), [
    "tokens.css",
    "theme.css",
    "fonts.css",
  ]);
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
    assert.deepEqual(readdirSync(out).sort(), ["fonts.css", "theme.css", "tokens.css"]);
    assert.throws(() =>
      execFileSync("node", [bin, "build", input, "--out", out], { stdio: "pipe" }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
