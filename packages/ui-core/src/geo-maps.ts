import type { GeoMap } from "./internal/geo.js";

/** Ids of the bundled maps. Each one is a separate JSON chunk, fetched only when it is loaded. */
export type MapId = "world" | "peru";

const loaders: Record<MapId, () => Promise<GeoMap>> = {
  world: () =>
    import("./geo-data/world.json", { with: { type: "json" } }).then(
      (module) => module.default as unknown as GeoMap,
    ),
  peru: () =>
    import("./geo-data/peru.json", { with: { type: "json" } }).then(
      (module) => module.default as unknown as GeoMap,
    ),
};

/** The bundled map ids, without loading any topology. */
export const MAP_IDS: readonly MapId[] = ["world", "peru"];

/**
 * Loads a bundled map (quantized TopoJSON, Natural Earth, public domain) on demand. Nothing about
 * the geometry is in this module's eager graph: a bundler splits each map into its own chunk.
 * Feed the result to `topologyFeatures` from `geo-topology`.
 */
export function loadMap(id: MapId): Promise<GeoMap> {
  return loaders[id]();
}

export type { GeoMap } from "./internal/geo.js";
