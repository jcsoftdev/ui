import { AnchoredOverlay } from "../internal/anchored.js";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  hasPopover,
  rootOf,
} from "../internal/base.js";
import css from "./popover.css.js";

/**
 * `<ui-popover>`: non-modal floating content on the Popover API (`popover="auto"`: top layer,
 * light dismiss on outside press and Escape, focus returned to the invoker). Open it with a native
 * invoker (`<button popovertarget="id">` or `commandfor="id" command="toggle-popover"`, which also
 * expose `aria-expanded`), the `open` attribute or `show(anchor)`. Focus moves to its first
 * focusable child. Attributes: `open`, `side` (top | right | bottom | left), `align` (start |
 * center | end), `side-offset` (default 6), `anchor` (id; default: the invoker), `material` and the
 * `liquid-*` options. Fires `open` and `close`. Engines without the Popover API get ui-core's
 * dismiss layer instead.
 */
export class UiPopover extends AnchoredOverlay {
  protected readonly popoverMode = "auto" as const;
  protected readonly defaultOffset = 6;
  #stopDismiss: (() => void) | undefined;
  #openings = 0;

  constructor() {
    super();
    this.addEventListener("beforetoggle", (event) => this.onNativeToggle(event));
    this.addEventListener("toggle", (event) => this.onNativeToggle(event));
  }

  protected override connected(): void {
    this.dataset.ui = "popover";
    adoptStyles(rootOf(this), css);
    this.tabIndex = -1;
  }

  protected override opened(): void {
    const target = this.querySelector<HTMLElement>(
      "[autofocus], button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    (target ?? this).focus({ preventScroll: true });
    if (hasPopover()) return;
    const anchor = this.anchorElement;
    const opening = ++this.#openings;
    import("@jcsoftdev/ui-core/dismiss").then(({ createDismissLayer }) => {
      // Closed (or closed and reopened) while the module loaded: that opening owns nothing.
      if (!this.open || opening !== this.#openings) return;
      this.#stopDismiss = createDismissLayer(this, {
        onDismiss: () => this.hide(),
        inside: () => [anchor],
      });
    });
  }

  protected override closed(): void {
    this.#openings++;
    this.#stopDismiss?.();
    this.#stopDismiss = undefined;
    // The Popover API returns focus itself; the fallback does it here.
    if (!hasPopover() && this.contains(document.activeElement))
      this.anchorElement?.focus({ preventScroll: true });
  }
}

/** Registers `<ui-popover>` (or `<prefix-popover>`) and returns the tag. */
export function definePopover(options?: DefineOptions): string {
  return defineElement("popover", UiPopover, options);
}
