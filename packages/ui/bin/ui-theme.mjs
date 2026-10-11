#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTheme } from "../scripts/build-theme.mjs";

const USAGE = `Usage: ui-theme build [tokens.json] --out <dir> [--kotlin-package <pkg>] [--no-kotlin]

Generates tokens.css, theme.css, fonts.css and Theme.kt from a tokens file.
Without a tokens file the bundled default theme is used.
--kotlin-library emits the explicit-API, @Immutable flavour used by the Compose kit.
--no-css skips the CSS outputs.`;

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
const [command, positional] = args;

if (command !== "build" || !out) {
  console.error(USAGE);
  process.exit(command === "--help" ? 0 : 1);
}

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(tokensFlag ?? positional ?? join(here, "../tokens/default.json"));
const files = buildTheme(JSON.parse(readFileSync(file, "utf8")), { kotlinPackage, kotlinLibrary });

mkdirSync(resolve(out), { recursive: true });
for (const [name, content] of Object.entries(files)) {
  if (noKotlin && name.endsWith(".kt")) continue;
  if (noCss && name.endsWith(".css")) continue;
  writeFileSync(join(resolve(out), name), content);
  console.log(`wrote ${join(out, name)}`);
}
