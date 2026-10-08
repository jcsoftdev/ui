"use client";

import { useMemo } from "react";
import { featurePositions, geometryExtent, geometryPath, labelAnchor } from "./geo-path.js";
import { fitProjection, type Projection } from "./projection.js";
import { topologyFeatures } from "./topojson.js";
import type { Bounds, GeoFeature, GeoMap, Position, ProjectionKind } from "./types.js";

const featureCache = new WeakMap<GeoMap, GeoFeature[]>();
const anchorCache = new WeakMap<GeoFeature[], Position[]>();

/** Decoded features of a map (once per map object, not per render). */
export function mapFeatures(map: GeoMap): GeoFeature[] {
  let features = featureCache.get(map);
  if (!features) {
    features = topologyFeatures(map.topology, map.object);
    featureCache.set(map, features);
  }
  return features;
}

function anchorsOf(features: GeoFeature[]): Position[] {
  let anchors = anchorCache.get(features);
  if (!anchors) {
    anchors = features.map((feature) => labelAnchor(feature.geometry));
    anchorCache.set(features, anchors);
  }
  return anchors;
}

const aspectCache = new WeakMap<GeoMap, Map<string, number>>();

/**
 * Height that suits `map` at `width`: its own projected height / width ratio, so a tall country gets a tall
 * box and a world map a wide one (within 220 and 640 px).
 */
export function defaultMapHeight(map: GeoMap, width: number, projection?: ProjectionKind): number {
  const kind = projection ?? map.projection;
  let byKind = aspectCache.get(map);
  if (!byKind) {
    byKind = new Map();
    aspectCache.set(map, byKind);
  }
  let aspect = byKind.get(kind);
  if (aspect === undefined) {
    const positions = featurePositions(mapFeatures(map));
    const fitted = fitProjection(kind, positions, 1000, 1000, { padding: 0 });
    const projected = positions.map(([lon, lat]) => fitted.project(lon, lat));
    const [x0, y0, x1, y1] = [
      Math.min(...projected.map((p) => p[0])),
      Math.min(...projected.map((p) => p[1])),
      Math.max(...projected.map((p) => p[0])),
      Math.max(...projected.map((p) => p[1])),
    ];
    aspect = (y1 - y0) / Math.max(1, x1 - x0);
    byKind.set(kind, aspect);
  }
  return Math.round(Math.min(640, Math.max(220, width * aspect)));
}

/** A map fitted to a box: everything the drawing layers need, in zoom 1 pixels. */
export interface MapGeometry {
  features: GeoFeature[];
  projection: Projection;
  /** SVG path of each region. */
  paths: string[];
  /** Label position of each region. */
  anchors: Array<[number, number]>;
  /** Pixel box of each region. */
  boxes: Bounds[];
  /** Pixel box of the whole map. */
  bounds: Bounds;
}

/**
 * Fits `map` into `width` x `height`. Recomputes paths only when the box, the
 * map or the projection changes, never on hover, zoom or pan (those only move
 * a transform).
 */
export function useMapGeometry(
  map: GeoMap,
  width: number,
  height: number,
  { projection, padding = 8 }: { projection?: ProjectionKind; padding?: number } = {},
): MapGeometry {
  return useMemo(() => {
    const features = mapFeatures(map);
    const projectionFit = fitProjection(
      projection ?? map.projection,
      featurePositions(features),
      width,
      height,
      { padding },
    );
    const project = projectionFit.project;
    const lonLatAnchors = anchorsOf(features);
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
    const bounds: Bounds = boxes.reduce<Bounds>(
      (all, box) => [
        Math.min(all[0], box[0]),
        Math.min(all[1], box[1]),
        Math.max(all[2], box[2]),
        Math.max(all[3], box[3]),
      ],
      [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ],
    );
    return {
      features,
      projection: projectionFit,
      paths: features.map((feature) => geometryPath(feature.geometry, project, 1)),
      anchors: lonLatAnchors.map(([lon, lat]) => project(lon, lat)),
      boxes,
      bounds,
    };
  }, [map, width, height, projection, padding]);
}
