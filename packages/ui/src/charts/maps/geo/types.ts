/** `[lon, lat]` in degrees. */
export type Position = readonly [number, number];

export interface PolygonGeometry {
  type: "Polygon";
  /** Outer ring first, then holes. Rings are closed (first point equals the last). */
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry;

/** A region of a map: stable `id` (ISO code), display `name` and its geometry. */
export interface GeoFeature {
  id: string;
  name: string;
  geometry: AreaGeometry;
}

/** The subset of TopoJSON this library reads (quantized, delta-encoded arcs; areas only). */
export interface TopologyGeometry {
  type: "Polygon" | "MultiPolygon";
  /** Polygon: rings of arc indices. MultiPolygon: polygons of rings. A negative index `~i` walks arc `i` backwards. */
  arcs: number[][] | number[][][];
  id?: string;
  properties?: { name?: string };
}

export interface TopologyObject {
  type: "GeometryCollection";
  geometries: TopologyGeometry[];
}

export interface Topology {
  type: "Topology";
  /** Present when `arcs` hold quantized integers, delta-encoded. */
  transform?: { scale: readonly [number, number]; translate: readonly [number, number] };
  arcs: number[][][];
  objects: Record<string, TopologyObject>;
}

export type ProjectionKind = "equirectangular" | "mercator" | "equalEarth" | "fitted";

/** A shippable map: its topology, the object to draw and the projection that suits it. */
export interface GeoMap {
  id: string;
  /** Accessible name of the area, e.g. "Perú". */
  name: string;
  topology: Topology;
  /** Key in `topology.objects`. */
  object: string;
  projection: ProjectionKind;
}

export type Bounds = readonly [minX: number, minY: number, maxX: number, maxY: number];
