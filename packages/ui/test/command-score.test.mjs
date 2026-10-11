// DOM-free fuzzy scoring for the command primitive.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/primitives/command/score.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const { commandScore } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const better = (a, b) => assert.ok(a > b, `${a} should beat ${b}`);

test("empty search matches everything with score 1", () => {
  assert.equal(commandScore("anything", ""), 1);
});

test("no match scores 0", () => {
  assert.equal(commandScore("calendar", "xyz"), 0);
  assert.equal(commandScore("abc", "abcd"), 0);
  assert.equal(commandScore("abc", "cba"), 0);
});

test("exact beats prefix beats later word start beats scattered characters", () => {
  const exact = commandScore("settings", "settings");
  const prefix = commandScore("settings page", "settings");
  const wordStart = commandScore("open settings", "settings");
  const scattered = commandScore("sweet tin grapes", "settings");
  assert.equal(exact, 1);
  better(exact, prefix);
  better(prefix, wordStart);
  better(wordStart, scattered);
  assert.ok(scattered > 0);
});

test("acronyms match word starts", () => {
  const acronym = commandScore("New Appointment Slot", "nas");
  assert.ok(acronym > 0);
  better(acronym, commandScore("nonexistent spam", "nas"));
  better(commandScore("go to settings", "gts"), commandScore("gotoletters", "gts"));
});

test("a match starting a word beats the same letters mid-word", () => {
  better(commandScore("pay now", "now"), commandScore("renowned", "now"));
});

test("separators count as word starts", () => {
  better(commandScore("user/profile", "prof"), commandScore("userprofile", "prof"));
  better(commandScore("nueva-cita", "cita"), commandScore("nuevacita", "cita"));
});

test("case mismatch costs a little but still matches", () => {
  const same = commandScore("Calendar", "Cal");
  const other = commandScore("Calendar", "cal");
  better(same, other);
  assert.ok(other > 0.9);
  assert.equal(commandScore("CALENDAR", "calendar") > 0, true);
});

test("hyphens and spaces are interchangeable", () => {
  assert.ok(commandScore("nueva cita", "nueva-cita") > 0);
  assert.ok(commandScore("nueva-cita", "nueva cita") > 0);
});

test("keywords are searchable but rank below the value itself", () => {
  const viaKeyword = commandScore("Cobrar servicio", "caja", ["caja", "pago"]);
  const viaValue = commandScore("Caja chica", "caja", ["pago"]);
  assert.ok(viaKeyword > 0);
  better(viaValue, viaKeyword);
  assert.equal(commandScore("Cobrar servicio", "caja"), 0);
});

test("a swapped pair of letters still matches, just lower", () => {
  const swapped = commandScore("calendar", "claendar");
  assert.ok(swapped > 0);
  better(commandScore("calendar", "calendar"), swapped);
});

test("ranking sorts a list best first and keeps ties in input order", () => {
  const list = ["Open settings", "Settings", "Sweet tin grapes", "Reset", "Settings page"];
  const ranked = list
    .map((value, index) => ({ value, index, score: commandScore(value, "settings") }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.value);
  assert.deepEqual(ranked, ["Settings", "Settings page", "Open settings", "Sweet tin grapes"]);
  const ties = ["alpha one", "alpha two", "alpha six"]
    .map((value, index) => ({ value, index, score: commandScore(value, "alpha") }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.value);
  assert.deepEqual(ties, ["alpha one", "alpha two", "alpha six"]);
});

test("a long candidate with repeated letters scores in reasonable time", () => {
  const text = "a".repeat(400);
  const start = performance.now();
  commandScore(text, "aaaaaaaaab");
  assert.ok(performance.now() - start < 500);
});
