import { createRovingFocus, type RovingFocus } from "@jcsoftdev/ui-core/roving";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  isPart,
  rootOf,
} from "../internal/base.js";
import radioCss from "./radio.css.js";
import groupCss from "./radio-group.css.js";

/**
 * `<ui-radio>`: one option of a `<ui-radio-group>` (`role="radio"` on the host, `aria-checked`).
 * Attributes: `value`, `disabled`. The label is the content. The group owns selection and focus.
 */
export class UiRadio extends ElementBase {
  static observedAttributes = ["disabled", "value"];
  readonly #internals = this.attachInternals();

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, radioCss);
    root.innerHTML =
      '<span part="circle" aria-hidden="true"><span part="dot"></span></span><slot></slot>';
    this.#internals.role = "radio";
    this.addEventListener("click", () => {
      if (!this.hasAttribute("data-disabled")) emit(this, "ui-radio-select");
    });
  }

  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  connectedCallback(): void {
    this.#render(this.dataset.state === "checked", this.disabled);
    this.closest<HTMLElement>("[data-ui='radio-group']")?.dispatchEvent(
      new Event("ui-radio-change"),
    );
  }

  attributeChangedCallback(): void {
    this.closest("[data-ui='radio-group']")?.dispatchEvent(new Event("ui-radio-change"));
  }

  /** Called by the group. */
  render(checked: boolean, disabled: boolean): void {
    this.#render(checked, disabled);
  }

  #render(checked: boolean, disabled: boolean): void {
    this.dataset.state = checked ? "checked" : "unchecked";
    this.toggleAttribute("data-disabled", disabled);
    this.#internals.ariaChecked = String(checked);
    this.#internals.ariaDisabled = disabled ? "true" : null;
  }
}

/**
 * `<ui-radio-group>`: a light-DOM radiogroup of `<ui-radio>` children, form-associated (submits
 * `name=value`). Arrow keys move focus and selection together, Space selects, one tab stop sits
 * on the checked radio (else the first). Attributes: `name`, `value`, `required`, `disabled`,
 * `orientation` (vertical | horizontal; arrows work on both axes like the native group).
 * Fires `change` (and `input`) when the user changes the value.
 */
export class UiRadioGroup extends ElementBase {
  static formAssociated = true;
  static observedAttributes = ["value", "disabled", "required"];

  readonly #internals = this.attachInternals();
  #value: string | null = null;
  #dirty = false;
  #formDisabled = false;
  #roving: RovingFocus | undefined;

  constructor() {
    super();
    this.#internals.role = "radiogroup";
    this.addEventListener("ui-radio-select", (event) => {
      event.stopPropagation();
      this.#choose(event.target as UiRadio);
    });
    this.addEventListener("ui-radio-change", () => this.#render());
    this.addEventListener("keydown", (event) => {
      if (event.key !== " ") return;
      const radio = this.#radios().find((item) => item === event.target);
      if (!radio) return;
      event.preventDefault();
      this.#choose(radio);
    });
  }

  get value(): string | null {
    return this.#value;
  }
  set value(value: string | null) {
    this.#dirty = true;
    this.#value = value;
    this.#render();
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled") || this.#formDisabled;
  }
  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }
  get validity(): ValidityState {
    return this.#internals.validity;
  }
  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }

  connectedCallback(): void {
    this.dataset.ui = "radio-group";
    adoptStyles(rootOf(this), groupCss);
    if (!this.#dirty) this.#value = this.getAttribute("value");
    this.#roving ??= createRovingFocus(this, {
      items: () => this.#radios(),
      isDisabled: (item) => this.disabled || item.hasAttribute("disabled"),
      onNavigate: (target) => this.#choose(target as UiRadio),
    });
    this.#render();
  }

  disconnectedCallback(): void {
    this.#roving?.destroy();
    this.#roving = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (name === "value" && !this.#dirty) this.#value = this.getAttribute("value");
    this.#render();
  }

  formResetCallback(): void {
    this.#dirty = false;
    this.#value = this.getAttribute("value");
    this.#render();
  }

  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.#render();
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === "string") this.value = state;
  }

  #radios(): UiRadio[] {
    return [...this.querySelectorAll<UiRadio>("*")].filter(
      (element) => isPart(element, "radio") && element.closest("[data-ui='radio-group']") === this,
    );
  }

  #choose(radio: UiRadio): void {
    if (this.disabled || radio.hasAttribute("disabled")) return;
    const value = radio.getAttribute("value") ?? "";
    radio.focus();
    if (value === this.#value) return;
    this.#dirty = true;
    this.#value = value;
    this.#render();
    emit(this, "input");
    emit(this, "change");
  }

  #render(): void {
    const radios = this.#radios();
    let checked: UiRadio | undefined;
    for (const radio of radios) {
      const on = this.#value !== null && radio.getAttribute("value") === this.#value;
      if (on) checked = radio;
      radio.render?.(on, this.disabled || radio.hasAttribute("disabled"));
    }
    this.#roving?.setActive(checked && !checked.hasAttribute("disabled") ? checked : undefined);
    this.#internals.ariaDisabled = this.disabled ? "true" : null;
    this.#internals.ariaRequired = this.hasAttribute("required") ? "true" : null;
    this.#internals.setFormValue(checked ? this.#value : null);
    if (this.hasAttribute("required") && !checked)
      this.#internals.setValidity(
        { valueMissing: true },
        "Select one of these options.",
        radios[0],
      );
    else this.#internals.setValidity({});
  }
}

/** Registers `<ui-radio-group>` and `<ui-radio>` (or the prefixed tags) and returns the group tag. */
export function defineRadioGroup(options?: DefineOptions): string {
  defineElement("radio", UiRadio, options);
  return defineElement("radio-group", UiRadioGroup, options);
}
