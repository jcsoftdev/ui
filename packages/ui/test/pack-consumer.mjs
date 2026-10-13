// Packs @jcsoftdev/ui, installs the tarball into a throwaway consumer and checks the 0.2.x surface:
// styles/*, tokens/*, the ui-theme bin and package-exports resolution. Run after `pnpm build`.
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
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "ui-pack-"));
try {
  const out = execFileSync("pnpm", ["pack", "--pack-destination", work], {
    cwd: pkgDir,
    encoding: "utf8",
  }).trim();
  const consumer = join(work, "consumer");
  const installed = join(consumer, "node_modules/@jcsoftdev/ui");
  mkdirSync(installed, { recursive: true });
  execFileSync("tar", ["-xzf", out.split("\n").pop(), "-C", installed, "--strip-components=1"]);

  const pkg = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {}, "no runtime dependencies");
  assert.ok(!JSON.stringify(pkg).includes("workspace:"), "no workspace: specifiers in the tarball");

  for (const f of ["tokens", "theme", "tailwind", "fonts", "base"]) {
    assert.ok(existsSync(join(installed, `styles/${f}.css`)), `styles/${f}.css packed`);
  }
  assert.ok(existsSync(join(installed, "styles/Theme.kt")));
  assert.ok(existsSync(join(installed, "tokens/default.json")));

  writeConsumerPackage(consumer);
  const require = createRequire(join(consumer, "index.js"));
  for (const spec of [
    "@jcsoftdev/ui/styles/tokens.css",
    "@jcsoftdev/ui/styles/theme.css",
    "@jcsoftdev/ui/styles/base.css",
    "@jcsoftdev/ui/tokens/default.json",
  ]) {
    assert.ok(existsSync(require.resolve(spec)), `${spec} resolves`);
  }
  assert.ok(
    readFileSync(require.resolve("@jcsoftdev/ui/styles/tokens.css"), "utf8").includes("--bg:"),
  );

  const bin = join(installed, "bin/ui-theme.mjs");
  const regenerated = join(work, "regen");
  execFileSync("node", [bin, "build", "--out", regenerated], { stdio: "pipe" });
  for (const name of readdirSync(regenerated)) {
    assert.equal(
      readFileSync(join(regenerated, name), "utf8"),
      readFileSync(join(installed, "styles", name), "utf8"),
      `ui-theme regenerates styles/${name} byte-for-byte`,
    );
  }
  const generated = join(work, "generated");
  execFileSync("node", [bin, "generate", "--brand", "#0e7490", "--out", generated, "--no-kotlin"], {
    stdio: "pipe",
  });
  assert.ok(
    existsSync(join(generated, "tokens.json")),
    "ui-theme generate works from the packed bin",
  );

  assert.ok(existsSync(join(installed, "scripts/build-theme.mjs")), "theme-builder module packed");
  assert.ok(existsSync(join(installed, "scripts/build-theme.d.mts")), "theme-builder types packed");
  assert.ok(
    !existsSync(join(consumer, "node_modules/@jcsoftdev/ui-tokens")),
    "ui-tokens not installed",
  );
  writeFileSync(
    join(consumer, "theme-builder.mjs"),
    `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as builder from "@jcsoftdev/ui/theme-builder";
for (const name of ["buildTheme", "buildTokensCss", "buildThemeCss", "buildFontsCss", "buildThemeKt"]) {
  assert.equal(typeof builder[name], "function", name);
}
const base = JSON.parse(readFileSync(new URL("./node_modules/@jcsoftdev/ui/tokens/default.json", import.meta.url), "utf8"));
const tokens = { ...base, color: { ...base.color, tokens: [{ name: "brand", value: "oklch(0.7 0.1 200)" }, ...base.color.tokens.slice(1)] } };
const files = builder.buildTheme(tokens, { kotlin: false });
assert.ok(!("Theme.kt" in files));
assert.match(files["tokens.css"], /oklch\\(0\\.7 0\\.1 200\\)/);
`,
  );
  execFileSync("node", ["theme-builder.mjs"], { cwd: consumer, stdio: "pipe" });

  for (const entry of ["primitives", "rich-text"]) {
    assert.ok(existsSync(join(installed, `dist/${entry}/index.js`)), `dist/${entry} packed`);
    assert.ok(
      existsSync(join(installed, `dist/${entry}/index.d.ts`)),
      `dist/${entry} types packed`,
    );
  }
  console.log("pack-consumer: ok");
} finally {
  rmSync(work, { recursive: true, force: true });
}

function writeConsumerPackage(dir) {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "consumer", private: true }));
}
