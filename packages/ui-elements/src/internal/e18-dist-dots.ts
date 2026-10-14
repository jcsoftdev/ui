// Loaded on demand by the box plot and the violin when `show-points` is on: the observation dots as
// SVG circles (few samples) or painted on the canvas layer (many).
import type { sequentialColor } from "@jcsoftdev/ui-core/chart/color-scale";
import type { JitteredValue } from "@jcsoftdev/ui-core/chart/distribution";
import { svg } from "./chart-dom.js";
import type { PointColoring } from "./e18-dist.js";

export interface ObservationOptions {
  points: readonly JitteredValue[];
  map: (value: number) => number;
  center: number;
  horizontal: boolean;
  color: string;
  /** "value" grades the fill from a pale tint of `color` to `color` across `range`. */
  coloring?: PointColoring;
  range?: readonly [number, number];
  radius?: number;
  /** The color scale; required for `coloring: "value"`, which falls back to the series color without it. */
  sequential?: typeof sequentialColor;
}

/** Raw observations of a box or violin as small dots (jitter already applied). */
export function observationDots({
  points,
  map,
  center,
  horizontal,
  color,
  coloring = "series",
  range,
  radius = 2.6,
  sequential,
}: ObservationOptions): SVGGElement {
  const graded = coloring === "value" && range != null && sequential != null;
  const g = svg("g", { "data-observations": "", "aria-hidden": "true", "pointer-events": "none" });
  for (const point of points) {
    const at = map(point.value);
    const fill = graded
      ? sequential(point.value, range, { mid: "var(--surface)", high: color }).color
      : color;
    g.append(
      svg("circle", {
        cx: horizontal ? at : center + point.offset,
        cy: horizontal ? center + point.offset : at,
        r: radius,
        "stroke-width": graded ? 0.75 : 0.5,
        style: `fill:${fill};fill-opacity:${graded ? 0.95 : 0.6};stroke:${graded ? color : "var(--surface)"}`,
      }),
    );
  }
  return g;
}

export interface PaintOptions extends ObservationOptions {
  /** Turns a CSS color into one a canvas accepts (see `colorResolver`). */
  resolve: (color: string) => string;
  /** Offset of the plot inside the canvas (the chart margin). */
  left: number;
  top: number;
}

/** The same dots as `observationDots`, painted in one loop on the canvas layer. */
export function paintObservations(
  g: CanvasRenderingContext2D,
  {
    points,
    map,
    center,
    horizontal,
    color,
    coloring = "series",
    range,
    radius = 2.6,
    sequential,
    resolve,
    left,
    top,
  }: PaintOptions,
): void {
  const fill = resolve(color);
  const graded = coloring === "value" && range != null && sequential != null;
  g.globalAlpha = graded ? 0.95 : 0.6;
  if (graded) {
    const mid = resolve("var(--surface)");
    const side = radius * 2;
    for (const point of points) {
      const at = map(point.value);
      const x = (horizontal ? at : center + point.offset) + left;
      const y = (horizontal ? center + point.offset : at) + top;
      g.fillStyle = sequential(point.value, range, { mid, high: fill }).color;
      g.fillRect(x - radius, y - radius, side, side);
    }
  } else {
    g.fillStyle = fill;
    g.beginPath();
    for (const point of points) {
      const at = map(point.value);
      const x = (horizontal ? at : center + point.offset) + left;
      const y = (horizontal ? center + point.offset : at) + top;
      g.moveTo(x + radius, y);
      g.arc(x, y, radius, 0, Math.PI * 2);
    }
    g.fill();
  }
  g.globalAlpha = 1;
}

export { colorResolver } from "./e18-canvas-color.js";

export interface RainOptions {
  values: readonly number[];
  map: (value: number) => number;
  random: () => number;
  /** Top of the rain band and its height. */
  from: number;
  spread: number;
  radius: number;
  color: string;
  left: number;
  top: number;
}

/** A raincloud's rain painted in one loop on the canvas layer. */
export function paintRain(
  g: CanvasRenderingContext2D,
  { values, map, random, from, spread, radius, color, left, top }: RainOptions,
): void {
  g.globalAlpha = 0.55;
  g.fillStyle = color;
  g.beginPath();
  for (const value of values) {
    const x = map(value) + left;
    const y = from + random() * spread + top;
    g.moveTo(x + radius, y);
    g.arc(x, y, radius, 0, Math.PI * 2);
  }
  g.fill();
  g.globalAlpha = 1;
}
