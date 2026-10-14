/**
 * Zoom and pan of a map element: wheel, drag, two-finger pinch, buttons and keys, on top of
 * ui-core's `geo/view` maths. The view is state of the element, not of a draw: every change asks
 * for a transient frame, so a pan or a zoom never rebuilds the snapshot or fires `chart-data`.
 *
 * Gesture rule (see docs/contributing-charts.md): the drag is the map's own gesture. A press that
 * travels past a few pixels calls `preventDefault()` on its `pointermove`, `pointerup` and `click`,
 * so the base never reads the drag as a selection; a press that stays put is a plain click and still
 * selects. Listeners sit on the SVG, which the base's listeners on the drawing see after.
 */
import {
  clampView,
  DEFAULT_LIMITS,
  IDENTITY_VIEW,
  type MapView,
  revealPoint,
  viewFitting,
  zoomAt,
} from "@jcsoftdev/ui-core/geo/view";
import { svg } from "./chart-dom.js";
import type { MapLabels } from "./e24-geo.js";

type Box = readonly [number, number, number, number];

export interface ViewHost {
  /** Asks for a transient frame. */
  request(): void;
  /** Whether motion is allowed (not `animate="off"`, no reduced motion). */
  motion(): boolean;
  /** The drawing size and the map's pixel box at zoom 1. */
  frame(): { width: number; height: number; content: Box; maxZoom: number };
  /** One finger scrolls the page until the map is engaged (tapped or focused): tells the host to switch `touch-action`. */
  engage(on: boolean): void;
}

