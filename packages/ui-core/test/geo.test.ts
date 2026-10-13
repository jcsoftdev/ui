// The geo behaviours are a port: these pin the maths to the React kit's sources, value for value.
import { describe, expect, it } from "vitest";
import * as reactHex from "../../ui/src/charts/hex-tile-map/hex-layout.ts";
import { worldMap as reactWorld } from "../../ui/src/charts/maps/data/world/index.ts";
import * as reactPath from "../../ui/src/charts/maps/geo/geo-path.ts";
import * as reactGlobe from "../../ui/src/charts/maps/geo/globe.ts";
import * as reactProjection from "../../ui/src/charts/maps/geo/projection.ts";
import * as reactTopo from "../../ui/src/charts/maps/geo/topojson.ts";
import * as reactView from "../../ui/src/charts/maps/geo/view.ts";
import * as globe from "../src/geo-globe.ts";
import * as hex from "../src/geo-hex.ts";
import { loadMap } from "../src/geo-maps.ts";
import * as path from "../src/geo-path.ts";
import * as projection from "../src/geo-projection.ts";
import * as topo from "../src/geo-topology.ts";
import * as view from "../src/geo-view.ts";

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const lonLat = (): [number, number] => [rand() * 360 - 180, rand() * 170 - 85];

describe("projection parity", () => {
  const kinds = ["equirectangular", "mercator", "equalEarth", "fitted"] as const;

  it("raw projections match React forward and inverse", () => {
    for (const kind of kinds) {
      const options = { centerLon: rand() * 40 - 20, parallel: rand() * 60 - 30 };
      const ours = projection.createRawProjection(kind, options);
      const theirs = reactProjection.createRawProjection(kind, options);
      for (let i = 0; i < 200; i += 1) {
        const [lon, lat] = lonLat();
        expect(ours.forward(lon, lat)).toEqual(theirs.forward(lon, lat));
        const [x, y] = theirs.forward(lon, lat);
        expect(ours.inverse(x, y)).toEqual(theirs.inverse(x, y));
      }
    }
  });

  it("round-trips equalEarth and mercator", () => {
    for (const kind of ["mercator", "equalEarth"] as const) {
      const raw = projection.createRawProjection(kind);
      for (let i = 0; i < 100; i += 1) {
        const [lon, lat] = lonLat();
        const [x, y] = raw.forward(lon, lat);
        const [lon2, lat2] = raw.inverse(x, y);
        expect(lon2).toBeCloseTo(lon, 6);
        expect(lat2).toBeCloseTo(lat, 6);
      }
    }
  });

  it("fitProjection matches React for scale, translate and sample points", () => {
    const positions = Array.from({ length: 40 }, lonLat);
    for (const kind of kinds) {
      const ours = projection.fitProjection(kind, positions, 640, 360, { padding: 12 });
      const theirs = reactProjection.fitProjection(kind, positions, 640, 360, { padding: 12 });
      expect(ours.scale).toBe(theirs.scale);
      expect(ours.translate).toEqual(theirs.translate);
      for (const [lon, lat] of positions.slice(0, 10)) {
        expect(ours.project(lon, lat)).toEqual(theirs.project(lon, lat));
        const [px, py] = theirs.project(lon, lat);
        expect(ours.invert(px, py)).toEqual(theirs.invert(px, py));
      }
    }
  });
});

describe("topology and paths", () => {
  it("decodes the bundled world map like React, and the lazy JSON is the same data", async () => {
    const map = await loadMap("world");
    expect(map).toEqual(reactWorld);
    const ours = topo.topologyFeatures(map.topology, map.object);
    const theirs = reactTopo.topologyFeatures(reactWorld.topology, reactWorld.object);
    expect(ours.length).toBe(176);
    expect(ours).toEqual(theirs);
  });

  it("builds identical SVG paths and extents for every country", async () => {
    const map = await loadMap("world");
    const features = topo.topologyFeatures(map.topology, map.object);
    const fitted = projection.fitProjection(
      map.projection,
      path.featurePositions(features),
      800,
      450,
    );
    const react = reactProjection.fitProjection(
      map.projection,
      reactPath.featurePositions(features),
      800,
      450,
    );
    for (const feature of features) {
      expect(path.geometryPath(feature.geometry, fitted.project)).toBe(
        reactPath.geometryPath(feature.geometry, react.project),
      );
      expect(path.geometryExtent(feature.geometry)).toEqual(
        reactPath.geometryExtent(feature.geometry),
      );
      expect(path.labelAnchor(feature.geometry)).toEqual(reactPath.labelAnchor(feature.geometry));
    }
  });

  it("selectRegions keeps only the requested ids", async () => {
    const map = await loadMap("peru");
    const sub = topo.selectRegions(map, ["PE-CUS", "PE-PUN"]);
    expect(topo.topologyFeatures(sub.topology, sub.object).map((f) => f.id)).toEqual([
      "PE-CUS",
      "PE-PUN",
    ]);
  });
});

