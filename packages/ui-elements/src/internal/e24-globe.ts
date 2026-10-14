/**
 * The renderer of `ui-globe-chart`: the lazy half. It holds everything that needs the globe maths,
 * the decoded topology, the color scale and the pointer gestures, so the element itself stays a thin
 * shell and a page pays for this only when a globe is on it (it is fetched together with the map).
 *
 * Drag rotates the globe (one finger only after a tap or focus; two fingers always), a flick keeps
 * turning with inertia that fades out, and the idle spin pauses off screen and in a hidden tab. Both
 * respect reduced motion and `animate="off"`.
 */
import { rangeIndex } from "@jcsoftdev/ui-core/chart/color-scale";
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
import type { UiGlobeChart } from "../globe-chart/globe-chart.js";
import { uid } from "./base.js";
import {
  CHART_EVENT,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  join,
  svg,
} from "./chart-base.js";
import { SR_ONLY } from "./chart-dom.js";
import { geometryContains, mapFeatures } from "./e24-features.js";
import type { MapPoint, RegionInfo } from "./e24-geo.js";
import {
  directionalNav,
  finiteValues,
  type MapLabels,
  resolveRoutes,
  setGeoKey,
} from "./e24-geo.js";
import type { KeyItem } from "./e24-key.js";
import { colorScale, legendFor, NO_DATA_FILL } from "./e24-scale.js";

export type { GlobeRotation };

/** More regions than this are painted on a canvas layer (the world has 176). */
const CANVAS_FROM = 80;
const DRAG_SLOP = 4;
/** Time constant of a flick's decay, in ms. */
const INERTIA_TAU = 325;
const MIN_SPEED = 0.004;

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

