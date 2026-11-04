import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("demo-kit-gaps-cases.tsx");

test("DialogHeader stacks title above description unless a layout asks otherwise", () => {
  assert.match(html.dialogHeader(), /class="[^"]*\bflex-col\b/);
  assert.doesNotMatch(html.dialogHeader(), /class="[^"]*\bitems-center\b/);
  const sideBySide = html.dialogHeader("flex-row items-center");
  assert.match(sideBySide, /\bflex-row\b/);
  assert.doesNotMatch(sideBySide, /\bflex-col\b/);
});

test("a lone Skeleton is a status; announce=false and a SkeletonGroup keep it to one", () => {
  const statuses = (markup) => markup.match(/role="status"/g)?.length ?? 0;
  assert.equal(statuses(html.skeletons()), 2);
  assert.equal(statuses(html.skeletonQuiet()), 0);
  assert.match(html.skeletonQuiet(), /aria-hidden="true"/);
  const grouped = html.skeletonGroup();
  assert.equal(statuses(grouped), 2, "the group plus the one that opts back in");
  assert.match(grouped, /aria-label="Cargando pedidos"/);
  assert.equal(grouped.match(/aria-busy/g)?.length, 2);
});

test("Avatar is an image named by the person unless it is decorative", () => {
  assert.match(
    html.avatar(),
    /role="img"[^>]*aria-label="Luis Ramirez"|aria-label="Luis Ramirez"[^>]*role="img"/,
  );
  for (const props of [{ decorative: true }, { "aria-hidden": true }]) {
    const markup = html.avatar(props);
    assert.match(markup, /aria-hidden="true"/);
    assert.doesNotMatch(markup, /role="img"/);
    assert.doesNotMatch(markup, /aria-label="Luis Ramirez"/);
  }
});

test("NumberStepper size drives the height and the button width", () => {
  assert.match(html.stepper(), /\bh-input\b/);
  const small = html.stepper({ size: "sm" });
  assert.match(small, /\bh-control-sm\b/);
  assert.doesNotMatch(small, /\bh-input\b/);
  assert.match(small, /\bw-7\b/);
  assert.match(html.stepper({ size: "md" }), /\bw-9\b/);
});

test("NumberStepper buttons are named after the field", () => {
  const es = html.stepper({}, "es");
  assert.match(es, /aria-label="Aumentar billetes de S\/ 100"/);
  assert.match(es, /aria-label="Disminuir billetes de S\/ 100"/);
  const en = html.stepper();
  assert.match(en, /aria-label="Increase billetes de S\/ 100"/);
  const custom = html.stepper({ incrementLabel: "Más", decrementLabel: "Menos" }, "es");
  assert.match(custom, /aria-label="Más"/);
  assert.match(custom, /aria-label="Menos"/);
  const labelled = html.stepper({ "aria-label": undefined, "aria-labelledby": "lbl" }, "es");
  assert.match(
    labelled,
    /aria-label="Aumentar"[^>]*aria-labelledby="[^"]*-increment lbl"|aria-labelledby="[^"]*-increment lbl"[^>]*aria-label="Aumentar"/,
  );
});
