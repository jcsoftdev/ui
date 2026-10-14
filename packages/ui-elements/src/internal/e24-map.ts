/**
 * `GeoMapElement`: the stage shared by `ui-choropleth-map` and `ui-bubble-map`. It loads the map
 * (a bundled id or a `GeoMap` object, lazily) together with the projection and scale code, fits it to
 * the drawing, and owns the region layer, the region labels, zoom and pan. A subclass supplies the
 * fills, the overlay and `hit`/`hover`/`snapshot`.
 *
 * Weight: this module is the eager shell. The topology, `e24-kit` (projection, paths, color scale)
 * and `e24-view` (gestures and zoom buttons, fetched on the first pointer, focus or wheel) are
 * separate chunks, so a page that never touches the map never pays for them.
 */
import type { Bounds } from "@jcsoftdev/ui-core/geo/path";
import type { GeoFeature, GeoMap, ProjectionKind } from "@jcsoftdev/ui-core/geo/topology";
import type { MapView } from "@jcsoftdev/ui-core/geo/view";
import { adoptStyles, emit, rootOf } from "./base.js";
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
  loadKit,
  type MapLabels,
  type MapSource,
} from "./e24-geo.js";
import type { Kit, MapGeometry } from "./e24-kit.js";
import type { MapViewer, ZoomControls } from "./e24-view.js";

export type { MapGeometry };

