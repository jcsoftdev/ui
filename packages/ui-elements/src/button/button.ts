import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";
import css from "./button.css.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * `<ui-button>`: a button whose host is the control (`role="button"` through ElementInternals), so
 * `aria-*` attributes on it apply directly. Form-associated: `type="submit"` / `"reset"` act on
 * the owning form. Attributes: `variant` (primary | secondary | ghost | danger), `size` (sm | md |
 * lg), `disabled`, `loading`, `block`, `type`, `material` (`liquid`, `liquid-clear`) and the
 * `liquid-*` options.
 */
export class UiButton extends ElementBase {
  static formAssociated = true;
  static observedAttributes = ["disabled", "loading", ...MATERIAL_ATTRIBUTES];

  readonly #internals = this.attachInternals();
  readonly #spinner: HTMLElement;
  readonly #material: Material;
  #formDisabled = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = `<span part="spinner" hidden></span><slot></slot>`;
    this.#spinner = root.querySelector("[part=spinner]") as HTMLElement;
    this.#internals.role = "button";
    this.#material = new Material(
      this,
      () => this,
      () => this.shadowRoot ?? undefined,
    );
    this.addEventListener("click", this.#onClick, true);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("keyup", this.#onKeyUp);
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }
  get type(): "button" | "submit" | "reset" {
    const type = this.getAttribute("type");
    return type === "submit" || type === "reset" ? type : "button";
  }
  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  connectedCallback(): void {
    this.setAttribute("data-glass-interactive", "");
    this.#sync();
    this.#material.sync();
  }

  disconnectedCallback(): void {
    this.#material.stop();
  }

  attributeChangedCallback(name: string): void {
    if (name === "disabled" || name === "loading") this.#sync();
    else this.#material.sync();
  }

  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.#sync();
  }

  #sync(): void {
    const disabled = this.disabled || this.#formDisabled;
    const loading = this.hasAttribute("loading");
    this.#internals.ariaDisabled = disabled ? "true" : null;
    this.#internals.ariaBusy = loading ? "true" : null;
    this.#spinner.hidden = !loading;
    if (disabled) this.removeAttribute("tabindex");
    else if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
  }

  #onClick = (event: MouseEvent): void => {
    if (this.disabled || this.#formDisabled || this.hasAttribute("loading")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const form = this.#internals.form;
    if (!form) return;
    if (this.type === "button") return;
    // The default action runs once the event has reached the window, after every listener of the
    // author (a microtask would run between listeners on a real click), so they can still cancel
    // it. If a listener stops propagation, a task picks it up instead.
    const act = () => {
      window.removeEventListener("click", onWindow);
      clearTimeout(fallback);
      if (event.defaultPrevented) return;
      if (this.type === "submit") form.requestSubmit();
      else form.reset();
    };
    const onWindow = (other: Event) => {
      if (other === event) act();
    };
    window.addEventListener("click", onWindow);
    const fallback = setTimeout(act, 0);
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this) return;
    if (event.key === " ") event.preventDefault();
    else if (event.key === "Enter" && !event.repeat) {
      event.preventDefault();
      this.click();
    }
  };

  #onKeyUp = (event: KeyboardEvent): void => {
    if (event.target === this && event.key === " ") {
      event.preventDefault();
      this.click();
    }
  };
}

/** Registers `<ui-button>` (or `<prefix-button>`) and returns the tag. */
export const defineButton = (options?: DefineOptions) => defineElement("button", UiButton, options);
