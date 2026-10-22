import { type DefineOptions, defineElement } from "../internal/base.js";
import { ProgressBase } from "../internal/e1-progress.js";
import css from "./progress.css.js";

/**
 * `<ui-progress>`: a determinate or indeterminate progress bar (WAI-ARIA `progressbar`, role on
 * the host).
 * Attributes: `value` (a missing or out-of-range value is indeterminate), `max` (default 100),
 * `value-text` (replaces the `aria-valuetext`, which defaults to the rounded percentage). The
 * `valueLabel(value, max)` property takes a function instead. `data-state` is `indeterminate`,
 * `loading` or `complete`. Give it an accessible name with `aria-label` or `aria-labelledby`.
 */
export class UiProgress extends ProgressBase {
  constructor() {
    super(css);
  }
}

/** Registers `<ui-progress>` (or `<prefix-progress>`) and returns the tag. */
export function defineProgress(options?: DefineOptions): string {
  return defineElement("progress", UiProgress, options);
}
