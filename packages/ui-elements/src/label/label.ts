import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import css from "./label.css.js";

/**
 * `<ui-label for="id">`: the visible label of a control. It owns one native `<label>` (its content
 * is moved inside), so the browser does what it does for any label: a click focuses or activates
 * the control, and the control's accessible name is the label text, including form-associated custom
 * elements such as `<ui-input>`. Attribute: `for` (the id of the control in the same root). A label
 * that wraps its control needs no `for`.
 */
export class UiLabel extends ElementBase {
  static observedAttributes = ["for"];
  readonly #label: HTMLLabelElement | undefined =
    typeof document === "undefined" ? undefined : document.createElement("label");
  #observer: MutationObserver | undefined;

  connectedCallback(): void {
    this.dataset.ui = "label";
    adoptStyles(rootOf(this), css);
    this.#adopt();
    this.#syncFor();
    this.#observer ??= new MutationObserver(() => this.#adopt());
    this.#observer.observe(this, { childList: true });
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
  }

  attributeChangedCallback(): void {
    this.#syncFor();
  }

  #adopt(): void {
    const label = this.#label;
    if (!label) return;
    for (const node of [...this.childNodes]) if (node !== label) label.append(node);
    if (label.parentNode !== this) this.append(label);
  }

  #syncFor(): void {
    const target = this.getAttribute("for");
    if (!this.#label) return;
    if (target === null) this.#label.removeAttribute("for");
    else this.#label.htmlFor = target;
  }
}

/** Registers `<ui-label>` (or `<prefix-label>`) and returns the tag. */
export const defineLabel = (options?: DefineOptions) => defineElement("label", UiLabel, options);
