// Zoom for the cartesian charts, loaded on demand when `brush` is set: drag a window on the plot,
// the overview strip under it (a mini chart with a draggable window), its keyboard slider and the
// reset button. A chart without `brush` never downloads this code.
import { pointScale } from "@jcsoftdev/ui-core/chart/scale";
import type { DrawContext } from "./chart-base.js";
import { svg } from "./chart-dom.js";
import {
  BRUSH_HEIGHT,
  type CartesianLayout,
  type ResolvedSeries,
  type XValue,
} from "./e17-layout.js";
import css from "./e17-zoom.css.js";

export type IndexRange = readonly [number, number];

export interface ZoomHost {
  readonly drawing: HTMLElement;
  layout(): CartesianLayout | undefined;
  /** Index in the full data of mark `index` of the zoomed, sampled window. */
  source(index: number): number;
  setRange(range: IndexRange | null, live?: boolean): void;
  /** Emits the pending `zoom` event, once a drag or a key run has ended. */
  flush(): void;
  redraw(): void;
  /** The drag drew a window: the base must not select on its pointerup. */
  claim(): void;
  /** Adopts the zoom stylesheet into the chart's root node. */
  adopt(css: string): void;
  fullSeries(context: DrawContext): ResolvedSeries[];
}

export interface ZoomSync {
  context: DrawContext;
  layout: CartesianLayout;
  total: number;
  range: IndexRange | null;
  categories: readonly XValue[];
  titleOf: (value: XValue) => string;
  start: number;
  end: number;
  labels: { resetZoom: string; brush: string };
}

export interface Zoom {
  /** The window being dragged on the plot, in plot pixels. */
  selection(): { from: number; to: number } | null;
  sync(input: ZoomSync | null): void;
  /** Puts the slider and the button back after a state screen replaced the drawing's children. */
  restore(): void;
  destroy(): void;
}

