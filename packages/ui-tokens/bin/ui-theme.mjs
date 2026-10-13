#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTheme } from "../scripts/build-theme.mjs";

const USAGE = `Usage:
  ui-theme build [tokens.json] --out <dir> [--kotlin-package <pkg>] [--no-kotlin]
  ui-theme generate --brand <hex> [--accent <hex>] [--neutral <hex>] [--danger <hex>] --out <dir>

build generates tokens.css, theme.css, tailwind.css, fonts.css and Theme.kt from a tokens file.
Without a tokens file the bundled default theme is used.
--kotlin-library emits the explicit-API, @Immutable flavour used by the Compose kit.
--no-kotlin skips Theme.kt, so tokens with var() or oklch() colors build.
--no-css skips the CSS outputs.

generate derives a WCAG AA color set (light and dark) from seed colors, merges it into the bundled
default tokens (the data-accent presets are kept) and writes tokens.json plus the same CSS outputs.`;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args.splice(i, 2)[1];
};
const has = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};

const out = flag("--out");
const kotlinPackage = flag("--kotlin-package");
const tokensFlag = flag("--tokens");
const noKotlin = has("--no-kotlin");
const kotlinLibrary = has("--kotlin-library");
const noCss = has("--no-css");
const seeds = {
  brand: flag("--brand"),
  accent: flag("--accent"),
  neutral: flag("--neutral"),
  danger: flag("--danger"),
};
const [command, positional] = args;

if (!["build", "generate"].includes(command) || !out || (command === "generate" && !seeds.brand)) {
  console.error(USAGE);
  process.exit(command === "--help" ? 0 : 1);
}

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(tokensFlag ?? positional ?? join(here, "../tokens/default.json"));
let tokens = JSON.parse(readFileSync(file, "utf8"));
const extra = {};
if (command === "generate") {
  const { createTheme, withTheme } = await import("../dist/index.js");
  const defined = Object.fromEntries(Object.entries(seeds).filter(([, v]) => v !== undefined));
  try {
    tokens = withTheme(tokens, createTheme(defined));
  } catch (error) {
    console.error(`ui-theme: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  extra["tokens.json"] = `${JSON.stringify(tokens, null, 2)}\n`;
}
const files = {
  ...extra,
  ...buildTheme(tokens, { kotlinPackage, kotlinLibrary, kotlin: !noKotlin }),
};

mkdirSync(resolve(out), { recursive: true });
for (const [name, content] of Object.entries(files)) {
  if (noCss && name.endsWith(".css")) continue;
  writeFileSync(join(resolve(out), name), content);
  console.log(`wrote ${join(out, name)}`);
}
