// One height per control size: every control at `sm` carries `--control-height-sm` (30px) and at `md`
// `--control-height-md` (38px), so a button lines up with a field in a toolbar or a table row. The
// markup cannot be measured here, so the contract is the token class each control renders.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("control-size-cases.tsx");

const HEIGHT = { sm: /\bh-control-sm\b/, md: /\bh-control-md\b/ };

/** The class attribute of the first element carrying a height token. */
function heights(markup) {
  return [...markup.matchAll(/class="([^"]*)"/g)]
    .map((m) => m[1].split(/\s+/).filter((name) => /^h-(control(-\w+)?|input)$/.test(name)))
    .filter((list) => list.length > 0);
}

test("Button and IconButton take the shared height at sm and md", () => {
  for (const size of ["sm", "md"]) {
    assert.match(html.button(size), HEIGHT[size]);
    assert.match(html.iconButton(size), HEIGHT[size]);
  }
  assert.match(html.button(), HEIGHT.md, "md is the default");
  assert.match(html.iconButton(), /\bw-control-md\b/, "the md icon button is a 38px square");
  assert.match(html.iconButton("sm"), /\bw-control-sm\b/);
  assert.deepEqual(heights(html.button("md")), [["h-control-md"]]);
});

test("every field takes the same height token as the button of its size", () => {
  for (const control of ["input", "select", "combobox", "datePicker", "timeInput"]) {
    for (const size of ["sm", "md"]) {
      const found = heights(html[control](size)).flat();
      assert.deepEqual(found, [`h-control-${size}`], `${control} at ${size}`);
    }
    assert.deepEqual(heights(html[control]()).flat(), ["h-control-md"], `${control} default`);
  }
});

test("DateTimePicker passes its size to both halves", () => {
  for (const size of ["sm", "md"]) {
    assert.deepEqual(heights(html.dateTimePicker(size)).flat(), [
      `h-control-${size}`,
      `h-control-${size}`,
    ]);
  }
});

test("DateTimePicker forwards per-part classes to its inner DatePicker and time field", () => {
  const markup = html.dateTimePicker("md", {
    dateInput: "x-date-input",
    clear: "x-clear",
    trigger: "x-trigger",
    timeInput: "x-time-input",
  });
  assert.match(markup, /<input[^>]*maxLength="10"[^>]*class="[^"]*x-date-input/);
  assert.match(markup, /<button[^>]*class="[^"]*x-clear/);
  assert.match(markup, /<button[^>]*class="[^"]*x-trigger/);
  assert.match(markup, /class="[^"]*x-time-input/);
});

test("the date picker's clear and calendar buttons have a 30px hit area", () => {
  const markup = html.datePicker("md");
  const buttons = [...markup.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(buttons.length, 2, "clear and calendar");
  for (const classes of buttons) assert.match(classes, /\bmin-h-control-sm\b/);
});

test("ChipGroup chips are never below the 30px hit area and take md on request", () => {
  const chips = (markup) =>
    [...markup.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1].split(/\s+/));
  for (const classes of chips(html.chipGroup())) {
    assert.ok(classes.includes("min-h-control-sm"));
    assert.ok(!classes.includes("min-h-7"), "the old 28px floor is gone");
  }
  for (const classes of chips(html.chipGroup("md")))
    assert.ok(classes.includes("min-h-control-md"));
});

test("an interactive Chip has a 30px minimum height; a display chip keeps its size", () => {
  assert.match(html.chip({ onClick: () => {} }), /\bmin-h-control-sm\b/);
  assert.match(html.chip({ role: "button", size: "sm" }), /\bmin-h-control-sm\b/);
  assert.doesNotMatch(html.chip({ role: "button", size: "sm" }), /\bmin-h-5\b/);
  assert.doesNotMatch(html.chip(), /min-h-control-sm/);
  assert.match(html.chip(), /\bh-6\b/);
});
