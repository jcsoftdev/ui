import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import css from "./loader.css.js";

/**
 * `<ui-loader>`: an animated waiting indicator of three dots (WAI-ARIA `status`, role on the host).
 * The dots stay still with `prefers-reduced-motion: reduce`.
 * Attributes: `variant` (`dots` default: the bare indicator with a visually hidden label; `typing`:
 * a bubble that shows the label), `size` (`md` default, `sm`), `label` (default `Typing…`).
 */
export class UiLoader extends ElementBase {
  static observedAttributes = ["label"];

  readonly #internals = this.attachInternals();
  readonly #label: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<span part="dots" aria-hidden="true"><span part="dot"></span><span part="dot"></span>' +
      '<span part="dot"></span></span><span part="label"></span>';
    this.#label = root.querySelector("[part=label]") as HTMLElement;
    this.#internals.role = "status";
  }

  connectedCallback(): void {
    this.#sync();
  }

  attributeChangedCallback(): void {
    this.#sync();
  }

  #sync(): void {
    this.#label.textContent = this.getAttribute("label") ?? "Typing…";
  }
}

/** Registers `<ui-loader>` (or `<prefix-loader>`) and returns the tag. */
export function defineLoader(options?: DefineOptions): string {
  return defineElement("loader", UiLoader, options);
}
