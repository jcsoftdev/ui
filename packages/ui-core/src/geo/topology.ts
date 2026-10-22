import type {
  AreaGeometry,
  GeoFeature,
  GeoMap,
  Position,
  Topology,
  TopologyGeometry,
} from "../internal/geo.js";

/**
 * Minimal TopoJSON decoder for area objects. Arcs are stored quantized and
 * delta-encoded; `decodeArcs` expands them once to absolute [lon, lat].
 */
export function decodeArcs(topology: Topology): Position[][] {
  const transform = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      if (!transform) return [dx as number, dy as number] as const;
      x += dx as number;
      y += dy as number;
      return [
        x * transform.scale[0] + transform.translate[0],
        y * transform.scale[1] + transform.translate[1],
      ] as const;
    });
  });
}

/** Walks the arc list of one ring; `~i` is arc `i` backwards. Shared end points are not repeated. */
export function stitchRing(arcs: readonly Position[][], indices: readonly number[]): Position[] {
  const ring: Position[] = [];
  for (const index of indices) {
    const arc =
      index < 0 ? [...(arcs[~index] as Position[])].reverse() : (arcs[index] as Position[]);
    for (let i = ring.length > 0 ? 1 : 0; i < arc.length; i++) ring.push(arc[i] as Position);
  }
  return ring;
}

function geometryOf(arcs: readonly Position[][], geometry: TopologyGeometry): AreaGeometry {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: (geometry.arcs as number[][]).map((ring) => stitchRing(arcs, ring)),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: (geometry.arcs as number[][][]).map((polygon) =>
      polygon.map((ring) => stitchRing(arcs, ring)),
    ),
  };
}

/** Regions of a topology object as lon/lat features. Returns `[]` for an unknown object. */
export function topologyFeatures(topology: Topology, object: string): GeoFeature[] {
  const collection = topology.objects[object];
  if (!collection) return [];
  const arcs = decodeArcs(topology);
  return collection.geometries.map((geometry, index) => ({
    id: geometry.id ?? `${object}-${index}`,
    name: geometry.properties?.name ?? geometry.id ?? `${index + 1}`,
    geometry: geometryOf(arcs, geometry),
  }));
}

/** All rings of a geometry, flattened (outer rings and holes). */
export function geometryRings(geometry: AreaGeometry): Position[][] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

/**
 * A map restricted to some regions (by id), e.g. only Lima and Callao out of
 * Peru. The projection is fitted to what is left, so the view zooms into it.
 * Arcs are shared, not copied.
 */
export function selectRegions(map: GeoMap, ids: readonly string[]): GeoMap {
  const object = map.topology.objects[map.object];
  return {
    ...map,
    id: `${map.id}:${ids.join(",")}`,
    topology: {
      ...map.topology,
      objects: {
        [map.object]: {
          type: "GeometryCollection",
          geometries: (object?.geometries ?? []).filter((g) => g.id && ids.includes(g.id)),
        },
      },
    },
  };
}

export type {
  AreaGeometry,
  GeoFeature,
  GeoMap,
  MultiPolygonGeometry,
  PolygonGeometry,
  Position,
  ProjectionKind,
  Topology,
  TopologyGeometry,
  TopologyObject,
} from "../internal/geo.js";
