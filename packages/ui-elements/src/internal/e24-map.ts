/**
 * `GeoMapElement`: the stage shared by `ui-choropleth-map` and `ui-bubble-map`. It loads the map
 * (a bundled id or a `GeoMap` object, lazily), fits it to the drawing with ui-core's projections,
 * owns zoom and pan, the region layer, the region labels and the zoom buttons. A subclass supplies
 * the fills, the overlay and `hit`/`hover`/`snapshot`.
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
import { type MapView, toScreen } from "@jcsoftdev/ui-core/geo/view";
import { adoptStyles, rootOf } from "./base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type HoverInfo,
  join,
  svg,
} from "./chart-base.js";
import css from "./e24-geo.css.js";
import {
  AutoAspect,
  DEFAULT_MAP_LABELS,
  loadGeoMap,
  type MapLabels,
  type MapSource,
  mapFeatures,
} from "./e24-geo.js";
import { MapViewer, type ZoomControls, zoomControls } from "./e24-view.js";

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

function fitGeometry(
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

/** What `GeoMapElement.stage()` hands a subclass for one draw. */
export interface Stage {
  geo: MapGeometry;
  view: MapView;
  width: number;
  height: number;
  /** Zoom-1 group holding the regions (and the highlight). */
  regions: SVGGElement;
  /** Zoom-1 group over the regions that moves with them (routes). */
  scene: SVGGElement;
  /** Screen-space layer over the regions (bubbles). */
  overlay: SVGGElement;
  labels: SVGGElement;
  toScreen(x: number, y: number): [number, number];
}

const textWidth = (text: string) => text.length * 6.6;

/**
 * Base of the zoomable map elements. Attributes: `map` (a bundled id, `world` or `peru`),
 * `projection`, `zoomable="off"`, `wheel-zoom` (`modifier` default, or `always`), `max-zoom` (16),
 * plus the chart attributes. Property: `map` also takes a `GeoMap` object, `labels`.
 * The topology of a bundled map is a separate chunk, fetched when the element first needs it.
 */
