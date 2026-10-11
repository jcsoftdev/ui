import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("primitives is an explicit, typed ESM entry", () => {
  assert.deepEqual(pkg.exports["./primitives"], {
    types: "./dist/primitives/index.d.ts",
    source: "./src/primitives/index.ts",
    import: "./dist/primitives/index.js",
  });
});

test("primitives internals are not reachable through the package", () => {
  assert.equal(pkg.exports["./primitives/*"], null);
  for (const deep of [
    "hide-others",
    "scroll-lock",
    "focusable",
    "layer-stack",
    "global-singleton",
    "pointer-events-lock",
    "menu/typeahead",
    "menu/grace",
    "menu/navigation",
    "command/store",
    "command/score",
    "command/command",
    "popper/geometry",
  ]) {
    assert.throws(
      () => import.meta.resolve(`@jcsoftdev/ui/primitives/${deep}`),
      { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" },
      deep,
    );
  }
});

test("the package ships its notices", () => {
  assert.ok(pkg.files.includes("THIRD_PARTY_NOTICES.md"));
  assert.ok(pkg.files.includes("CHANGELOG.md"));
  assert.equal(pkg.dependencies, undefined);
});
