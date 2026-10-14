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
 * `<ui-line-chart>`: trends over categories or time. Smooth monotone curves by default (they never
 * overshoot the data), `curve="linear"` for straight ones, and `step`, `step-before`, `step-after`
 * for values that hold until they change. Dates space themselves by real elapsed time
 * (`x-scale="band"` evens them out). Series may be `dashed`; series beyond `max-points` (2000) are
 * reduced with LTTB. Hover shows a crosshair and one dot per series; `brush` zooms long ranges.
 *
 * Properties also include `annotations` (reference `line` and `range` on either axis, `point` and
 * `text`, as in React; `tone` picks the color family).
 *
 * Attributes: `curve`, `markers`, `data-labels`, `grid="off"`, `crosshair="off"`, `brush`,
 * `x-scale`, `max-points` (number or `off`), `category-label-rotation`, `category-tick-every`,
 * plus the chart attributes. Properties and events as `<ui-bar-chart>`.
 */
export class UiLineChart extends CartesianElement {
  protected override readonly lineKit = lineKit;
  protected readonly kind = "line" as const;
  protected override readonly defaultCurve = "smooth" as const;
}

/** Registers `<ui-line-chart>` (or `<prefix>-line-chart`) and returns the tag. */
export function defineLineChart(options?: DefineOptions): string {
  return defineElement("line-chart", UiLineChart, options);
}
