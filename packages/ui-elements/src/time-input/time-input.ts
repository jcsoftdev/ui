import {
  createSegmentedInput,
  normalizeTime,
  type SegmentedInput,
} from "@jcsoftdev/ui-core/segmented-input";
import { adoptStyles, type DefineOptions, defineElement } from "../internal/base.js";
import { numberAttr } from "../internal/e5-forms.js";
import { FormElement } from "../internal/form.js";
import { syncControlAria } from "../internal/form-controls.js";
import css from "./time-input.css.js";

/**
 * `<ui-time-input>`: 24h time field. A masked native text input in a shadow root (so it shows
 * "15:30" whatever the browser locale is), driven by ui-core `segmented-input`: digits only, the
 * colon inserted once the hour is complete, the caret kept in place, and ArrowUp/ArrowDown on the
 * segment under the caret (the hour moves by 1, the minutes by `step`). A half-typed time falls
 * back to the committed one on blur. The value is `HH:MM`, or empty, and it is submitted under
 * `name`.
 *
 * Attributes: `value`, `name`, `step` (minutes, 5), `placeholder` ("HH:MM"), `label` or
 * `aria-label`, `required`, `disabled`, `invalid`. Events: `input` and `change` when a valid time
 * is committed (or the field is cleared).
 */
export class UiTimeInput extends FormElement {
  static override observedAttributes = [
    ...FormElement.observedAttributes,
    "step",
    "placeholder",
    "label",
    "aria-label",
    "aria-describedby",
    "invalid",
  ];

  readonly #input: HTMLInputElement;
  #field: SegmentedInput | undefined;
  #step = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML =
      '<input part="input" type="text" inputmode="numeric" autocomplete="off" maxlength="5">';
    this.#input = root.querySelector("input") as HTMLInputElement;
  }

  /** The inner native input, for selection APIs. */
  get input(): HTMLInputElement {
    return this.#input;
  }

  override get value(): string {
    return normalizeTime(super.value) ?? "";
  }
  override set value(value: string) {
    super.value = value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.update());
  }

  disconnectedCallback(): void {
    this.#field?.destroy();
    this.#field = undefined;
  }

  protected override update(): void {
    const step = Math.max(1, numberAttr(this, "step", 5));
    if (!this.#field || step !== this.#step) {
      this.#step = step;
      this.#field?.destroy();
      this.#field = createSegmentedInput(this.#input, {
        kind: "time",
        value: this.value,
        step,
        onChange: (value) => this.commit(value),
      });
    }
    this.#input.disabled = this.disabled;
    this.#input.placeholder = this.getAttribute("placeholder") ?? "HH:MM";
    syncControlAria(this, this.#input, this.internals.labels as NodeListOf<HTMLLabelElement>);
    super.update();
  }

  protected render(): void {
    // An outside change (property, attribute, reset, restore) reaches the field here; a user edit
    // already committed the same value, so this is then a no-op.
    if (this.#field && this.#field.getValue() !== this.value) this.#field.setValue(this.value);
  }

  protected override validate() {
    const base = super.validate();
    return base && { ...base, anchor: this.#input };
  }
}

/** Registers `<ui-time-input>` (or `<prefix-time-input>`) and returns the tag. */
export function defineTimeInput(options?: DefineOptions): string {
  return defineElement("time-input", UiTimeInput, options);
}
