import { type DefineOptions, defineElement } from "../internal/base.js";
import { ToggleElement } from "../internal/toggle.js";
import css from "./checkbox.css.js";

const TEMPLATE =
  '<span part="box" aria-hidden="true">' +
  '<svg part="check" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5"/></svg>' +
  '<svg part="dash" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h6"/></svg>' +
  "</span><slot></slot>";

/**
 * `<ui-checkbox>`: `role="checkbox"` on the host, `checked` / `indeterminate` (`aria-checked`
 * true, false or mixed), `disabled`, `required`, `name`, `value`. Space toggles. Form-associated.
 * Styling hooks: `data-state` and `:state(checked)` / `:state(indeterminate)`.
 */
export class UiCheckbox extends ToggleElement {
  protected readonly controlRole = "checkbox" as const;
  protected readonly template = TEMPLATE;
  protected readonly css = css;
}

/** Registers `<ui-checkbox>` (or `<prefix-checkbox>`) and returns the tag. */
export const defineCheckbox = (options?: DefineOptions) =>
  defineElement("checkbox", UiCheckbox, options);
