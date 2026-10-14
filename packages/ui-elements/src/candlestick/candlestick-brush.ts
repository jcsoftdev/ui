import { attachIndexBrush, type IndexRange } from "@jcsoftdev/ui-core/chart/brush";
import { downsample } from "@jcsoftdev/ui-core/chart/downsample";
import { areaPath, linePath, type Point } from "@jcsoftdev/ui-core/chart/path";
import { pointScale } from "@jcsoftdev/ui-core/chart/scale";
import { adoptStyles, rootOf } from "../internal/base.js";
import { svg } from "../internal/chart-dom.js";
import css from "./candlestick-brush.css.js";

export const BRUSH_HEIGHT = 52;
const OVERVIEW_POINTS = 360;

export interface BrushState {
  count: number;
  range: IndexRange;
  /** Closing prices of the full data: the overview line. */
  closes: readonly number[];
  /** Plot margins on the left and the right, to align with the chart above. */
  left: number;
  right: number;
  width: number;
  label: string;
  resetLabel: string;
  valueText: (range: IndexRange) => string;
  onChange: (range: IndexRange) => void;
}

export interface CandleBrush {
  update(state: BrushState): void;
  destroy(): void;
}

/**
 * The overview window under a candlestick chart (a draggable view over the closing prices) and the
 * reset-zoom button, in a chunk of their own: nothing here is downloaded without `brush`.
 */
export function mountBrush(host: HTMLElement, initial: BrushState): CandleBrush {
  adoptStyles(rootOf(host), css);
  const slider = document.createElement("div");
  slider.dataset.uiPart = "brush";
  slider.setAttribute("role", "slider");
  slider.tabIndex = 0;
  const reset = document.createElement("button");
  reset.type = "button";
  reset.dataset.uiPart = "reset";
  host.append(slider, reset);
  let state = initial;
  const scale = () =>
    pointScale({
      count: state.count,
      range: [0, Math.max(10, state.width - state.left - state.right)],
    });
  const brush = attachIndexBrush(slider, {
    count: initial.count,
    range: initial.range,
    onChange: (range) => state.onChange(range),
    indexAt: (pixel) => scale().indexAt(pixel),
    position: (index) => scale().center(index),
    offset: initial.left,
  });
  reset.addEventListener("click", () => state.onChange([0, state.count - 1]));

  const render = () => {
    const { width, left, right, count, range, closes } = state;
    const inner = Math.max(10, width - left - right);
    const x = scale();
    const sampled = downsample(
      closes.map((y, i) => ({ x: i, y })),
      OVERVIEW_POINTS,
    );
    const lo = Math.min(0, ...closes);
    const span = Math.max(...closes) - lo || 1;
    const y = (value: number) => BRUSH_HEIGHT - 6 - ((value - lo) / span) * (BRUSH_HEIGHT - 14);
    const points: Point[] = sampled.map((p) => ({ x: x.center(p.x), y: y(p.y) }));
    const bottom = points.map((p) => ({ x: p.x, y: BRUSH_HEIGHT - 6 }));
    const [start, end] = range;
    const x0 = x.center(start);
    const x1 = x.center(end);
    const veil = (from: number, to: number) =>
      svg("rect", {
        x: from,
        y: 0,
        width: Math.max(0, to - from),
        height: BRUSH_HEIGHT,
        style: "fill:var(--surface);fill-opacity:.72",
      });
    const group = svg(
      "g",
      { transform: `translate(${left},0)` },
      svg("rect", {
        x: 0,
        y: 0.5,
        width: inner,
        height: BRUSH_HEIGHT - 1,
        rx: 10,
        style: "fill:var(--surface-2);fill-opacity:.5",
      }),
      svg("path", {
        d: areaPath(points, bottom, "smooth"),
        style: "fill:var(--accent-word);fill-opacity:.14",
      }),
      svg("path", {
        d: linePath(points, "smooth"),
        fill: "none",
        "stroke-width": 1.25,
        style: "stroke:var(--accent-word);stroke-opacity:.85",
      }),
      veil(0, x0),
      veil(x1, inner),
      svg("rect", {
        x: x0,
        y: 0.5,
        width: Math.max(0, x1 - x0),
        height: BRUSH_HEIGHT - 1,
        rx: 8,
        "stroke-width": 1.25,
        style: "fill:var(--accent);fill-opacity:.1;stroke:var(--accent-word);cursor:grab",
      }),
      ...[x0, x1].map((px) =>
        svg("rect", {
          x: px - 4,
          y: BRUSH_HEIGHT / 2 - 12,
          width: 8,
          height: 24,
          rx: 4,
          "stroke-width": 1.25,
          style: "fill:var(--float);stroke:var(--accent-word);cursor:ew-resize",
        }),
      ),
    );
    slider.replaceChildren(
      svg("svg", { "aria-hidden": "true", width, height: BRUSH_HEIGHT }, group),
    );
    slider.style.height = `${BRUSH_HEIGHT}px`;
    slider.setAttribute("aria-label", state.label);
    slider.setAttribute("aria-valuemin", "0");
    slider.setAttribute("aria-valuemax", `${count - 1}`);
    slider.setAttribute("aria-valuenow", `${start}`);
    slider.setAttribute("aria-valuetext", state.valueText(range));
    reset.textContent = state.resetLabel;
    reset.hidden = !(start > 0 || end < count - 1);
  };
  render();

  return {
    update(next) {
      state = next;
      brush.update({
        count: next.count,
        range: next.range,
        offset: next.left,
        indexAt: (pixel) => scale().indexAt(pixel),
        position: (index) => scale().center(index),
      });
      render();
    },
    destroy() {
      brush.destroy();
      slider.remove();
      reset.remove();
    },
  };
}
