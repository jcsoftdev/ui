// Packs the given workspace packages, installs the tarballs side by side into a throwaway consumer
// and imports every JS export by package name in Node (no DOM: the SSR import contract). It also
// checks that dependencies are first-party only and that no `workspace:` specifier leaks.
//   node scripts/pack-check.mjs packages/ui-core [packages/ui-elements ...]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = process.argv.slice(2);
assert.ok(dirs.length > 0, "usage: pack-check.mjs <package dir>...");
const work = mkdtempSync(join(tmpdir(), "ui-pack-check-"));
try {
  const consumer = join(work, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  const packed = [];
  for (const dir of dirs) {
    const out = execFileSync("pnpm", ["pack", "--pack-destination", work], { cwd: join(root, dir), encoding: "utf8" });
    const tarball = out.trim().split("\n").pop();
    const name = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")).name;
    const installed = join(consumer, "node_modules", name);
    mkdirSync(installed, { recursive: true });
    execFileSync("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"]);
    packed.push({ name, installed });
  }
  for (const { name, installed } of packed) {
    const pkg = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
    assert.ok(!JSON.stringify(pkg).includes("workspace:"), `${name}: no workspace: specifiers`);
    for (const dep of Object.keys(pkg.dependencies ?? {}))
      assert.ok(dep.startsWith("@jcsoftdev/"), `${name}: only first-party dependencies (found ${dep})`);
    for (const dep of Object.keys(pkg.dependencies ?? {}))
      assert.ok(packed.some((p) => p.name === dep), `${name}: dependency ${dep} must be packed too`);
    let count = 0;
    for (const [key, target] of Object.entries(pkg.exports)) {
      if (typeof target === "string" && !target.endsWith(".js")) {
        const files = key.includes("*") ? [] : [target];
        for (const file of files) assert.ok(existsSync(join(installed, file)), `${name}: ${file} packed`);
        continue;
      }
      const file = target.import;
      const specs = [];
      if (key.includes("*")) {
        const [before, after] = file.split("*");
        const folder = join(installed, dirname(before));
        for (const entry of readdirSync(folder))
          if (entry.endsWith(after.replace(/^.*\//, "")) && !entry.endsWith(".d.ts"))
            specs.push(`${name}/${key.slice(2).replace("*", entry.slice(0, entry.length - after.length))}`);
      } else {
        specs.push(key === "." ? name : `${name}/${key.slice(2)}`);
        if (target.types) assert.ok(existsSync(join(installed, target.types)), `${name}: ${target.types} packed`);
      }
      for (const spec of specs) {
        execFileSync("node", ["--input-type=module", "-e", `const m = await import(${JSON.stringify(spec)}); if (!Object.keys(m).length) throw new Error("empty ${spec}");`], { cwd: consumer, stdio: "pipe" });
        count++;
      }
    }
    console.log(`pack-check: ${name} ok (${count} entries import in Node)`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
