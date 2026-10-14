// Generates the Compose chart parity fixtures from the React chart math (see chart-fixtures/registry.mjs).
//   node packages/ui-compose/scripts/chart-fixtures.mjs           write the fixtures, remove stale ones
//   node packages/ui-compose/scripts/chart-fixtures.mjs --check   fail when the committed fixtures differ from a fresh run
import { mkdirSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixturePath, serialize, staleFixtures, validateRegistry } from "./chart-fixtures-lib.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const chartsDir = join(repo, "packages/ui-compose/charts");
const { fixtures } = await import(pathToFileURL(join(repo, "packages/ui-compose/chart-fixtures/registry.mjs")).href);
const check = process.argv.includes("--check");

const problems = validateRegistry(fixtures, chartsDir);
if (problems.length) {
  console.error(`chart fixture registry is invalid:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// esbuild is only needed once a fixture exists, so an empty registry runs without installing anything.
async function load(source, scratch) {
  const { build } = createRequire(join(repo, "packages/ui/package.json"))("esbuild");
  const outfile = join(scratch, `${source.replace(/[^a-z0-9]+/gi, "_")}.mjs`);
  await build({ entryPoints: [join(repo, source)], bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent" });
  return import(pathToFileURL(outfile).href);
}

const scratch = mkdtempSync(join(tmpdir(), "chart-fixtures-"));
const drift = [];
try {
  for (const fixture of fixtures) {
    const file = fixturePath(chartsDir, fixture);
    const text = serialize(fixture.run(await load(fixture.source, scratch)));
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current === text) continue;
    if (check) {
      drift.push(`${current === null ? "missing" : "out of date"}: ${relative(repo, file)}`);
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
      console.log(`wrote ${relative(repo, file)}`);
    }
  }
  for (const file of staleFixtures(fixtures, chartsDir)) {
    if (check) drift.push(`stale: ${relative(repo, file)}`);
    else {
      rmSync(file);
      console.log(`removed ${relative(repo, file)}`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (drift.length) {
  console.error(`Chart fixtures drifted from the React math. Run \`pnpm chart:fixtures\` and commit:\n  ${drift.join("\n  ")}`);
  process.exit(1);
}
console.log(check ? `chart fixtures in sync (${fixtures.length})` : `chart fixtures written (${fixtures.length})`);
