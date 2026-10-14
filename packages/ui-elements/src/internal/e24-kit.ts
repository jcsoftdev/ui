/**
 * The lazy half of the zoomable map elements: projection, path building, topology decoding, region
 * matching and the color scale. An element fetches it in parallel with the map's topology and holds
 * the module, so the first draw after the map arrives is synchronous and the element's own chunk
 * stays small. Never imported eagerly; reach it through `loadKit()`.
 */
import {
  type Bounds,
  featurePositions,
  geometryExtent,
  geometryPath,
  labelAnchor,
} from "@jcsoftdev/ui-core/geo/path";
import { fitProjection, type Projection } from "@jcsoftdev/ui-core/geo/projection";
import type { GeoFeature, GeoMap, ProjectionKind } from "@jcsoftdev/ui-core/geo/topology";
import { mapFeatures } from "./e24-features.js";

export { createRegionIndex } from "@jcsoftdev/ui-core/geo/match";
export { toScreen } from "@jcsoftdev/ui-core/geo/view";
export { colorScale, legendFor } from "./e24-scale.js";
export { mapFeatures };

/** A map fitted to a box: everything the drawing layers need, in zoom-1 pixels. */
export interface MapGeometry {
  features: GeoFeature[];
  projection: Projection;
  paths: string[];
  /** Label position of each region. */
  anchors: Array<[number, number]>;
  /** Pixel box of each region. */
  boxes: Bounds[];
  /** Pixel box of the whole map. */
  bounds: Bounds;
}

const anchorCache = new WeakMap<GeoFeature[], Array<readonly [number, number]>>();

const lonLatAnchors = (features: GeoFeature[]) => {
  let anchors = anchorCache.get(features);
  if (!anchors) {
    anchors = features.map((feature) => labelAnchor(feature.geometry));
    anchorCache.set(features, anchors);
  }
  return anchors;
};

/** Height / width of `map` once projected: a tall country gets a tall box and a world map a wide one. */
export function mapAspect(map: GeoMap, kind: ProjectionKind = map.projection): number {
  const positions = featurePositions(mapFeatures(map));
  const fitted = fitProjection(kind, positions, 1000, 1000, { padding: 0 });
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of positions) {
    const [x, y] = fitted.project(lon, lat);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return (y1 - y0) / Math.max(1, x1 - x0);
}

export function fitGeometry(
  map: GeoMap,
  width: number,
  height: number,
  kind: ProjectionKind,
): MapGeometry {
  const features = mapFeatures(map);
  const projection = fitProjection(kind, featurePositions(features), width, height, { padding: 8 });
  const project = projection.project;
  const boxes = features.map((feature): Bounds => {
    const [west, south, east, north] = geometryExtent(feature.geometry);
    const corners = [
      project(west, south),
      project(east, south),
      project(east, north),
      project(west, north),
    ];
    const xs = corners.map((corner) => corner[0]);
    const ys = corners.map((corner) => corner[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
  const bounds = boxes.reduce<Bounds>(
    (all, box) => [
      Math.min(all[0], box[0]),
      Math.min(all[1], box[1]),
      Math.max(all[2], box[2]),
      Math.max(all[3], box[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  return {
    features,
    projection,
    paths: features.map((feature) => geometryPath(feature.geometry, project, 1)),
    anchors: lonLatAnchors(features).map(([lon, lat]) => project(lon, lat)),
    boxes,
    bounds,
  };
}

export type Kit = typeof import("./e24-kit.js");
