/**
 * The parts of a hierarchy chart that only matter once someone zooms: the tween, the pointer and
 * key gestures that open and close nodes, and the breadcrumb. Loaded after the first draw, so a
 * chart that is only looked at never pays for them.
 */
import type { HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import { byId } from "./base.js";
import { easeOutCubic } from "./chart-text.js";

/** The members of a hierarchy chart the zoom parts use (some are protected there). */
export interface ZoomChart extends HTMLElement {
  zoomTo(id: string): boolean;
  zoomOut(): boolean;
  readonly drillable: boolean;
  readonly tweening: boolean;
  readonly selected: number | null;
  readonly nodes: readonly HierarchyNode[];
  readonly last:
    | { hit?: (x: number, y: number, target: Element, radius: number) => number }
    | undefined;
  touched: boolean;
  readonly drawing: HTMLElement;
  model(): { focus: HierarchyNode; path: HierarchyNode[] };
  readonly crumbId: string | null;
  readonly strings: { breadcrumb: string };
  isCenter(x: number, y: number): boolean;
  drillTarget(node: HierarchyNode): HierarchyNode;
  requestDraw(kind: "transient"): void;
}

/** A pointer that moves farther than this (px) between down and up is a swipe, not a tap. */
const TAP_SLOP = 10;

export class Zoom {
  #frame = 0;
  #down: { x: number; y: number } | undefined;
  #crumb: { el: HTMLElement; stop: AbortController } | undefined;
  #items: unknown;
  #refocus: string | undefined;
  readonly #host: ZoomChart;

  constructor(host: ZoomChart) {
    this.#host = host;
  }

  /** Remember to focus node `id` after the next draw, when the keyboard is what moved. */
  keep(id: string | undefined): void {
    const active = document.activeElement;
    if (id && active && this.#host.drawing.contains(active)) this.#refocus = id;
  }

  /** A redraw restores focus by mark index; the open node changed, so put it on the right node. */
  settle(result: { marks?: unknown } & object): void {
    const host = this.#host;
    const id = this.#refocus;
    if (!id || result !== host.last) return;
    this.#refocus = undefined;
    const marks = (result as { marks?: ReadonlyArray<{ el: Element }> | { count: number } }).marks;
    const mark =
      marks && !("count" in marks)
        ? marks[host.nodes.findIndex((node) => node.id === id)]
        : undefined;
    const active = document.activeElement;
    if (!mark || (active !== document.body && !host.drawing.contains(active))) return;
    if (active !== mark.el) (mark.el as HTMLElement).focus({ preventScroll: true });
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
      this.#host.requestDraw("transient");
      if (t < 1) this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  /**
   * Wires the breadcrumb `el` (`null` unwires) and gives it `path`. A breadcrumb that is not
   * defined yet gets the path once it is, whichever was defined first.
   */
  sync(): void {
    const host = this.#host;
    const id = host.crumbId;
    this.crumb(
      id === "off"
        ? null
        : id
          ? byId(host, id)
          : host.querySelector<HTMLElement>('[data-ui="chart-breadcrumb"]'),
      host.model().path,
      host.strings.breadcrumb,
    );
  }

  unwire(): void {
    this.crumb(null, [], "");
  }

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
            if (this.#crumb?.el === el) this.sync();
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
        if (!host.drillable || event.detail === 0) return;
        const [x, y] = this.#local(svg, event);
        if (!host.isCenter(x, y)) return;
        event.preventDefault();
        host.zoomOut();
      },
      opts,
    );
    svg.addEventListener(
      "pointerdown",
      (event) => {
        host.touched = event.pointerType !== "mouse";
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
        if (event.pointerType === "mouse" || !host.drillable) return;
        if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_SLOP) return;
        const [x, y] = this.#local(svg, event);
        const index = host.last?.hit?.(x, y, event.target as Element, 44) ?? -1;
        const node = host.nodes[index];
        const target = node && host.drillTarget(node);
        if (index < 0 || index !== host.selected || !target || target.children.length === 0) return;
        event.preventDefault();
        host.zoomTo(target.id);
      },
      opts,
    );
    // Escape goes up a level when no mark is pinned (a pinned mark takes Escape first).
    svg.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || host.selected !== null || !host.drillable) return;
        if (!host.model().focus.parent) return;
        event.preventDefault();
        host.zoomOut();
      },
      opts,
    );
  }
}
