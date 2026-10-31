import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const type = JSON.parse(readFileSync(join(here, "../tokens/default.json"), "utf8")).type;
const roles = Object.fromEntries(
  type.groups.flatMap((g) => g.styles).map((s) => [s.name, Number.parseFloat(s.fontSize)]),
);

test("size scale steps are unique, ascending and named after their pixel size", () => {
  const sizes = type.sizeScale.map((s) => Number.parseFloat(s.fontSize));
  assert.deepEqual(
    sizes,
    [...new Set(sizes)].sort((a, b) => a - b),
  );
  for (const s of type.sizeScale) {
    assert.equal(s.name, `fs-${Number.parseFloat(s.fontSize) * 10}`);
  }
});

test("no role is below 10px or above 24px", () => {
  for (const [name, size] of Object.entries(roles)) {
    assert.ok(size >= 10 && size <= 24, `${name} is ${size}px`);
  }
});

test("mobile roles never exceed their desktop counterparts", () => {
  assert.ok(roles["m-title"] <= roles["page-title"]);
  assert.ok(roles["m-card-title"] <= roles["m-title"]);
  assert.ok(roles["m-row-title"] <= roles["card-title"]);
  assert.ok(roles["kpi-number"] <= roles["page-title"] + 2);
});

test("hierarchy descends from title to meta", () => {
  assert.ok(roles["page-title"] > roles["dialog-title"]);
  assert.ok(roles["dialog-title"] >= roles["card-title"]);
  assert.ok(roles["card-title"] > roles.body);
  assert.ok(roles.body >= roles["row-title"]);
  assert.ok(roles["row-title"] > roles.control);
  assert.ok(roles.control > roles.meta);
});
