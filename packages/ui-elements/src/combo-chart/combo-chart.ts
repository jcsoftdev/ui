import { type DefineOptions, defineElement } from "../internal/base.js";
import { CartesianElement } from "../internal/e17-cartesian.js";

export type {
  AxisSpec,
  CartesianSeries,
  ValueAxisOptions,
  XValue,
} from "../internal/e17-cartesian.js";

/**
 * `<ui-combo-chart>`: columns, lines and areas on one plot, e.g. revenue as columns with
 * appointments as a line on a second axis. Each series says how it is drawn with `type`
 * (`column`, `line`, `area`) and which value axis it reads with `axis` (`left`, `right`, or the id
 * of an entry of `axes`); `stack` applies to the columns and areas.
 *
 * Attributes: as `<ui-line-chart>` and `<ui-bar-chart>`. Properties and events as `<ui-bar-chart>`.
 */
export class UiComboChart extends CartesianElement {
  protected readonly kind = undefined;
  protected override readonly defaultCurve = "smooth" as const;
}

/** Registers `<ui-combo-chart>` (or `<prefix>-combo-chart`) and returns the tag. */
export function defineComboChart(options?: DefineOptions): string {
  return defineElement("combo-chart", UiComboChart, options);
}
