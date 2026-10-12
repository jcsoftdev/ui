import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const glass = await loadCases("glass-cases.ts");

function withGlobals(globals, run) {
  const saved = Object.fromEntries(Object.keys(globals).map((k) => [k, globalThis[k]]));
  Object.assign(globals, {});
  for (const [k, v] of Object.entries(globals)) globalThis[k] = v;
  glass.resetBackdropRefractionSupport();
  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
    glass.resetBackdropRefractionSupport();
  }
}

const css = (supported) => ({ supports: (prop) => supported.includes(prop) });
const BLINK = ["backdrop-filter", "-webkit-app-region"];

test("the displacement map is a sized SVG data URI with a neutral middle", () => {
  const uri = glass.createDisplacementMap({ width: 320, height: 200, radius: 24, bezel: 14 });
  assert.match(uri, /^data:image\/svg\+xml,/);
  const svg = decodeURIComponent(uri.slice(uri.indexOf(",") + 1));
  assert.match(svg, /width="320" height="200"/);
  assert.match(svg, /stop-color="rgb\(128,0,0\)"/);
  assert.match(svg, /stop-color="rgb\(0,0,128\)"/);
  assert.match(svg, /mix-blend-mode:screen/);
});

test("the displacement map clamps a bezel or radius larger than the shape", () => {
  const svg = decodeURIComponent(
    glass.createDisplacementMap({ width: 40, height: 20, radius: 999, bezel: 999 }).split(",")[1],
  );
  assert.match(svg, /rx="10"/);
  assert.doesNotMatch(svg, /NaN|-\d/);
});

test("refraction support is an allow-list: only Blink-like engines pass the probe", () => {
  const window = { SVGFEDisplacementMapElement: class {} };
  assert.equal(
    withGlobals({ window, CSS: css(BLINK) }, () => glass.supportsBackdropRefraction()),
    true,
  );
  // Safari: parses url() in backdrop-filter but has no Blink-only property.
  assert.equal(
    withGlobals({ window, CSS: css(["backdrop-filter"]) }, () =>
      glass.supportsBackdropRefraction(),
    ),
    false,
  );
  assert.equal(
    withGlobals({ window: undefined }, () => glass.supportsBackdropRefraction()),
    false,
  );
});

test("applyGlassRefraction is a no-op without a DOM and returns a cleanup", () => {
  const cleanup = glass.applyGlassRefraction({});
  assert.equal(typeof cleanup, "function");
  cleanup();
});