/** Colors a CSS expression (a `var()`, a `color-mix()`) resolves to, for painting on a canvas. */
function createColorResolver(host: HTMLElement) {
  const cache = new Map<string, string>();
  let probe: HTMLSpanElement | undefined;
  return {
    resolve(css: string): string {
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

interface Layers {
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

interface Model {
  regions: Array<{ id: string; name: string; value: number | null; color: string }>;
  domain: readonly [number, number];
  options: ReturnType<UiGlobeChart["scaleOptions"]>;
}

export class GlobeRenderer {
  readonly #host: UiGlobeChart;
  readonly #uid = uid("globe");
  readonly #colors: ReturnType<typeof createColorResolver>;
  #disc: GlobeDisc = { cx: 0, cy: 0, radius: 0 };
  #motion = true;
  #layers: Layers | undefined;
  #model: Model | undefined;
  #markers: Marker[] = [];
  #points: readonly MapPoint[] = [];
  #features: GeoFeature[] = [];
  #controls:
    | { root: HTMLElement; reset: HTMLButtonElement; spin: HTMLButtonElement; live: HTMLElement }
    | undefined;
  #graticule: { step: number; lines: Vec3[][] } | undefined;
  #pointers = new Map<number, { x: number; y: number }>();
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
  #tween = 0;
  #spin = 0;
  #announce = 0;
  #announced = "";
  #onscreen = true;

  constructor(host: UiGlobeChart) {
    this.#host = host;
    this.#colors = createColorResolver(host);
  }

  get dragging(): boolean {
    return this.#dragging;
  }

  // ---- rotation ------------------------------------------------------------------------------

  #turn(next: GlobeRotation, user: boolean): void {
    this.#host.commit(next);
    if (user) this.#announceSoon();
  }

  #announceSoon(): void {
    clearTimeout(this.#announce);
    this.#announce = window.setTimeout(() => {
      const { rotation } = this.#host;
      const text = this.#host.mapLabels.centerAt(rotation.lon, rotation.lat);
      if (this.#controls && text !== this.#announced) {
        this.#announced = text;
        this.#controls.live.textContent = text;
      }
    }, 400);
  }

  stopMotion(): void {
    cancelAnimationFrame(this.#frame);
    cancelAnimationFrame(this.#tween);
    this.#frame = 0;
    this.#tween = 0;
    this.#velocity = { lon: 0, lat: 0 };
  }

  destroy(): void {
    this.stopMotion();
    cancelAnimationFrame(this.#spin);
    this.#spin = 0;
    clearTimeout(this.#announce);
  }

  /** Turns to `target` over a short tween (at once without motion). */
  turnTo(target: GlobeRotation): void {
    this.stopMotion();
    const goal = normalizeRotation(target);
    if (!this.#motion) {
      this.#turn(goal, true);
      return;
    }
    const from = this.#host.rotation;
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
    if (!this.#motion || this.#host.reduced || Math.hypot(lon, lat) < MIN_SPEED) return;
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
      const { rotation } = this.#host;
      this.#turn(
        normalizeRotation({
          lon: rotation.lon + this.#velocity.lon * dt,
          lat: rotation.lat + this.#velocity.lat * dt,
        }),
        true,
      );
      this.#frame = requestAnimationFrame(step);
    };
    this.#frame = requestAnimationFrame(step);
  }

  /** Starts or stops the idle spin: only while the shell allows it, on screen and in a visible tab. */
  syncSpin(): void {
    const allowed =
      this.#host.autoRotating && this.#onscreen && !document.hidden && !this.#dragging;
    if (!allowed) {
      cancelAnimationFrame(this.#spin);
      this.#spin = 0;
      return;
    }
    if (this.#spin) return;
    let last = performance.now();
    const step = (now: number) => {
      if (!this.#host.autoRotating || !this.#onscreen || document.hidden || this.#dragging) {
        this.#spin = 0;
        return;
      }
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.#turn(
        spinRotation(
          this.#host.rotation,
          seconds,
          Number(this.#host.getAttribute("auto-rotate-speed")) || 8,
        ),
        false,
      );
      this.#spin = requestAnimationFrame(step);
    };
    this.#spin = requestAnimationFrame(step);
  }

  // ---- input (the base owns hover, tap, keyboard and selection) ---------------------------------

  setup(root: SVGSVGElement, signal: AbortSignal): void {
    const host = this.#host;
    const opts = { signal };
    const themes = () => {
      this.#colors.clear();
      host.requestDraw("transient");
    };
    const observer = new MutationObserver(themes);
    observer.observe(document.documentElement, { attributes: true });
    const schemes = matchMedia("(prefers-color-scheme: dark)");
    schemes.addEventListener("change", themes, opts);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener(
      "change",
      () => {
        if (motion.matches) this.stopMotion();
        this.syncSpin();
        host.requestDraw("transient");
      },
      opts,
    );
    const visible = new IntersectionObserver((entries) => {
      this.#onscreen = entries.at(-1)?.isIntersecting ?? true;
      this.syncSpin();
    });
    visible.observe(host);
    document.addEventListener("visibilitychange", () => this.syncSpin(), opts);
    signal.addEventListener("abort", () => {
      observer.disconnect();
      visible.disconnect();
      this.destroy();
    });

    const centroid = () => {
      const all = [...this.#pointers.values()];
      return {
        x: all.reduce((sum, p) => sum + p.x, 0) / all.length,
        y: all.reduce((sum, p) => sum + p.y, 0) / all.length,
      };
    };
    root.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        this.stopMotion();
        this.#dragged = false;
        this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const c = centroid();
        this.#press = {
          x: c.x,
          y: c.y,
          moved: 0,
          samples: [{ t: event.timeStamp, ...host.rotation }],
        };
        host.hovering = true;
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
        if (!press || !this.#pointers.has(event.pointerId)) return;
        this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        // A single finger belongs to the page's scroll until the globe is engaged by a tap or focus.
        if (event.pointerType === "touch" && !host.touchEngaged && this.#pointers.size < 2) return;
        const c = centroid();
        const dx = c.x - press.x;
        const dy = c.y - press.y;
        press.x = c.x;
        press.y = c.y;
        press.moved += Math.abs(dx) + Math.abs(dy);
        if (press.moved <= DRAG_SLOP) return;
        // The drag is the globe's own gesture: it must never become a selection.
        event.preventDefault();
        this.#dragged = true;
        if (!this.#dragging) {
          this.#dragging = true;
          host.toggleAttribute("data-dragging", true);
        }
        this.#turn(dragRotation(host.rotation, dx, dy, this.#disc.radius), true);
        press.samples.push({ t: event.timeStamp, ...host.rotation });
        while (press.samples.length > 2 && event.timeStamp - (press.samples[0]?.t ?? 0) > 90)
          press.samples.shift();
      },
      opts,
    );
    const release = (event: PointerEvent) => {
      const press = this.#press;
      if (!press) return;
      if (this.#dragged) event.preventDefault();
      else if (event.pointerType === "touch" && event.type === "pointerup") host.engage(true);
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      this.#pointers.delete(event.pointerId);
      if (this.#pointers.size > 0) {
        const c = centroid();
        press.x = c.x;
        press.y = c.y;
        return;
      }
      this.#press = undefined;
      this.#dragging = false;
      host.toggleAttribute("data-dragging", false);
      host.hovering = host.drawing.matches(":hover, :focus-within");
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
      this.syncSpin();
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
    host.drawing.addEventListener(
      "keydown",
      (event) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target instanceof HTMLButtonElement) return;
        if (event.key === "0") {
          this.turnTo(host.initialRotation);
        } else if (event.shiftKey && event.key.startsWith("Arrow")) {
          const next = keyRotation(host.rotation, event.key, 10);
          if (!next) return;
          this.stopMotion();
          this.#turn(next, true);
        } else return;
        event.preventDefault();
      },
      opts,
    );
    host.drawing.addEventListener("focusin", () => host.engage(true), opts);
    host.drawing.addEventListener(
      "focusout",
      (event) => {
        if (!host.drawing.contains(event.relatedTarget as Node | null)) host.engage(false);
      },
      opts,
    );
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (host.touchEngaged && !host.drawing.contains(event.target as Node | null))
          host.engage(false);
      },
      opts,
    );
    host.addEventListener(
      CHART_EVENT.hover,
      (event) => {
        const info = (event as CustomEvent<HoverInfo | null>).detail;
        this.onHover(info);
        if (info?.source === "keyboard") this.#reveal(info.index);
      },
      opts,
    );
  }

  // ---- model ---------------------------------------------------------------------------------

  markInfo(index: number): GlobeMark | undefined {
    const point = this.#points[index];
    if (point) return { kind: "point", point };
    const region = this.#model?.regions[index - this.#points.length];
    return region && { kind: "region", index: index - this.#points.length, ...region };
  }

  onHover(info: HoverInfo | null): void {
    const hl = this.#layers?.hl;
    const map = this.#host.inputs()?.map;
    if (!hl || !map) return;
    const index = info ? info.index - this.#points.length : -1;
    const rings = featureRings(map)[index];
    hl.setAttribute("d", rings ? globeRingsPath(rings, this.#host.rotation, this.#disc) : "");
  }

  /** Turns the globe so mark `index` is in view (the keyboard moved to it). */
  #reveal(index: number): void {
    let position: readonly [number, number] | undefined;
    const point = this.#points[index];
    if (point) position = [point.lon, point.lat];
    else {
      const feature = this.#features[index - this.#points.length];
      if (feature) position = labelOf(feature);
    }
    if (!position) return;
    const visible = projectOrthographic(position, this.#host.rotation, this.#disc);
    const { cx, cy, radius } = this.#disc;
    if (visible && Math.hypot(visible[0] - cx, visible[1] - cy) < radius * 0.8) return;
    this.turnTo({ lon: position[0], lat: position[1] });
  }

  #buildModel(features: GeoFeature[]): Model {
    const input = this.#host.inputs() as NonNullable<ReturnType<UiGlobeChart["inputs"]>>;
    const options = this.#host.scaleOptions();
    const scale = colorScale(finiteValues(input.data), options);
    const lookup = createRegionIndex(input.data);
    const ranges = input.ranges;
    const regions = features.map((feature) => {
      const raw = lookup(feature)?.value;
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      const stop = value == null ? null : scale.color(value);
      const hidden =
        value != null &&
        ranges?.length &&
        this.#host.isHidden(`range-${rangeIndex(value, ranges)}`);
      return {
        id: feature.id,
        name: feature.name,
        value,
        color: !stop || hidden ? NO_DATA_FILL : stop.color,
      };
    });
    return { regions, domain: scale.domain, options };
  }

  // ---- draw ----------------------------------------------------------------------------------

  draw(ctx: DrawContext): DrawResult | undefined {
    const host = this.#host;
    const input = host.inputs();
    if (!input) return undefined;
    const { map, points, routes } = input;
    this.#motion = ctx.motion;
    const labels = host.mapLabels;
    const features = mapFeatures(map);
    this.#features = features;
    this.#points = points;
    const rings = featureRings(map);
    const rotation = host.rotation;
    const disc: GlobeDisc = {
      cx: ctx.width / 2,
      cy: ctx.height / 2,
      radius: Math.max(24, Math.min(ctx.width, ctx.height) / 2 - 6),
    };
    this.#disc = disc;
    const name = host.getAttribute("value-name") || labels.value;

    if (!ctx.transient || !this.#model) this.#model = this.#buildModel(features);
    const model = this.#model;
    const canvasMode = host.getAttribute("canvas");
    const useCanvas =
      canvasMode === "on" || (canvasMode !== "off" && features.length > CANVAS_FROM);

    const layers =
      this.#layers?.root === ctx.svg && ctx.phase !== "enter" ? this.#layers : this.#build(ctx.svg);
    this.#layers = layers;
    for (const circle of [layers.clip, layers.disc, layers.shade, layers.ring]) {
      circle.setAttribute("cx", `${disc.cx}`);
      circle.setAttribute("cy", `${disc.cy}`);
      circle.setAttribute("r", `${disc.radius}`);
    }
    layers.disc.setAttribute("display", useCanvas ? "none" : "inline");

    const step = Number(host.getAttribute("graticule-step")) || 30;
    const lines = host.getAttribute("graticule") === "off" ? [] : this.#graticuleLines(step);
    const graticuleD = routePolylinePath(
      lines.flatMap((line) => globeLinePieces(line, rotation, disc)),
    );

    if (useCanvas) {
      const g = ctx.canvas();
      const colorOf = (css: string) => this.#colors.resolve(css);
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
      rings.forEach((featureRingList, index) => {
        const d = globeRingsPath(featureRingList, rotation, disc);
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
    const minRadius = Number(host.getAttribute("min-radius")) || 4;
    const maxRadius = Number(host.getAttribute("max-radius")) || 16;
    const categories: string[] = [];
    for (const point of points)
      if (point.category && !categories.includes(point.category)) categories.push(point.category);
    const markers = points.flatMap((point, index): Marker[] => {
      if (point.category && host.isHidden(point.category)) return [];
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
    const arcs = resolveRoutes(routes, points);
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

    this.onHover(host.hover);
    this.#syncControls(labels);
    const text = (index: number) => {
      const value = model.regions[index]?.value;
      return value == null ? labels.noData : ctx.format(value);
    };
    const hasData = input.data.length > 0;
    const extents = this.#extents(features);

    // Keyboard neighbours on screen: a mark on the far side or hidden has no anchor.
    const anchors: Array<[number, number] | null> = [
      ...points.map((point) =>
        point.category && host.isHidden(point.category)
          ? null
          : projectOrthographic([point.lon, point.lat], rotation, disc),
      ),
      ...features.map((feature) => projectOrthographic(labelOf(feature), rotation, disc)),
    ];

    setGeoKey(host, this.#keyItems(model, categories, hasData, labels));

    return {
      summary: `${labels.centerAt(rotation.lon, rotation.lat)}. ${features.length} regions${points.length ? `, ${points.length} markers` : ""}`,
      marks: {
        count: points.length + features.length,
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
      nav: (index, intent) => {
        const from = anchors[index];
        if (!from && intent !== "home" && intent !== "end") {
          // The current mark is out of sight: the nearest visible one is the way back in.
          let best: number | undefined;
          let nearest = Number.POSITIVE_INFINITY;
          anchors.forEach((anchor, i) => {
            if (!anchor) return;
            const d = Math.hypot(anchor[0] - disc.cx, anchor[1] - disc.cy);
            if (d < nearest) {
              nearest = d;
              best = i;
            }
          });
          return best;
        }
        return directionalNav(anchors, index, intent);
      },
      maxHoverRows: 1,
      snapshot: () => this.#snapshot(ctx, labels, model, categories, name, hasData),
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

  #graticuleLines(step: number): Vec3[][] {
    if (this.#graticule?.step !== step)
      this.#graticule = {
        step,
        lines: graticuleLines(step).map((line) => line.map((position) => toVec(position))),
      };
    return this.#graticule.lines;
  }

  /** What the legend cannot hold next to a color bar: "No data", and the categories when there is one. */
  #keyItems(
    model: Model,
    categories: readonly string[],
    hasData: boolean,
    labels: MapLabels,
  ): KeyItem[] {
    const items: KeyItem[] = [];
    // With region values the legend slot holds the color bar (or the ranges): the categories join the key.
    if (hasData && categories.length > 1)
      categories.forEach((id, index) => {
        items.push({ id, name: id, color: seriesColor(index), shape: "dot", toggle: true });
      });
    if (hasData && model.regions.some((region) => region.color === NO_DATA_FILL))
      items.push({ id: "no-data", name: labels.noData, color: NO_DATA_FILL, outline: true });
    return items;
  }

  /** One table for the regions and the markers: the points first, then the regions, like the marks. */
  #snapshot(
    ctx: DrawContext,
    labels: MapLabels,
    model: Model,
    categories: readonly string[],
    name: string,
    hasData: boolean,
  ) {
    const host = this.#host;
    const points = this.#points;
    const regions = model.regions;
    const title = host.getAttribute("label") || host.resolvedLabels.chart;
    const none = regions.map(() => null);
    const blank = regions.map(() => "");
    const scale = hasData ? legendFor(model.options, model.domain, ctx.format, name) : {};
    const legend =
      categories.length > 1 && !hasData
        ? categories.map((id, index) => ({
            id,
            name: id,
            color: seriesColor(index),
            shape: "dot" as const,
          }))
        : undefined;
    const series = [
      {
        id: "value",
        name,
        color: ctx.color(0),
        values: [...points.map((point) => point.value ?? null), ...regions.map((r) => r.value)],
        text: [
          ...points.map((point) => (point.value == null ? "" : ctx.format(point.value))),
          ...regions.map((region) =>
            region.value == null ? labels.noData : ctx.format(region.value),
          ),
        ],
      },
      ...(points.length > 0
        ? [
            {
              id: "lon",
              name: labels.longitude,
              color: ctx.color(1),
              values: [...points.map((point) => point.lon), ...none],
              text: [...points.map((point) => point.lon.toFixed(2)), ...blank],
            },
            {
              id: "lat",
              name: labels.latitude,
              color: ctx.color(2),
              values: [...points.map((point) => point.lat), ...none],
              text: [...points.map((point) => point.lat.toFixed(2)), ...blank],
            },
          ]
        : []),
    ];
    return {
      title,
      categoryHeader: labels.region,
      categories: [...points.map((point) => point.name), ...regions.map((region) => region.name)],
      series,
      ...(scale.scale ? { scale: scale.scale } : {}),
      ...(legend ? { legend } : {}),
    };
  }

  #build(root: SVGSVGElement): Layers {
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
    return { root, land, graticule, routes, markers, hl, shade, ring, disc: discEl, clip };
  }

  #ensureControls() {
    if (this.#controls) return this.#controls;
    const host = this.#host;
    const root = document.createElement("div");
    root.dataset.uiPart = "globe-controls";
    const button = (kind: string, run: () => void) => {
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.kind = kind;
      el.addEventListener("click", run);
      return el;
    };
    const reset = button("reset", () => this.turnTo(host.initialRotation));
    const spin = button("spin", () => {
      host.paused = !host.paused;
      this.syncSpin();
      host.requestDraw("transient");
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

  #syncControls(labels: MapLabels): void {
    const host = this.#host;
    const controls = this.#ensureControls();
    controls.reset.textContent = labels.resetView;
    const spinning = host.hasAttribute("auto-rotate") && this.#motion;
    controls.spin.hidden = !spinning;
    controls.spin.textContent = host.paused ? labels.playSpin : labels.pauseSpin;
    controls.spin.setAttribute("aria-pressed", `${host.paused}`);
    // The base puts the SVG into the drawing after this draw returns, so the controls go in after it.
    queueMicrotask(() => {
      if (!host.isConnected) return;
      if (controls.root.parentNode !== host.drawing) host.drawing.append(controls.root);
      if (controls.live.parentNode !== host.drawing) host.drawing.append(controls.live);
    });
  }
}
