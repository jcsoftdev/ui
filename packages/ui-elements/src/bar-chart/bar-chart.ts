import { type DefineOptions, defineElement } from "../internal/base.js";
import { CartesianElement } from "../internal/e17-cartesian.js";

export type {
  AxisSpec,
  CartesianSeries,
  ValueAxisOptions,
  XValue,
} from "../internal/e17-cartesian.js";

/**
 * `<ui-bar-chart>`: columns (or horizontal bars) for one or more series on the chart base. Several
 * series group side by side, or pile up with `stack`; bars are rounded at their value end only and
 * negative values grow the other way. Hover or focus shows a crosshair band and the category's
 * details; arrows, Home and End walk the categories (one tab stop). Dragging on the plot zooms
 * (`brush`), a click, Enter or a tap pins a category, and `chart-select` / `chart-drill` report it.
 *
 * Attributes: `orientation` (`vertical`, `horizontal`), `stack` (`none`, `normal`, `percent`),
 * `distributed` (one palette color per bar), `data-labels`, `bar-radius` (px, default 6), `grid="off"`,
 * `crosshair="off"`, `brush` (drag to zoom plus an overview strip and reset button),
 * `category-label-rotation` (degrees), `category-tick-every`, plus the chart attributes (`label`,
 * `height`, `locale`, `value-format`, `currency`, `palette`, `animate`...). Properties:
 * `categories`, `series` (`{ id, name, data | ranges, axis, color, dashed, format, stackGroup, colors }`),
 * `yAxis`, `rightAxis`, `axes` (any number of value axes), `xFormat`, `zoom`, `copy` (strings),
 * `labels`. Events: `zoom` plus the chart events.
 */
export class UiBarChart extends CartesianElement {
  protected readonly kind = "column" as const;
}

/** Registers `<ui-bar-chart>` (or `<prefix>-bar-chart`) and returns the tag. */
export function defineBarChart(options?: DefineOptions): string {
  return defineElement("bar-chart", UiBarChart, options);
}
