/**
 * Shared, DOM-free logic of the E24 map family (`ui-choropleth-map`, `ui-bubble-map`,
 * `ui-hex-tile-map`, `ui-globe-chart`): data matching, color scales, keyboard neighbours and the lazy
 * map loader. The geometry itself comes from `@jcsoftdev/ui-core/geo/*`; the topology data is never
 * imported here, only through `loadGeoMap`, so each map is fetched when an element asks for it.
 */
import type { GeoMap } from "@jcsoftdev/ui-core/geo/topology";
import type { KeyItem } from "./e24-key.js";
import type { Kit } from "./e24-kit.js";

/** A value for one region, matched by region id or name (accents and case ignored). */
export interface RegionDatum {
  id: string;
  /** `null` leaves the region without data. */
  value: number | null;
}

export interface RegionInfo {
  index: number;
  id: string;
  name: string;
  value: number | null;
}

/** Visible strings of the maps. English defaults; override with `chart.labels = { ... }`. */
export interface MapLabels {
  zoomIn: string;
  zoomOut: string;
  fit: string;
  controls: string;
  noData: string;
  region: string;
  /** Default name of the value (tooltip row and table column). */
  value: string;
  longitude: string;
  latitude: string;
  category: string;
  cluster: (count: number) => string;
  origin: string;
  destination: string;
  routes: string;
  resetView: string;
  pauseSpin: string;
  playSpin: string;
  centerAt: (lon: number, lat: number) => string;
}

const degrees = (value: number, positive: string, negative: string) =>
  `${Math.abs(Math.round(value))}° ${value >= 0 ? positive : negative}`;

export const DEFAULT_MAP_LABELS: MapLabels = {
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit the whole map",
  controls: "Map zoom",
  noData: "No data",
  region: "Region",
  value: "Value",
  longitude: "Longitude",
  latitude: "Latitude",
  category: "Category",
  cluster: (count) => `Group of ${count}`,
  origin: "Origin",
  destination: "Destination",
  routes: "Routes",
  resetView: "Reset view",
  pauseSpin: "Pause rotation",
  playSpin: "Start rotation",
  centerAt: (lon, lat) => `Centered on ${degrees(lat, "N", "S")}, ${degrees(lon, "E", "W")}`,
};

export const finiteValues = (data: readonly RegionDatum[]): number[] =>
  data.flatMap((datum) =>
    typeof datum.value === "number" && Number.isFinite(datum.value) ? [datum.value] : [],
  );

/** Index of the range a legend id (`range-N`) stands for, or -1. */
export const rangeOfId = (id: string): number =>
  id.startsWith("range-") ? Number(id.slice(6)) : -1;

type Anchor = readonly [number, number] | null | undefined;

/**
 * Keyboard neighbour of mark `from` on a 2D layout (a map, a tile grid): the nearest anchor in the
 * direction of the arrow, preferring the ones straight ahead; Home and End go to the first and last
 * mark that has an anchor. `undefined` stays put. It is only a lookup on the anchors.
 */
export function directionalNav(
  anchors: ReadonlyArray<Anchor>,
  from: number,
  intent: "left" | "right" | "up" | "down" | "home" | "end" | "parent" | "child",
): number | undefined {
  if (intent === "home") return anchors.findIndex(Boolean);
  if (intent === "end") {
    for (let i = anchors.length - 1; i >= 0; i -= 1) if (anchors[i]) return i;
    return undefined;
  }
  const origin = anchors[from];
  if (!origin || intent === "parent" || intent === "child") return undefined;
  const horizontal = intent === "left" || intent === "right";
  const sign = intent === "right" || intent === "down" ? 1 : -1;
  let best: number | undefined;
  let bestCost = Number.POSITIVE_INFINITY;
  anchors.forEach((anchor, index) => {
    if (!anchor || index === from) return;
    const along = ((horizontal ? anchor[0] - origin[0] : anchor[1] - origin[1]) || 0) * sign;
    const across = Math.abs(horizontal ? anchor[1] - origin[1] : anchor[0] - origin[0]);
    if (along <= 0) return;
    // Straight ahead beats a nearer neighbour off to the side.
    const cost = along + across * 2;
    if (cost < bestCost) {
      bestCost = cost;
      best = index;
    }
  });
  return best;
}

// ---- lazy map data ---------------------------------------------------------------------------

/** A bundled map id (`world`, `peru`), or a map object you bring. */
export type MapSource = GeoMap | string | null | undefined;

const loading = new Map<string, Promise<GeoMap | null>>();

/**
 * The map a `map` attribute or property names. A `GeoMap` object resolves at once. A bundled id
 * loads its topology through ui-core's `geo/maps` (a dynamic import of a module per map), once per
 * id, so a page pays only for the maps it shows. An unknown id resolves to `null`. A failed fetch
 * rejects and is forgotten, so the next call retries instead of replaying the failure.
 */
