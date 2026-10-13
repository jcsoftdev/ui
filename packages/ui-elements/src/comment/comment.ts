import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import css from "./comment.css.js";

const SEPARATOR = " — ";

/**
 * `<ui-comment>`: an annotation callout on a document, `role="note"`. A bold author (with an
 * optional counter) comes first, then the children as the body. A note takes no name from its
 * content, so `label` is required for an accessible name.
 *
 * Attributes: `author`, `label` (becomes `aria-label`), `number` (counter shown before the author)
 * and `tone` (`pending`, the default, or `reply`).
 */
export class UiComment extends ElementBase {
  static observedAttributes = ["author", "label", "number"];
  readonly #author = document.createElement("b");
  readonly #separator = document.createTextNode(SEPARATOR);

  connectedCallback(): void {
    connectLight(this, "comment", css);
    defaultAttr(this, "role", "note");
    this.#author.dataset.uiPart = "author";
    if (this.firstChild !== this.#author) this.prepend(this.#author, this.#separator);
    this.#render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  #render(): void {
    const label = this.getAttribute("label");
    if (label === null) this.removeAttribute("aria-label");
    else this.setAttribute("aria-label", label);
    const number = this.getAttribute("number");
    this.#author.textContent = `${number ? `${number} · ` : ""}${this.getAttribute("author") ?? ""}`;
  }
}

/** Registers `<ui-comment>` (or `<prefix-comment>`) and returns the tag. */
export function defineComment(options?: DefineOptions): string {
  return defineElement("comment", UiComment, options);
}
