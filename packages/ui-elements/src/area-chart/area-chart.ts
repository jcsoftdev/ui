import { type DefineOptions, defineElement } from "../internal/base.js";
import { CartesianElement } from "../internal/e17-cartesian.js";
import { lineKit } from "../internal/e17-lines.js";

export type {
  AxisSpec,
  CartesianSeries,
  ChartAnnotation,
  ValueAxisOptions,
  XValue,
} from "../internal/e17-cartesian.js";

/**
 * `<ui-area-chart>`: volume over time with a soft gradient fill. `stack="normal"` piles the series
 * into a total (the tooltip adds a Total row), `stack="percent"` shows each one's share of 100%.
 *
 * Properties also include `annotations` (reference `line` and `range` on either axis, `point` and
 * `text`, as in React; `tone` picks the color family).
 *
 * Attributes: as `<ui-line-chart>`, plus `stack` and `gradient="off"` (flat fill). Properties and
 * events as `<ui-bar-chart>`.
 */
export class UiAreaChart extends CartesianElement {
  protected override readonly lineKit = lineKit;
  protected readonly kind = "area" as const;
  protected override readonly defaultCurve = "smooth" as const;
}

/** Registers `<ui-area-chart>` (or `<prefix>-area-chart`) and returns the tag. */
export function defineAreaChart(options?: DefineOptions): string {
  return defineElement("area-chart", UiAreaChart, options);
}
