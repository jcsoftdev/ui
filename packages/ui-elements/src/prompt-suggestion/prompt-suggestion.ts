import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
} from "../internal/base.js";
import css from "./prompt-suggestion.css.js";

/**
 * `<ui-prompt-suggestion>`: a chip with a suggested prompt. It wraps a native `<button>` in a
 * shadow root (focus is delegated to it), so the role, name (the text content) and keyboard are
 * native. Pressing it fires `select` with `{ text }`, the visible label (React `onSelect`).
 *
 * Attributes: `disabled`. Events: `select`.
 */
export class UiPromptSuggestion extends ElementBase {
  static observedAttributes = ["disabled"];
  readonly #button: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open", delegatesFocus: true });
    adoptStyles(root, css);
    root.innerHTML =
      '<button part="button" type="button"><span part="text"><slot></slot></span></button>';
    this.#button = root.querySelector("button") as HTMLButtonElement;
    this.#button.addEventListener("click", () => emit(this, "select", { text: this.text }));
  }

  /** The suggestion text: the trimmed text content. */
  get text(): string {
    return (this.textContent ?? "").trim();
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }

  connectedCallback(): void {
    this.#button.disabled = this.disabled;
  }

  attributeChangedCallback(): void {
    this.#button.disabled = this.disabled;
  }
}

/** Registers `<ui-prompt-suggestion>` (or `<prefix-prompt-suggestion>`) and returns the tag. */
export function definePromptSuggestion(options?: DefineOptions): string {
  return defineElement("prompt-suggestion", UiPromptSuggestion, options);
}
