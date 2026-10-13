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
  for (const coverage of ["full", "dome", "rim"]) {
    for (const [width, height, radius] of shapes) {
      for (const dpr of [1, 2]) {
        const bezel = glass.bezelFor(radius, width, height, coverage);
        const scale = glass.scaleFor(width, height, bezel, coverage);
        const f = glass.computeDisplacementField({ width, height, radius, bezel, coverage, dpr });
        const along = (get, count) => {
          let last = Number.NEGATIVE_INFINITY;
          for (let i = 0; i < count; i++) {
            const source = i / dpr + (scale * (get(i) - 127.5)) / 255;
            assert.ok(
              source >= last - 0.2,
              `${coverage} ${width}x${height} r${radius} @${dpr}x folds at ${i}`,
            );
            last = source;
          }
        };
        const midY = Math.floor(f.height / 2);
        const midX = Math.floor(f.width / 2);
        // Whole left half of the middle row (red) and top half of the middle column (green).
        along((i) => f.data[(midY * f.width + i) * 4], midX);
        along((i) => f.data[(i * f.width + midX) * 4 + 1], midY);
      }
    }
  }
});

const fullField = (width, height, dpr = 1, coverage = "full") => {
  const radius = 24;
  const bezel = glass.bezelFor(radius, width, height, coverage);
  const f = glass.computeDisplacementField({ width, height, radius, bezel, coverage, dpr });
  const scale = glass.scaleFor(width, height, bezel, coverage);
  /** Source offset in css px at css position (x, y), from the nearest map pixel. */
  const at = (x, y) => {
    const i = Math.min(f.width - 1, Math.max(0, Math.round(x * dpr)));
    const j = Math.min(f.height - 1, Math.max(0, Math.round(y * dpr)));
    const o = (j * f.width + i) * 4;
    return [(scale * (f.data[o] - 127.5)) / 255, (scale * (f.data[o + 1] - 127.5)) / 255];
  };
  return { at, scale };
};

test("whole-surface profiles have no facets: the direction of the pull is continuous across the diagonals", () => {
  // A height field from the distance to the nearest edge (or one per axis) flips the direction of
  // the pull along the diagonals of the shape, and the glass reads as a four-faced pyramid.
  for (const [width, height] of [
    [520, 320],
    [1280, 56],
    [200, 200],
    [180, 56],
    [320, 520],
  ]) {
    for (const coverage of ["full", "dome"]) {
      const { at } = fullField(width, height, 1, coverage);
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const q of [0.35, 0.5, 0.65, 0.8]) {
            // The point of the diagonal u = v at radius q, and a point one pixel either side of it.
            const x = width / 2 + (sx * q * width) / 2;
            const y = height / 2 + (sy * q * height) / 2;
            const a = at(x - 1.5, y);
            const b = at(x + 1.5, y);
            const norm = Math.hypot(...a) * Math.hypot(...b);
            if (norm < 1e-6) continue;
            const cos = (a[0] * b[0] + a[1] * b[1]) / norm;
            assert.ok(
              cos > 0.97,
              `${coverage} ${width}x${height} facet at ${sx},${sy},${q}: cos ${cos}`,
            );
          }
        }
      }
    }
  }
});

test("the facet detector flags a hip-roof field (pull along the normal of the nearest edge)", () => {
  const width = 200;
  const height = 200;
  const roof = (x, y) => {
    const dl = x;
    const dr = width - x;
    const dt = y;
    const db = height - y;
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) return [1, 0];
    if (m === dr) return [-1, 0];
    if (m === dt) return [0, 1];
    return [0, -1];
  };
  // The same probe as above, on the diagonal of a square at radius 0.5.
  const a = roof(100 - 50 - 1.5, 100 - 50);
  const b = roof(100 - 50 + 1.5, 100 - 50);
  assert.ok(a[0] * b[0] + a[1] * b[1] < 0.97);
});

