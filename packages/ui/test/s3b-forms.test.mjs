// Pure logic behind the S3b form components: slider value/step clamping and rating rounding.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const slider = await load("../src/forms/slider/model.ts");
const rating = await load("../src/forms/rating/model.ts");
const emoji = await load("../src/forms/emoji-picker/model.ts");
const emojiData = await load("../src/forms/emoji-picker/emoji-data.ts");

test("slider: snaps to step from min and clamps", () => {
  assert.equal(slider.snapToStep(37, 0, 100, 5), 35);
  assert.equal(slider.snapToStep(38, 0, 100, 5), 40);
  assert.equal(slider.snapToStep(-20, 0, 100, 5), 0);
  assert.equal(slider.snapToStep(500, 0, 100, 5), 100);
  assert.equal(slider.snapToStep(12, 10, 100, 25), 10);
  assert.equal(slider.snapToStep(100, 10, 100, 25), 85);
});

test("slider: decimal steps do not accumulate float noise", () => {
  assert.equal(slider.snapToStep(0.30000000000000004, 0, 1, 0.1), 0.3);
  assert.equal(slider.snapToStep(35.26, 0, 500, 0.5), 35.5);
});

test("slider: unbounded stepper values", () => {
  assert.equal(slider.snapToStep(7.4, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 1), 7);
  assert.equal(slider.snapToStep(-3, 0, Number.POSITIVE_INFINITY, 1), 0);
});

test("slider: ratio and value from ratio", () => {
  assert.equal(slider.ratioOf(25, 0, 100), 0.25);
  assert.equal(slider.ratioOf(150, 0, 100), 1);
  assert.equal(slider.ratioOf(5, 5, 5), 0);
  assert.equal(slider.valueFromRatio(0.42, 0, 100, 10), 40);
  assert.equal(slider.valueFromRatio(2, 0, 100, 10), 100);
});

test("slider: range thumbs never cross and respect minGap", () => {
  assert.deepEqual(slider.setRangeThumb([20, 60], 0, 80, 0, 100, 5, 10), [50, 60]);
  assert.deepEqual(slider.setRangeThumb([20, 60], 1, 10, 0, 100, 5, 10), [20, 30]);
  assert.deepEqual(slider.setRangeThumb([20, 60], 0, 30, 0, 100, 5), [30, 60]);
});

test("slider: nearest thumb and keyboard", () => {
  assert.equal(slider.nearestThumb([20, 60], 25), 0);
  assert.equal(slider.nearestThumb([20, 60], 55), 1);
  assert.equal(slider.nearestThumb([20, 60], 5), 0);
  assert.equal(slider.nearestThumb([20, 60], 95), 1);
  assert.equal(slider.keyboardValue("ArrowRight", 10, 0, 100, 5, 50), 15);
  assert.equal(slider.keyboardValue("PageDown", 10, 0, 100, 5, 50), -40);
  assert.equal(slider.keyboardValue("Home", 10, 0, 100, 5, 50), 0);
  assert.equal(slider.keyboardValue("End", 10, 0, 100, 5, 50), 100);
  assert.equal(slider.keyboardValue("a", 10, 0, 100, 5, 50), null);
});

test("rating: rounds to whole or half stars inside [0, max]", () => {
  assert.equal(rating.roundRating(3.4, 5), 3);
  assert.equal(rating.roundRating(3.5, 5), 4);
  assert.equal(rating.roundRating(3.3, 5, 0.5), 3.5);
  assert.equal(rating.roundRating(3.2, 5, 0.5), 3);
  assert.equal(rating.roundRating(9, 5), 5);
  assert.equal(rating.roundRating(-1, 5), 0);
  assert.equal(rating.roundRating(Number.NaN, 5), 0);
});

test("rating: pointer half stars and fill", () => {
  assert.equal(rating.ratingFromPointer(2, 0.3, 5, 0.5), 2.5);
  assert.equal(rating.ratingFromPointer(2, 0.8, 5, 0.5), 3);
  assert.equal(rating.ratingFromPointer(2, 0.3, 5, 1), 3);
  assert.equal(rating.starFill(0, 2.5), 1);
  assert.equal(rating.starFill(2, 2.5), 0.5);
  assert.equal(rating.starFill(3, 2.5), 0);
});

test("rating: keyboard", () => {
  assert.equal(rating.ratingKey("ArrowRight", 4.5, 5, 0.5), 5);
  assert.equal(rating.ratingKey("ArrowRight", 5, 5), 5);
  assert.equal(rating.ratingKey("ArrowLeft", 0, 5), 0);
  assert.equal(rating.ratingKey("End", 1, 5), 5);
  assert.equal(rating.ratingKey("x", 1, 5), null);
});

test("emoji: search ignores accents and case, requires every word, dedupes", () => {
  const cats = emojiData.EMOJI_CATEGORIES;
  assert.ok(emoji.searchEmojis(cats, "CORAZON").length > 5);
  assert.deepEqual(
    emoji.searchEmojis(cats, "barberia poste").map((e) => e.emoji),
    ["💈"],
  );
  assert.deepEqual(emoji.searchEmojis(cats, "   "), []);
  assert.deepEqual(emoji.searchEmojis(cats, "zzzz"), []);
  assert.deepEqual(
    emoji.searchEmojis(cats, "tijeras").map((e) => e.emoji),
    ["✂️"],
  );
  assert.ok(emoji.searchEmojis(cats, "sueño").length >= 1);
});

test("emoji: dataset has unique emojis", () => {
  const all = emojiData.EMOJI_CATEGORIES.flatMap((c) => c.emojis.map((e) => e.emoji));
  assert.equal(new Set(all).size, all.length);
});

test("emoji: grid navigation stays inside a ragged grid", () => {
  assert.equal(emoji.gridMove("ArrowRight", 9, 4, 10), 9);
  assert.equal(emoji.gridMove("ArrowLeft", 0, 4, 10), 0);
  assert.equal(emoji.gridMove("ArrowDown", 5, 4, 10), 9);
  assert.equal(emoji.gridMove("ArrowDown", 7, 4, 10), 7);
  assert.equal(emoji.gridMove("ArrowUp", 2, 4, 10), 2);
  assert.equal(emoji.gridMove("ArrowUp", 6, 4, 10), 2);
  assert.equal(emoji.gridMove("End", 0, 4, 10), 9);
  assert.equal(emoji.gridMove("Home", 5, 4, 10), 0);
  assert.equal(emoji.gridMove("x", 5, 4, 10), 5);
});
