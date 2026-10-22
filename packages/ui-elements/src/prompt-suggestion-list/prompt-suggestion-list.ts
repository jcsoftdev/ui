import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import css from "./prompt-suggestion-list.css.js";

/**
 * `<ui-prompt-suggestion-list>`: a wrapping group of `<ui-prompt-suggestion>` chips,
 * `role="group"` named by `label` (default "Sugerencias"). The chips stay in the page tab order,
 * as in the React kit (a plain group, not a toolbar).
 *
 * Attributes: `label`.
 */
export class UiPromptSuggestionList extends ElementBase {
  static observedAttributes = ["label"];

  connectedCallback(): void {
    connectLight(this, "prompt-suggestion-list", css);
    defaultAttr(this, "role", "group");
    this.#render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  #render(): void {
    this.setAttribute("aria-label", this.getAttribute("label") ?? "Sugerencias");
  }
}

/** Registers `<ui-prompt-suggestion-list>` (or `<prefix-prompt-suggestion-list>`) and returns the tag. */
export function definePromptSuggestionList(options?: DefineOptions): string {
  return defineElement("prompt-suggestion-list", UiPromptSuggestionList, options);
}
