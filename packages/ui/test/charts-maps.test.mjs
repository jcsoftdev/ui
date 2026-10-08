// Map geometry: projections, the TopoJSON decoder, simplification and the shipped data.
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const maps = join(here, "../src/charts/maps");

async function load(entry) {
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const lib = await load(join(maps, "geo/pure.ts"));

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);

test("mercator: the origin stays put and 45 degrees lands at ln(tan(67.5 deg))", () => {
  const mercator = lib.createRawProjection("mercator");
  const [x0, y0] = mercator.forward(0, 0);
  near(x0, 0);
  near(y0, 0);
  const [x, y] = mercator.forward(90, 45);
  near(x, Math.PI / 2);
  near(y, -Math.log(Math.tan((67.5 * Math.PI) / 180)));
  const [, polar] = mercator.forward(0, 90);
  assert.ok(Number.isFinite(polar), "the poles are clamped, never infinite");
});

test("equirectangular: x scales with cos(parallel), y is minus the latitude in radians", () => {
  const plain = lib.createRawProjection("equirectangular");
  const [x, y] = plain.forward(10, 20);
  near(x, (10 * Math.PI) / 180);
  near(y, (-20 * Math.PI) / 180);
  const fitted = lib.createRawProjection("fitted", { parallel: 60, centerLon: 10 });
  near(fitted.forward(30, 0)[0], (20 * Math.PI) / 180 / 2);
});

test("equal earth: equator at 180 degrees reaches the published extent", () => {
  const equalEarth = lib.createRawProjection("equalEarth");
  near(equalEarth.forward(180, 0)[0], 2.7066, 1e-3);
  near(equalEarth.forward(0, 0)[1], 0);
});

test("every projection round-trips lon/lat", () => {
  for (const kind of ["equirectangular", "mercator", "equalEarth", "fitted"]) {
    const raw = lib.createRawProjection(kind, { centerLon: -75, parallel: -10 });
    for (const [lon, lat] of [
      [-77.03, -12.04],
      [0, 0],
      [139.7, 35.7],
      [-120, 60],
      [20, -34],
    ]) {
      const [x, y] = raw.forward(lon, lat);
      const [lon2, lat2] = raw.inverse(x, y);
      near(lon2, lon, 1e-6);
      near(lat2, lat, 1e-6);
    }
  }
});

test("fitProjection fills the box, centred, keeping the aspect ratio", () => {
  const points = [
    [-81, -18],
    [-69, -18],
    [-69, 0],
    [-81, 0],
  ];
  const fitted = lib.fitProjection("fitted", points, 400, 300, { padding: 10 });
  const projected = points.map(([lon, lat]) => fitted.project(lon, lat));
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  assert.ok(Math.min(...xs) >= 10 - 1e-6 && Math.max(...xs) <= 390 + 1e-6);
  assert.ok(Math.min(...ys) >= 10 - 1e-6 && Math.max(...ys) <= 290 + 1e-6);
  const touches = Math.abs(Math.max(...ys) - Math.min(...ys) - 280) < 1e-6;
  assert.ok(touches, "the taller axis uses the full inner height");
  near((Math.min(...xs) + Math.max(...xs)) / 2, 200, 1e-6);
  const [lon, lat] = fitted.invert(...fitted.project(-75, -9));
  near(lon, -75);
  near(lat, -9);
});

test("topojson decoder: quantized delta arcs, transform and reversed arcs", () => {
  const topology = {
    type: "Topology",
    transform: { scale: [0.5, 0.5], translate: [10, 20] },
    // arc 0: (0,0) -> (4,0) -> (4,4); arc 1: (4,4) -> (0,4) -> (0,0)
    arcs: [
      [
        [0, 0],
        [4, 0],
        [0, 4],
      ],
      [
        [4, 4],
        [-4, 0],
        [0, -4],
      ],
    ],
    objects: {
      cells: {
        type: "GeometryCollection",
        geometries: [
          { type: "Polygon", id: "A", properties: { name: "Alfa" }, arcs: [[0, 1]] },
          { type: "Polygon", id: "B", arcs: [[~1, ~0]] },
        ],
      },
    },
  };
  const features = lib.topologyFeatures(topology, "cells");
  assert.equal(features.length, 2);
  assert.equal(features[0].name, "Alfa");
  assert.deepEqual(features[0].geometry.coordinates[0], [
    [10, 20],
    [12, 20],
    [12, 22],
    [10, 22],
    [10, 20],
  ]);
  // B walks both arcs backwards, in reverse order: the same ring, opposite direction.
  assert.deepEqual(features[1].geometry.coordinates[0], [
    [10, 20],
    [10, 22],
    [12, 22],
    [12, 20],
    [10, 20],
  ]);
  assert.equal(features[1].name, "B");
  assert.deepEqual(lib.topologyFeatures(topology, "missing"), []);
});

