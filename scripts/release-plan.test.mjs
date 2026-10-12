import assert from "node:assert/strict";
import { test } from "node:test";
import { planRelease } from "./release-plan.mjs";

const pkgs = [
  { dir: "packages/ui-tokens", name: "@jcsoftdev/ui-tokens", version: "1.2.3" },
  { dir: "packages/ui", name: "@jcsoftdev/ui", version: "1.2.3" },
];
const plan = (over) => planRelease({ tag: "v1.2.3", enabled: ["packages/ui"], packages: pkgs, ...over });

test("publishes only the enabled packages, in list order", () => {
  assert.deepEqual(plan(), { errors: [], publish: ["packages/ui"] });
  assert.deepEqual(plan({ enabled: ["packages/ui-tokens", "packages/ui"] }).publish, [
    "packages/ui-tokens",
    "packages/ui",
  ]);
});

test("rejects a tag that does not match the version", () => {
  assert.match(plan({ tag: "v1.2.4" }).errors[0], /does not match/);
});

test("rejects diverging versions and unknown or empty lists", () => {
  assert.match(plan({ packages: [pkgs[0], { ...pkgs[1], version: "1.3.0" }] }).errors[0], /lockstep/);
  assert.match(plan({ enabled: ["packages/nope"] }).errors.join(), /not a public package/);
  assert.match(plan({ enabled: [] }).errors.join(), /empty/);
});
