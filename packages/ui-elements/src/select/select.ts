import { type DefineOptions, defineElement } from "../internal/base.js";
import { SelectBase, type SelectGroup, type SelectOption } from "../internal/e6-select.js";

export type { SelectGroup, SelectOption };

const CHEVRON =
  '<svg part="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

/**
 * `<ui-select>`: a form-associated select-only combobox with a styled listbox popup (use
 * `<ui-native-select>` when the system picker is what you want). The trigger is
 * `role="combobox"` and keeps focus; the popup is a top-layer `role="listbox"` with
 * `aria-activedescendant`, typeahead, Home/End/PageUp/PageDown, Escape and outside press dismiss
 * (stacked, so Escape inside a dialog closes the popup first).
 *
 * Options: `<option>` and `<optgroup>` children (`value`, `disabled`, `selected`, `label`), or the
 * `options` property: `(SelectOption | SelectGroup)[]`. Attributes: `name`, `value` (the default,
 * restored by `form.reset()`), `placeholder` (shown while the value is empty), `required`,
 * `disabled`, `invalid`, `label` or `aria-label` (accessible name; else the `<label>`s that point
 * at it), `material` and the `liquid-*` options. Methods: `show()`, `hide()`. Events: `input` and
 * `change` when the user picks, `open` and `close`.
 */
export class UiSelect extends SelectBase {
  static override icon = CHEVRON;
}

/** Registers `<ui-select>` (or `<prefix-select>`) and returns the tag. */
export function defineSelect(options?: DefineOptions): string {
  return defineElement("select", UiSelect, options);
}
