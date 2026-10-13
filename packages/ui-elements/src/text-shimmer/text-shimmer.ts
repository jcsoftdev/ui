import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import css from "./text-shimmer.css.js";

/**
 * `<ui-text-shimmer>`: text with a light sweep, for "thinking…" labels. No ARIA role; the text is
 * ordinary content. It is static with `prefers-reduced-motion: reduce`. Wrap it in an element of
 * your choice when you need one (React `as`).
 * Attributes: `duration` (seconds for one sweep, default 2).
 */
export class UiTextShimmer extends ElementBase {
  static observedAttributes = ["duration"];

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = "<slot></slot>";
  }

  connectedCallback(): void {
    this.#sync();
  }

  attributeChangedCallback(): void {
    this.#sync();
  }

  #sync(): void {
    const seconds = Number(this.getAttribute("duration"));
    if (this.hasAttribute("duration") && seconds > 0)
      this.style.setProperty("--ui-text-shimmer-duration", `${seconds}s`);
    else this.style.removeProperty("--ui-text-shimmer-duration");
  }
}

/** Registers `<ui-text-shimmer>` (or `<prefix-text-shimmer>`) and returns the tag. */
export function defineTextShimmer(options?: DefineOptions): string {
  return defineElement("text-shimmer", UiTextShimmer, options);
}
