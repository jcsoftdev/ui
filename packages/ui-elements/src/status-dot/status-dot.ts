import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import css from "./status-dot.css.js";

/**
 * `<ui-status-dot>`: a coloured dot or square with a text label, so colour is never the only
 * signal. The label is always in the accessibility tree and only visible with `show-label`.
 * Attributes: `tone` (`neutral` default, `accent`, `success`, `warning`, `danger`), `label`
 * (required text), `show-label`, `shape` (`dot` default, `square`), `hollow` (transparent fill
 * with an accent ring).
 */
export class UiStatusDot extends ElementBase {
  static observedAttributes = ["label"];

  readonly #label: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = '<span part="dot" aria-hidden="true"></span><span part="label"></span>';
    this.#label = root.querySelector("[part=label]") as HTMLElement;
  }

  get label(): string {
    return this.getAttribute("label") ?? "";
  }
  set label(value: string) {
    this.setAttribute("label", value);
  }

  connectedCallback(): void {
    this.#label.textContent = this.label;
  }

  attributeChangedCallback(): void {
    this.#label.textContent = this.label;
  }
}

/** Registers `<ui-status-dot>` (or `<prefix-status-dot>`) and returns the tag. */
export function defineStatusDot(options?: DefineOptions): string {
  return defineElement("status-dot", UiStatusDot, options);
}
