// The motion entry: token parsing and the count-up tween (pure), and server rendering without a
// window, where every component must render its final, unanimated state.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { loadCases } from "./components/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/motion/model.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const model = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);
const cases = await loadCases("motion-cases.tsx");
// React inlines the hoisted motion stylesheet in string renders; the assertions read the markup.
const html = Object.fromEntries(
  Object.entries(cases.html).map(([name, render]) => [
    name,
    () => render().replace(/<style[^>]*>[\s\S]*?<\/style>/g, ""),
  ]),
);

test("durations come from the token, with the fallback for anything unparsable", () => {
  assert.equal(model.parseDuration("180ms"), 180);
  assert.equal(model.parseDuration(" .25s "), 250);
  assert.equal(model.parseDuration("60ms"), 60);
  assert.equal(model.parseDuration(""), 180);
  assert.equal(model.parseDuration("fast"), 180);
  assert.equal(model.parseDuration("-5ms", 120), 120);
});

test("easings follow the token and always end at 0 and 1", () => {
  const curves = ["linear", "ease", "ease-out", "cubic-bezier(.2,.8,.2,1)", "steps(4)", ""];
  for (const css of curves) {
    const ease = model.parseEasing(css);
    assert.equal(ease(0), 0, css);
    assert.equal(ease(1), 1, css);
  }
  assert.equal(model.parseEasing("linear")(0.3), 0.3);
  const brand = model.parseEasing("cubic-bezier(.2,.8,.2,1)");
  assert.ok(brand(0.5) > 0.85 && brand(0.5) < 0.95, `${brand(0.5)} is not an ease-out midpoint`);
});

test("a count-up lands exactly on its value and keeps integer runs whole", () => {
  const ease = model.parseEasing("linear");
  assert.equal(model.countAt(0, 1234, 270, 270, ease), 1234);
  assert.equal(model.countAt(0, 1234, 9999, 270, ease), 1234);
  assert.equal(model.countAt(0, 1234, 135, 270, ease), 617);
  assert.equal(model.countAt(0, 10, 100, 270, ease), 4);
  assert.equal(model.countAt(0, 0.78, 135, 270, ease), 0.39);
  assert.equal(model.countAt(5, 80, 0, 0, ease), 80, "no duration means the final value at once");
});

test("server HTML renders every end state with no motion attributes", () => {
  assert.equal(typeof window, "undefined");
  const reveal = html.reveal();
  assert.match(reveal, /Welcome back/);
  const stagger = html.stagger();
  assert.match(stagger, /<ul[^>]*><li>One<\/li><li>Two<\/li><li>Three<\/li><\/ul>/);
  const swap = html.crossFade();
  assert.match(swap, /Detail seven/);
  assert.doesNotMatch(swap, /data-motion-leave|aria-hidden/);
  assert.doesNotMatch(html.presenceHidden(), /Hidden note/);
  const rows = html.rows();
  for (const markup of [reveal, stagger, swap, rows]) {
    assert.doesNotMatch(markup, /data-motion="|data-motion-stagger|data-motion-pulse|--ui-motion/);
  }
});

test("CountUp renders the final value through its Intl formatter, once", () => {
  const usd = html.countUpFormatter();
  assert.match(usd, /\$1,234\.50/);
  assert.equal(usd.match(/1,234/g).length, 1, "no hidden duplicate when nothing animates");
  assert.doesNotMatch(usd, /aria-hidden/);
  assert.match(html.countUpLocale(), /12,345/);
});
