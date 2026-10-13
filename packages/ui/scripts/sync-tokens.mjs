// Copies the token assets owned by @jcsoftdev/ui-tokens into this package so the published
// files stay byte-compatible with 0.2.x (styles/*, tokens/*, bin/ui-theme.mjs, the `./theme-builder` module). The copies are
// build output and git-ignored; ui-tokens is a devDependency, so consumers install nothing extra.

import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "../ui-tokens");

// The CLI bundles ui-tokens' compiled theme engine.
execFileSync("pnpm", ["--dir", source, "run", "build:ts"], { stdio: "ignore" });

for (const dir of ["styles", "tokens"]) {
  rmSync(join(root, dir), { recursive: true, force: true });
  mkdirSync(join(root, dir), { recursive: true });
  for (const name of readdirSync(join(source, dir))) {
    cpSync(join(source, dir, name), join(root, dir, name));
  }
}

mkdirSync(join(root, "scripts"), { recursive: true });
for (const name of ["build-theme.mjs", "build-theme.d.mts"]) {
  cpSync(join(source, "scripts", name), join(root, "scripts", name));
}

mkdirSync(join(root, "bin"), { recursive: true });
const bin = join(root, "bin/ui-theme.mjs");
buildSync({
  entryPoints: [join(source, "bin/ui-theme.mjs")],
  outfile: bin,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "none",
});
chmodSync(bin, 0o755);
console.log(
  "synced @jcsoftdev/ui-tokens -> styles/, tokens/, bin/, scripts/build-theme.{mjs,d.mts}",
);
