import { type DefineOptions, defineElement } from "../internal/base.js";
import { ChoiceGroup } from "../internal/form-controls.js";
import { OptionButton } from "../internal/option-button.js";
import css from "./radio-button-group.css.js";

/**
 * `<ui-radio-button>`: one card-button of a `<ui-radio-button-group>` (`role="radio"`,
 * `aria-checked`). Attributes: `value`, `disabled`. The label is the content; add a child with
 * `slot="icon"` and/or `slot="description"`. The group owns selection and focus.
 */
export class UiRadioButton extends OptionButton {
  protected readonly choiceRole = "radio" as const;
}

/**
 * `<ui-radio-button-group>`: exclusive choice where each option is a button-like card (WAI-ARIA
 * radio group). Light DOM, form-associated, on the `FormElement` base, so it behaves like a set of
 * native radios: one tab stop (on the checked card, else the first), arrows move focus and
 * selection together, Space selects, it submits `name=value`, `required` without a choice is
 * `valueMissing`, `form.reset()` restores the `value` attribute and a disabled fieldset disables it.
 * Name it with `aria-label` or `aria-labelledby`.
 *
 * Attributes: `name`, `value`, `required`, `disabled`. A card with `disabled` is skipped by arrows.
 * Events: `input` and `change` when the user picks another card (React `onValueChange`).
 */
export class UiRadioButtonGroup extends ChoiceGroup {
  protected readonly ui = "radio-button-group";
  protected readonly itemPart = "radio-button";
  protected readonly css = css;
}

/** Registers `<ui-radio-button-group>` and `<ui-radio-button>` (or the prefixed tags); returns the group tag. */
export function defineRadioButtonGroup(options?: DefineOptions): string {
  defineElement("radio-button", UiRadioButton, options);
  return defineElement("radio-button-group", UiRadioButtonGroup, options);
}
