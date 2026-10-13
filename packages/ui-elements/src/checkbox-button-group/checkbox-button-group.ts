import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import { FormElement } from "../internal/form.js";
import { type ChoiceItem, itemsOf, onSpace } from "../internal/form-controls.js";
import { OptionButton } from "../internal/option-button.js";
import css from "./checkbox-button-group.css.js";

/**
 * `<ui-checkbox-button>`: one card-button of a `<ui-checkbox-button-group>` (`role="checkbox"`,
 * `aria-checked`, its own tab stop). Attributes: `value`, `disabled`. The label is the content; add
 * a child with `slot="icon"` and/or `slot="description"`.
 */
export class UiCheckboxButton extends OptionButton {
  protected readonly choiceRole = "checkbox" as const;
}

/**
 * `<ui-checkbox-button-group>`: multi-select where each option is a button-like card (WAI-ARIA
 * `group` of checkboxes). Light DOM, form-associated, on the `FormElement` base: every card is its
 * own tab stop and Space (or a click) toggles it. It submits one `name=value` entry per checked
 * card, `required` with nothing checked is `valueMissing`, and `form.reset()` restores the `value`
 * attribute. Name it with `aria-label` or `aria-labelledby`.
 *
 * Attributes: `name`, `value` (comma-separated, so values must not contain commas; the `values`
 * property takes any array), `required`, `disabled`. Events: `input` and `change` on a user toggle.
 */
export class UiCheckboxButtonGroup extends FormElement {
  constructor() {
    super();
    this.internals.role = "group";
    this.addEventListener("ui-choice-select", (event) => {
      event.stopPropagation();
      this.#toggle(event.target as ChoiceItem);
    });
    this.addEventListener("ui-choice-change", (event) => {
      event.stopPropagation();
      this.update();
    });
    this.addEventListener("keydown", (event) =>
      onSpace(
        event,
        () => this.#items(),
        (item) => this.#toggle(item),
      ),
    );
  }

  /** The checked values, in the order they were checked. */
  get values(): string[] {
    return this.value ? this.value.split(",") : [];
  }
  set values(values: string[]) {
    this.value = values.join(",");
  }

  override connectedCallback(): void {
    this.dataset.ui = "checkbox-button-group";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
  }

  #items(): ChoiceItem[] {
    return itemsOf(this, "checkbox-button", "checkbox-button-group");
  }

  #toggle(item: ChoiceItem): void {
    if (this.disabled || item.hasAttribute("disabled")) return;
    const value = item.getAttribute("value") ?? "";
    const values = this.values;
    this.commit(
      (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]).join(","),
    );
  }

  protected override update(): void {
    super.update();
    const data = new FormData();
    if (this.name) for (const value of this.values) data.append(this.name, value);
    this.internals.setFormValue(this.values.length ? data : null, this.value);
  }

  protected render(): void {
    const checked = new Set(this.values);
    for (const item of this.#items())
      item.sync(
        checked.has(item.getAttribute("value") ?? ""),
        this.disabled || item.hasAttribute("disabled"),
      );
  }

  protected override validate() {
    const problem = super.validate();
    return (
      problem && {
        flags: problem.flags,
        message: "Select at least one option.",
        anchor: this.#items()[0],
      }
    );
  }
}

/** Registers `<ui-checkbox-button-group>` and `<ui-checkbox-button>` (or the prefixed tags); returns the group tag. */
export function defineCheckboxButtonGroup(options?: DefineOptions): string {
  defineElement("checkbox-button", UiCheckboxButton, options);
  return defineElement("checkbox-button-group", UiCheckboxButtonGroup, options);
}
