import { type DefineOptions, defineElement } from "../internal/base.js";
import { UiDonutBase } from "../internal/e20-donut.js";

export type { DonutCrumb, DonutDatum } from "../internal/e20-donut.js";

/**
 * `<ui-donut-chart>`: a ring of slices with rounded corners and a gap, a centre total that follows
 * the hovered slice, slices that step out on hover, focus or legend hover, optional labels and
 * drill-down. React `DonutChart`.
 *
 * ARIA: a `group` of named images, one per slice; one tab stop, arrows (wrapping), Home, End; Enter
 * or Space pins a slice, Escape clears. Add `<ui-chart-legend>`, `<ui-chart-tooltip>`,
 * `<ui-chart-breadcrumb>` or `<ui-chart-data-table>` inside it to opt into each part; a legend
 * inside a chart wider than 32rem sits beside the drawing.
 *
 * Attributes: `data` (JSON: `{ id, name, value, color?, children? }[]`), `variant` (`donut`, `pie`),
 * `semi`, `inner-radius` (0.2 to 0.9 of the radius, default 0.62), `corner-radius` (px, default 6),
 * `gap` (px, default 3), `explode` (px a hovered slice steps out, default 8), `start-angle`
 * (degrees from 12 o'clock), `monochrome` (flag, or a base color), `fill` (`solid`, `gradient`,
 * `pattern`), `drilldown="off"`, `root-label`, `outside-labels` (flag, `name`, `percent`, `both`),
 * `slice-labels` (flag, `percent`, `value`), `center-label`, `center-value`, `initial-hidden` (ids,
 * comma separated), plus the chart attributes (`label`, `description`, `height`, `aspect-ratio`,
 * `locale`, `value-format`, `currency`, `palette`, `animate`, `loading`, `empty`...).
 * Properties: `data` (a datum may carry its own `format`), `crumbs`, `goTo(id)`, `labels`
 * (`total`, `value`, `share`), `valueFormat`, `palette`.
 * Events: `chart-hover`, `chart-select` (`{ index, category }`: the pinned slice; a slice with
 * children opens instead), `chart-series`, `chart-data`.
 */
export class UiDonutChart extends UiDonutBase {}

/** Registers `<ui-donut-chart>` (or `<prefix>-donut-chart`) and returns the tag. */
export function defineDonutChart(options?: DefineOptions): string {
  return defineElement("donut-chart", UiDonutChart, options);
}
