import { adoptStyles, ElementBase, emit } from "./base.js";

/**
 * Shared behaviour of `<ui-checkbox>` and `<ui-switch>`: the host is the control (role and
 * `aria-checked` through ElementInternals), Space toggles it (Enter too for a switch), a click
 * anywhere on it toggles it, and it is form-associated: `name=value` (default `on`) is submitted
 * while checked, `required` makes an unchecked control invalid, `form.reset()` restores the
 * `checked` attribute. The label is the element's content.
 */
export abstract class ToggleElement extends ElementBase {
  static formAssociated = true;
  static observedAttributes = ["checked", "disabled", "required", "value", "indeterminate"];

  protected readonly internals = this.attachInternals();
  #checked = false;
  #dirty = false;
  #formDisabled = false;

  protected abstract readonly controlRole: "checkbox" | "switch";
  protected abstract readonly template: string;
  protected abstract readonly css: string;

  constructor() {
    super();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("keyup", this.#onKeyUp);
  }

  get checked(): boolean {
    return this.#checked;
  }
  set checked(value: boolean) {
    this.#dirty = true;
    this.#set(value);
  }
  get indeterminate(): boolean {
    return this.hasAttribute("indeterminate");
  }
  set indeterminate(value: boolean) {
    this.toggleAttribute("indeterminate", value);
  }
  get disabled(): boolean {
    return this.hasAttribute("disabled") || this.#formDisabled;
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }
  get value(): string {
    return this.getAttribute("value") ?? "on";
  }
  get name(): string {
    return this.getAttribute("name") ?? "";
  }
  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: "open" });
      adoptStyles(root, this.css);
      root.innerHTML = this.template;
    }
    this.internals.role = this.controlRole;
    if (!this.#dirty) this.#checked = this.hasAttribute("checked");
    this.#render();
  }

  attributeChangedCallback(name: string): void {
    if (name === "checked" && !this.#dirty) this.#checked = this.hasAttribute("checked");
    this.#render();
  }

  formResetCallback(): void {
    this.#dirty = false;
    this.#checked = this.hasAttribute("checked");
    this.#render();
  }

  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.#render();
  }

  formStateRestoreCallback(state: string | File | FormData | null): void {
    this.checked = state !== null;
  }

  /** Toggles as a user would: `input` and `change` events fire. */
  toggle(): void {
    if (this.disabled) return;
    this.#dirty = true;
    if (this.indeterminate) this.removeAttribute("indeterminate");
    this.#set(!this.#checked);
    emit(this, "input");
    emit(this, "change");
  }

  #set(value: boolean): void {
    this.#checked = value;
    this.#render();
  }

  #render(): void {
    const mixed = this.controlRole === "checkbox" && this.indeterminate;
    const state = mixed ? "indeterminate" : this.#checked ? "checked" : "unchecked";
    this.internals.ariaChecked = mixed ? "mixed" : String(this.#checked);
    this.internals.ariaDisabled = this.disabled ? "true" : null;
    this.internals.ariaRequired = this.hasAttribute("required") ? "true" : null;
    this.dataset.state = state;
    const states = this.internals.states as (Set<string> & { clear(): void }) | undefined;
    try {
      states?.delete("checked");
      states?.delete("indeterminate");
      if (state !== "unchecked") states?.add(state);
    } catch {
      // An engine without custom state names: `data-state` carries the styling.
    }
    if (this.disabled) this.removeAttribute("tabindex");
    else if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    this.internals.setFormValue(this.#checked ? this.value : null, this.#checked ? "on" : null);
    if (this.hasAttribute("required") && !this.#checked)
      this.internals.setValidity({ valueMissing: true }, "Check this box to continue.");
    else this.internals.setValidity({});
  }

  #onClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // A link or a control inside the label keeps its own click.
    const inner = event.composedPath()[0];
    if (
      inner instanceof Element &&
      inner !== this &&
      inner.closest("a, button, input, select, textarea")
    )
      return;
    this.toggle();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this) return;
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter" && this.controlRole === "switch") {
      event.preventDefault();
      this.toggle();
    }
  };

  #onKeyUp = (event: KeyboardEvent): void => {
    if (event.target === this && event.key === " ") this.toggle();
  };
}
