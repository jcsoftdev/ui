import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("kpi-compound-cases.tsx");

const read = (path) =>
  readFileSync(fileURLToPath(new URL(`../src/${path}`, import.meta.url)), "utf8");
const isClient = (code) => /^\s*["']use client["']/.test(code);

test("the Kpi root stays a server module so Kpi.Label dots from a server component", () => {
  assert.equal(isClient(read("containers/kpi/kpi.tsx")), false);
  assert.equal(isClient(read("containers/kpi/kpi-parts.tsx")), true);
});

test("Kpi exposes its parts as statics and they render inside the tile", () => {
  const markup = html.composed();
  assert.match(markup, /Revenue/);
  assert.match(markup, /S\/ 10/);
  assert.match(markup, /per day/);
});
