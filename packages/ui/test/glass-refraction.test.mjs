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

const px = (field, x, y) => {
  const o = (y * field.width + x) * 4;
  return [...field.data.slice(o, o + 4)];
};

test("the lens profile is 1 at the edge, falls monotonically and is 0 inside", () => {
  const profile = glass.lensProfile();
  assert.equal(profile[0], 1);
  assert.equal(profile.at(-1), 0);
  for (let i = 1; i < profile.length; i++) assert.ok(profile[i] <= profile[i - 1]);
  // Snell on a convex squircle: most of the bend is in the outer rim.
  assert.ok(profile[Math.floor(profile.length / 2)] < 0.15);
});

test("the displacement field is neutral in the middle and pulls the rim inwards", () => {
  const f = glass.computeDisplacementField({ width: 200, height: 120, radius: 24, bezel: 20 });
  assert.equal(f.width, 200);
  assert.equal(f.height, 120);
  // Middle: no displacement, full softness.
  assert.deepEqual(px(f, 100, 60), [128, 128, 255, 255]);
  // Edges sample from inside the shape: left pulls right (red above 128), right pulls left, top pulls down.
  assert.ok(px(f, 0, 60)[0] > 200);
  assert.ok(px(f, 199, 60)[0] < 60);
  assert.ok(px(f, 100, 0)[1] > 200);
  assert.ok(px(f, 100, 119)[1] < 60);
  // The edge is sharp (blue 0), the inner end of the rim soft again.
  assert.ok(px(f, 0, 60)[2] < 20);
  assert.equal(px(f, 30, 60)[2], 255);
  // The shape is symmetric.
  const [r1] = px(f, 3, 60);
  const [r2] = px(f, 196, 60);
  assert.ok(Math.abs(r1 - 128 + (r2 - 128)) <= 1);
});

test("corners displace along the radius, outside the rounded corner is neutral", () => {
  const f = glass.computeDisplacementField({ width: 100, height: 100, radius: 30, bezel: 20 });
  const [r, g] = px(f, 12, 12);
  assert.ok(r > 128 && g > 128);
  assert.deepEqual(px(f, 0, 0).slice(0, 2), [128, 128]);
});

test("the displacement field follows the pixel ratio up to 2 and clamps a bezel or radius larger than the shape", () => {
  assert.equal(
    glass.computeDisplacementField({ width: 40, height: 20, radius: 9, bezel: 8, dpr: 2 }).width,
    80,
  );
  assert.equal(
    glass.computeDisplacementField({ width: 40, height: 20, radius: 9, bezel: 8, dpr: 5 }).width,
    80,
  );
  const f = glass.computeDisplacementField({ width: 40, height: 20, radius: 999, bezel: 999 });
  assert.equal(f.data.length, 40 * 20 * 4);
  for (const v of f.data) assert.ok(Number.isFinite(v));
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
