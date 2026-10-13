import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import css from "./led.css.js";

/**
 * `<ui-led>`: a status dot with a text label, so colour is never the only signal. The label is
 * always in the accessibility tree and only visible with `show-label`.
 * Attributes: `status` (`success` default, `warning`, `danger`, `idle`), `label` (required text),
 * `show-label`.
 */
export class UiLed extends ElementBase {
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

/** Registers `<ui-led>` (or `<prefix-led>`) and returns the tag. */
export function defineLed(options?: DefineOptions): string {
  return defineElement("led", UiLed, options);
}
