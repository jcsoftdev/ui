import { type DefineOptions, defineElement } from "../internal/base.js";
import { SelectBase, type SelectGroup, type SelectOption } from "../internal/e6-select.js";
import css from "./inline-select.css.js";

export type { SelectGroup, SelectOption };

const CHEVRONS =
  '<svg part="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>';

/**
 * `<ui-inline-select>`: the borderless select that reads as part of a sentence or a row ("Repeat
 * every [week v]"). Same engine, attributes, options, events and keyboard as `<ui-select>`: a
 * form-associated select-only combobox with a listbox popup.
 */
export class UiInlineSelect extends SelectBase {
  static override css = css;
  static override icon = CHEVRONS;
}

/** Registers `<ui-inline-select>` (or `<prefix-inline-select>`) and returns the tag. */
export function defineInlineSelect(options?: DefineOptions): string {
  return defineElement("inline-select", UiInlineSelect, options);
}
