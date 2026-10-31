import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("cases.tsx");

test("checkbox and switch add an invisible hit target sized by --touch-target", () => {
  for (const markup of [html.checkbox(), html.switch()]) {
    assert.match(markup, /size-10/);
    assert.match(markup, /\brelative\b/);
    assert.match(markup, /after:size-\(--touch-target\)/);
    assert.match(markup, /after:absolute/);
    assert.doesNotMatch(markup, /density=/);
  }
});

test("radio options keep a 44px row under touch through --touch-target", () => {
  assert.match(html.radio(), /min-h-\(--touch-target\)/);
  assert.doesNotMatch(html.radio(), /density=/);
});

test("only an interactive chip enlarges under touch", () => {
  assert.match(html.chipInteractive(), /min-h-control-sm/);
  assert.doesNotMatch(html.chipStatic(), /min-h-|--touch/);
});

test("nav-like lists reach 44px under touch through --touch-target", () => {
  const sources = [
    "src/containers/settings-layout/settings-layout.tsx",
    "src/shell/sidebar/sidebar.tsx",
    "src/navigation/tabs/tabs.tsx",
    "src/overlays/dropdown-menu/dropdown-menu.tsx",
  ];
  for (const file of sources) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /min-h-\(--touch-target\)/, file);
  }
});

test("no component reads data-density=touch directly, so data-density=auto reaches them", () => {
  const offenders = readdirSync(new URL("../src", import.meta.url), { recursive: true })
    .filter((file) => /\.tsx?$/.test(file) && !/\.stories\.tsx$/.test(file))
    .filter((file) =>
      readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8").includes("density=touch"),
    );
  assert.deepEqual(offenders, []);
});

test("checkbox is a square box filled with the accent, not a round success badge", () => {
  const markup = html.checkbox();
  assert.match(markup, /rounded-xs/);
  assert.doesNotMatch(markup, /rounded-pill|success/);
  assert.match(markup, /group-data-\[state=checked\]:bg-accent/);
  assert.match(markup, /group-data-\[state=indeterminate\]:bg-accent/);
  assert.match(html.radio(), /rounded-pill/);
});

test("checkbox dims and blocks the cursor when disabled, and draws a dash when indeterminate", () => {
  assert.match(html.checkbox(), /disabled:opacity-50/);
  assert.match(html.checkbox(), /disabled:cursor-not-allowed/);
  assert.match(html.checkboxIndeterminate(), /d="M5 12h14"/);
  assert.match(html.checkboxChecked(), /d="M20 6 9 17l-5-5"/);
  assert.match(html.checkboxIndeterminate(), /aria-checked="mixed"/);
  assert.notEqual(html.checkboxIndeterminate(), html.checkboxChecked());
});
