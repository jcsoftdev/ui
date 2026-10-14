import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fixturePath, serialize, staleFixtures, validateRegistry } from "../packages/ui-compose/scripts/chart-fixtures-lib.mjs";

const charts = mkdtempSync(join(tmpdir(), "charts-"));
mkdirSync(join(charts, "chart-core"));
writeFileSync(join(charts, "chart-core", "build.gradle.kts"), "");
const entry = { module: "chart-core", name: "scale", source: "x.ts", run: () => 1 };

test("serialize spells non-finite numbers and negative zero so Kotlin can read them back", () => {
  assert.equal(serialize({ a: [NaN, Infinity, -Infinity, -0, 0, 1.5] }), JSON.stringify({ a: ["NaN", "Infinity", "-Infinity", "-0", 0, 1.5] }, null, 2) + "\n");
});

test("serialize is stable for the same input", () => {
  const value = { b: 1, a: [1, 2, { c: null }] };
  assert.equal(serialize(value), serialize(structuredClone(value)));
});

test("registry validation rejects unknown modules, bad names and duplicates", () => {
  assert.deepEqual(validateRegistry([entry], charts), []);
  assert.equal(validateRegistry([{ ...entry, module: "chart-nope" }], charts).length, 1);
  assert.equal(validateRegistry([{ ...entry, name: "Bad_Name" }], charts).length, 1);
  assert.equal(validateRegistry([entry, entry], charts).length, 1);
});

test("stale fixtures are the files no registry entry produces", () => {
  const kept = fixturePath(charts, entry);
  mkdirSync(join(kept, ".."), { recursive: true });
  writeFileSync(kept, "{}");
  writeFileSync(join(kept, "..", "old.json"), "{}");
  assert.deepEqual(staleFixtures([entry], charts), [join(kept, "..", "old.json")]);
});
