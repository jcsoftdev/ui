import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { startRoving } from "../internal/e10.js";
import css from "./toolbar.css.js";

/**
 * `<ui-toolbar>`: a wrapping row of filters and controls above a table or grid. Plain layout with
 * no ARIA role, as in the React kit. Put `<ui-toolbar-right>` inside it to push a group to the
 * right edge.
 *
 * Attribute `roving` turns it into an ARIA toolbar (`role="toolbar"`, give it an `aria-label`):
 * its buttons and links become one tab stop and the arrow keys, Home and End move between them
 * (APG toolbar pattern). Text fields keep their own keys, so only buttons and links join the ring.
 * `orientation="vertical"` switches the arrows to Up and Down. The behaviour loads on demand.
 */
export class UiToolbar extends ElementBase {
  static observedAttributes = ["roving", "orientation"];
  #stop: (() => void) | undefined;

  connectedCallback(): void {
    connectLight(this, "toolbar", css);
    this.#sync();
  }

  disconnectedCallback(): void {
    this.#stop?.();
    this.#stop = undefined;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#sync();
  }

  #sync(): void {
    this.#stop?.();
    this.#stop = undefined;
    const roving = this.hasAttribute("roving");
    if (roving) {
      this.setAttribute("role", "toolbar");
      const vertical = this.getAttribute("orientation") === "vertical";
      if (vertical) this.setAttribute("aria-orientation", "vertical");
      else this.removeAttribute("aria-orientation");
      this.#stop = startRoving(this, vertical ? "vertical" : "horizontal");
    } else if (this.getAttribute("role") === "toolbar") {
      this.removeAttribute("role");
      this.removeAttribute("aria-orientation");
    }
  }
}

/** `<ui-toolbar-right>`: the group pushed to the right edge of a toolbar. */
export class UiToolbarRight extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "toolbar-right", css);
  }
}

/** Registers `<ui-toolbar>` and `<ui-toolbar-right>` (or the same under another prefix); returns the toolbar tag. */
export function defineToolbar(options?: DefineOptions): string {
  defineElement("toolbar-right", UiToolbarRight, options);
  return defineElement("toolbar", UiToolbar, options);
}
