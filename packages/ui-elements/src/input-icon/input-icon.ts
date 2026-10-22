import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import css from "./input-icon.css.js";

/**
 * `<ui-input-icon>`: puts a leading icon inside a text control. Light DOM: the icon is the child
 * with `slot="icon"` (an `<svg>`, an `<img>`...; it is hidden from assistive technology), the
 * control is the other child (`<ui-input>`, `<ui-textarea>` or a native `<input>`), which gets
 * room for the icon. The element has no role of its own; name the control, not the icon.
 */
export class UiInputIcon extends ElementBase {
  readonly #observer: MutationObserver | undefined =
    typeof MutationObserver === "undefined" ? undefined : new MutationObserver(() => this.#hide());

  connectedCallback(): void {
    this.dataset.ui = "input-icon";
    adoptStyles(rootOf(this), css);
    this.#hide();
    this.#observer?.observe(this, { childList: true });
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
  }

  #hide(): void {
    for (const icon of this.querySelectorAll(":scope > [slot='icon']"))
      icon.setAttribute("aria-hidden", "true");
  }
}

/** Registers `<ui-input-icon>` (or `<prefix-input-icon>`) and returns the tag. */
export const defineInputIcon = (options?: DefineOptions) =>
  defineElement("input-icon", UiInputIcon, options);