const IDENTITY: MapView = { k: 1, x: 0, y: 0 };

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
 *
 * Loading: the topology of a bundled map is a separate chunk, fetched with the projection and scale
 * code when the element connects (and again on a `map` change). If it fails, or the id is unknown,
 * the element shows the empty state, fires `map-error` (`detail`: `{ map, reason }`) and draws no map
 * at all; setting `map` again, or changing the attribute, retries.
 *
 * Touch: the drawing keeps `touch-action: pan-y`. One finger scrolls the page; two fingers pan and
 * pinch; a tap (or focus) engages the map and then one finger pans too, until focus or a tap goes
 * elsewhere. The wheel zooms with Ctrl or Cmd (or always, with `wheel-zoom="always"`).
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

  #viewer: MapViewer | undefined;
  #viewerLoad: Promise<void> | undefined;
  #root: SVGSVGElement | undefined;
  #signal: AbortSignal | undefined;
  #wired = false;
  #source: MapSource;
  #map: GeoMap | null = null;
  #kit: Kit | undefined;
  #failed = false;
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
  #listeners: AbortController | undefined;

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
  /** The lazy projection and scale code; only available from the draw that follows the load. */
  protected get kit(): Kit {
    return this.#kit as Kit;
  }
  /** The zoom of the current view; the identity until the viewer has loaded. */
  protected get viewState(): MapView {
    return this.#viewer?.view ?? IDENTITY;
  }
  /** A pan is in progress: hover is ignored. */
  protected get panning(): boolean {
    return this.#viewer?.dragging ?? false;
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
        if (anchor && this.zoomable) this.#viewer?.reveal(anchor[0], anchor[1]);
      }
    });
  }

  override connectedCallback(): void {
    this.dataset.uiGeo = "";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
    this.toggleAttribute("data-zoomable", this.zoomable);
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    // The gestures and the zoom buttons are fetched by the first sign of a person.
    const wake = () => this.#wake();
    for (const type of ["pointerenter", "pointerdown", "focusin", "wheel"])
      this.drawing.addEventListener(type, wake, { signal, passive: true });
    if (matchMedia("(pointer: coarse)").matches)
      (window.requestIdleCallback ?? setTimeout)(() => this.#wake());
    this.#load();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listeners?.abort();
    this.#viewer?.stop();
    this.#wired = false;
    // Gestures were wired to a signal the base has now aborted.
    this.#signal = undefined;
    this.#root = undefined;
  }

  override attributeChangedCallback(name: string): void {
    if (name === "map" && this.#source === undefined && this.isConnected) this.#load();
    if (name === "projection" && this.#map) this.#aspect.set(this.#aspectOf(this.#map));
    if (name === "zoomable" || name === "wheel-zoom") this.#syncGestures();
    super.attributeChangedCallback(name);
  }

  #aspectOf(map: GeoMap): number | null {
    return this.#kit ? this.#kit.mapAspect(map, this.projectionKind) : null;
  }

  #syncGestures(): void {
    this.toggleAttribute("data-zoomable", this.zoomable);
    const viewer = this.#viewer;
    if (!viewer) return;
    viewer.gestures = this.zoomable;
    viewer.wheelZoom = this.getAttribute("wheel-zoom") === "always" ? "always" : "modifier";
    if (!this.zoomable) viewer.stop();
    if (this.#controls) this.#controls.root.hidden = !this.zoomable;
  }

  #wake(): void {
    if (this.#viewerLoad || !this.zoomable) return;
    this.#viewerLoad = import("./e24-view.js")
      .then(({ MapViewer, zoomControls }) => {
        this.#viewer = new MapViewer({
          request: () => this.requestDraw("transient"),
          motion: () => this.getAttribute("animate") !== "off" && !this.reduced,
          frame: () => ({
            width: this.#width,
            height: this.#height,
            content: this.#geo?.bounds ?? [0, 0, this.#width, this.#height],
            maxZoom: this.maxZoom,
          }),
          engage: (on) => {
            if (!this.hasAttribute("touch-action"))
              this.drawing.style.touchAction = on ? "none" : "pan-y";
          },
        });
        this.#controls = zoomControls(this.#viewer);
        this.#syncGestures();
        this.#wire();
        this.requestDraw("transient");
      })
      .catch(() => {
        this.#viewerLoad = undefined;
      });
  }

  #wire(): void {
    if (this.#wired || !this.#viewer || !this.#root || !this.#signal) return;
    this.#wired = true;
    this.#viewer.attach(this.#root, this.#signal, this.drawing);
  }

  #load(): void {
    const source = this.#source ?? this.getAttribute("map");
    const token = ++this.#token;
    if (!source) {
      this.#loaded(null, null);
      return;
    }
    if (typeof source !== "string") {
      loadKit().then(
        (kit) => token === this.#token && this.#loaded(source, kit),
        () => token === this.#token && this.#failure(source, "load"),
      );
      return;
    }
    Promise.all([loadGeoMap(source), loadKit()]).then(
      ([map, kit]) => {
        if (token !== this.#token) return;
        if (map) this.#loaded(map, kit);
        else this.#failure(source, "unknown");
      },
      () => {
        if (token === this.#token) this.#failure(source, "load");
      },
    );
  }

  #failure(source: MapSource, reason: "load" | "unknown"): void {
    this.#failed = true;
    this.#map = null;
    this.#geo = undefined;
    this.#geoKey = "";
    this.onMap(null);
    emit(this, "map-error", { map: typeof source === "string" ? source : null, reason });
    this.requestDraw();
  }

  #loaded(map: GeoMap | null, kit: Kit | null): void {
    this.#failed = false;
    this.#map = map;
    this.#kit = kit ?? this.#kit;
    this.#geoKey = "";
    this.#viewer?.reset();
    this.#aspect.set(map ? this.#aspectOf(map) : null);
    this.onMap(map);
    this.requestDraw();
  }

  protected override isEmpty(): boolean {
    return this.#failed;
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
    this.#root = root;
    this.#signal = signal;
    this.#wire();
    this.drawing.addEventListener(
      "keydown",
      (event) => {
        if (!this.zoomable || event.defaultPrevented || !this.#viewer) return;
        if (event.target instanceof HTMLButtonElement) return;
        if (this.#viewer.key(event)) event.preventDefault();
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
    const kit = this.#kit;
    if (!map || !kit) return null;
    this.#width = ctx.width;
    this.#height = ctx.height;
    this.#aspect.fit(ctx.width);
    const mapKind = this.projectionKind ?? map.projection;
    const key = `${map.id}|${ctx.width}|${ctx.height}|${mapKind}`;
    if (key !== this.#geoKey) {
      this.#geo = kit.fitGeometry(map, ctx.width, ctx.height, mapKind);
      this.#geoKey = key;
      this.#viewer?.reset();
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
    const view = this.viewState;
    const transform = `translate(${view.x} ${view.y}) scale(${view.k})`;
    layers.regions.setAttribute("transform", transform);
    layers.scene.setAttribute("transform", transform);
    this.toggleAttribute("data-dragging", this.panning);
    const controls = this.#controls;
    if (controls && this.#viewer) {
      controls.sync(this.mapLabels, this.#viewer);
      controls.root.hidden = !this.zoomable;
      // The base puts the SVG into the drawing after this draw returns, so the buttons go in after it.
      queueMicrotask(() => {
        if (this.isConnected && controls.root.parentNode !== this.drawing)
          this.drawing.append(controls.root);
      });
    }
    return {
      geo,
      view,
      width: ctx.width,
      height: ctx.height,
      regions: layers.regions,
      scene: layers.scene,
      overlay: layers.overlay,
      labels: layers.labels,
      toScreen: (x, y) => [x * view.k + view.x, y * view.k + view.y],
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
    if (this.panning) return -1;
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
