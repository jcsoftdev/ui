import {
  type ColorRange,
  rangeIndex,
  type ScaleColors,
} from "@jcsoftdev/ui-core/chart/color-scale";
import { seriesColor } from "@jcsoftdev/ui-core/chart/palette";
import {
  applyMatrix,
  dragRotation,
  type GlobeDisc,
  type GlobeRotation,
  globeArc,
  globeLinePieces,
  globeRingsPath,
  graticuleLines,
  invertOrthographic,
  keyRotation,
  normalizeRotation,
  projectOrthographic,
  spinRotation,
  toVec,
  type Vec3,
  viewMatrix,
} from "@jcsoftdev/ui-core/geo/globe";
import { createRegionIndex } from "@jcsoftdev/ui-core/geo/match";
import { geometryExtent, labelAnchor } from "@jcsoftdev/ui-core/geo/path";
import { routePolylinePath } from "@jcsoftdev/ui-core/geo/routes";
import { type GeoFeature, type GeoMap, geometryRings } from "@jcsoftdev/ui-core/geo/topology";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  emit,
  rootOf,
  uid,
} from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  join,
  svg,
} from "../internal/chart-base.js";
import { SR_ONLY } from "../internal/chart-dom.js";
import {
  colorScale,
  createColorResolver,
  DEFAULT_MAP_LABELS,
  finiteValues,
  geometryContains,
  legendFor,
  loadGeoMap,
  type MapLabels,
  type MapPoint,
  type MapRoute,
  type MapSource,
  mapFeatures,
  type RegionDatum,
  type RegionInfo,
  resolveRoutes,
} from "../internal/e24-geo.js";
import css from "./globe-chart.css.js";

export type { GlobeRotation, MapPoint, MapRoute };

const NO_DATA_FILL = "var(--surface-2)";
const DEFAULT_ROTATION: GlobeRotation = { lon: -75, lat: -10 };
/** More regions than this are painted on a canvas (the world has 176). */
const CANVAS_FROM = 80;
const DRAG_SLOP = 4;
/** Exponential decay of a flick, in ms. */
const INERTIA_TAU = 325;
const MIN_SPEED = 0.004;

const ringCache = new WeakMap<GeoMap, Vec3[][][]>();
const extentCache = new WeakMap<GeoFeature[], ReturnType<typeof geometryExtent>[]>();
const anchorCache = new WeakMap<GeoFeature, readonly [number, number]>();

/** World vectors of every ring of every region (once per map). */
function featureRings(map: GeoMap): Vec3[][][] {
  let rings = ringCache.get(map);
  if (!rings) {
    rings = mapFeatures(map).map((feature) =>
      geometryRings(feature.geometry).map((ring) => ring.map((position) => toVec(position))),
    );
    ringCache.set(map, rings);
  }
  return rings;
}

const labelOf = (feature: GeoFeature) => {
  let anchor = anchorCache.get(feature);
  if (!anchor) {
    anchor = labelAnchor(feature.geometry);
    anchorCache.set(feature, anchor);
  }
  return anchor;
};

/** What mark `index` of the globe stands for. */
export type GlobeMark = { kind: "point"; point: MapPoint } | ({ kind: "region" } & RegionInfo);

interface Marker {
  point: MapPoint;
  index: number;
  x: number;
  y: number;
  radius: number;
  color: string;
}

