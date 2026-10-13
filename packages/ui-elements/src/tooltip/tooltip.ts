import { createHoverIntent, createSkipWindow } from "@jcsoftdev/ui-core/hover-intent";
import { AnchoredOverlay } from "../internal/anchored.js";
import {
  adoptStyles,
  byId,
  type DefineOptions,
  defineElement,
  ensureId,
  rootOf,
} from "../internal/base.js";
import css from "./tooltip.css.js";

/** Hover delay before a tooltip opens, and the window in which the next one opens at once. */
const DELAY = 700;
const LEAVE_GRACE = 100;
const skipWindow = createSkipWindow(300);

/**
 * `<ui-tooltip for="id">`: a short description of the element `for` names, shown on hover (after
 * `delay` ms, default 700; at once right after another tooltip closed) and on keyboard focus,
 * hidden on leave, blur and Escape. `role="tooltip"`, wired to the anchor's `aria-describedby`.
 * A manual popover in the top layer. Attributes: `for`, `delay`, `side` (default top), `align`,
 * `side-offset` (default 6), `arrow`, `open`.
 */
export class UiTooltip extends AnchoredOverlay {
  static override observedAttributes = [...AnchoredOverlay.observedAttributes, "for"];
  protected readonly popoverMode = "manual" as const;
  protected readonly defaultOffset = 6;
  protected override defaultSide = "top" as const;
  readonly #internals = this.attachInternals();
  #anchor: HTMLElement | null = null;
  readonly #intent = createHoverIntent({
    onChange: (open) => {
      this.open = open;
    },
    openDelay: () => {
      const delay = Number.parseFloat(this.getAttribute("delay") ?? "");
      return Number.isFinite(delay) ? delay : DELAY;
    },
    closeDelay: LEAVE_GRACE,
    skip: skipWindow,
  });
  #arrow: HTMLElement | null = null;

  constructor() {
    super();
    this.#internals.role = "tooltip";
    // Hoverable content (WCAG 1.4.13): staying on the tooltip keeps it open.
    this.addEventListener("pointerenter", () => this.#intent.hold());
    this.addEventListener("pointerleave", () => this.#intent.leave());
  }

  protected override arrow(): HTMLElement | null {
    return this.#arrow;
  }

  protected override connected(): void {
    this.dataset.ui = "tooltip";
    adoptStyles(rootOf(this), css);
    if (this.hasAttribute("arrow") && !this.#arrow) {
      this.#arrow = document.createElement("span");
      this.#arrow.dataset.uiPart = "arrow";
      this.#arrow.setAttribute("aria-hidden", "true");
      this.append(this.#arrow);
    }
    this.#bind(byId(this, this.getAttribute("for")));
  }

  override disconnectedCallback(): void {
    this.#intent.cancel();
    super.disconnectedCallback();
    this.#bind(null);
  }

  override attributeChangedCallback(name: string): void {
    if (name === "for" && this.isConnected) this.#bind(byId(this, this.getAttribute("for")));
    else super.attributeChangedCallback(name);
  }

  protected override opened(): void {
    document.addEventListener("keydown", this.#onKey, true);
  }

  protected override closed(): void {
    document.removeEventListener("keydown", this.#onKey, true);
    skipWindow.markClosed();
  }

  #bind(anchor: HTMLElement | null): void {
    const previous = this.#anchor;
    if (previous === anchor) return;
    if (previous) {
      for (const [type, listener] of this.#listeners) previous.removeEventListener(type, listener);
      const ids = (previous.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id && id !== this.id);
      if (ids.length) previous.setAttribute("aria-describedby", ids.join(" "));
      else previous.removeAttribute("aria-describedby");
    }
    this.#anchor = anchor;
    this.anchorElement = anchor;
    if (!anchor) return;
    for (const [type, listener] of this.#listeners) anchor.addEventListener(type, listener);
    const id = ensureId(this, "tooltip");
    const ids = (anchor.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
    if (!ids.includes(id)) anchor.setAttribute("aria-describedby", [...ids, id].join(" "));
  }

  #enter = (event: Event) => this.#intent.enter(event as PointerEvent);
  /** Leaving the anchor closes after a grace period, so the pointer can move onto the tooltip. */
  #leave = () => this.#intent.leave();
  #close = () => this.#intent.close();
  #focus = () => {
    if (this.#anchor?.matches(":focus-visible")) this.#intent.focus();
  };
  #onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !this.open) return;
    this.#close();
  };
  #listeners: [string, EventListener][] = [
    ["pointerenter", this.#enter],
    ["pointerleave", this.#leave],
    ["focusin", this.#focus],
    ["focusout", this.#close],
    ["pointerdown", this.#close],
  ];
}

/** Registers `<ui-tooltip>` (or `<prefix-tooltip>`) and returns the tag. */
export function defineTooltip(options?: DefineOptions): string {
  return defineElement("tooltip", UiTooltip, options);
}
