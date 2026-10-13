import { type DefineOptions, defineElement } from "../internal/base.js";
import { ProgressBase } from "../internal/e1-progress.js";
import css from "./meter.css.js";

/**
 * `<ui-meter>`: the thinner progress bar. Same API and ARIA as `<ui-progress>` (the React kit's
 * `Meter` is a `progressbar` too): `value`, `max`, `value-text`, `valueLabel()`.
 */
export class UiMeter extends ProgressBase {
  constructor() {
    super(css);
  }
}

/** Registers `<ui-meter>` (or `<prefix-meter>`) and returns the tag. */
export function defineMeter(options?: DefineOptions): string {
  return defineElement("meter", UiMeter, options);
}
