import { type DefineOptions, defineElement } from "../internal/base.js";
import { ChoiceGroup, ChoiceItem } from "../internal/form-controls.js";
import optionCss from "./accent-option.css.js";
import css from "./accent-picker.css.js";

/**
 * `<ui-accent-option>`: one swatch of a `<ui-accent-picker>` (`role="radio"`, `aria-checked`).
 * Attributes: `value`, `swatch` (any CSS colour, typically `var(--accent)`), `disabled`. The label
 * is the content.
 */
export class UiAccentOption extends ChoiceItem {
  static override observedAttributes = [...ChoiceItem.observedAttributes, "swatch"];
  protected readonly choiceRole = "radio" as const;
  protected readonly template = '<span part="swatch" aria-hidden="true"></span><slot></slot>';
  protected readonly css = optionCss;

  override attributeChangedCallback(): void {
    this.#swatch();
    super.attributeChangedCallback();
  }

  override connectedCallback(): void {
    this.#swatch();
    super.connectedCallback();
  }

  #swatch(): void {
    const swatch = this.getAttribute("swatch");
    if (swatch) this.style.setProperty("--ui-accent-swatch", swatch);
    else this.style.removeProperty("--ui-accent-swatch");
  }
}

/**
 * `<ui-accent-picker>`: exclusive swatch picker (WAI-ARIA radio group of `<ui-accent-option>`).
 * Same keyboard and form behaviour as `<ui-radio-button-group>`: one tab stop, arrows move
 * focus and selection, Space selects, it submits `name=value` and restores the `value` attribute
 * on `form.reset()`. With no `value` the first option is selected, like the React kit. The host
 * exposes `data-accent` with the active value; applying it to the document is up to the consumer.
 *
 * Attributes: `name`, `value`, `required`, `disabled`. Events: `input` and `change`.
 */
export class UiAccentPicker extends ChoiceGroup {
  protected readonly ui = "accent-picker";
  protected readonly itemPart = "accent-option";
  protected readonly css = css;

  protected override fallbackValue(): string {
    return this.items()[0]?.getAttribute("value") ?? "";
  }

  protected override render(): void {
    super.render();
    this.dataset.accent = this.value;
  }
}

/** Registers `<ui-accent-picker>` and `<ui-accent-option>` (or the prefixed tags); returns the picker tag. */
export function defineAccentPicker(options?: DefineOptions): string {
  defineElement("accent-option", UiAccentOption, options);
  return defineElement("accent-picker", UiAccentPicker, options);
}
