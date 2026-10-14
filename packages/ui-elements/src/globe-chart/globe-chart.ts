import type { ColorRange, ScaleColors } from "@jcsoftdev/ui-core/chart/color-scale";
import type { GeoMap } from "@jcsoftdev/ui-core/geo/topology";
import { adoptStyles, type DefineOptions, defineElement, emit, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
} from "../internal/chart-base.js";
import {
  AutoAspect,
  DEFAULT_MAP_LABELS,
  type MapLabels,
  MapLoader,
  type MapPoint,
  type MapRoute,
  type MapSource,
  type RegionDatum,
} from "../internal/e24-geo.js";
import type { GlobeMark, GlobeRenderer, GlobeRotation } from "../internal/e24-globe.js";
import css from "./globe-chart.css.js";

export type { GlobeMark, GlobeRotation, MapPoint, MapRoute };

const DEFAULT_ROTATION: GlobeRotation = { lon: -75, lat: -10 };

/** Longitude wrapped to [-180, 180), latitude kept off the poles (same as ui-core's `normalizeRotation`). */
const normalize = ({ lon, lat }: GlobeRotation): GlobeRotation => ({
  lon: ((((lon + 180) % 360) + 360) % 360) - 180,
  lat: Math.max(-89, Math.min(89, lat)),
});

/** What the renderer reads from the element on every draw. */
export interface GlobeInputs {
  map: GeoMap;
  data: readonly RegionDatum[];
  points: readonly MapPoint[];
  routes: readonly MapRoute[];
  ranges: readonly ColorRange[] | undefined;
}

/**
 * `<ui-globe-chart>`: the world as a globe (orthographic projection) you turn with the pointer.
 * Regions can be colored by value (a gradient legend through the chart's `scale`, or stepped
 * `ranges`), markers sized by value, and great-circle routes lifted over the surface. Drag
 * rotates it and a flick keeps turning with inertia that fades out; a press that does not move is a
 * click and pins what is under it, a drag never does. Many regions (more than 80, like the world) are
 * painted on a canvas layer under the SVG; the SVG keeps the outline, markers, routes and highlight.
 *
 * Motion: inertia and the idle spin (`auto-rotate`) stop under reduced motion and `animate="off"`,
 * and the spin also stops off screen, in a hidden tab, while the pointer or focus is on the globe, and
 * with the pause button. Nothing spins until a map has loaded.
 *
 * Touch: the drawing keeps `touch-action: pan-y`. One finger scrolls the page; two fingers rotate;
 * a tap (or focus) engages the globe and then one finger rotates too, until focus or a tap goes
 * elsewhere.
 *
 * Keyboard: the arrow keys move to the nearest mark in that direction (the globe turns to show it),
 * Home and End jump, Enter pins, Shift+arrows rotate by 10 degrees, `0` returns to the first view.
 * ARIA: the drawing is a `group` named by `label` with a listbox of marks (points first, then
 * regions); its description says where the globe is centered, and one table lists the markers and
 * the regions.
 *
 * Legend: with region values the chart's legend shows the color bar (or the ranges); the marker
 * categories and the "No data" swatch sit in a key under the drawing. Without region values the
 * categories are the chart's legend.
 *
 * Attributes: `map` (`world` default, or `peru`; or the `map` property with a `GeoMap`), `scale`,
 * `domain`, `center`, `value-name`, `graticule="off"`, `graticule-step` (30), `min-radius` (4),
 * `max-radius` (16), `auto-rotate`, `auto-rotate-speed` (8 degrees per second), `canvas` (`auto`
 * default, `on`, `off`), `rotation` (`lon,lat`), plus the chart attributes. Properties: `rotation`
 * (`{ lon, lat }`, the view center), `initialRotation` (where the reset button goes; Lima by
 * default), `data` (`{ id, value }[]`), `points`, `routes`, `colors`, `ranges`, `labels`;
 * `markInfo(index)` says what a mark index is. Events: the chart events, `rotation-change`
 * (`detail`: `{ lon, lat }`) on every turn, and `map-error` (`detail`: `{ map, reason }`) when the
 * map cannot load, after which the empty state shows; setting `map` again retries.
 */