export function createZoom(
  host: ZoomHost,
  root: SVGSVGElement,
  signal: AbortSignal,
  isOn: () => boolean,
): Zoom {
  host.adopt(css);
  let dragFrom: number | null = null;
  let dragged = false;
  let selection: { from: number; to: number } | null = null;
  let wanted = false;
  let mini: SVGGElement | undefined;
  let slider: HTMLElement | undefined;
  let reset: HTMLButtonElement | undefined;
  let brush: { update(patch: object): void; destroy(): void } | undefined;
  let loading = false;
  let patch: object | undefined;
  const opts = { signal };

  const local = (event: PointerEvent): number | null => {
    const layout = host.layout();
    const box = root.getBoundingClientRect();
    if (!layout || !box.width) return null;
    const x = (event.clientX - box.left) * (layout.width / box.width) - layout.margin.left;
    const y = (event.clientY - box.top) * (layout.height / box.height) - layout.margin.top;
    return x < 0 || y < 0 || x > layout.innerWidth || y > layout.innerHeight ? null : x;
  };
  root.addEventListener(
    "pointerdown",
    (event) => {
      if (!isOn() || event.button !== 0 || event.pointerType === "touch") return;
      const x = local(event);
      if (x === null || host.layout()?.horizontal) return;
      dragFrom = x;
      dragged = false;
      root.setPointerCapture(event.pointerId);
    },
    opts,
  );
  root.addEventListener(
    "pointermove",
    (event) => {
      const layout = host.layout();
      if (dragFrom === null || !layout) return;
      const box = root.getBoundingClientRect();
      const raw = (event.clientX - box.left) * (layout.width / box.width) - layout.margin.left;
      const x = Math.min(Math.max(raw, 0), layout.innerWidth);
      if (!dragged && Math.abs(x - dragFrom) <= 4) return;
      dragged = true;
      host.claim();
      selection = { from: Math.min(dragFrom, x), to: Math.max(dragFrom, x) };
      host.redraw();
    },
    opts,
  );
  const finish = (event: PointerEvent) => {
    if (dragFrom === null) return;
    const layout = host.layout();
    const chosen = selection;
    dragFrom = null;
    selection = null;
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    if (!dragged) return;
    dragged = false;
    if (layout && chosen && event.type === "pointerup") {
      const lo = layout.indexAt(chosen.from);
      const hi = layout.indexAt(chosen.to);
      if (hi - lo >= 1) host.setRange([host.source(lo), host.source(hi)]);
    }
    host.redraw();
  };
  root.addEventListener("pointerup", finish, opts);
  root.addEventListener("pointercancel", finish, opts);

  const removeOverlays = () => {
    mini?.remove();
    slider?.remove();
    reset?.remove();
    brush?.destroy();
    brush = undefined;
    loading = false;
  };
  signal.addEventListener("abort", removeOverlays, { once: true });

  return {
    selection: () => selection,
    restore() {
      for (const el of [slider, reset])
        if (el && !el.isConnected && wanted) host.drawing.append(el);
    },
    destroy: removeOverlays,
    sync(input) {
      wanted = input !== null;
      if (!input) {
        removeOverlays();
        return;
      }
      const { context, layout, total, range, categories, titleOf, start, end, labels } = input;
      const { margin, innerWidth } = layout;
      const top = context.height - BRUSH_HEIGHT;
      const track = pointScale({ count: total, range: [0, innerWidth] });
      const current: IndexRange = range ?? [0, total - 1];
      const x0 = track.center(current[0]);
      const x1 = track.center(current[1]);

      mini ??= svg("g", { "aria-hidden": "true" });
      mini.replaceChildren();
      mini.setAttribute("transform", `translate(${margin.left},${top})`);
      mini.append(
        svg("rect", {
          "data-e17": "track",
          x: 0,
          y: 0.5,
          width: innerWidth,
          height: BRUSH_HEIGHT - 1,
          rx: 10,
        }),
      );
      const fullSeries = host.fullSeries(context);
      let lo = 0;
      let hi = Number.NEGATIVE_INFINITY;
      for (const item of fullSeries)
        for (const value of item.data) {
          if (value == null) continue;
          if (value < lo) lo = value;
          if (value > hi) hi = value;
        }
      const span = (hi === Number.NEGATIVE_INFINITY ? 1 : hi) - lo || 1;
      const y = (value: number) => BRUSH_HEIGHT - 6 - ((value - lo) / span) * (BRUSH_HEIGHT - 14);
      for (const item of fullSeries) {
        const parts: string[] = [];
        let open = false;
        for (let index = 0; index < item.data.length; index += 1) {
          const value = item.data[index];
          if (value == null) {
            open = false;
            continue;
          }
          parts.push(`${open ? "L" : "M"}${track.center(index).toFixed(1)},${y(value).toFixed(1)}`);
          open = true;
        }
        mini.append(
          svg("path", {
            d: parts.join(""),
            fill: "none",
            "stroke-width": 1.25,
            style: `stroke:${item.color};stroke-opacity:.85`,
          }),
        );
      }
      mini.append(
        svg("rect", {
          "data-e17": "veil",
          x: 0,
          y: 0,
          width: Math.max(0, x0),
          height: BRUSH_HEIGHT,
        }),
        svg("rect", {
          "data-e17": "veil",
          x: x1,
          y: 0,
          width: Math.max(0, innerWidth - x1),
          height: BRUSH_HEIGHT,
        }),
        svg("rect", {
          "data-e17": "window",
          x: x0,
          y: 0.5,
          width: Math.max(0, x1 - x0),
          height: BRUSH_HEIGHT - 1,
          rx: 8,
          "stroke-width": 1.25,
        }),
      );
      for (const x of [x0, x1])
        mini.append(
          svg("rect", {
            "data-e17": "handle",
            x: x - 4,
            y: BRUSH_HEIGHT / 2 - 12,
            width: 8,
            height: 24,
            rx: 4,
            "stroke-width": 1.25,
          }),
        );
      if (!mini.isConnected) root.append(mini);

      const drawing = host.drawing;
      if (!slider) {
        slider = document.createElement("div");
        // A drag or a key run ends here: the one `zoom` event of the gesture.
        for (const type of ["pointerup", "pointercancel", "keyup", "blur"])
          slider.addEventListener(type, () => host.flush(), { signal });
      }
      slider.dataset.e17 = "slider";
      slider.setAttribute("role", "slider");
      slider.tabIndex = 0;
      slider.setAttribute("aria-label", labels.brush);
      slider.setAttribute("aria-valuemin", "0");
      slider.setAttribute("aria-valuemax", `${total - 1}`);
      slider.setAttribute("aria-valuenow", `${current[0]}`);
      slider.setAttribute(
        "aria-valuetext",
        `${titleOf(categories[start] as XValue)} – ${titleOf(categories[end] as XValue)}`,
      );
      Object.assign(slider.style, {
        position: "absolute",
        left: `${margin.left}px`,
        top: `${top}px`,
        width: `${innerWidth}px`,
        height: `${BRUSH_HEIGHT}px`,
        touchAction: "none",
        borderRadius: "10px",
      });
      if (!slider.isConnected) drawing.append(slider);

      if (!reset) {
        reset = document.createElement("button");
        reset.type = "button";
        reset.dataset.e17 = "reset";
        reset.addEventListener(
          "click",
          () => {
            host.setRange(null);
            host.flush();
          },
          { signal },
        );
      }
      reset.textContent = labels.resetZoom;
      reset.hidden = !range;
      if (!reset.isConnected) drawing.append(reset);

      patch = {
        count: total,
        range: current,
        offset: 0,
        indexAt: (pixel: number) => track.indexAt(pixel),
        position: (index: number) => track.center(index),
        // A drag moves the window many times: redraw each time, announce once (see `flush`).
        onChange: (next: IndexRange) => host.setRange(next, true),
      };
      if (brush) brush.update(patch);
      else if (!loading) {
        loading = true;
        import("@jcsoftdev/ui-core/chart/brush").then(({ attachIndexBrush }) => {
          if (signal.aborted || !wanted || brush || !slider || !patch) return;
          brush = attachIndexBrush(slider, patch as never);
        });
      }
    },
  };
}
