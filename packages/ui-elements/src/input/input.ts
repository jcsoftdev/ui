import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import css from "./input.css.js";

/** Attributes copied as they are onto the inner `<input>`. */
const FORWARDED = [
  "type",
  "placeholder",
  "required",
  "readonly",
  "minlength",
  "maxlength",
  "pattern",
  "min",
  "max",
  "step",
  "autocomplete",
  "inputmode",
  "enterkeyhint",
  "spellcheck",
] as const;

/**
 * `<ui-input>`: a native `<input>` in a shadow root (focus is delegated to it), form-associated
 * through ElementInternals: its value is submitted under the host's `name`, its constraint
 * validity is the host's, and `form.reset()` restores the `value` attribute.
 *
 * Accessible name: `aria-label` or `label` on the host, else the text of the `<label>`s that
 * point at the host (`<label for>` or a wrapping label), which the inner input references through
 * `ariaLabelledByElements` where supported. `invalid` sets `aria-invalid`.
 */
export class UiInput extends ElementBase {
  static formAssociated = true;
  static observedAttributes = [
    ...FORWARDED,
    "disabled",
    "value",
    "label",
    "aria-label",
    "invalid",
    "name",
  ];

  readonly #internals = this.attachInternals();
  readonly #input: HTMLInputElement;
  #dirty = false;
  #formDisabled = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML = `<input part="input">`;
    this.#input = root.querySelector("input") as HTMLInputElement;
    this.#input.addEventListener("input", () => {
      this.#dirty = true;
      this.#commit();
    });
    // `change` is not composed: re-dispatch it from the host.
    this.#input.addEventListener("change", () => emit(this, "change"));
  }

  get value(): string {
    return this.#input.value;
  }
  set value(value: string) {
    this.#dirty = true;
    this.#input.value = value;
    this.#commit();
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }
  get validity(): ValidityState {
    return this.#internals.validity;
  }
  get validationMessage(): string {
    return this.#internals.validationMessage;
  }
  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }
  /** The inner native input, for selection APIs. */
  get input(): HTMLInputElement {
    return this.#input;
  }

  connectedCallback(): void {
    for (const name of FORWARDED) this.#forward(name);
    if (!this.#dirty) this.#input.value = this.getAttribute("value") ?? "";
    this.#syncDisabled();
    this.#syncName();
    // Labels parsed after the element are only known once the parser has moved on.
    queueMicrotask(() => this.#syncName());
    this.#commit();
  }

  attributeChangedCallback(name: string): void {
    if (name === "value" && !this.#dirty) {
      this.#input.value = this.getAttribute("value") ?? "";
      this.#commit();
    } else if (name === "disabled") this.#syncDisabled();
    else if (name === "label" || name === "aria-label") this.#syncName();
    else if (name === "invalid")
      this.#input.setAttribute("aria-invalid", String(this.hasAttribute("invalid")));
    else if ((FORWARDED as readonly string[]).includes(name)) {
      this.#forward(name);
      this.#commit();
    }
  }

  formResetCallback(): void {
    this.#dirty = false;
    this.#input.value = this.getAttribute("value") ?? "";
    this.#commit();
  }

  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.#syncDisabled();
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    if (typeof state === "string") this.value = state;
  }

  #forward(name: string): void {
    const value = this.getAttribute(name);
    if (value === null) this.#input.removeAttribute(name);
    else this.#input.setAttribute(name, value);
  }

  #syncDisabled(): void {
    this.#input.disabled = this.hasAttribute("disabled") || this.#formDisabled;
  }

  #syncName(): void {
    const own = this.getAttribute("aria-label") ?? this.getAttribute("label");
    const labels = [...(this.#internals.labels as NodeListOf<HTMLLabelElement>)];
    const input = this.#input as HTMLInputElement & { ariaLabelledByElements?: Element[] | null };
    if (own) {
      input.setAttribute("aria-label", own);
      if ("ariaLabelledByElements" in input) input.ariaLabelledByElements = null;
    } else if (labels.length && "ariaLabelledByElements" in input) {
      input.removeAttribute("aria-label");
      input.ariaLabelledByElements = labels;
    } else if (labels.length) {
      input.setAttribute("aria-label", labels.map((label) => label.textContent?.trim()).join(" "));
    } else input.removeAttribute("aria-label");
  }

  #commit(): void {
    this.#internals.setFormValue(this.#input.value);
    const { validity, validationMessage } = this.#input;
    if (validity.valid) this.#internals.setValidity({});
    else this.#internals.setValidity(validity, validationMessage, this.#input);
  }
}

/** Registers `<ui-input>` (or `<prefix-input>`) and returns the tag. */
export const defineInput = (options?: DefineOptions) => defineElement("input", UiInput, options);
