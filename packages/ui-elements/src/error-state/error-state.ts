import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import state from "../internal/e3-state.css.js";
import css from "./error-state.css.js";

/**
 * `<ui-error-state>`: a failure with a plain-language headline, an optional explanation, a
 * correlation id for support and an optional retry button (WAI-ARIA `alert`, role on the host).
 * Never put a raw exception in an attribute.
 * Attributes: `heading` (React `title`; wins as the headline), `message` (headline when `heading`
 * is absent, otherwise the explanation), `description` (explanation, wins over `message`),
 * `correlation-id`, `correlation-label` (default `ID:`), `retryable` (shows the button),
 * `retry-label` (default `Retry`). Events: `retry` (React `onRetry`) when the button is pressed.
 */
export class UiErrorState extends ElementBase {
  static observedAttributes = [
    "heading",
    "description",
    "message",
    "correlation-id",
    "correlation-label",
    "retryable",
    "retry-label",
  ];

  readonly #internals = this.attachInternals();
  readonly #title: HTMLElement;
  readonly #detail: HTMLElement;
  readonly #correlation: HTMLElement;
  readonly #retry: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, state);
    adoptStyles(root, css);
    root.innerHTML =
      '<div part="root"><p part="title"></p><p part="detail" hidden></p>' +
      '<p part="correlation" hidden></p><button type="button" part="retry" hidden></button></div>';
    this.#title = root.querySelector("[part=title]") as HTMLElement;
    this.#detail = root.querySelector("[part=detail]") as HTMLElement;
    this.#correlation = root.querySelector("[part=correlation]") as HTMLElement;
    this.#retry = root.querySelector("button") as HTMLButtonElement;
    this.#internals.role = "alert";
    this.#retry.addEventListener("click", () => emit(this, "retry"));
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    const heading = this.getAttribute("heading");
    const message = this.getAttribute("message");
    const description = this.getAttribute("description");
    this.#title.textContent = heading || message || "Something went wrong. Try again.";
    const detail = description || (heading !== null ? message : null);
    this.#detail.textContent = detail ?? "";
    this.#detail.hidden = !detail;
    const id = this.getAttribute("correlation-id");
    this.#correlation.textContent = id
      ? `${this.getAttribute("correlation-label") ?? "ID:"} ${id}`
      : "";
    this.#correlation.hidden = !id;
    this.#retry.textContent = this.getAttribute("retry-label") ?? "Retry";
    this.#retry.hidden = !this.hasAttribute("retryable");
  }
}

/** Registers `<ui-error-state>` (or `<prefix-error-state>`) and returns the tag. */
export function defineErrorState(options?: DefineOptions): string {
  return defineElement("error-state", UiErrorState, options);
}