describe("globe parity", () => {
  const rotation = { lon: -77, lat: -12 };
  const disc = { cx: 200, cy: 180, radius: 150 };

  it("orthographic projection, inversion and rotations match React", () => {
    for (let i = 0; i < 200; i += 1) {
      const p = lonLat();
      expect(globe.projectOrthographic(p, rotation, disc)).toEqual(
        reactGlobe.projectOrthographic(p, rotation, disc),
      );
      const x = rand() * 400;
      const y = rand() * 360;
      expect(globe.invertOrthographic(x, y, rotation, disc)).toEqual(
        reactGlobe.invertOrthographic(x, y, rotation, disc),
      );
    }
    expect(globe.dragRotation(rotation, 31, -17, 150)).toEqual(
      reactGlobe.dragRotation(rotation, 31, -17, 150),
    );
    expect(globe.keyRotation(rotation, "ArrowUp")).toEqual(
      reactGlobe.keyRotation(rotation, "ArrowUp"),
    );
    expect(globe.keyRotation(rotation, "x")).toBeNull();
    expect(globe.spinRotation({ lon: 170, lat: 5 }, 2, 12)).toEqual(
      reactGlobe.spinRotation({ lon: 170, lat: 5 }, 2, 12),
    );
  });

  it("clipped ring paths, graticule, line pieces and arcs match React", async () => {
    const map = await loadMap("world");
    const rings = topo
      .topologyFeatures(map.topology, map.object)
      .flatMap((f) => topo.geometryRings(f.geometry))
      .map((ring) => ring.map(globe.toVec));
    for (const turn of [rotation, { lon: 100, lat: 40 }, { lon: 0, lat: -80 }]) {
      expect(globe.globeRingsPath(rings, turn, disc)).toBe(
        reactGlobe.globeRingsPath(rings, turn, disc),
      );
    }
    expect(globe.graticuleLines(30, 6)).toEqual(reactGlobe.graticuleLines(30, 6));
    const arc = globe.globeArc([-77, -12], [139, 35], 32, 0.2);
    expect(arc).toEqual(reactGlobe.globeArc([-77, -12], [139, 35], 32, 0.2));
    expect(globe.globeLinePieces(arc, rotation, disc)).toEqual(
      reactGlobe.globeLinePieces(arc, rotation, disc),
    );
  });

  it("keeps the latitude clamped and the longitude wrapped", () => {
    expect(globe.normalizeRotation({ lon: 200, lat: 120 })).toEqual({ lon: -160, lat: 89 });
  });
});

describe("hex layout parity", () => {
  it("lays out, hit-tests and finds neighbours like React", () => {
    const grid = hex.layoutHexGrid(hex.PERU_HEX_TILES, 520, 420);
    expect(grid).toEqual(reactHex.layoutHexGrid(reactHex.PERU_HEX_TILES, 520, 420));
    expect(hex.PERU_HEX_TILES).toEqual(reactHex.PERU_HEX_TILES);
    expect(hex.hexPoints(10, 20, grid.size, 2)).toBe(reactHex.hexPoints(10, 20, grid.size, 2));
    for (let i = 0; i < 100; i += 1) {
      const x = rand() * 520;
      const y = rand() * 420;
      expect(hex.hexAt(grid.centers, grid.size, x, y)).toBe(
        reactHex.hexAt(grid.centers, grid.size, x, y),
      );
    }
    for (const tile of hex.PERU_HEX_TILES)
      expect(hex.hexNeighbors(tile, hex.PERU_HEX_TILES)).toEqual(
        reactHex.hexNeighbors(tile, reactHex.PERU_HEX_TILES),
      );
    expect(hex.layoutHexGrid([], 100, 100).size).toBe(0);
  });
});

describe("view parity", () => {
  it("zoomAt, clampView, viewFitting and revealPoint match React", () => {
    const limits = { minZoom: 1, maxZoom: 16 };
    const start = { k: 1.5, x: -40, y: 12 };
    const content = [10, 20, 600, 340] as const;
    expect(view.zoomAt(start, 2, 100, 80, limits)).toEqual(
      reactView.zoomAt(start, 2, 100, 80, limits),
    );
    expect(view.clampView({ k: 3, x: 500, y: -900 }, 640, 360, content, limits, 8)).toEqual(
      reactView.clampView({ k: 3, x: 500, y: -900 }, 640, 360, content, limits, 8),
    );
    expect(view.viewFitting([10, 20, 200, 100], 640, 360, { padding: 20 })).toEqual(
      reactView.viewFitting([10, 20, 200, 100], 640, 360, { padding: 20 }),
    );
    expect(view.revealPoint(start, 700, 10, 640, 360)).toEqual(
      reactView.revealPoint(start, 700, 10, 640, 360),
    );
  });
});