test("whole-surface profiles never fold in 2D: the Jacobian of the sampling map stays positive", () => {
  for (const [width, height, coverage] of [
    [520, 320, "full"],
    [1280, 56, "full"],
    [200, 200, "full"],
    [180, 56, "full"],
    [520, 320, "dome"],
    [1280, 56, "dome"],
    [200, 200, "dome"],
    [180, 56, "dome"],
  ]) {
    const { at } = fullField(width, height, 2, coverage);
    for (let x = 4; x < width - 4; x += Math.ceil(width / 90)) {
      for (let y = 4; y < height - 4; y += Math.ceil(height / 40)) {
        const [ox1, oy1] = at(x + 1, y);
        const [ox0, oy0] = at(x - 1, y);
        const [px1, py1] = at(x, y + 1);
        const [px0, py0] = at(x, y - 1);
        const a = 1 + (ox1 - ox0) / 2;
        const b = (px1 - px0) / 2;
        const c = (oy1 - oy0) / 2;
        const d = 1 + (py1 - py0) / 2;
        assert.ok(a * d - b * c > 0.05, `${coverage} ${width}x${height} folds at ${x},${y}`);
      }
    }
  }
});

test("full coverage bends the whole surface: strongest at the rim, smaller but non-zero inside, zero at the centre, capped in px", () => {
  const f = glass.computeDisplacementField({
    width: 400,
    height: 200,
    radius: 28,
    bezel: glass.bezelFor(28, 400, 200, "full"),
    coverage: "full",
  });
  const red = (x, y) => f.data[(y * f.width + x) * 4] - 128;
  assert.ok(
    red(0, 100) > red(100, 100) && red(100, 100) > red(180, 100),
    "falls towards the centre",
  );
  assert.ok(red(180, 100) > 0, "still bends close to the centre");
  assert.equal(red(200, 100), 0, "no seam at the centre");
  assert.equal(red(399, 100) + red(0, 100), -1 + 1 - 0, "symmetric");
  const { x, y } = glass.lensAmplitude(2000, 1000, glass.bezelFor(0, 2000, 1000, "full"), "full");
  assert.ok(x <= 24 && y <= 24, "a large surface does not smear");
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

test("the dome is a different lens from the full one: round contours, flatter middle, softer wall", () => {
  const options = (coverage) => ({
    width: 400,
    height: 200,
    radius: 28,
    bezel: glass.bezelFor(28, 400, 200, coverage),
    coverage,
  });
  const full = glass.computeDisplacementField(options("full"));
  const dome = glass.computeDisplacementField(options("dome"));
  const red = (f, x, y) => f.data[(y * f.width + x) * 4] - 128;
  assert.equal(red(dome, 200, 100), 0, "no seam at the centre");
  assert.ok(red(dome, 0, 100) > red(dome, 100, 100) && red(dome, 100, 100) > red(dome, 180, 100));
  // Flatter in the middle and softer at the walls than the full lens (it peaks at the corners).
  assert.ok(red(dome, 150, 100) < red(full, 150, 100));
  assert.ok(red(dome, 0, 100) < red(full, 0, 100) && red(dome, 0, 100) > red(full, 0, 100) / 2);
  assert.notDeepEqual([...dome.data.slice(0, 4000)], [...full.data.slice(0, 4000)]);
});

test("bevelWidth caps the offset of the whole-surface profiles in px and refraction scales the filter, not the map", () => {
  const big = glass.lensAmplitude(2000, 1000, 500, "full", 12);
  assert.equal(big.x, 12);
  assert.equal(glass.lensAmplitude(2000, 1000, 500, "dome").x, 24);
  assert.equal(
    glass.scaleFor(2000, 1000, 500, "full", 12) < glass.scaleFor(2000, 1000, 500, "full"),
    true,
  );
  // A small surface stays fold-free whatever the cap.
  assert.equal(glass.lensAmplitude(40, 20, 10, "full", 90).x, 5.5);
  const a = glass.computeDisplacementField({
    width: 300,
    height: 120,
    radius: 24,
    bezel: 60,
    coverage: "full",
    cap: 6,
  });
  const b = glass.computeDisplacementField({
    width: 300,
    height: 120,
    radius: 24,
    bezel: 60,
    coverage: "full",
    cap: 24,
  });
  assert.deepEqual(
    [...a.data],
    [...b.data],
    "the map is normalised: only the filter scale carries the cap",
  );
});

// Crystal: a minifying lens samples outside the surface, so it can bend far more than the other
// profiles; what keeps it clean is that the map p -> p + offset(p) never folds.
const CRYSTAL_SHAPES = [
  [300, 96],
  [320, 200],
  [40, 40],
  [1280, 56],
  [96, 300],
];

test("the crystal lens never folds, at the largest refraction, for pills and rectangles", () => {
  for (const [width, height] of CRYSTAL_SHAPES) {
    const hx = width / 2;
    const hy = height / 2;
    const half = Math.max(hx, hy);
    for (const refraction of [0.5, 1, 1.67, 2]) {
      const amplitude = glass.crystalAmplitude(width, height, refraction);
      assert.ok(amplitude <= glass.CRYSTAL_MAX_OFFSET);
      const k = amplitude / half;
      const map = (x, y) => {
        const s = glass.crystalShape(glass.crystalRadius(x, y, hx, hy));
        return [x + k * s * x, y + k * s * y];
      };
      // Jacobian determinant of the source map by central differences, over the surface and the margin.
      const e = 0.01;
      const m = glass.crystalMargin(amplitude);
      for (let y = -hy - m; y <= hy + m; y += 2.3) {
        for (let x = -hx - m; x <= hx + m; x += 2.3) {
          const [xr, yr] = map(x + e, y);
          const [xl, yl] = map(x - e, y);
          const [xu, yu] = map(x, y + e);
          const [xd, yd] = map(x, y - e);
          const det = ((xr - xl) * (yu - yd) - (xu - xd) * (yr - yl)) / (4 * e * e);
          assert.ok(
            det > 0.99,
            `fold at ${x},${y} of ${width}x${height} refraction ${refraction}: ${det}`,
          );
        }
      }
    }
  }
});

test("the crystal map encodes the same offsets and stays foldless once quantised", () => {
  for (const [width, height] of CRYSTAL_SHAPES) {
    const amplitude = glass.crystalAmplitude(width, height, 2);
    const margin = glass.crystalMargin(amplitude);
    const field = glass.computeCrystalField({ width, height, amplitude });
    assert.equal(field.width, Math.round(width + 2 * margin));
    assert.equal(field.height, Math.round(height + 2 * margin));
    const decode = (x, y) => {
      const o = (y * field.width + x) * 4;
      // feDisplacementMap: scale * (C - 0.5), scale = 2 A 255 / 254.
      const f = (v) => amplitude * ((v - 127.5) / 127);
      return [x + 0.5 + f(field.data[o]), y + 0.5 + f(field.data[o + 1])];
    };
    const step = 4;
    for (let y = step; y < field.height - step; y += step) {
      for (let x = step; x < field.width - step; x += step) {
        const [ax, ay] = decode(x, y);
        const [bx] = decode(x + step, y);
        const [, by] = decode(x, y + step);
        assert.ok(
          bx > ax && by > ay,
          `fold in the quantised map at ${x},${y} of ${width}x${height}`,
        );
      }
    }
    // The middle of the surface samples itself; the silhouette samples further out than itself.
    const cx = Math.floor(field.width / 2);
    const cy = Math.floor(field.height / 2);
    const [mx, my] = decode(cx, cy);
    assert.ok(Math.abs(mx - (cx + 0.5)) < 2 && Math.abs(my - (cy + 0.5)) < 2);
    const [ex] = decode(margin + width - 1, cy);
    assert.ok(ex > margin + width, "the right edge shows what lies past it");
    assert.equal(field.data[2], 255, "no soft band: a crystal is not frosted");
  }
});

test("the crystal amplitude follows refraction up to a fixed cap and is zero for no refraction", () => {
  assert.equal(glass.crystalAmplitude(300, 96, 0), 0);
  assert.ok(glass.crystalAmplitude(300, 96, 1) < glass.crystalAmplitude(300, 96, 2));
  assert.equal(glass.crystalAmplitude(4000, 400, 2), glass.CRYSTAL_MAX_OFFSET);
  assert.equal(glass.crystalAmplitude(300, 96, 9), glass.crystalAmplitude(300, 96, 2));
});
