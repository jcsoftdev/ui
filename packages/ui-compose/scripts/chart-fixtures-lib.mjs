import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const FIXTURE_DIR = "src/commonTest/resources/fixtures";

export const TAG = "$f";

/**
 * JSON text for a fixture. A non-finite number or negative zero is the tagged object {"$f": "NaN" | "Infinity" | "-Infinity" | "-0"},
 * so a plain string "NaN" stays a string; fixture data must not use a "$f" key itself.
 */
export function serialize(value) {
  const text = JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "object" && v !== null && !Array.isArray(v) && Object.hasOwn(v, TAG)) {
        throw new Error(`fixture data uses the reserved "${TAG}" key`);
      }
      if (typeof v !== "number") return v;
      if (Number.isNaN(v)) return { [TAG]: "NaN" };
      if (v === Infinity) return { [TAG]: "Infinity" };
      if (v === -Infinity) return { [TAG]: "-Infinity" };
      return Object.is(v, -0) ? { [TAG]: "-0" } : v;
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
    if (fixture?.source !== undefined && typeof fixture.source !== "string") problems.push(`${label}: source must be a path`);
    if (!/^[a-z][a-z0-9-]*$/.test(fixture?.name ?? "")) problems.push(`${label}: name must be kebab-case`);
    if (typeof fixture?.run !== "function") problems.push(`${label}: needs run()`);
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
