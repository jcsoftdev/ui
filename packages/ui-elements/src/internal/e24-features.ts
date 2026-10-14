/**
 * Decoded features of a bundled or custom map, and point-in-area tests on them. Part of the lazy
 * half of the map family (see `e24-kit`): a page that only draws tile maps never loads it.
 */
import {
  type AreaGeometry,
  type GeoFeature,
  type GeoMap,
  topologyFeatures,
} from "@jcsoftdev/ui-core/geo/topology";

const featureCache = new WeakMap<GeoMap, GeoFeature[]>();

/** Decoded features of a map, once per map object. */
export function mapFeatures(map: GeoMap): GeoFeature[] {
  let features = featureCache.get(map);
  if (!features) {
    features = topologyFeatures(map.topology, map.object);
    featureCache.set(map, features);
  }
  return features;
}

function ringContains(
  ring: ReadonlyArray<readonly [number, number]>,
  x: number,
  y: number,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as readonly [number, number];
    const [xj, yj] = ring[j] as readonly [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether `[lon, lat]` lies inside an area (holes excluded). */
export function geometryContains(geometry: AreaGeometry, lon: number, lat: number): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    ([outer, ...holes]) =>
      !!outer &&
      ringContains(outer, lon, lat) &&
      !holes.some((hole) => ringContains(hole, lon, lat)),
  );
}
