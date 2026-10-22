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
 * `<ui-scatter-chart>`: relationships between two measures. Several series, optional least-squares
 * trend lines with R squared, quadrants, seeded jitter for overlapping points and a `canvas`
 * renderer for tens of thousands of points (the points stay reachable by keyboard and screen
 * reader). `brush` draws a rectangle to select a region.
 *
 * Attributes: `trend-line`, `radius`, `x-type="time"`, `jitter` (`x,y` px), `seed`,
 * `renderer="canvas"`, `brush`, `touch-delay`, `show-labels`, `grid="off"`, plus the chart
 * attributes. Properties: `series`, `xAxis`, `yAxis`, `xFormat`, `yFormat`, `quadrants`, `copy`,
 * `brushValue`, `describeBrush`. Event: `brush` (rectangle in data units or null).
 */
export class UiScatterChart extends XYElement {
  protected readonly sized = false;
}

/** Registers `<ui-scatter-chart>` (or `<prefix>-scatter-chart`) and returns the tag. */
export function defineScatterChart(options?: DefineOptions): string {
  return defineElement("scatter-chart", UiScatterChart, options);
}
