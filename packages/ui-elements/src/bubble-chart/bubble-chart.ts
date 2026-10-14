import { type DefineOptions, defineElement } from "../internal/base.js";
import { XYElement } from "../internal/e17-xy.js";

export type {
  BrushRect,
  DistributionAxisOptions,
  QuadrantOptions,
  XYPoint,
  XYSeries,
} from "../internal/e17-xy.js";

/**
 * `<ui-bubble-chart>`: a scatter whose third measure (`point.size`) sets the bubble area. A size
 * key sits under the plot (`size-legend="off"` hides it); `shading="shaded"` renders spheres;
 * points may carry an `image`. Bubbles shrink in narrow frames.
 *
 * Attributes: `size-range` (`min,max` radius px, default `4,30`), `size-legend`, `shading`,
 * `show-labels`, plus the scatter attributes. Properties add `sizeFormat`.
 */
export class UiBubbleChart extends XYElement {
  protected readonly sized = true;
  protected override readonly defaultShowLabels = true;
}

/** Registers `<ui-bubble-chart>` (or `<prefix>-bubble-chart`) and returns the tag. */
export function defineBubbleChart(options?: DefineOptions): string {
  return defineElement("bubble-chart", UiBubbleChart, options);
}
