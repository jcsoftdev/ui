import { type DefineOptions, defineElement } from "../internal/base.js";
import { UiHistogram } from "../internal/e17-histogram.js";

export type {
  Bin,
  BinRule,
  DistributionAxisOptions,
  HistogramSeries,
} from "../internal/e17-histogram.js";
/**
 * `<ui-histogram>`: the shape of raw observations. Bins are shared by every visible series (several
 * series overlap); the rule is automatic (Freedman-Diaconis, Sturges when the IQR is 0), a count or
 * an exact width. Counts or densities, an optional fitted normal curve and an "explode into dots"
 * view.
 *
 * Attributes: `bins` (`auto`, `sturges`, `freedman-diaconis` or a number), `bin-width`, `domain`
 * (`min,max`), `mode="count|density"`, `normal-curve`, `exploded`, `explode-toggle`, `grid="off"`,
 * plus the chart attributes. Properties: `series`, `xAxis`, `yAxis`, `binFormat`, `copy`,
 * `exploded`. Event: `explode`.
 */
export { UiHistogram, UiHistogram as default };

/** Registers `<ui-histogram>` (or `<prefix>-histogram`) and returns the tag. */
export function defineHistogram(options?: DefineOptions): string {
  return defineElement("histogram", UiHistogram, options);
}
