import { type DefineOptions, defineElement } from "../internal/base.js";
import { UiDonutBase } from "../internal/e20-donut.js";

export type { DonutCrumb, DonutDatum } from "../internal/e20-donut.js";

/**
 * `<ui-pie-chart>`: a donut without the hole (React `PieChart`): the same slices, rounded corners
 * (8px by default), gaps, step-out on hover, labels, legend toggling and drill-down. It takes the
 * attributes of `<ui-donut-chart>` except `variant`, `inner-radius`, `center-label` and
 * `center-value`.
 */
export class UiPieChart extends UiDonutBase {
  protected override defaultCorner = 8;
  protected override variant(): "pie" {
    return "pie";
  }
}

/** Registers `<ui-pie-chart>` (or `<prefix>-pie-chart`) and returns the tag. */
export function definePieChart(options?: DefineOptions): string {
  return defineElement("pie-chart", UiPieChart, options);
}
