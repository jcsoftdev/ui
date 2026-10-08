import { type PlanePoint, ringArea, simplifyLine } from "./simplify.js";
import type { GeoFeature, Position, Topology, TopologyGeometry } from "./types.js";

export interface BuildTopologyOptions {
  /** Name of the single object in the result. */
  object: string;
  /** Grid size of the quantization: coordinates become integers in [0, quantization]. */
  quantization?: number;
  /** Simplification tolerance in degrees. */
  tolerance?: number;
  /** Rings smaller than this (square degrees) are dropped, e.g. specks of islands. */
  minArea?: number;
}

type Cell = [number, number];

interface RingRef {
  /** Indices into `arcs`; `~i` for an arc walked backwards. */
  arcs: number[];
  closedSingle: boolean;
}

const keyOf = (point: Cell, width: number): number => point[0] * width + point[1];

/**
 * Builds a TopoJSON topology from lon/lat polygons. Rings are cut at the
 * points where the set of neighbours changes (junctions), so a border shared
 * by two regions becomes ONE arc referenced by both. Each arc is simplified
 * once with its end points fixed, which keeps neighbours glued together: no
 * gaps or overlaps can open along a shared border however coarse the
 * tolerance. Used by the data build script; also exported for tests.
 */
export function buildTopology(
  features: readonly GeoFeature[],
  { object, quantization = 20_000, tolerance = 0, minArea = 0 }: BuildTopologyOptions,
): Topology {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const polygonsOf = (feature: GeoFeature): Position[][][] =>
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  for (const feature of features) {
    for (const polygon of polygonsOf(feature)) {
      for (const [x, y] of polygon[0] ?? []) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const scaleX = (maxX - minX) / quantization || 1;
  const scaleY = (maxY - minY) / quantization || 1;
  const width = quantization + 1;
  const quantize = (point: Position): Cell => [
    Math.round((point[0] - minX) / scaleX),
    Math.round((point[1] - minY) / scaleY),
  ];

  // 1. Quantize rings (open: no repeated closing point, no consecutive duplicates).
  interface Ring {
    cells: Cell[];
  }
  const polygons: Array<{ feature: number; rings: Ring[] }> = [];
  features.forEach((feature, featureIndex) => {
    for (const polygon of polygonsOf(feature)) {
      const rings: Ring[] = [];
      let dropped = false;
      polygon.forEach((ring, ringIndex) => {
        const cells: Cell[] = [];
        for (const position of ring) {
          const cell = quantize(position);
          const last = cells[cells.length - 1];
          if (!last || last[0] !== cell[0] || last[1] !== cell[1]) cells.push(cell);
        }
        const first = cells[0];
        const last = cells[cells.length - 1];
        if (first && last && cells.length > 1 && first[0] === last[0] && first[1] === last[1])
          cells.pop();
        const area = Math.abs(
          ringArea(cells.map(([x, y]) => [x * scaleX, y * scaleY] as PlanePoint)),
        );
        if (cells.length < 3 || area < minArea) {
          if (ringIndex === 0) dropped = true;
          return;
        }
        rings.push({ cells });
      });
      if (!dropped && rings.length > 0) polygons.push({ feature: featureIndex, rings });
    }
  });

  // 2. Junctions: points whose pair of neighbours differs between occurrences.
  const neighbours = new Map<number, Set<string>>();
  for (const { rings } of polygons) {
    for (const { cells } of rings) {
      const n = cells.length;
      for (let i = 0; i < n; i++) {
        const prev = keyOf(cells[(i - 1 + n) % n] as Cell, width);
        const next = keyOf(cells[(i + 1) % n] as Cell, width);
        const pair = prev < next ? `${prev}|${next}` : `${next}|${prev}`;
        const key = keyOf(cells[i] as Cell, width);
        const set = neighbours.get(key) ?? new Set<string>();
        set.add(pair);
        neighbours.set(key, set);
      }
    }
  }
  const isJunction = (cell: Cell) => (neighbours.get(keyOf(cell, width))?.size ?? 0) > 1;

  // 3. Cut every ring into arcs; identical arcs (either direction) are stored once.
  const arcs: Cell[][] = [];
  const arcIndex = new Map<string, number>();
  const serialize = (cells: readonly Cell[]) => cells.map((cell) => keyOf(cell, width)).join(",");
  const register = (cells: Cell[]): number => {
    const forward = serialize(cells);
    const known = arcIndex.get(forward);
    if (known !== undefined) return known;
    const backward = serialize([...cells].reverse());
    const reversed = arcIndex.get(backward);
    if (reversed !== undefined) return ~reversed;
    arcs.push(cells);
    arcIndex.set(forward, arcs.length - 1);
    return arcs.length - 1;
  };
  const refOf = (cells: Cell[]): RingRef => {
    const n = cells.length;
    const junctions: number[] = [];
    for (let i = 0; i < n; i++) if (isJunction(cells[i] as Cell)) junctions.push(i);
    if (junctions.length === 0) {
      let start = 0;
      for (let i = 1; i < n; i++)
        if (keyOf(cells[i] as Cell, width) < keyOf(cells[start] as Cell, width)) start = i;
      const rotated = [...cells.slice(start), ...cells.slice(0, start)];
      return { arcs: [register([...rotated, rotated[0] as Cell])], closedSingle: true };
    }
    const first = junctions[0] as number;
    const rotated = [...cells.slice(first), ...cells.slice(0, first)];
    const ends = junctions.map((j) => (j - first + n) % n);
    ends.sort((a, b) => a - b);
    const indices: number[] = [];
    for (let k = 0; k < ends.length; k++) {
      const from = ends[k] as number;
      const to = k + 1 < ends.length ? (ends[k + 1] as number) : n;
      const piece = rotated.slice(from, to);
      piece.push((to === n ? rotated[0] : rotated[to]) as Cell);
      indices.push(register(piece));
    }
    return { arcs: indices, closedSingle: false };
  };
  const refs = polygons.map(({ rings }) => rings.map(({ cells }) => refOf(cells)));

  // 4. Simplify each arc once (tolerance converted to grid units).
  const gridTolerance = tolerance / Math.max(scaleX, scaleY);
  const simplified = arcs.map((arc, index) => {
    const closed =
      (arc[0] as Cell)[0] === (arc[arc.length - 1] as Cell)[0] &&
      (arc[0] as Cell)[1] === (arc[arc.length - 1] as Cell)[1];
    const cells = simplifyLine(arc, gridTolerance) as Cell[];
    if (closed && cells.length < 4) return { index, cells: null };
    return { index, cells };
  });
  const survives = (ref: RingRef) =>
    ref.arcs.every((i) => simplified[i < 0 ? ~i : i]?.cells != null);

  // 5. Emit only the arcs still used, renumbered, delta-encoded.
  const remap = new Map<number, number>();
  const outArcs: number[][][] = [];
  const geometries = new Map<number, TopologyGeometry>();
  const usable = (ring: number[]) =>
    ring.map((i) => {
      const id = i < 0 ? ~i : i;
      if (!remap.has(id)) {
        remap.set(id, outArcs.length);
        let px = 0;
        let py = 0;
        outArcs.push(
          (simplified[id] as { cells: Cell[] }).cells.map(([x, y]) => {
            const delta: number[] = [x - px, y - py];
            px = x;
            py = y;
            return delta;
          }),
        );
      }
      const mapped = remap.get(id) as number;
      return i < 0 ? ~mapped : mapped;
    });
  polygons.forEach(({ feature }, polygonIndex) => {
    const polygonRefs = refs[polygonIndex] as RingRef[];
    const rings = polygonRefs.filter(survives);
    const outer = polygonRefs[0];
    if (!outer || !survives(outer)) return;
    const polygonArcs = rings.map((ring) => usable(ring.arcs));
    const source = features[feature] as GeoFeature;
    const current = geometries.get(feature);
    if (!current) {
      geometries.set(feature, {
        type: "Polygon",
        arcs: polygonArcs,
        id: source.id,
        properties: { name: source.name },
      });
    } else if (current.type === "Polygon") {
      current.type = "MultiPolygon";
      current.arcs = [current.arcs as number[][], polygonArcs];
    } else {
      (current.arcs as number[][][]).push(polygonArcs);
    }
  });

  return {
    type: "Topology",
    transform: { scale: [scaleX, scaleY], translate: [minX, minY] },
    arcs: outArcs,
    objects: {
      [object]: {
        type: "GeometryCollection",
        geometries: features.flatMap((_, index) => geometries.get(index) ?? []),
      },
    },
  };
}