export abstract class GeoMapElement extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "map",
    "projection",
    "zoomable",
    "wheel-zoom",
    "max-zoom",
  ];
  static override retain = true;
  declare labels: Partial<ChartLabels> & Partial<MapLabels>;

  protected readonly viewer = new MapViewer({
    request: () => this.requestDraw("transient"),
    motion: () => this.getAttribute("animate") !== "off" && !this.reduced,
    frame: () => ({
      width: this.#width,
      height: this.#height,
      content: this.#geo?.bounds ?? [0, 0, this.#width, this.#height],
      maxZoom: this.maxZoom,
    }),
  });
  #source: MapSource;
  #map: GeoMap | null = null;
  #token = 0;
  #width = 0;
  #height = 0;
  #geo: MapGeometry | undefined;
  #geoKey = "";
  #layers:
    | {
        root: SVGSVGElement;
        regions: SVGGElement;
        scene: SVGGElement;
        hl: SVGPathElement;
        overlay: SVGGElement;
        labels: SVGGElement;
      }
    | undefined;
  #controls: ZoomControls | undefined;
  readonly #aspect = new AutoAspect(this);

  get map(): MapSource {
    return this.#source ?? this.getAttribute("map");
  }
  set map(value: MapSource) {
    this.#source = value;
    this.#load();
  }
  /** The map being drawn, once loaded. */
  get loadedMap(): GeoMap | null {
    return this.#map;
  }
  get mapLabels(): MapLabels {
    return { ...DEFAULT_MAP_LABELS, ...this.labels };
  }
  get zoomable(): boolean {
    return this.getAttribute("zoomable") !== "off";
  }
  get maxZoom(): number {
    return Number(this.getAttribute("max-zoom")) || 16;
  }
  get projectionKind(): ProjectionKind | undefined {
    const kind = this.getAttribute("projection");
    return kind === "equirectangular" ||
      kind === "mercator" ||
      kind === "equalEarth" ||
      kind === "fitted"
      ? kind
      : undefined;
  }

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      this.onHover(info);
      if (info?.source === "keyboard") {
        const anchor = this.revealAt(info.index);
        if (anchor && this.zoomable) this.viewer.reveal(anchor[0], anchor[1]);
      }
    });
  }

  override connectedCallback(): void {
    this.dataset.uiGeo = "";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
    this.#syncGestures();
    this.#load();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.viewer.stop();
  }

  override attributeChangedCallback(name: string): void {
    this.#aspect.changed(name);
    if (name === "map" && this.#source === undefined && this.isConnected) this.#load();
    if (name === "zoomable" || name === "wheel-zoom") this.#syncGestures();
    super.attributeChangedCallback(name);
  }

  #syncGestures(): void {
    this.viewer.gestures = this.zoomable;
    this.viewer.wheelZoom = this.getAttribute("wheel-zoom") === "always" ? "always" : "modifier";
    this.drawing.style.touchAction = this.zoomable ? "none" : "pan-y";
    this.toggleAttribute("data-zoomable", this.zoomable);
  }

  #load(): void {
    const source = this.#source ?? this.getAttribute("map");
    const token = ++this.#token;
    if (!source) {
      this.#loaded(null);
      return;
    }
    if (typeof source !== "string") {
      this.#loaded(source);
      return;
    }
    loadGeoMap(source).then((map) => {
      if (token === this.#token) this.#loaded(map);
    });
  }

  #loaded(map: GeoMap | null): void {
    this.#map = map;
    this.#geoKey = "";
    this.viewer.reset();
    this.#aspect.apply(map ? 1 / mapAspect(map, this.projectionKind) : null);
    this.onMap(map);
    this.requestDraw();
  }

  /** The map arrived (or was cleared). */
  protected onMap(_map: GeoMap | null): void {}
  /** The hover or pinned details changed. */
  protected onHover(info: HoverInfo | null): void {
    const hl = this.#layers?.hl;
    if (hl)
      hl.setAttribute(
        "d",
        info && this.highlightRegions ? (this.#geo?.paths[info.index] ?? "") : "",
      );
  }
  /** Whether hovering mark `index` highlights that region's outline. */
  protected highlightRegions = true;
  /** The zoom-1 point to keep in view when the keyboard moves to mark `index` (a region's anchor by default). */
  protected revealAt(index: number): readonly [number, number] | null | undefined {
    return this.#geo?.anchors[index];
  }

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    this.viewer.attach(root, signal);
    this.drawing.addEventListener(
      "keydown",
      (event) => {
        if (!this.zoomable || event.defaultPrevented) return;
        if (event.target instanceof HTMLButtonElement) return;
        if (this.viewer.key(event)) event.preventDefault();
      },
      { signal },
    );
  }

  /**
   * Fits the map to the drawing and returns the layers to paint, or `null` while there is no map
   * (nothing is drawn, and the draw that follows the load is a fresh `enter`).
   */
  protected stage(ctx: DrawContext): Stage | null {
    const map = this.#map;
    if (!map) return null;
    this.#width = ctx.width;
    this.#height = ctx.height;
    const kind = this.projectionKind ?? map.projection;
    const key = `${map.id}|${ctx.width}|${ctx.height}|${kind}`;
    if (key !== this.#geoKey) {
      this.#geo = fitGeometry(map, ctx.width, ctx.height, kind);
      this.#geoKey = key;
      this.viewer.reset();
    }
    const geo = this.#geo as MapGeometry;
    if (ctx.phase === "enter" || !this.#layers || this.#layers.root !== ctx.svg) {
      ctx.svg.replaceChildren();
      const regions = svg("g", { "data-layer": "regions" });
      const hl = svg("path", { "data-hl": "", fill: "none", "fill-rule": "evenodd" });
      const scene = svg("g", { "data-layer": "scene" });
      const overlay = svg("g", { "data-layer": "overlay" });
      const labels = svg("g", { "data-layer": "labels", "aria-hidden": "true" });
      regions.append(hl);
      ctx.svg.append(regions, scene, overlay, labels);
      this.#layers = { root: ctx.svg, regions, scene, hl, overlay, labels };
    }
    const layers = this.#layers;
    const view = this.viewer.view;
    const transform = `translate(${view.x} ${view.y}) scale(${view.k})`;
    layers.regions.setAttribute("transform", transform);
    layers.scene.setAttribute("transform", transform);
    this.toggleAttribute("data-dragging", this.viewer.dragging);
    this.#controls ??= zoomControls(this.viewer);
    const controls = this.#controls;
    controls.sync(this.mapLabels, this.viewer);
    controls.root.hidden = !this.zoomable;
    // The base puts the SVG into the drawing after this draw returns, so the buttons go in after it.
    queueMicrotask(() => {
      if (this.isConnected && controls.root.parentNode !== this.drawing)
        this.drawing.append(controls.root);
    });
    return {
      geo,
      view,
      width: ctx.width,
      height: ctx.height,
      regions: layers.regions,
      scene: layers.scene,
      overlay: layers.overlay,
      labels: layers.labels,
      toScreen: (x, y) => toScreen(view, x, y),
    };
  }

  /** Draws one path per region (keyed by id); returns them in region order, for marks. */
  protected paintRegions(stage: Stage, fills: readonly string[]): SVGPathElement[] {
    const { features, paths } = stage.geo;
    const hl = this.#layers?.hl;
    const items = features.map((_, index) => index);
    const elements = join(
      stage.regions,
      items,
      (index) => (features[index] as GeoFeature).id,
      () => svg("path", { "data-region": "", "fill-rule": "evenodd" }),
      (el, index) => {
        el.dataset.i = `${index}`;
        const d = paths[index] as string;
        if (el.getAttribute("d") !== d) el.setAttribute("d", d);
        el.style.fill = fills[index] ?? "";
      },
    );
    // The highlight stays on top of the regions.
    if (hl && stage.regions.lastChild !== hl) stage.regions.append(hl);
    this.onHover(this.hover);
    return elements;
  }

  /** Writes `texts[i]` on region `i` where it fits (largest regions first, no overlaps). */
  protected paintLabels(stage: Stage, texts: ReadonlyArray<string | null> | undefined): void {
    const placed: Array<{ index: number; x: number; y: number; text: string }> = [];
    if (texts) {
      const { boxes, anchors } = stage.geo;
      const order = boxes
        .map((box, index) => ({ index, area: (box[2] - box[0]) * (box[3] - box[1]) }))
        .sort((a, b) => b.area - a.area);
      const taken: Array<[number, number, number, number]> = [];
      for (const { index } of order) {
        const text = texts[index];
        const box = boxes[index];
        const anchor = anchors[index];
        if (!text || !box || !anchor) continue;
        const w = textWidth(text) * 1.05;
        if ((box[2] - box[0]) * stage.view.k < w + 8 || (box[3] - box[1]) * stage.view.k < 16)
          continue;
        const [x, y] = stage.toScreen(anchor[0], anchor[1]);
        if (x < w / 2 || x > stage.width - w / 2 || y < 8 || y > stage.height - 8) continue;
        const rect: [number, number, number, number] = [x - w / 2, y - 7, x + w / 2, y + 7];
        if (taken.some((t) => rect[0] < t[2] && rect[2] > t[0] && rect[1] < t[3] && rect[3] > t[1]))
          continue;
        taken.push(rect);
        placed.push({ index, x, y, text });
      }
    }
    join(
      stage.labels,
      placed,
      (item) => item.index,
      () => svg("text", { "text-anchor": "middle", "dominant-baseline": "central" }),
      (el, item) => {
        el.setAttribute("x", `${item.x}`);
        el.setAttribute("y", `${item.y}`);
        if (el.textContent !== item.text) el.textContent = item.text;
      },
    );
  }

  /** Region under the pointer, from the element the pointer is on. */
  protected regionOf(target: Element | null): number {
    if (this.viewer.dragging) return -1;
    const hit = target?.closest?.("path[data-i]");
    return hit ? Number((hit as SVGElement).dataset.i) : -1;
  }

  /** Tooltip anchor of a zoom-1 point, kept inside the drawing. */
  protected anchorOf(stage: Stage, x: number, y: number): { x: number; y: number } {
    const [sx, sy] = stage.toScreen(x, y);
    return {
      x: Math.min(stage.width - 4, Math.max(4, sx)),
      y: Math.min(stage.height - 4, Math.max(4, sy)),
    };
  }
}