export function loadGeoMap(source: MapSource): Promise<GeoMap | null> {
  if (!source) return Promise.resolve(null);
  if (typeof source !== "string") return Promise.resolve(source);
  let pending = loading.get(source);
  if (!pending) {
    pending = import("@jcsoftdev/ui-core/geo/maps").then(({ MAP_IDS, loadMap }) =>
      (MAP_IDS as readonly string[]).includes(source)
        ? loadMap(source as (typeof MAP_IDS)[number])
        : null,
    );
    loading.set(source, pending);
    pending.catch(() => {
      if (loading.get(source) === pending) loading.delete(source);
    });
  }
  return pending;
}

let kitLoad: Promise<Kit> | undefined;

/** The lazy half of the map family (projection, paths, topology decoding, color scale), once. */
export function loadKit(): Promise<Kit> {
  if (!kitLoad) {
    kitLoad = import("./e24-kit.js");
    kitLoad.catch(() => {
      kitLoad = undefined;
    });
  }
  return kitLoad;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Sizes the drawing to its content when the author set neither `height` nor `aspect-ratio`, the way
 * React does: `height = clamp(220, width * ratio, 640)`. It writes the `height` attribute (the base
 * has no other hook for a computed height) and steps aside the moment the author sets either.
 */
export class AutoAspect {
  readonly #host: HTMLElement;
  /** Height / width of the content. */
  #ratio: number | null = null;
  /** The `height` value written last: any other value on the host is the author's. */
  #written: string | null = null;
  constructor(host: HTMLElement) {
    this.#host = host;
  }
  /** Sets the content ratio (height / width) and sizes to `width` (the host's width by default). */
  set(ratio: number | null, width = this.#host.clientWidth): void {
    this.#ratio = ratio;
    this.fit(width);
  }
  fit(width: number): void {
    const host = this.#host;
    if (this.#ratio === null || !width || host.hasAttribute("aspect-ratio")) return;
    const current = host.getAttribute("height");
    if (current !== null && current !== this.#written) return;
    const next = `${Math.round(clamp(width * this.#ratio, 220, 640))}`;
    if (current === next) return;
    this.#written = next;
    host.setAttribute("height", next);
  }
}

// ---- markers and routes ----------------------------------------------------------------------

/** One marker: a place by longitude and latitude. */
export interface MapPoint {
  id: string;
  name: string;
  lon: number;
  lat: number;
  /** Drives the bubble area; omit it for fixed-size markers. */
  value?: number;
  /** Colors the marker and groups it in the legend. */
  category?: string;
}

/** A place a route starts or ends at: a point id, or a coordinate. */
export type MapRouteEnd = string | { lon: number; lat: number; name?: string };

/** A flow between two places. */
export interface MapRoute {
  id: string;
  from: MapRouteEnd;
  to: MapRouteEnd;
  /** Drives the line width, e.g. boxes shipped. */
  value?: number;
  /** Tooltip title; "Origin → Destination" by default. */
  name?: string;
  /** CSS color; the accent by default. */
  color?: string;
}

export interface ResolvedRoute {
  route: MapRoute;
  name: string;
  from: readonly [number, number];
  to: readonly [number, number];
}

/** Routes whose two ends resolve (a point id or a coordinate); the rest are dropped. */
export function resolveRoutes(
  routes: readonly MapRoute[],
  points: readonly MapPoint[],
): ResolvedRoute[] {
  const place = (end: MapRouteEnd): { at: [number, number]; name: string } | null => {
    if (typeof end !== "string")
      return {
        at: [end.lon, end.lat],
        name: end.name ?? `${end.lat.toFixed(2)}, ${end.lon.toFixed(2)}`,
      };
    const point = points.find((candidate) => candidate.id === end);
    return point ? { at: [point.lon, point.lat], name: point.name } : null;
  };
  return routes.flatMap((route): ResolvedRoute[] => {
    const from = place(route.from);
    const to = place(route.to);
    return from && to
      ? [{ route, name: route.name ?? `${from.name} → ${to.name}`, from: from.at, to: to.at }]
      : [];
  });
}

const keySignatures = new WeakMap<HTMLElement, string>();

/**
 * Shows `items` (the "No data" swatch, the globe's marker categories) under the chart's drawing, or
 * removes the key when there are none. The drawing code lives in a chunk fetched on first use.
 */
export function setGeoKey(host: HTMLElement, items: readonly KeyItem[]): void {
  const signature = JSON.stringify(items);
  if (keySignatures.get(host) === signature) return;
  const had = keySignatures.has(host);
  keySignatures.set(host, signature);
  if (items.length === 0 && !had) return;
  import("./e24-key.js").then(({ renderKey }) => renderKey(host, items));
}
