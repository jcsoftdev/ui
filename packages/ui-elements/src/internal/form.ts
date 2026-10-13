import { ElementBase } from "./base.js";

/**
 * Base for a form-associated element whose value is a string (sliders, selects, pin inputs...).
 * It owns the ElementInternals plumbing: `name`, `value` (the `value` attribute is the default,
 * restored by `form.reset()`), `disabled` (own attribute or a disabled fieldset), `required`,
 * `form`, `validity`, `checkValidity()`, `reportValidity()` and form state restore. Subclasses
 * implement `render()` (called after every change) and may override `validate()`.
 *
 * Call `commit(value)` for a user change: it updates the value, renders and fires `input` and
 * `change`.
 */
export abstract class FormElement extends ElementBase {
  static formAssociated = true;
  static observedAttributes = ["value", "disabled", "required", "name"];

  protected readonly internals = this.attachInternals();
  #value = "";
  #dirty = false;
  #formDisabled = false;

  get value(): string {
    return this.#value;
  }
  set value(value: string) {
    this.#dirty = true;
    this.#value = value;
    this.update();
  }
  get defaultValue(): string {
    return this.getAttribute("value") ?? "";
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled") || this.#formDisabled;
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }
  get required(): boolean {
    return this.hasAttribute("required");
  }
  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  connectedCallback(): void {
    if (!this.#dirty) this.#value = this.defaultValue;
    this.update();
  }

  attributeChangedCallback(name: string, _old?: string | null, _next?: string | null): void {
    if (name === "value" && !this.#dirty) this.#value = this.defaultValue;
    this.update();
  }

  formResetCallback(): void {
    this.#dirty = false;
    this.#value = this.defaultValue;
    this.update();
  }

  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.update();
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === "string") this.value = state;
  }

  /** A user change: sets the value, renders, fires `input` and `change`. */
  protected commit(value: string): void {
    if (this.disabled || value === this.#value) return;
    this.value = value;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Syncs the form value, validity, `aria-disabled`/`aria-required`, then `render()`. */
  protected update(): void {
    this.internals.setFormValue(this.#value || null);
    this.internals.ariaDisabled = this.disabled ? "true" : null;
    this.internals.ariaRequired = this.required ? "true" : null;
    const problem = this.validate();
    if (problem) this.internals.setValidity(problem.flags, problem.message, problem.anchor);
    else this.internals.setValidity({});
    this.render();
  }

  /** The default rule: `required` with an empty value is `valueMissing`. */
  protected validate():
    | { flags: ValidityStateFlags; message: string; anchor?: HTMLElement }
    | undefined {
    if (this.required && !this.#value)
      return { flags: { valueMissing: true }, message: "Fill in this field." };
    return undefined;
  }

  protected abstract render(): void;
}
