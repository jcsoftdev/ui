import type { AreaGeometry, Bounds, GeoFeature, Position } from "../internal/geo.js";
import { geometryRings } from "./topology.js";

type Project = (lon: number, lat: number) => readonly [number, number];

/**
 * SVG path (`d`) of an area: one closed subpath per ring. Consecutive points
 * that land on the same pixel (at `precision` decimals) are merged, so the
 * string stays short even at low zoom. Use with `fill-rule: evenodd` for holes.
 */
export function geometryPath(geometry: AreaGeometry, project: Project, precision = 1): string {
  const factor = 10 ** precision;
  const round = (value: number) => Math.round(value * factor) / factor;
  let d = "";
  for (const ring of geometryRings(geometry)) {
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    let count = 0;
    let part = "";
    for (const [lon, lat] of ring) {
      const [px, py] = project(lon, lat);
      const x = round(px);
      const y = round(py);
      if (x === lastX && y === lastY) continue;
      part += `${count === 0 ? "M" : "L"}${x} ${y}`;
      lastX = x;
      lastY = y;
      count++;
    }
    if (count >= 3) d += `${part}Z`;
  }
  return d;
}

/** Extent of the outer boundary of a geometry in lon/lat. */
export function geometryExtent(geometry: AreaGeometry): Bounds {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    for (const [lon, lat] of polygon[0] ?? []) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return [west, south, east, north];
}

/** Every outer-ring vertex of the features, for fitting a projection. */
export function featurePositions(features: readonly GeoFeature[]): Position[] {
  const positions: Position[] = [];
  for (const feature of features) {
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const polygon of polygons) for (const point of polygon[0] ?? []) positions.push(point);
  }
  return positions;
}

function ringContains(ring: readonly Position[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Position;
    const [xj, yj] = ring[j] as Position;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function edgeDistanceSquared(rings: readonly Position[][], x: number, y: number, k: number) {
  let best = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ((ring[j] as Position)[0] - x) * k;
      const ay = (ring[j] as Position)[1] - y;
      const bx = ((ring[i] as Position)[0] - x) * k;
      const by = (ring[i] as Position)[1] - y;
      const dx = bx - ax;
      const dy = by - ay;
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length));
      const px = ax + t * dx;
      const py = ay + t * dy;
      best = Math.min(best, px * px + py * py);
    }
  }
  return best;
}

function polygonArea(ring: readonly Position[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j] as Position)[0] * (ring[i] as Position)[1];
    sum -= (ring[i] as Position)[0] * (ring[j] as Position)[1];
  }
  return Math.abs(sum / 2);
}

/**
 * A point well inside the region, for its label: the point of the largest
 * polygon farthest from every edge (a coarse "pole of inaccessibility": grid
 * search, then two refinements). Better than the centroid for crescents such
 * as Lima or Chile.
 */
export function labelAnchor(geometry: AreaGeometry): Position {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let main = polygons[0] as Position[][];
  let mainArea = -1;
  for (const polygon of polygons) {
    const area = polygonArea(polygon[0] ?? []);
    if (area > mainArea) {
      main = polygon;
      mainArea = area;
    }
  }
  const [west, south, east, north] = geometryExtent({ type: "Polygon", coordinates: main });
  const k = Math.cos(((south + north) / 2) * (Math.PI / 180)) || 1;
  const inside = (x: number, y: number) =>
    ringContains(main[0] ?? [], x, y) && !main.slice(1).some((hole) => ringContains(hole, x, y));
  let best: Position = [(west + east) / 2, (south + north) / 2];
  let bestDistance = -1;
  let stepX = (east - west) / 16;
  let stepY = (north - south) / 16;
  let x0 = west;
  let y0 = south;
  let x1 = east;
  let y1 = north;
  for (let pass = 0; pass < 3; pass++) {
    for (let x = x0; x <= x1; x += stepX) {
      for (let y = y0; y <= y1; y += stepY) {
        if (!inside(x, y)) continue;
        const distance = edgeDistanceSquared(main, x, y, k);
        if (distance > bestDistance) {
          bestDistance = distance;
          best = [x, y];
        }
      }
    }
    x0 = best[0] - stepX;
    x1 = best[0] + stepX;
    y0 = best[1] - stepY;
    y1 = best[1] + stepY;
    stepX /= 5;
    stepY /= 5;
  }
  return best;
}

export type { AreaGeometry, Bounds, GeoFeature, Position } from "../internal/geo.js";
