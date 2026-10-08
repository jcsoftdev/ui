// Pure logic of the globe: orthographic projection, rotation, horizon clipping, arcs.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = await build({
  entryPoints: [join(here, "../src/charts/maps/geo/globe.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
});
const lib = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);
const disc = { cx: 100, cy: 100, radius: 50 };

test("the view center lands in the middle of the disc", () => {
  const [x, y] = lib.projectOrthographic([-75, -10], { lon: -75, lat: -10 }, disc);
  near(x, 100);
  near(y, 100);
});

test("north is up and east is right", () => {
  const rotation = { lon: 0, lat: 0 };
  const north = lib.projectOrthographic([0, 30], rotation, disc);
  const east = lib.projectOrthographic([30, 0], rotation, disc);
  near(north[0], 100);
  near(north[1], 100 - 50 * Math.sin(Math.PI / 6));
  near(east[1], 100);
  near(east[0], 100 + 50 * Math.sin(Math.PI / 6));
});

test("the far side is not projected and the horizon sits on the rim", () => {
  const rotation = { lon: 0, lat: 0 };
  assert.equal(lib.projectOrthographic([180, 0], rotation, disc), null);
  const [x, y] = lib.projectOrthographic([90, 0], rotation, disc);
  near(x, 150);
  near(y, 100);
});

test("invert undoes project everywhere on the visible side", () => {
  const rotation = { lon: 40, lat: 25 };
  for (const [lon, lat] of [
    [40, 25],
    [60, 10],
    [10, 50],
    [90, -20],
  ]) {
    const screen = lib.projectOrthographic([lon, lat], rotation, disc);
    if (!screen) continue;
    const [backLon, backLat] = lib.invertOrthographic(screen[0], screen[1], rotation, disc);
    near(backLon, lon, 1e-6);
    near(backLat, lat, 1e-6);
  }
  assert.equal(lib.invertOrthographic(0, 0, rotation, disc), null);
});

test("dragging right turns the surface with the pointer (the view center moves west)", () => {
  const next = lib.dragRotation({ lon: 0, lat: 0 }, 50, 0, 50);
  near(next.lon, -(180 / Math.PI));
  const tilted = lib.dragRotation({ lon: 0, lat: 0 }, 0, -2000, 50);
  assert.ok(tilted.lat >= -lib.GLOBE_MAX_LAT && tilted.lat <= lib.GLOBE_MAX_LAT);
});

test("rotation wraps longitude and clamps latitude", () => {
  assert.deepEqual(lib.normalizeRotation({ lon: 190, lat: 120 }), { lon: -170, lat: 89 });
  assert.equal(lib.wrapLon(-181), 179);
  assert.deepEqual(lib.keyRotation({ lon: 0, lat: 0 }, "ArrowRight"), { lon: 10, lat: 0 });
  assert.equal(lib.keyRotation({ lon: 0, lat: 0 }, "a"), null);
  near(lib.spinRotation({ lon: 175, lat: 5 }, 1, 10).lon, -175);
});

test("a ring fully on the visible side is kept, one fully behind is dropped", () => {
  const square = (lon, lat) =>
    [
      [lon - 5, lat - 5],
      [lon + 5, lat - 5],
      [lon + 5, lat + 5],
      [lon - 5, lat + 5],
    ].map(lib.toVec);
  const front = lib.globeRingsPath([square(0, 0)], { lon: 0, lat: 0 }, disc);
  assert.ok(front.startsWith("M") && front.endsWith("Z"));
  assert.equal(lib.globeRingsPath([square(180, 0)], { lon: 0, lat: 0 }, disc), "");
});

test("a ring over the horizon is cut on the rim with arc points", () => {
  const ring = [
    [60, -20],
    [120, -20],
    [120, 20],
    [60, 20],
  ].map(lib.toVec);
  const view = ring.map((v) => lib.applyMatrix(lib.viewMatrix({ lon: 0, lat: 0 }), v));
  const clipped = lib.clipRingToHemisphere(view);
  assert.ok(clipped.length > view.length - 2);
  for (const v of clipped) {
    assert.ok(v[2] >= -1e-9, "no vertex behind the horizon");
    near(Math.hypot(...v), 1, 1e-9);
  }
  const rim = clipped.filter((v) => Math.abs(v[2]) < 1e-9);
  assert.ok(rim.length >= 2);
});

test("lines are cut where they leave the visible side", () => {
  const equator = [];
  for (let lon = -180; lon <= 180; lon += 10) equator.push(lib.toVec([lon, 0]));
  const pieces = lib.globeLinePieces(equator, { lon: 0, lat: 0 }, disc);
  assert.equal(pieces.length, 1);
  const [first] = pieces[0];
  near(first[0], 50, 1e-6);
  const southern = equator.map(() => lib.toVec([0, -60]));
  assert.equal(lib.globeLinePieces(southern, { lon: 0, lat: 80 }, disc).length, 0);
});

test("graticule has meridians and parallels at the step", () => {
  const lines = lib.graticuleLines(30);
  assert.equal(lines.length, 12 + 5);
});

test("great arcs keep their ends and lift in the middle", () => {
  const flat = lib.globeArc([-77, -12], [2, 49], 10, 0);
  const lifted = lib.globeArc([-77, -12], [2, 49], 10, 0.2);
  assert.equal(flat.length, 11);
  near(Math.hypot(...flat[5]), 1, 1e-9);
  assert.ok(Math.hypot(...lifted[5]) > 1.05);
  near(Math.hypot(...lifted[0]), 1, 1e-9);
  const [lon, lat] = lib.fromVec(flat[0]);
  near(lon, -77, 1e-9);
  near(lat, -12, 1e-9);
});
