/**
 * The parts of a hierarchy chart that only matter once someone zooms: the tween, the pointer and
 * key gestures that open and close nodes, and the breadcrumb. Loaded after the first draw, so a
 * chart that is only looked at never pays for them.
 */
import type { HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import { easeOutCubic } from "./chart-text.js";

/** What the zoom parts ask of the chart. */
export interface ZoomHost {
  zoomTo(id: string): boolean;
  zoomOut(): boolean;
  drillable(): boolean;
  /** The open node has a parent to go back to. */
  canExit(): boolean;
  /** A mark is pinned. */
  pinned(): boolean;
  /** (x, y), in drawing units, is in the hole of a sunburst. */
  center(x: number, y: number): boolean;
  /** Id of the node a tap at (x, y) opens: the pinned node under the pointer, if it has children. */
  tapTarget(x: number, y: number, target: Element): string | null;
  /** The last pointer was a finger or a pen. */
  touch(on: boolean): void;
  /** Whether a zoom may be animated now. */
  animate(): boolean;
  redraw(): void;
}

/** A pointer that moves farther than this (px) between down and up is a swipe, not a tap. */
const TAP_SLOP = 10;

export class Zoom {
  #frame = 0;
  #down: { x: number; y: number } | undefined;
  #crumb: { el: HTMLElement; stop: AbortController } | undefined;
  #items: unknown;
  readonly #host: ZoomHost;

  constructor(host: ZoomHost) {
    this.#host = host;
  }

  cancel(): void {
    cancelAnimationFrame(this.#frame);
  }

  /** Runs `step(t)` with `t` easing from 0 to 1 over `duration` ms, one transient frame each. */
  play(step: (t: number) => void, duration: number): void {
    this.cancel();
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      step(easeOutCubic(t));
      this.#host.redraw();
      if (t < 1) this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  /**
   * Wires the breadcrumb `el` (`null` unwires) and gives it `path`. A breadcrumb that is not
   * defined yet gets the path once it is, whichever was defined first.
   */
  crumb(el: HTMLElement | null, path: readonly HierarchyNode[], label: string): void {
    if (el !== this.#crumb?.el) {
      this.#crumb?.stop.abort();
      this.#crumb = undefined;
      this.#items = undefined;
      if (el) {
        const stop = new AbortController();
        this.#crumb = { el, stop };
        el.addEventListener(
          "select",
          (event) => {
            const target = (event as CustomEvent<{ id?: string }>).detail?.id;
            if (target && event.target === el) this.#host.zoomTo(target);
          },
          { signal: stop.signal },
        );
        if (el.localName.includes("-") && !customElements.get(el.localName))
          customElements.whenDefined(el.localName).then(() => {
            if (this.#crumb?.el === el) this.crumb(el, path, label);
          });
      }
    }
    if (!el || !("items" in el)) return;
    const items = path.map((node) => ({ id: node.id, name: node.name }));
    const same =
      this.#items === (el as HTMLElement & { items: unknown }).items &&
      JSON.stringify(this.#items) === JSON.stringify(items);
    if (same) return;
    if (!el.hasAttribute("label")) el.setAttribute("label", label);
    this.#items = items;
    (el as HTMLElement & { items: unknown }).items = items;
  }

  /** Pointer position in drawing units. */
  #local(svg: SVGSVGElement, event: PointerEvent | MouseEvent): [number, number] {
    const box = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    return [
      (event.clientX - box.left) * (view.width / (box.width || 1)),
      (event.clientY - box.top) * (view.height / (box.height || 1)),
    ];
  }

  gestures(svg: SVGSVGElement, signal: AbortSignal): void {
    const host = this.#host;
    const opts = { signal };
    // The hole of a sunburst, or the first band of an icicle, zooms out (a click is not a selection).
    svg.addEventListener(
      "click",
      (event) => {
        if (!host.drillable() || event.detail === 0) return;
        const [x, y] = this.#local(svg, event);
        if (!host.center(x, y)) return;
        event.preventDefault();
        host.zoomOut();
      },
      opts,
    );
    svg.addEventListener(
      "pointerdown",
      (event) => {
        host.touch(event.pointerType !== "mouse");
        this.#down = { x: event.clientX, y: event.clientY };
      },
      opts,
    );
    // A second tap on the pinned node opens it (the first tap pins). A swipe that ends on it does not.
    svg.addEventListener(
      "pointerup",
      (event) => {
        const down = this.#down;
        this.#down = undefined;
        if (event.pointerType === "mouse" || !host.drillable()) return;
        if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_SLOP) return;
        const [x, y] = this.#local(svg, event);
        const id = host.tapTarget(x, y, event.target as Element);
        if (!id) return;
        event.preventDefault();
        host.zoomTo(id);
      },
      opts,
    );
    // Escape goes up a level when no mark is pinned (a pinned mark takes Escape first).
    svg.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || host.pinned() || !host.drillable() || !host.canExit()) return;
        event.preventDefault();
        host.zoomOut();
      },
      opts,
    );
  }
}
