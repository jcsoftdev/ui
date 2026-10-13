import { ChoiceItem } from "./form-controls.js";
import css from "./option-button.css.js";

const TEMPLATE =
  '<span part="icon" aria-hidden="true"><slot name="icon"></slot></span>' +
  '<span part="text"><span part="label"><slot></slot></span>' +
  '<span part="description"><slot name="description"></slot></span></span>';

/** A selectable card-button: the label is the content, `slot="icon"` and `slot="description"` are optional. */
export abstract class OptionButton extends ChoiceItem {
  protected readonly template = TEMPLATE;
  protected readonly css = css;
}
