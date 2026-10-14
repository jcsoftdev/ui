import { type DefineOptions, defineElement } from "../internal/base.js";
import { barKit, drawBars } from "../internal/e17-bars.js";
import { CartesianElement } from "../internal/e17-cartesian.js";
import type { CartesianLayout } from "../internal/e17-layout.js";
import { lineKit } from "../internal/e17-lines.js";

export type {
  AxisSpec,
  CartesianSeries,
  ChartAnnotation,
  ValueAxisOptions,
  XValue,
} from "../internal/e17-cartesian.js";

/**
 * `<ui-combo-chart>`: columns, lines and areas on one plot, e.g. revenue as columns with
 * appointments as a line on a second axis. Each series says how it is drawn with `type`
 * (`column`, `line`, `area`) and which value axis it reads with `axis` (`left`, `right`, or the id
 * of an entry of `axes`); `stack` applies to the columns and areas.
 *
 * Properties also include `annotations` (reference `line` and `range` on either axis, `point` and
 * `text`, as in React; `tone` picks the color family).
 *
 * Attributes: as `<ui-line-chart>` and `<ui-bar-chart>`. Properties and events as `<ui-bar-chart>`.
 */
export class UiComboChart extends CartesianElement {
  protected override readonly lineKit = lineKit;
  protected override readonly barKit = barKit;
  protected override paintBars(plot: SVGGElement, layout: CartesianLayout): SVGElement[] {
    return drawBars(plot, layout);
  }
  protected readonly kind = undefined;
  protected override readonly defaultCurve = "smooth" as const;
}

/** Registers `<ui-combo-chart>` (or `<prefix>-combo-chart`) and returns the tag. */
export function defineComboChart(options?: DefineOptions): string {
  return defineElement("combo-chart", UiComboChart, options);
}