test("simplifyLine keeps the ends and never strays beyond the tolerance", () => {
  const line = Array.from({ length: 200 }, (_, i) => [i, Math.sin(i / 7) * 3 + (i % 2) * 0.05]);
  const simple = lib.simplifyLine(line, 0.2);
  assert.deepEqual(simple[0], line[0]);
  assert.deepEqual(simple.at(-1), line.at(-1));
  assert.ok(simple.length < line.length / 2);
  for (const [x, y] of line) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < simple.length - 1; i++) {
      const [ax, ay] = simple[i];
      const [bx, by] = simple[i + 1];
      if (x < ax || x > bx) continue;
      const t = (x - ax) / (bx - ax || 1);
      best = Math.min(best, Math.abs(y - (ay + t * (by - ay))));
    }
    assert.ok(best <= 0.2 * 1.5, `point ${x} strays ${best}`);
  }
});

function jaggedNeighbours() {
  // Two squares sharing x = 10; the shared border wiggles so simplification has work to do.
  const border = Array.from({ length: 41 }, (_, i) => [10 + Math.sin(i) * 0.04, i * 0.25]);
  const left = [[0, 0], ...border, [0, 10], [0, 0]];
  const right = [[20, 0], ...[...border].reverse(), [20, 10], [20, 0]].reverse();
  const polygon = (ring) => ({ type: "Polygon", coordinates: [ring] });
  return [
    { id: "L", name: "Left", geometry: polygon(left) },
    { id: "R", name: "Right", geometry: polygon(right) },
  ];
}

test("simplification keeps rings closed and neighbours glued along shared borders", () => {
  const features = jaggedNeighbours();
  const topology = lib.buildTopology(features, {
    object: "cells",
    tolerance: 0.2,
    quantization: 4000,
  });
  const decoded = lib.topologyFeatures(topology, "cells");
  assert.equal(decoded.length, 2);
  for (const feature of decoded) {
    const ring = feature.geometry.coordinates[0];
    assert.ok(ring.length >= 4, "a ring keeps at least a triangle");
    assert.deepEqual(ring[0], ring[ring.length - 1], "the ring is closed");
  }
  const key = (p) => p.map((v) => v.toFixed(6)).join(",");
  const [left, right] = decoded.map((f) => new Set(f.geometry.coordinates[0].map(key)));
  const shared = [...left].filter((p) => right.has(p));
  // Both sides keep the very same simplified border, which is shorter than the original one.
  assert.ok(shared.length >= 2 && shared.length < 41, `shared border has ${shared.length} points`);
  const borderOf = (feature) =>
    feature.geometry.coordinates[0].filter(
      (p) => Math.abs(p[0] - 10) < 0.3 && p[1] > 0 && p[1] < 10,
    );
  assert.deepEqual(new Set(borderOf(decoded[0]).map(key)), new Set(borderOf(decoded[1]).map(key)));
  assert.equal(topology.arcs.length, 3, "left-only, right-only and one shared arc");
});

test("tiny rings vanish but polygons never end up open or degenerate", () => {
  const speck = {
    id: "S",
    name: "Speck",
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [0, 5],
            [5, 5],
            [5, 0],
            [0, 0],
          ],
        ],
        [
          [
            [8, 8],
            [8, 8.01],
            [8.01, 8.01],
            [8.01, 8],
            [8, 8],
          ],
        ],
      ],
    },
  };
  const topology = lib.buildTopology([speck], { object: "cells", tolerance: 0.1, minArea: 0.01 });
  const [feature] = lib.topologyFeatures(topology, "cells");
  assert.equal(feature.geometry.type, "Polygon");
  assert.equal(feature.geometry.coordinates.length, 1);
});

test("shipped maps: closed rings, expected regions, small files", async () => {
  const peru = (await load(join(maps, "data/peru/index.ts"))).peruMap;
  const world = (await load(join(maps, "data/world/index.ts"))).worldMap;
  for (const [map, count] of [
    [peru, 26],
    [world, 150],
  ]) {
    const features = lib.topologyFeatures(map.topology, map.object);
    assert.ok(features.length >= count, `${map.id}: ${features.length} regions`);
    assert.equal(new Set(features.map((f) => f.id)).size, features.length, "ids are unique");
    for (const feature of features) {
      for (const ring of lib.geometryRings(feature.geometry)) {
        assert.ok(ring.length >= 4, `${feature.id}: ring too short`);
        assert.deepEqual(ring[0], ring[ring.length - 1], `${feature.id}: ring not closed`);
      }
    }
  }
  const ids = lib.topologyFeatures(peru.topology, peru.object).map((f) => f.id);
  for (const id of ["PE-LIM", "PE-LMA", "PE-CAL", "PE-CUS", "PE-LOR"])
    assert.ok(ids.includes(id), id);
  for (const file of ["peru", "world"]) {
    const size = statSync(join(maps, `data/${file}/index.ts`)).size;
    assert.ok(size < 150 * 1024, `${file} is ${size} bytes`);
  }
});

test("clusterPoints merges neighbours and keeps far points apart", () => {
  const clusters = lib.clusterPoints(
    [
      { x: 0, y: 0, value: 10 },
      { x: 5, y: 5, value: 2 },
      { x: 300, y: 300, value: 4 },
    ],
    36,
  );
  assert.equal(clusters.length, 2);
  assert.deepEqual(clusters[0].members, [0, 1]);
  near(clusters[0].value, 12);
  assert.deepEqual(clusters[1].members, [2]);
});