/**
 * `<ui-globe-chart>`: the world as a globe (orthographic projection) you turn with the pointer.
 * Regions can be colored by value (a gradient legend through the chart's `scale`, or stepped
 * `ranges`), markers sized by value, and great-circle routes lifted over the surface. Drag
 * rotates it and a flick keeps turning with inertia that fades out (no inertia, no idle spin with
 * reduced motion or `animate="off"`); a press that does not move is a click and pins what is under
 * it, a drag never does. Many regions (more than 80, like the world) are painted on a canvas layer
 * under the SVG; the SVG keeps the outline, markers, routes and highlight.
 *
 * Keyboard: the arrow keys step through markers, then regions (the globe turns to show each),
 * Home and End jump, Enter pins, Shift+arrows rotate by 10 degrees, `0` returns to the first view.
 * ARIA: the drawing is a `group` named by `label` with a listbox of marks; its description says
 * where the globe is centered, and the numbers are also a screen-reader table.
 *
 * Attributes: `map` (`world` default, or `peru`; or the `map` property with a `GeoMap`),
 * `scale`, `domain`, `center`, `value-name`, `graticule="off"`, `graticule-step` (30),
 * `min-radius` (4), `max-radius` (16), `auto-rotate`, `auto-rotate-speed` (8 degrees per second),
 * `canvas` (`auto` default, `on`, `off`), plus the chart attributes. Properties: `rotation`
 * (`{ lon, lat }`, the view center), `initialRotation` (where the reset button goes; Lima by
 * default), `data` (`{ id, value }[]`), `points`, `routes`, `colors`, `ranges`, `labels`;
 * `markInfo(index)` says what a mark index is. Events: the chart events, and `rotation-change`
 * (`detail`: `{ lon, lat }`) on every turn.
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
  static override touchAction = "none";
  declare labels: Partial<ChartLabels> & Partial<MapLabels>;

  #source: MapSource;
  #map: GeoMap | null = null;
  #token = 0;
  #data: readonly RegionDatum[] = [];
  #points: readonly MapPoint[] = [];
  #routes: readonly MapRoute[] = [];
  #colors: ScaleColors | undefined;
  #ranges: readonly ColorRange[] | undefined;
  #domain: readonly [number, number] | undefined;
  #initial: GlobeRotation = DEFAULT_ROTATION;
  #rotation: GlobeRotation = normalizeRotation(DEFAULT_ROTATION);
  #disc: GlobeDisc = { cx: 0, cy: 0, radius: 0 };
  #motion = true;
  #paused = false;
  #engaged = false;
  #press:
    | {
        x: number;
        y: number;
        moved: number;
        samples: Array<{ t: number; lon: number; lat: number }>;
      }
    | undefined;
  #dragging = false;
  #dragged = false;
  #velocity = { lon: 0, lat: 0 };
  #frame = 0;
  #spin = 0;
  #tween = 0;
  #layers:
    | {
        root: SVGSVGElement;
        land: SVGGElement;
        graticule: SVGPathElement;
        routes: SVGGElement;
        markers: SVGGElement;
        hl: SVGPathElement;
        shade: SVGCircleElement;
        ring: SVGCircleElement;
        disc: SVGCircleElement;
        clip: SVGCircleElement;
      }
    | undefined;
  #controls:
    | { root: HTMLElement; reset: HTMLButtonElement; spin: HTMLButtonElement; live: HTMLElement }
    | undefined;
  #colorsOf = createColorResolver(this);
  #uid = uid("globe");
  #model:
    | {
        regions: Array<{ id: string; name: string; value: number | null; color: string }>;
        domain: readonly [number, number];
        options: ReturnType<UiGlobeChart["scaleOptions"]>;
      }
    | undefined;
  #markers: Marker[] = [];
  #markCount = 0;
  #announce = 0;
  #lastAnnounced = "";

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
    this.#initial = normalizeRotation(value ?? DEFAULT_ROTATION);
  }
  /** The view center. */
  get rotation(): GlobeRotation {
    return this.#rotation;
  }
  set rotation(value: GlobeRotation) {
    this.#stopMotion();
    this.#turn(normalizeRotation(value), false);
  }
  markInfo(index: number): GlobeMark | undefined {
    const point = this.#points[this.#markers.find((m) => m.index === index)?.index ?? -1];
    void point;
    return this.#markInfo(index);
  }
  get mapLabels(): MapLabels {
    return { ...DEFAULT_MAP_LABELS, ...this.labels };
  }
  get autoRotating(): boolean {
    return (
      this.hasAttribute("auto-rotate") &&
      this.#motion &&
      !this.#paused &&
      !this.#engaged &&
      !this.#dragging
    );
  }

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) => {
      const info = (event as CustomEvent<HoverInfo | null>).detail;
      this.#highlight(info);
      if (info?.source === "keyboard") this.#reveal(info.index);
    });
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "globe-chart";
    super.connectedCallback();
    this.drawing.style.touchAction = "none";
    this.#syncRotationAttribute();
    this.#load();
    const engage = (on: boolean) => () => {
      this.#engaged = on || this.#press !== undefined;
      this.#syncSpin();
    };
    this.#listeners = new AbortController();
    const { signal } = this.#listeners;
    this.drawing.addEventListener("pointerenter", engage(true), { signal });
    this.drawing.addEventListener("pointerleave", engage(false), { signal });
    this.drawing.addEventListener("focusin", engage(true), { signal });
    this.drawing.addEventListener("focusout", engage(false), { signal });
  }
  #listeners: AbortController | undefined;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listeners?.abort();
    this.#stopMotion();
    cancelAnimationFrame(this.#spin);
    this.#spin = 0;
    clearTimeout(this.#announce);
  }

  override attributeChangedCallback(name: string): void {
    if (name === "map" && this.#source === undefined && this.isConnected) this.#load();
    if (name === "rotation") this.#syncRotationAttribute();
    if (name === "auto-rotate" || name === "animate") this.#syncSpin();
    super.attributeChangedCallback(name);
  }

  #syncRotationAttribute(): void {
    const [lon, lat] = (this.getAttribute("rotation") ?? "").split(",").map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat))
      this.#rotation = normalizeRotation({ lon: lon as number, lat: lat as number });
  }

  #load(): void {
    const source = this.#source ?? this.getAttribute("map") ?? "world";
    const token = ++this.#token;
    if (typeof source !== "string") {
      this.#map = source;
      this.requestDraw();
      return;
    }
    loadGeoMap(source).then((map) => {
      if (token !== this.#token) return;
      this.#map = map;
      this.requestDraw();
    });
  }

  protected override isEmpty(): boolean {
    return !!this.#map && mapFeatures(this.#map).length === 0;
  }

  // ---- rotation ------------------------------------------------------------------------------

  #turn(next: GlobeRotation, user: boolean): void {
    this.#rotation = next;
    this.requestDraw("transient");
    emit(this, "rotation-change", { lon: next.lon, lat: next.lat });
    if (user) this.#announceSoon();
  }

  #announceSoon(): void {
    clearTimeout(this.#announce);
    this.#announce = window.setTimeout(() => {
      const text = this.mapLabels.centerAt(this.#rotation.lon, this.#rotation.lat);
      if (this.#controls && text !== this.#lastAnnounced) {
        this.#lastAnnounced = text;
        this.#controls.live.textContent = text;
      }
    }, 400);
  }

  #stopMotion(): void {
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#tween);
    this.#frame = 0;
    this.#tween = 0;
    this.#velocity = { lon: 0, lat: 0 };
  }

  /** Turns to `target` over a short tween (at once without motion). */
  #turnTo(target: GlobeRotation): void {
    this.#stopMotion();
    const goal = normalizeRotation(target);
    if (!this.#motion) {
      this.#turn(goal, true);
      return;
    }
    const from = this.#rotation;
    const dLon = ((goal.lon - from.lon + 540) % 360) - 180;
    const dLat = goal.lat - from.lat;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 360);
      const e = 1 - (1 - t) ** 3;
      this.#turn(normalizeRotation({ lon: from.lon + dLon * e, lat: from.lat + dLat * e }), true);
      if (t < 1) this.#tween = requestAnimationFrame(step);
    };
    this.#tween = requestAnimationFrame(step);
  }

  #inertia(): void {
    const { lon, lat } = this.#velocity;
    if (!this.#motion || Math.hypot(lon, lat) < MIN_SPEED) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const decay = Math.exp(-dt / INERTIA_TAU);
      this.#velocity = { lon: this.#velocity.lon * decay, lat: this.#velocity.lat * decay };
      if (Math.hypot(this.#velocity.lon, this.#velocity.lat) < MIN_SPEED) {
        this.#frame = 0;
        return;
      }
      this.#turn(
        normalizeRotation({
          lon: this.#rotation.lon + this.#velocity.lon * dt,
          lat: this.#rotation.lat + this.#velocity.lat * dt,
        }),
        true,
      );
      this.#frame = requestAnimationFrame(step);
    };
    this.#frame = requestAnimationFrame(step);
  }

  #syncSpin(): void {
    if (this.autoRotating) {
      if (this.#spin) return;
      let last = performance.now();
      const step = (now: number) => {
        if (!this.autoRotating || !this.isConnected) {
          this.#spin = 0;
          return;
        }
        const seconds = Math.min(0.1, (now - last) / 1000);
        last = now;
        this.#turn(
          spinRotation(
            this.#rotation,
            seconds,
            Number(this.getAttribute("auto-rotate-speed")) || 8,
          ),
          false,
        );
        this.#spin = requestAnimationFrame(step);
      };
      this.#spin = requestAnimationFrame(step);
    } else {
      cancelAnimationFrame(this.#spin);
      this.#spin = 0;
    }
  }

  // ---- input (the base owns hover, tap, keyboard and selection) ---------------------------------

  protected override setup(root: SVGSVGElement, signal: AbortSignal): void {
    const opts = { signal };
    const themes = () => {
      this.#colorsOf.clear();
      this.requestDraw("transient");
    };
    const observer = new MutationObserver(themes);
    observer.observe(document.documentElement, { attributes: true });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themes, opts);
    signal.addEventListener("abort", () => observer.disconnect());

    root.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        this.#stopMotion();
        this.#dragged = false;
        this.#press = {
          x: event.clientX,
          y: event.clientY,
          moved: 0,
          samples: [{ t: event.timeStamp, ...this.#rotation }],
        };
        this.#engaged = true;
        try {
          root.setPointerCapture(event.pointerId);
        } catch {
          // The pointer is already gone.
        }
      },
      opts,
    );
    root.addEventListener(
      "pointermove",
      (event) => {
        const press = this.#press;
        if (!press) return;
        const dx = event.clientX - press.x;
        const dy = event.clientY - press.y;
        press.x = event.clientX;
        press.y = event.clientY;
        press.moved += Math.abs(dx) + Math.abs(dy);
        if (press.moved <= DRAG_SLOP) return;
        // The drag is the globe's own gesture: it must never become a selection.
        event.preventDefault();
        this.#dragged = true;
        if (!this.#dragging) {
          this.#dragging = true;
          this.toggleAttribute("data-dragging", true);
        }
        this.#turn(dragRotation(this.#rotation, dx, dy, this.#disc.radius), true);
        press.samples.push({ t: event.timeStamp, ...this.#rotation });
        while (press.samples.length > 2 && event.timeStamp - (press.samples[0]?.t ?? 0) > 90)
          press.samples.shift();
      },
      opts,
    );
    const release = (event: PointerEvent) => {
      const press = this.#press;
      if (!press) return;
      if (this.#dragged) event.preventDefault();
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      this.#press = undefined;
      this.#dragging = false;
      this.toggleAttribute("data-dragging", false);
      this.#engaged = this.drawing.matches(":hover, :focus-within");
      if (this.#dragged && event.type === "pointerup") {
        const first = press.samples[0];
        const last = press.samples[press.samples.length - 1];
        const span = first && last ? last.t - first.t : 0;
        if (first && last && span > 0 && event.timeStamp - last.t < 80) {
          const dLon = ((last.lon - first.lon + 540) % 360) - 180;
          this.#velocity = { lon: dLon / span, lat: (last.lat - first.lat) / span };
          this.#inertia();
        }
      }
      this.#syncSpin();
    };
    root.addEventListener("pointerup", release, opts);
    root.addEventListener("pointercancel", release, opts);
    root.addEventListener(
      "click",
      (event) => {
        if (this.#dragged) event.preventDefault();
      },
      opts,
    );
    // The keys the globe keeps for itself; the arrows without Shift step through the marks.
    this.drawing.addEventListener(
      "keydown",
      (event) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target instanceof HTMLButtonElement) return;
        if (event.key === "0") {
          this.#turnTo(this.#initial);
        } else if (event.shiftKey && event.key.startsWith("Arrow")) {
          const next = keyRotation(this.#rotation, event.key, 10);
          if (!next) return;
          this.#stopMotion();
          this.#turn(next, true);
        } else return;
        event.preventDefault();
      },
      opts,
    );
  }

  #ensureControls(): NonNullable<UiGlobeChart["_controls"]> {
    if (this.#controls) return this.#controls;
    const root = document.createElement("div");
    root.dataset.uiPart = "globe-controls";
    const button = (kind: string, run: () => void) => {
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.kind = kind;
      el.addEventListener("click", run);
      return el;
    };
    const reset = button("reset", () => this.#turnTo(this.#initial));
    const spin = button("spin", () => {
      this.#paused = !this.#paused;
      this.#syncSpin();
      this.requestDraw("transient");
    });
    spin.setAttribute("aria-pressed", "false");
    const live = document.createElement("span");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.style.cssText = SR_ONLY;
    root.append(reset, spin);
    this.#controls = { root, reset, spin, live };
    return this.#controls;
  }
  declare _controls: {
    root: HTMLElement;
    reset: HTMLButtonElement;
    spin: HTMLButtonElement;
    live: HTMLElement;
  };

  // ---- model ---------------------------------------------------------------------------------

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

  #markInfo(index: number): GlobeMark | undefined {
    const points = this.#points;
    if (index < points.length) {
      const point = points[index];
      return point && { kind: "point", point };
    }
    const region = this.#model?.regions[index - points.length];
    return region && { kind: "region", index: index - points.length, ...region };
  }

  #highlight(info: HoverInfo | null): void {
    const hl = this.#layers?.hl;
    if (!hl || !this.#map) return;
    const index = info ? info.index - this.#points.length : -1;
    const rings = featureRings(this.#map)[index];
    hl.setAttribute("d", rings ? globeRingsPath(rings, this.#rotation, this.#disc) : "");
  }

  /** Turns the globe so mark `index` is in view (the keyboard moved to it). */
  #reveal(index: number): void {
    const map = this.#map;
    if (!map) return;
    let position: readonly [number, number] | undefined;
    const point = this.#points[index];
    if (point) position = [point.lon, point.lat];
    else {
      const feature = mapFeatures(map)[index - this.#points.length];
      if (feature) position = labelOf(feature);
    }
    if (!position) return;
    const visible = projectOrthographic(position, this.#rotation, this.#disc);
    const { cx, cy, radius } = this.#disc;
    if (visible && Math.hypot(visible[0] - cx, visible[1] - cy) < radius * 0.8) return;
    this.#turnTo({ lon: position[0], lat: position[1] });
  }

  // ---- draw ----------------------------------------------------------------------------------

  protected override draw(ctx: DrawContext): DrawResult | undefined {
    const map = this.#map;
    if (!map) return undefined;
    this.#motion = ctx.motion;
    if (!ctx.motion) this.#syncSpin();
    const labels = this.mapLabels;
    const features = mapFeatures(map);
    const rings = featureRings(map);
    const rotation = this.#rotation;
    const disc: GlobeDisc = {
      cx: ctx.width / 2,
      cy: ctx.height / 2,
      radius: Math.max(24, Math.min(ctx.width, ctx.height) / 2 - 6),
    };
    this.#disc = disc;
    const name = this.getAttribute("value-name") || labels.value;

    if (!ctx.transient || !this.#model) this.#model = this.#buildModel(ctx, features);
    const model = this.#model;
    const points = this.#points;
    const useCanvas =
      this.getAttribute("canvas") === "on" ||
      (this.getAttribute("canvas") !== "off" && features.length > CANVAS_FROM);

    const layers =
      this.#layers?.root === ctx.svg && ctx.phase !== "enter"
        ? this.#layers
        : this.#build(ctx.svg, disc);
    this.#layers = layers;
    for (const circle of [layers.clip, layers.disc, layers.shade, layers.ring]) {
      circle.setAttribute("cx", `${disc.cx}`);
      circle.setAttribute("cy", `${disc.cy}`);
      circle.setAttribute("r", `${disc.radius}`);
    }
    layers.disc.toggleAttribute("hidden", useCanvas);
    layers.disc.setAttribute("display", useCanvas ? "none" : "inline");

    const graticuleOn = this.getAttribute("graticule") !== "off";
    const step = Number(this.getAttribute("graticule-step")) || 30;
    const lines = graticuleOn ? this.#graticule(step) : [];
    const graticuleD = routePolylinePath(
      lines.flatMap((line) => globeLinePieces(line, rotation, disc)),
    );

    if (useCanvas) {
      const g = ctx.canvas();
      const colorOf = (css: string) => this.#colorsOf.resolve(css);
      g.fillStyle = colorOf("var(--sunken)");
      g.beginPath();
      g.arc(disc.cx, disc.cy, disc.radius, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.clip();
      if (graticuleD) {
        g.strokeStyle = colorOf("var(--line)");
        g.lineWidth = 0.75;
        g.stroke(new Path2D(graticuleD));
      }
      g.strokeStyle = colorOf("var(--surface)");
      g.lineWidth = 0.6;
      g.lineJoin = "round";
      rings.forEach((featureRings, index) => {
        const d = globeRingsPath(featureRings, rotation, disc);
        if (!d) return;
        const path = new Path2D(d);
        g.fillStyle = colorOf((model.regions[index] as { color: string }).color);
        g.fill(path, "evenodd");
        g.stroke(path);
      });
      g.restore();
      layers.land.replaceChildren();
      layers.graticule.setAttribute("d", "");
    } else {
      layers.graticule.setAttribute("d", graticuleD);
      join(
        layers.land,
        features,
        (feature) => feature.id,
        () => svg("path", { "data-region": "", "fill-rule": "evenodd" }),
        (el, _feature, index) => {
          const d = globeRingsPath(rings[index] as Vec3[][], rotation, disc);
          if (el.getAttribute("d") !== d) el.setAttribute("d", d);
          el.style.fill = (model.regions[index] as { color: string }).color;
        },
      );
    }

    // Markers on the visible side.
    const values = points.flatMap((point) => (point.value == null ? [] : [point.value]));
    const top = Math.max(1, ...values);
    const minRadius = Number(this.getAttribute("min-radius")) || 4;
    const maxRadius = Number(this.getAttribute("max-radius")) || 16;
    const categories: string[] = [];
    for (const point of points)
      if (point.category && !categories.includes(point.category)) categories.push(point.category);
    const markers = points.flatMap((point, index): Marker[] => {
      if (point.category && this.isHidden(point.category)) return [];
      const at = projectOrthographic([point.lon, point.lat], rotation, disc);
      if (!at) return [];
      const share = point.value == null ? 0 : Math.sqrt(point.value / top);
      const category = point.category ? categories.indexOf(point.category) : -1;
      return [
        {
          point,
          index,
          x: at[0],
          y: at[1],
          radius: point.value == null ? minRadius : minRadius + (maxRadius - minRadius) * share,
          color: category >= 0 ? seriesColor(category) : "var(--accent)",
        },
      ];
    });
    this.#markers = markers;
    const markerEls = join(
      layers.markers,
      markers,
      (marker) => marker.point.id,
      () => svg("circle", { "data-marker": "", "fill-opacity": 0.78 }),
      (el, marker) => {
        el.dataset.i = `${marker.index}`;
        el.dataset.series = marker.point.category ?? "";
        el.setAttribute("cx", `${marker.x}`);
        el.setAttribute("cy", `${marker.y}`);
        el.setAttribute("r", `${marker.radius}`);
        el.style.fill = marker.color;
      },
    );
    const markerOf = new Map(
      markers.map((marker, i) => [marker.index, markerEls[i] as SVGElement]),
    );

    // Routes: great circles lifted a little over the surface.
    const arcs = resolveRoutes(this.#routes, points);
    join(
      layers.routes,
      arcs,
      (arc) => arc.route.id,
      () => svg("path", { "data-route": "" }),
      (el, arc) => {
        el.setAttribute(
          "d",
          routePolylinePath(globeLinePieces(globeArc(arc.from, arc.to, 56, 0.07), rotation, disc)),
        );
        el.style.stroke = arc.route.color ?? "var(--accent-word)";
        el.setAttribute(
          "stroke-width",
          `${arc.route.value == null ? 1.6 : 1 + Math.min(3, Math.sqrt(arc.route.value) / 6)}`,
        );
      },
    );

    const count = points.length + features.length;
    this.#markCount = count;
    this.#highlight(this.hover);
    this.#syncControls(labels);
    const centerText = labels.centerAt(rotation.lon, rotation.lat);
    const text = (index: number) => {
      const value = model.regions[index]?.value;
      return value == null ? labels.noData : ctx.format(value);
    };
    const hasData = this.#data.length > 0;

    return {
      label: map.name,
      summary: `${centerText}. ${features.length} regions${points.length ? `, ${points.length} markers` : ""}`,
      marks: {
        count,
        label: (index) => {
          const point = points[index];
          if (point)
            return point.value == null
              ? point.name
              : `${point.name}, ${name}: ${ctx.format(point.value)}`;
          const region = index - points.length;
          return `${model.regions[region]?.name}: ${text(region)}`;
        },
        element: (index) => markerOf.get(index) ?? null,
      },
      hit: (x, y, _target, radius) => {
        if (this.#dragging) return -1;
        // Markers sit over the land; a finger gets some slack around them.
        const slack = Math.min(radius, 22);
        let best = -1;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const marker of markers) {
          const d = Math.hypot(marker.x - x, marker.y - y);
          if (d > Math.max(marker.radius, slack)) continue;
          const score = d <= marker.radius ? marker.radius : 1000 + d;
          if (score < bestScore) {
            best = marker.index;
            bestScore = score;
          }
        }
        if (best >= 0) return best;
        const at = invertOrthographic(x, y, rotation, disc);
        if (!at) return -1;
        const extents = this.#extents(features);
        for (let i = 0; i < features.length; i += 1) {
          const [west, south, east, north] = extents[i] as ReturnType<typeof geometryExtent>;
          if (at[0] < west || at[0] > east || at[1] < south || at[1] > north) continue;
          if (geometryContains((features[i] as GeoFeature).geometry, at[0], at[1]))
            return points.length + i;
        }
        return -1;
      },
      hover: (index) => {
        const point = points[index];
        if (point) {
          const at = projectOrthographic([point.lon, point.lat], rotation, disc) ?? [
            disc.cx,
            disc.cy,
          ];
          return {
            title: point.name,
            rows:
              point.value == null
                ? []
                : [{ id: "value", name, value: ctx.format(point.value), color: "var(--accent)" }],
            x: at[0],
            y: at[1] - 8,
            side: "top",
          };
        }
        const region = model.regions[index - points.length];
        const feature = features[index - points.length];
        if (!region || !feature) return null;
        // Anchor on the region's label point; behind the globe, on the nearest point of the rim.
        const v = applyMatrix(viewMatrix(rotation), toVec(labelOf(feature)));
        const norm = v[2] >= 0 ? 1 : Math.hypot(v[0], v[1]) || 1;
        return {
          title: region.name,
          rows: [{ id: "value", name, value: text(index - points.length), color: region.color }],
          x: disc.cx + (disc.radius * v[0]) / norm,
          y: disc.cy - (disc.radius * v[1]) / norm,
          side: "top",
        };
      },
      maxHoverRows: 1,
      snapshot: () => this.#snapshot(ctx, labels, map, features, model, name, hasData),
    };
  }

  #extents(features: GeoFeature[]) {
    let extents = extentCache.get(features);
    if (!extents) {
      extents = features.map((feature) => geometryExtent(feature.geometry));
      extentCache.set(features, extents);
    }
    return extents;
  }

  #graticuleCache: { step: number; lines: Vec3[][] } | undefined;
  #graticule(step: number): Vec3[][] {
    if (this.#graticuleCache?.step !== step)
      this.#graticuleCache = {
        step,
        lines: graticuleLines(step).map((line) => line.map((position) => toVec(position))),
      };
    return this.#graticuleCache.lines;
  }

  #buildModel(ctx: DrawContext, features: GeoFeature[]) {
    const options = this.scaleOptions();
    const scale = colorScale(finiteValues(this.#data), options);
    const lookup = createRegionIndex(this.#data);
    const ranges = this.#ranges;
    const regions = features.map((feature) => {
      const raw = lookup(feature)?.value;
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      const stop = value == null ? null : scale.color(value);
      const hidden =
        value != null && ranges?.length && this.isHidden(`range-${rangeIndex(value, ranges)}`);
      return {
        id: feature.id,
        name: feature.name,
        value,
        color: !stop || hidden ? NO_DATA_FILL : stop.color,
      };
    });
    void ctx;
    return { regions, domain: scale.domain, options };
  }

  #snapshot(
    ctx: DrawContext,
    labels: MapLabels,
    map: GeoMap,
    features: GeoFeature[],
    model: NonNullable<UiGlobeChart["_model"]>,
    name: string,
    hasData: boolean,
  ) {
    const points = this.#points;
    const categories: string[] = [];
    for (const point of points)
      if (point.category && !categories.includes(point.category)) categories.push(point.category);
    const legend =
      categories.length > 1
        ? categories.map((id, index) => ({
            id,
            name: id,
            color: seriesColor(index),
            shape: "dot" as const,
          }))
        : undefined;
    const title = this.getAttribute("label") || map.name;
    if (hasData || points.length === 0) {
      const scaleLegend = legendFor(model.options, model.domain, ctx.format, name);
      return {
        title,
        categoryHeader: labels.region,
        categories: features.map((feature) => feature.name),
        series: [
          {
            id: "value",
            name,
            color: ctx.color(0),
            values: model.regions.map((region) => region.value),
            text: model.regions.map((region) =>
              region.value == null ? labels.noData : ctx.format(region.value),
            ),
          },
        ],
        ...(scaleLegend.scale || !legend ? scaleLegend : { legend }),
      };
    }
    return {
      title,
      categoryHeader: labels.region,
      categories: points.map((point) => point.name),
      series: [
        {
          id: "lon",
          name: labels.longitude,
          color: ctx.color(0),
          values: points.map((point) => point.lon),
          text: points.map((point) => point.lon.toFixed(2)),
        },
        {
          id: "lat",
          name: labels.latitude,
          color: ctx.color(1),
          values: points.map((point) => point.lat),
          text: points.map((point) => point.lat.toFixed(2)),
        },
        {
          id: "value",
          name,
          color: ctx.color(2),
          values: points.map((point) => point.value ?? null),
          text: points.map((point) => (point.value == null ? "" : ctx.format(point.value))),
        },
      ],
      legend: legend ?? [],
    };
  }
  declare _model: {
    regions: Array<{ id: string; name: string; value: number | null; color: string }>;
    domain: readonly [number, number];
    options: ReturnType<UiGlobeChart["scaleOptions"]>;
  };

  #build(root: SVGSVGElement, disc: GlobeDisc) {
    root.replaceChildren();
    const clipId = `${this.#uid}-disc`;
    const shadeId = `${this.#uid}-shade`;
    const clip = svg("circle", {});
    const discEl = svg("circle", { "data-disc": "" });
    const land = svg("g", { "data-layer": "land", "fill-rule": "evenodd" });
    const graticule = svg("path", { "data-graticule": "", fill: "none" });
    const shade = svg("circle", { fill: `url(#${shadeId})`, "pointer-events": "none" });
    const routes = svg("g", {
      "data-layer": "routes",
      fill: "none",
      "clip-path": `url(#${clipId})`,
    });
    const hl = svg("path", { "data-hl": "", fill: "none", "fill-rule": "evenodd" });
    const ring = svg("circle", { "data-ring": "", fill: "none" });
    const markers = svg("g", { "data-layer": "markers" });
    root.append(
      svg(
        "defs",
        {},
        svg("clipPath", { id: clipId }, clip),
        svg(
          "radialGradient",
          { id: shadeId, cx: "38%", cy: "34%", r: "75%" },
          svg("stop", { offset: "0%", "stop-color": "#fff", "stop-opacity": 0.16 }),
          svg("stop", { offset: "60%", "stop-color": "#fff", "stop-opacity": 0 }),
          svg("stop", { offset: "100%", "stop-color": "#000", "stop-opacity": 0.14 }),
        ),
      ),
      discEl,
      svg("g", { "clip-path": `url(#${clipId})` }, graticule, land, shade, hl),
      ring,
      routes,
      markers,
    );
    void disc;
    return { root, land, graticule, routes, markers, hl, shade, ring, disc: discEl, clip };
  }

  #syncControls(labels: MapLabels): void {
    const controls = this.#ensureControls();
    controls.reset.textContent = labels.resetView;
    const spinning = this.hasAttribute("auto-rotate") && this.#motion;
    controls.spin.hidden = !spinning;
    controls.spin.textContent = this.#paused ? labels.playSpin : labels.pauseSpin;
    controls.spin.setAttribute("aria-pressed", `${this.#paused}`);
    queueMicrotask(() => {
      if (!this.isConnected) return;
      if (controls.root.parentNode !== this.drawing) this.drawing.append(controls.root);
      if (controls.live.parentNode !== this.drawing) this.drawing.append(controls.live);
    });
    void this.#markCount;
  }
}

/** Registers `<ui-globe-chart>` (or `<prefix>-globe-chart`) and returns the tag. */
export function defineGlobeChart(options?: DefineOptions): string {
  return defineElement("globe-chart", UiGlobeChart, options);
}
