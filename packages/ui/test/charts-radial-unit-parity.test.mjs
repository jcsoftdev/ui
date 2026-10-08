// Parity helpers: monochrome shades, tapered funnel, rect/sector morph geometry, unit silhouettes.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const core = join(here, "../src/charts/core");

async function load(file) {
  const bundle = await build({
    stdin: {
      contents: `export * from ${JSON.stringify(join(core, file))};`,
      resolveDir: core,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const palette = await load("palette.ts");
const polar = await load("polar.ts");
const morph = await load("shape-morph.ts");
const icons = await load("unit-icons.ts");

test("monochromeShade: full color first, palest tint last, clamped", () => {
  assert.equal(palette.monochromeShade(0, 5), "var(--accent-word)");
  assert.equal(palette.monochromeShade(0, 1), "var(--accent-word)");
  assert.match(palette.monochromeShade(4, 5), /var\(--accent-word\) 40%/);
  assert.equal(palette.monochromeShade(99, 5), palette.monochromeShade(4, 5));
  assert.match(palette.monochromeShade(2, 5, "red"), /red 70%/);
});

test("monochromeByValue: the largest value is darkest, ties keep input order", () => {
  const shades = palette.monochromeByValue([10, 40, 20, 40]);
  assert.equal(shades[1], palette.monochromeShade(0, 4));
  assert.equal(shades[3], palette.monochromeShade(1, 4));
  assert.equal(shades[2], palette.monochromeShade(2, 4));
  assert.equal(shades[0], palette.monochromeShade(3, 4));
});

test("funnelStages: tapered narrows into the next stage, untapered keeps straight bars", () => {
  const values = [100, 60, 30];
  const tapered = polar.funnelStages(values, { length: 300, thickness: 200 });
  assert.equal(tapered[0].widthTo, tapered[1].widthFrom);
  assert.equal(tapered[2].widthTo, tapered[2].widthFrom * 0.72);
  const neck = polar.funnelStages(values, { length: 300, thickness: 200, neck: 0.3 });
  assert.ok(Math.abs(neck[2].widthTo - neck[2].widthFrom * 0.3) < 1e-9);
  const stepped = polar.funnelStages(values, { length: 300, thickness: 200, tapered: false });
  for (const stage of stepped) assert.equal(stage.widthTo, stage.widthFrom);
  const pyramid = polar.funnelStages(values, {
    length: 300,
    thickness: 200,
    variant: "pyramid",
    tapered: false,
  });
  assert.equal(pyramid[2].widthTo, 0);
});

test("rectRing and sectorRing sample the same number of points", () => {
  const rect = morph.rectRing(0, 0, 100, 40);
  const sector = morph.sectorRing(50, 50, 20, 40, 0, Math.PI / 2);
  assert.equal(rect.length, 4 * morph.EDGE_SAMPLES);
  assert.equal(sector.length, rect.length);
});

test("blendRings: t=0 gives the rectangle, t=1 the sector, t=0.5 the midpoints", () => {
  const rect = morph.rectRing(0, 0, 100, 40);
  const sector = morph.sectorRing(50, 50, 20, 40, 0, Math.PI / 2);
  assert.deepEqual(morph.blendRings(rect, sector, 0), rect);
  assert.deepEqual(morph.blendRings(rect, sector, 1), sector);
  const half = morph.blendRings(rect, sector, 0.5);
  assert.ok(Math.abs(half[0].x - (rect[0].x + sector[0].x) / 2) < 1e-9);
  assert.ok(Math.abs(half[0].y - (rect[0].y + sector[0].y) / 2) < 1e-9);
});

test("sectorRing: the first point sits on the outer arc at the start angle", () => {
  const ring = morph.sectorRing(100, 100, 30, 60, 0, Math.PI / 2);
  assert.ok(Math.abs(ring[0].x - 100) < 1e-9);
  assert.ok(Math.abs(ring[0].y - 40) < 1e-9);
});

test("ringCenter of a rectangle is its center; ringPath closes the outline", () => {
  const center = morph.ringCenter(morph.rectRing(10, 20, 110, 60));
  assert.ok(Math.abs(center.x - 60) < 3);
  assert.ok(Math.abs(center.y - 40) < 3);
  const path = morph.ringPath(morph.rectRing(0, 0, 10, 10, 2));
  assert.match(path, /^M0\.0,0\.0L/);
  assert.ok(path.endsWith("Z"));
  assert.equal(morph.ringPath([{ x: 0, y: 0 }]), "");
});

test("silhouette presets all resolve to drawable shapes", () => {
  for (const name of [...icons.PICTOGRAM_SILHOUETTES, ...icons.BARBER_SILHOUETTES]) {
    assert.ok(icons.isUnitIconName(name), name);
    const shape = icons.resolveUnitShape(name);
    assert.ok(shape.path.startsWith("M"), name);
    assert.equal(shape.width, 24);
  }
  for (const name of ["woman", "child", "heart", "tree", "house", "car", "clock", "pin"]) {
    assert.ok(icons.isUnitIconName(name), name);
  }
});
