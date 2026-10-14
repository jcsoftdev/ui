/**
 * Shared, DOM-free logic of the E24 map family (`ui-choropleth-map`, `ui-bubble-map`,
 * `ui-hex-tile-map`, `ui-globe-chart`): data matching, color scales, keyboard neighbours and the lazy
 * map loader. The geometry itself comes from `@jcsoftdev/ui-core/geo/*`; the topology data is never
 * imported here, only through `loadGeoMap`, so each map is fetched when an element asks for it.
 */
import {
  type ColorRange,
  type ColorStop,
  divergingColor,
  normalize,
  rangeColor,
  rangeIndex,
  type ScaleColors,
  sequentialColor,
} from "@jcsoftdev/ui-core/chart/color-scale";
import {
  type AreaGeometry,
  type GeoFeature,
  type GeoMap,
  topologyFeatures,
} from "@jcsoftdev/ui-core/geo/topology";
import type { LegendItem, LegendScale } from "./chart-protocol.js";

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

export interface ColorScaleOptions {
  scale?: "sequential" | "diverging";
  /** Fixed `[min, max]`; the data extent by default. */
  domain?: readonly [number, number];
  /** Neutral value of a diverging scale. */
  center?: number;
  colors?: ScaleColors;
  /** Stepped coloring: each value takes the color of the range that contains it. */
  ranges?: readonly ColorRange[];
}

export interface RegionScale {
  domain: readonly [number, number];
  /** `null` when the value falls outside every range. */
  color(value: number): ColorStop | null;
}

/** Builds the color function of a choropleth or tile map from its options and every finite value. */
export function colorScale(
  values: readonly number[],
  { scale = "sequential", domain, center = 0, colors, ranges }: ColorScaleOptions,
): RegionScale {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  const extent: readonly [number, number] = domain ?? [
    scale === "sequential" ? Math.min(0, min) : min,
    max,
  ];
  if (ranges && ranges.length > 0)
    return {
      domain: extent,
      color: (value) => {
        const index = rangeIndex(value, ranges);
        return index < 0 ? null : rangeColor(ranges[index] as ColorRange, index, ranges.length);
      },
    };
  return {
    domain: extent,
    color: (value) =>
      scale === "diverging"
        ? divergingColor(value, extent, center, colors)
        : sequentialColor(value, extent, colors),
  };
}

/**
 * What the legend shows for the scale: a gradient (`scale`) for a continuous one, one item per
 * range (`legend`) for a stepped one. The diverging gradient puts its neutral color at `center`.
 */
export function legendFor(
  options: ColorScaleOptions,
  domain: readonly [number, number],
  format: (value: number) => string,
  label: string,
): { scale?: LegendScale; legend?: LegendItem[] } {
  const { scale = "sequential", center = 0, colors, ranges } = options;
  if (ranges && ranges.length > 0)
    return {
      legend: ranges.map((range, index) => ({
        id: `range-${index}`,
        name: range.label,
        color: rangeColor(range, index, ranges.length).color,
        shape: "square",
      })),
    };
  const [min, max] = domain;
  if (scale === "diverging") {
    const at = (value: number) => divergingColor(value, domain, center, colors).color;
    const middle = Math.min(1, Math.max(0, normalize(center, min, max)));
    return {
      scale: {
        min,
        max,
        colors: [at(min), at(center), at(max)],
        stops: [0, middle, 1],
        format,
        label,
      },
    };
  }
  return {
    scale: {
      min,
      max,
      colors: [
        sequentialColor(min, domain, colors).color,
        sequentialColor(max, domain, colors).color,
      ],
      format,
      label,
    },
  };
}

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
 * loads its topology through ui-core's `geo/maps` (a dynamic import of a JSON chunk), once per id,
 * so a page pays only for the maps it shows. An unknown id resolves to `null`.
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
  }
  return pending;
}

// ---- hit testing on the sphere ---------------------------------------------------------------

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

/** Colors a CSS expression (a `var()`, a `color-mix()`) resolves to, for painting on a canvas. */
export function createColorResolver(host: HTMLElement): {
  resolve(css: string): string;
  clear(): void;
} {
  const cache = new Map<string, string>();
  let probe: HTMLSpanElement | undefined;
  return {
    resolve(css) {
      let value = cache.get(css);
      if (value) return value;
      probe ??= document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;color:${css}`;
      host.append(probe);
      value = getComputedStyle(probe).color;
      probe.remove();
      cache.set(css, value);
      return value;
    },
    clear: () => cache.clear(),
  };
}

/**
 * Gives an element an `aspect-ratio` that suits its content when the author set neither `height`
 * nor `aspect-ratio`, and steps aside the moment the author sets either (a tall country gets a tall
 * box, a world map a wide one). The ratio is width / height, kept within `[0.6, 2.5]`.
 */
export class AutoAspect {
  readonly #host: HTMLElement;
  #auto = false;
  #setting = false;
  constructor(host: HTMLElement) {
    this.#host = host;
  }
  apply(ratio: number | null): void {
    const host = this.#host;
    if (
      ratio === null ||
      host.hasAttribute("height") ||
      (host.hasAttribute("aspect-ratio") && !this.#auto)
    )
      return;
    this.#setting = true;
    host.setAttribute("aspect-ratio", Math.min(2.5, Math.max(0.6, ratio)).toFixed(2));
    this.#setting = false;
    this.#auto = true;
  }
  /** Call from `attributeChangedCallback`. */
  changed(name: string): void {
    if (this.#setting || !this.#auto) return;
    if (name === "aspect-ratio") this.#auto = false;
    else if (name === "height" && this.#host.hasAttribute("height")) {
      this.#setting = true;
      this.#host.removeAttribute("aspect-ratio");
      this.#setting = false;
      this.#auto = false;
    }
  }
}

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