const MOVE_THRESHOLD = 4;
const DURATION = 220;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export class MapViewer {
  view: MapView = IDENTITY_VIEW;
  /** A pan is in progress: hover is ignored. */
  dragging = false;
  /** True from the moment a press moved until the next press: the click after a drag is ignored. */
  dragged = false;
  gestures = true;
  /** Tapped or focused: a single touch pans. Before that, one finger scrolls the page and two pan and pinch. */
  engaged = false;
  wheelZoom: "always" | "modifier" = "modifier";
  readonly #host: ViewHost;
  readonly #pointers = new Map<number, { x: number; y: number }>();
  #gesture: { view: MapView; x: number; y: number; distance: number; moved: boolean } | undefined;
  #frame = 0;

  constructor(host: ViewHost) {
    this.#host = host;
  }

  #limits() {
    const { maxZoom } = this.#host.frame();
    return { minZoom: DEFAULT_LIMITS.minZoom, maxZoom };
  }

  #clamp(next: MapView): MapView {
    const { width, height, content } = this.#host.frame();
    return clampView(next, width, height, content, this.#limits());
  }

  #apply(next: MapView): void {
    this.view = this.#clamp(next);
    this.#host.request();
  }

  /** Back to the whole map, at once (a new size or a new map). */
  reset(): void {
    cancelAnimationFrame(this.#frame);
    if (this.view.k === 1 && this.view.x === 0 && this.view.y === 0) return;
    this.view = IDENTITY_VIEW;
  }

  stop(): void {
    cancelAnimationFrame(this.#frame);
    this.#pointers.clear();
    this.#gesture = undefined;
    this.dragging = false;
  }

  animateTo(target: MapView): void {
    cancelAnimationFrame(this.#frame);
    const goal = this.#clamp(target);
    if (!this.#host.motion()) {
      this.#apply(goal);
      return;
    }
    const from = this.view;
    const start = performance.now();
    const step = (now: number) => {
      const e = easeOut(Math.min(1, Math.max(0, (now - start) / DURATION)));
      // Zoom geometrically so the speed feels constant.
      this.#apply({
        k: from.k * (goal.k / from.k) ** e,
        x: from.x + (goal.x - from.x) * e,
        y: from.y + (goal.y - from.y) * e,
      });
      if (e < 1) this.#frame = requestAnimationFrame(step);
    };
    this.#frame = requestAnimationFrame(step);
  }

  zoomBy(factor: number, cx?: number, cy?: number): void {
    const { width, height } = this.#host.frame();
    this.animateTo(zoomAt(this.view, factor, cx ?? width / 2, cy ?? height / 2, this.#limits()));
  }
  fit(): void {
    this.animateTo(IDENTITY_VIEW);
  }
  panBy(dx: number, dy: number): void {
    this.animateTo({ ...this.view, x: this.view.x + dx, y: this.view.y + dy });
  }
  focusBox(box: Box): void {
    const { width, height, maxZoom } = this.#host.frame();
    this.animateTo(viewFitting(box, width, height, { maxZoom }));
  }
  /** Pans the least that brings a zoom-1 point into view (the keyboard moved to a region). */
  reveal(x: number, y: number): void {
    const { width, height } = this.#host.frame();
    const next = revealPoint(this.view, x, y, width, height);
    if (next !== this.view) this.animateTo(next);
  }

  get canZoomIn(): boolean {
    return this.view.k < this.#limits().maxZoom - 1e-6;
  }
  get canZoomOut(): boolean {
    return this.view.k > DEFAULT_LIMITS.minZoom + 1e-6;
  }

  #engage(on: boolean): void {
    if (this.engaged === on) return;
    this.engaged = on;
    this.#host.engage(on);
  }

  /** Wires the gestures to the SVG (and the focus to `scope`); everything is removed with `signal`. */
  attach(
    root: SVGSVGElement,
    signal: AbortSignal,
    scope: HTMLElement = root.parentElement ?? document.body,
  ): void {
    const opts = { signal };
    scope.addEventListener("focusin", () => this.#engage(true), opts);
    scope.addEventListener(
      "focusout",
      (event) => {
        if (!scope.contains(event.relatedTarget as Node | null)) this.#engage(false);
      },
      opts,
    );
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (this.engaged && !scope.contains(event.target as Node | null)) this.#engage(false);
      },
      opts,
    );
    const local = (event: { clientX: number; clientY: number }) => {
      const box = root.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const center = () => {
      const points = [...this.#pointers.values()];
      const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
      const [a, b] = points;
      return { x, y, distance: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 };
    };
    root.addEventListener(
      "pointerdown",
      (event) => {
        if (!this.gestures || (event.pointerType === "mouse" && event.button !== 0)) return;
        cancelAnimationFrame(this.#frame);
        this.dragged = false;
        this.#pointers.set(event.pointerId, local(event));
        const c = center();
        this.#gesture = { view: this.view, x: c.x, y: c.y, distance: c.distance, moved: false };
      },
      opts,
    );
    root.addEventListener(
      "pointermove",
      (event) => {
        const g = this.#gesture;
        if (!this.gestures || !g || !this.#pointers.has(event.pointerId)) return;
        this.#pointers.set(event.pointerId, local(event));
        // A single finger belongs to the page's scroll until the map is engaged.
        if (event.pointerType === "touch" && !this.engaged && this.#pointers.size < 2) return;
        const c = center();
        if (
          !g.moved &&
          Math.hypot(c.x - g.x, c.y - g.y) < MOVE_THRESHOLD &&
          this.#pointers.size < 2
        )
          return;
        if (!g.moved) {
          g.moved = true;
          this.dragged = true;
          this.dragging = true;
          try {
            root.setPointerCapture(event.pointerId);
          } catch {
            // The pointer is already gone.
          }
        }
        event.preventDefault();
        let next = { ...g.view, x: g.view.x + (c.x - g.x), y: g.view.y + (c.y - g.y) };
        if (this.#pointers.size >= 2 && g.distance > 0) {
          next = zoomAt(g.view, c.distance / g.distance, g.x, g.y, this.#limits());
          next = { ...next, x: next.x + (c.x - g.x), y: next.y + (c.y - g.y) };
        }
        this.#apply(next);
      },
      opts,
    );
    const release = (event: PointerEvent) => {
      // The press moved: the drag owns it, so the base must not read it as a tap or a click.
      if (this.#gesture?.moved) event.preventDefault();
      else if (event.pointerType === "touch" && event.type === "pointerup") this.#engage(true);
      this.#pointers.delete(event.pointerId);
      if (this.#pointers.size === 0) {
        this.#gesture = undefined;
        this.dragging = false;
      } else {
        const c = center();
        this.#gesture = { view: this.view, x: c.x, y: c.y, distance: c.distance, moved: true };
      }
    };
    root.addEventListener("pointerup", release, opts);
    root.addEventListener("pointercancel", release, opts);
    root.addEventListener(
      "click",
      (event) => {
        if (this.dragged) event.preventDefault();
      },
      opts,
    );
    root.addEventListener(
      "wheel",
      (event) => {
        if (!this.gestures) return;
        if (this.wheelZoom === "modifier" && !(event.ctrlKey || event.metaKey)) return;
        // At the zoom floor, scrolling out belongs to the page.
        if (event.deltaY > 0 && !this.canZoomOut) return;
        event.preventDefault();
        cancelAnimationFrame(this.#frame);
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
        const speed = event.ctrlKey ? 0.01 : 0.0018;
        const at = local(event);
        this.#apply(
          zoomAt(this.view, Math.exp(-event.deltaY * unit * speed), at.x, at.y, this.#limits()),
        );
      },
      { signal, passive: false },
    );
  }

  /** `+`, `-`, `0` and Shift+arrows, for a key pressed on a mark or the frame. Returns whether it was used. */
  key(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const zoom = ZOOM_KEYS[event.key];
    if (zoom) {
      if (zoom === "fit") this.fit();
      else this.zoomBy(zoom === "in" ? 1.6 : 1 / 1.6);
      return true;
    }
    if (event.shiftKey && event.key.startsWith("Arrow")) {
      const step = 64;
      this.panBy(
        event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0,
        event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0,
      );
      return true;
    }
    return false;
  }
}

const ZOOM_KEYS: Record<string, "in" | "out" | "fit" | undefined> = {
  "+": "in",
  "=": "in",
  "-": "out",
  _: "out",
  "0": "fit",
};

export interface ZoomControls {
  root: HTMLElement;
  /** Updates the names and the disabled state. */
  sync(labels: MapLabels, viewer: MapViewer): void;
}

const GLYPHS = {
  in: "M8 3v10M3 8h10",
  out: "M3 8h10",
  fit: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
};

/** The zoom buttons (plus, minus, fit): plain buttons in a group, outside the SVG so export skips them. */
export function zoomControls(viewer: MapViewer): ZoomControls {
  const root = document.createElement("div");
  root.dataset.uiPart = "geo-controls";
  root.setAttribute("role", "group");
  const make = (kind: keyof typeof GLYPHS, run: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.kind = kind;
    button.append(
      svg(
        "svg",
        { viewBox: "0 0 16 16", width: 16, height: 16, fill: "none", "aria-hidden": "true" },
        svg("path", {
          d: GLYPHS[kind],
          stroke: "currentColor",
          "stroke-width": 1.75,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
      ),
    );
    button.addEventListener("click", run);
    return button;
  };
  const zoomIn = make("in", () => viewer.zoomBy(1.6));
  const zoomOut = make("out", () => viewer.zoomBy(1 / 1.6));
  const fit = make("fit", () => viewer.fit());
  root.append(zoomIn, zoomOut, fit);
  return {
    root,
    sync(labels, v) {
      root.setAttribute("aria-label", labels.controls);
      zoomIn.setAttribute("aria-label", labels.zoomIn);
      zoomOut.setAttribute("aria-label", labels.zoomOut);
      fit.setAttribute("aria-label", labels.fit);
      zoomIn.disabled = !v.canZoomIn;
      zoomOut.disabled = !v.canZoomOut;
      fit.disabled = v.view.k <= 1.0001;
    },
  };
}