export class UiGlobeChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "map",
    "scale",
    "domain",
    "center",
    "value-name",
    "graticule",
    "graticule-step",
    "min-radius",
    "max-radius",
    "auto-rotate",
    "auto-rotate-speed",
    "canvas",
    "rotation",
  ];
  static override retain = true;
  declare labels: Partial<ChartLabels> & Partial<MapLabels>;

  /** @internal The spin is paused by the user (the pause button). */
  paused = false;
  /** @internal The pointer or focus is on the globe: the idle spin waits. */
  hovering = false;
  /** @internal A tap or focus has engaged the globe: one finger rotates it. */
  touchEngaged = false;

  #source: MapSource;
  #map: GeoMap | null = null;
  #renderer: GlobeRenderer | undefined;
  #bound: { root: SVGSVGElement; signal: AbortSignal } | undefined;
  #failed = false;
  /** connectedCallback has run: before that, attribute callbacks of an upgrade must not start a load. */
  #started = false;
  #data: readonly RegionDatum[] = [];
  #points: readonly MapPoint[] = [];
  #routes: readonly MapRoute[] = [];
  #colors: ScaleColors | undefined;
  #ranges: readonly ColorRange[] | undefined;
  #domain: readonly [number, number] | undefined;
  #initial: GlobeRotation = DEFAULT_ROTATION;
  #rotation: GlobeRotation = normalize(DEFAULT_ROTATION);
  readonly #aspect = new AutoAspect(this);
  readonly #loader = new MapLoader(() => import("../internal/e24-globe.js"));
  #listeners: AbortController | undefined;

  get map(): MapSource {
    return this.#source ?? this.getAttribute("map") ?? "world";
  }
  set map(value: MapSource) {
    this.#source = value;
    this.#load();
  }
  get data(): readonly RegionDatum[] {
    return this.#data;
  }
  set data(value: readonly RegionDatum[]) {
    this.#data = value ?? [];
    this.requestDraw();
  }
  get points(): readonly MapPoint[] {
    return this.#points;
  }
  set points(value: readonly MapPoint[]) {
    this.#points = value ?? [];
    this.requestDraw();
  }
  get routes(): readonly MapRoute[] {
    return this.#routes;
  }
  set routes(value: readonly MapRoute[]) {
    this.#routes = value ?? [];
    this.requestDraw();
  }
  get colors(): ScaleColors | undefined {
    return this.#colors;
  }
  set colors(value: ScaleColors | undefined) {
    this.#colors = value;
    this.requestDraw();
  }
  get ranges(): readonly ColorRange[] | undefined {
    return this.#ranges;
  }
  set ranges(value: readonly ColorRange[] | undefined) {
    this.#ranges = value;
    this.requestDraw();
  }
  get domain(): readonly [number, number] | undefined {
    if (this.#domain) return this.#domain;
    const [min, max] = (this.getAttribute("domain") ?? "").split(",").map(Number);
    return Number.isFinite(min) && Number.isFinite(max)
      ? [min as number, max as number]
      : undefined;
  }
  set domain(value: readonly [number, number] | undefined) {
    this.#domain = value;
    this.requestDraw();
  }
  /** Where the reset button goes. */
  get initialRotation(): GlobeRotation {
    return this.#initial;
  }
  set initialRotation(value: GlobeRotation) {
    this.#initial = normalize(value ?? DEFAULT_ROTATION);
  }
  /** The view center. */
  get rotation(): GlobeRotation {
    return this.#rotation;
  }
  set rotation(value: GlobeRotation) {
    this.#renderer?.stopMotion();
    this.commit(normalize(value));
  }
  /** What mark `index` stands for: a point, or a region. */
  markInfo(index: number): GlobeMark | undefined {
    return this.#renderer?.markInfo(index);
  }
  get mapLabels(): MapLabels {
    return { ...DEFAULT_MAP_LABELS, ...this.labels };
  }
  /** Whether the idle spin may run now: asked for, allowed by motion settings, and a map is drawn. */
  get autoRotating(): boolean {
    return (
      this.hasAttribute("auto-rotate") &&
      this.getAttribute("animate") !== "off" &&
      !this.reduced &&
      !this.paused &&
      !this.hovering &&
      !!this.#renderer &&
      !!this.#map &&
      !this.#failed
    );
  }

  /** @internal Sets the view center and redraws; used by the renderer. */
  commit(next: GlobeRotation): void {
    this.#rotation = next;
    this.requestDraw("transient");
    emit(this, "rotation-change", { lon: next.lon, lat: next.lat });
  }

  /** @internal One finger rotates (`on`) or scrolls the page. */
  engage(on: boolean): void {
    if (this.touchEngaged === on) return;
    this.touchEngaged = on;
    if (!this.hasAttribute("touch-action")) this.drawing.style.touchAction = on ? "none" : "pan-y";
  }

  /** @internal */
  inputs(): GlobeInputs | null {
    return this.#map
      ? {
          map: this.#map,
          data: this.#data,
          points: this.#points,
          routes: this.#routes,
          ranges: this.#ranges,
        }
      : null;
  }

  /** @internal */
  scaleOptions() {
    return {
      scale:
        this.getAttribute("scale") === "diverging"
          ? ("diverging" as const)
          : ("sequential" as const),
      domain: this.domain,
      center: Number(this.getAttribute("center")) || 0,
      colors: this.#colors,
      ranges: this.#ranges,
    };
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "globe-chart";
    super.connectedCallback();
    this.#syncRotationAttribute();
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    const hover = (on: boolean) => () => {
      this.hovering = on;
      this.#renderer?.syncSpin();
    };
    this.drawing.addEventListener("pointerenter", hover(true), { signal });
    this.drawing.addEventListener("pointerleave", hover(false), { signal });
    this.drawing.addEventListener("focusin", hover(true), { signal });
    this.drawing.addEventListener("focusout", hover(false), { signal });
    this.#aspect.set(1);
    this.#started = true;
    this.#load();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#started = false;
    this.#listeners?.abort();
    this.#renderer?.destroy();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "map" && this.#source === undefined && this.#started) this.#load();
    if (name === "rotation") this.#syncRotationAttribute();
    if (name === "auto-rotate" || name === "animate") this.#renderer?.syncSpin();
    super.attributeChangedCallback(name);
  }

  #syncRotationAttribute(): void {
    const [lon, lat] = (this.getAttribute("rotation") ?? "").split(",").map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat))
      this.#rotation = normalize({ lon: lon as number, lat: lat as number });
  }

  #load(): void {
    const source = this.#source ?? this.getAttribute("map") ?? "world";
    this.#loader.load(source, {
      done: (map, lazy) => {
        this.#failed = false;
        this.#map = map;
        if (lazy && !this.#renderer) {
          this.#renderer = new lazy.GlobeRenderer(this);
          // The base ran `setup` after its first draw, which can precede the renderer: bind it now.
          if (this.#bound) this.#renderer.setup(this.#bound.root, this.#bound.signal);
        }
        this.requestDraw();
        this.#renderer?.syncSpin();
      },
      fail: (reason) => {
        this.#failed = true;
        this.#map = null;
        this.#renderer?.stopMotion();
        emit(this, "map-error", { map: typeof source === "string" ? source : null, reason });
        this.requestDraw();
      },
    });
  }

  protected override isEmpty(): boolean {
    return super.isEmpty() || this.#failed;
  }

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    this.#bound = { root, signal };
    this.#renderer?.setup(root, signal);
  }

  protected override draw(ctx: DrawContext): DrawResult | undefined {
    return this.#renderer?.draw(ctx);
  }
}

/** Registers `<ui-globe-chart>` (or `<prefix>-globe-chart`) and returns the tag. */
export function defineGlobeChart(options?: DefineOptions): string {
  return defineElement("globe-chart", UiGlobeChart, options);
}
