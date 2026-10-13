import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./highlight-line.css.js";

/**
 * `<ui-highlight-line>`: the focus sentence at the top of a card. Wrap the key phrase in
 * `<strong>` to emphasize it. It only paints text, it computes nothing. Exposed as a paragraph
 * (`role="paragraph"`), like the React kit's `<p>`.
 */
export class UiHighlightLine extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "highlight-line", css);
    if (!this.hasAttribute("role")) this.setAttribute("role", "paragraph");
  }
}

/** Registers `<ui-highlight-line>` (or `<prefix-highlight-line>`) and returns the tag. */
export function defineHighlightLine(options?: DefineOptions): string {
  return defineElement("highlight-line", UiHighlightLine, options);
}
