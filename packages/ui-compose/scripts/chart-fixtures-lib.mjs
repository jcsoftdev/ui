import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const FIXTURE_DIR = "src/commonTest/resources/fixtures";

/** JSON text for a fixture. Non-finite numbers and -0 are spelled as strings so Kotlin can read them back exactly. */
export function serialize(value) {
  const text = JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v !== "number") return v;
      if (Number.isNaN(v)) return "NaN";
      if (v === Infinity) return "Infinity";
      if (v === -Infinity) return "-Infinity";
      return Object.is(v, -0) ? "-0" : v;
    },
    2,
  );
  if (text === undefined) throw new Error("fixture value is not JSON-serialisable");
  return `${text}\n`;
}

export const fixturePath = (chartsDir, { module, name }) => join(chartsDir, module, FIXTURE_DIR, `${name}.json`);

/** Problems with the registry itself: bad shape, unknown module, duplicate output. Empty when valid. */
export function validateRegistry(fixtures, chartsDir) {
  const problems = [];
  const seen = new Set();
  for (const fixture of fixtures) {
    const label = `${fixture?.module}/${fixture?.name}`;
    if (!/^[a-z][a-z0-9-]*$/.test(fixture?.module ?? "") || !existsSync(join(chartsDir, fixture.module, "build.gradle.kts"))) {
      problems.push(`${label}: module is not a registered chart module`);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(fixture?.name ?? "")) problems.push(`${label}: name must be kebab-case`);
    if (typeof fixture?.source !== "string" || typeof fixture?.run !== "function") problems.push(`${label}: needs source and run()`);
    if (seen.has(label)) problems.push(`${label}: registered twice`);
    seen.add(label);
  }
  return problems;
}

/** Fixture files on disk that no registry entry produces. */
export function staleFixtures(fixtures, chartsDir) {
  const expected = new Set(fixtures.map((fixture) => fixturePath(chartsDir, fixture)));
  const stale = [];
  for (const item of readdirSync(chartsDir, { withFileTypes: true })) {
    const dir = join(chartsDir, item.name, FIXTURE_DIR);
    if (!item.isDirectory() || !existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".json") && !expected.has(join(dir, file))) stale.push(join(dir, file));
    }
  }
  return stale;
}
