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

test("the lens profile is 1 at the edge, falls monotonically, starts flat and is 0 inside", () => {
  const profile = glass.lensProfile();
  assert.equal(profile[0], 1);
  assert.equal(profile.at(-1), 0);
  const step = 1 / (profile.length - 1);
  let steepest = 0;
  for (let i = 1; i < profile.length; i++) {
    assert.ok(profile[i] <= profile[i - 1]);
    steepest = Math.max(steepest, (profile[i - 1] - profile[i]) / step);
  }
  // Starts flat (a clean shifted copy at the very edge), and never falls faster than 1.5 per bevel.
  assert.ok(profile[0] - profile[1] < 0.002);
  assert.ok(steepest <= 1.52, `steepest slope ${steepest}`);
});

test("the default lens cannot fold: source position minus output position stays increasing across the bevel", () => {
  // Regression for the sawtooth along the walls: when the offset falls faster than 1px per px the
  // mapping folds back on itself and stripes behind the glass break into a repeating serration.
  const shapes = [
    [480, 220, 28],
    [1120, 64, 32],
    [180, 56, 28],
    [320, 320, 24],
    [40, 20, 9],
  ];
  for (const [width, height, radius] of shapes) {
    for (const dpr of [1, 2]) {
      const bezel = glass.bezelFor(radius, width, height);
      const scale = glass.scaleFor(bezel);
      const f = glass.computeDisplacementField({ width, height, radius, bezel, dpr });
      const along = (get, count) => {
        let last = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < count; i++) {
          const source = i / dpr + (scale * (get(i) - 127.5)) / 255;
          assert.ok(source >= last - 0.2, `${width}x${height} r${radius} @${dpr}x folds at ${i}`);
          last = source;
        }
      };
      const midY = Math.floor(f.height / 2);
      const midX = Math.floor(f.width / 2);
      along((i) => f.data[(midY * f.width + i) * 4], Math.ceil((bezel + 1) * dpr)); // left wall, red
      along((i) => f.data[(i * f.width + midX) * 4 + 1], Math.ceil((bezel + 1) * dpr)); // top wall, green
    }
  }
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

test("the specular field lights the walls facing the upper left, weakly the opposite ones, and leaves the middle dark", () => {
  const f = glass.computeSpecularField({ width: 200, height: 120, radius: 24, dpr: 1 });
  const at = (x, y) => (y * f.width + x) * 4;
  // Glint (red) on the outermost pixel of each wall.
  const top = f.data[at(100, 0)];
  const left = f.data[at(0, 60)];
  const bottom = f.data[at(100, 119)];
  const right = f.data[at(199, 60)];
  assert.ok(top > 100 && left > 40, "walls facing the light glint");
  assert.ok(bottom > 0 && bottom < top, "the opposite wall glints less");
  assert.ok(right > 0 && right < left);
  // Contour (green) on every wall, nothing in the middle, always opaque.
  for (const [x, y] of [
    [100, 0],
    [0, 60],
    [100, 119],
    [199, 60],
  ])
    assert.ok(f.data[at(x, y) + 1] > 60);
  const mid = at(100, 60);
  assert.deepEqual([...f.data.slice(mid, mid + 4)], [0, 0, 0, 255]);
  // The inner shadow (blue) sits on the walls turned away from the light, not on the lit ones.
  assert.ok(f.data[at(100, 3) + 2] < f.data[at(100, 116) + 2]);
});

test("a small pill keeps a clear middle: the bevel never exceeds 30% of the short side", () => {
  const f = glass.computeDisplacementField({ width: 180, height: 56, radius: 28, bezel: 16.8 });
  const centre = (28 * f.width + 90) * 4;
  assert.deepEqual([...f.data.slice(centre, centre + 3)], [128, 128, 255]);
});
