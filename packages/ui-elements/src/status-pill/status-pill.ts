import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import css from "./status-pill.css.js";

/**
 * `<ui-status-pill>`: a pill with a status LED and its label (WAI-ARIA `button`, role on the host).
 * The label is hidden when the nearest size container (e.g. a topbar) is narrower than 700px; the
 * accessible name stays.
 * Attributes: `status` (`success` default, `warning`, `danger`, `idle`), `label`, `interactive`.
 * Without `interactive` the pill is decorative and exposed as a disabled button, as in the React
 * kit. With it the pill takes focus, Enter and Space activate it, and a `select` event fires
 * (a click does too).
 */
export class UiStatusPill extends ElementBase {
  static observedAttributes = ["label", "interactive"];

  readonly #internals = this.attachInternals();
  readonly #label: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML =
      '<span part="dot" aria-hidden="true"></span><span part="label" aria-hidden="true"></span>';
    this.#label = root.querySelector("[part=label]") as HTMLElement;
    this.#internals.role = "button";
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  get label(): string {
    return this.getAttribute("label") ?? "";
  }
  set label(value: string) {
    this.setAttribute("label", value);
  }
  get interactive(): boolean {
    return this.hasAttribute("interactive");
  }
  set interactive(value: boolean) {
    this.toggleAttribute("interactive", value);
  }

  connectedCallback(): void {
    this.#sync();
  }

  attributeChangedCallback(): void {
    this.#sync();
  }

  #sync(): void {
    this.#label.textContent = this.label;
    this.#internals.ariaLabel = this.label;
    this.#internals.ariaDisabled = this.interactive ? null : "true";
    if (this.interactive) {
      if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    } else if (this.getAttribute("tabindex") === "0") this.removeAttribute("tabindex");
  }

  readonly #onClick = (): void => {
    if (this.interactive) emit(this, "select");
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (!this.interactive || event.target !== this) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.click();
    }
  };
}

/** Registers `<ui-status-pill>` (or `<prefix-status-pill>`) and returns the tag. */
export function defineStatusPill(options?: DefineOptions): string {
  return defineElement("status-pill", UiStatusPill, options);
}
