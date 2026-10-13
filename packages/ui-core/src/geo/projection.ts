import type { Position, ProjectionKind } from "../internal/geo.js";

const RAD = Math.PI / 180;
/** Web Mercator cannot show the poles; latitudes are clamped here. */
export const MERCATOR_MAX_LAT = 85.0511287798;

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const EQUAL_EARTH_M = Math.sqrt(3) / 2;

/** Unit-scale projection: lon/lat in degrees to plane coordinates (x east, y south, so it can be drawn directly). */
export interface RawProjection {
  kind: ProjectionKind;
  forward: (lon: number, lat: number) => [number, number];
  inverse: (x: number, y: number) => [number, number];
}

export interface RawProjectionOptions {
  /** Longitude kept at x = 0, in degrees. */
  centerLon?: number;
  /** Standard parallel of the `equirectangular` and `fitted` projections, in degrees (true scale there). */
  parallel?: number;
}

/**
 * Creates a raw projection:
 * - `equirectangular`: plate carrée (x = lon, y = -lat) with an optional standard parallel;
 * - `mercator`: conformal, latitudes clamped to ±85.05°;
 * - `equalEarth`: area preserving, pleasant for world maps;
 * - `fitted`: equirectangular with the standard parallel at the middle of the area, so a country keeps its shape
 *   (use with `fitProjection`, which also picks the centre).
 */
export function createRawProjection(
  kind: ProjectionKind,
  { centerLon = 0, parallel = 0 }: RawProjectionOptions = {},
): RawProjection {
  if (kind === "mercator") {
    return {
      kind,
      forward: (lon, lat) => {
        const phi = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat)) * RAD;
        return [(lon - centerLon) * RAD, -Math.log(Math.tan(Math.PI / 4 + phi / 2))];
      },
      inverse: (x, y) => [x / RAD + centerLon, (2 * Math.atan(Math.exp(-y)) - Math.PI / 2) / RAD],
    };
  }
  if (kind === "equalEarth") {
    return {
      kind,
      forward: (lon, lat) => {
        const theta = Math.asin(EQUAL_EARTH_M * Math.sin(lat * RAD));
        const t2 = theta * theta;
        const t6 = t2 * t2 * t2;
        const x =
          ((lon - centerLon) * RAD * Math.cos(theta)) /
          (EQUAL_EARTH_M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
        return [x, -theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
      },
      inverse: (x, y) => {
        let theta = -y;
        let t2 = theta * theta;
        let t6 = t2 * t2 * t2;
        let slope = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
        for (let i = 0; i < 12; i++) {
          t2 = theta * theta;
          t6 = t2 * t2 * t2;
          const error = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) + y;
          slope = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
          const delta = error / slope;
          theta -= delta;
          if (Math.abs(delta) < 1e-12) break;
        }
        t2 = theta * theta;
        t6 = t2 * t2 * t2;
        slope = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
        return [
          (EQUAL_EARTH_M * x * slope) / Math.cos(theta) / RAD + centerLon,
          Math.asin(Math.sin(theta) / EQUAL_EARTH_M) / RAD,
        ];
      },
    };
  }
  const stretch = Math.cos(parallel * RAD) || 1;
  return {
    kind,
    forward: (lon, lat) => [(lon - centerLon) * RAD * stretch, -lat * RAD],
    inverse: (x, y) => [x / (RAD * stretch) + centerLon, -y / RAD],
  };
}

/** A raw projection scaled and translated into a pixel box. */
export interface Projection {
  kind: ProjectionKind;
  /** Pixels per unit of the raw projection. */
  scale: number;
  translate: readonly [number, number];
  project: (lon: number, lat: number) => [number, number];
  invert: (x: number, y: number) => [number, number];
}

export interface FitOptions {
  /** Pixels kept free on every side. */
  padding?: number;
}

/** Extent of a set of positions: [west, south, east, north]. */
export function positionsExtent(
  positions: Iterable<Position>,
): [number, number, number, number] | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of positions) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

/**
 * Projects `positions` and scales them to fill `width` x `height` (minus
 * padding) keeping the aspect ratio, centred. This is what makes a map fill
 * its exact parent: the same data fits a 320 px card and a full dashboard
 * panel. For `fitted` the centre meridian and the standard parallel come
 * from the extent itself.
 */
export function fitProjection(
  kind: ProjectionKind,
  positions: readonly Position[],
  width: number,
  height: number,
  { padding = 8 }: FitOptions = {},
): Projection {
  const extent = positionsExtent(positions) ?? [-180, -90, 180, 90];
  const centerLon = kind === "fitted" ? (extent[0] + extent[2]) / 2 : 0;
  const parallel = kind === "fitted" ? (extent[1] + extent[3]) / 2 : 0;
  const raw = createRawProjection(kind, { centerLon, parallel });
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of positions) {
    const [x, y] = raw.forward(lon, lat);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const scale = Math.min(innerW / (maxX - minX || 1), innerH / (maxY - minY || 1));
  const translate: [number, number] = [
    (width - scale * (minX + maxX)) / 2,
    (height - scale * (minY + maxY)) / 2,
  ];
  return {
    kind,
    scale,
    translate,
    project: (lon, lat) => {
      const [x, y] = raw.forward(lon, lat);
      return [x * scale + translate[0], y * scale + translate[1]];
    },
    invert: (x, y) => raw.inverse((x - translate[0]) / scale, (y - translate[1]) / scale),
  };
}

export type { Position, ProjectionKind } from "../internal/geo.js";
