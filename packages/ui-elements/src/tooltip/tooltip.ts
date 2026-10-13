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
const SKIP_DELAY = 300;
const LEAVE_GRACE = 100;
let lastClosed = 0;

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
  #timer: ReturnType<typeof setTimeout> | undefined;
  #arrow: HTMLElement | null = null;

  constructor() {
    super();
    this.#internals.role = "tooltip";
    // Hoverable content (WCAG 1.4.13): staying on the tooltip keeps it open.
    this.addEventListener("pointerenter", () => clearTimeout(this.#timer));
    this.addEventListener("pointerleave", () => this.#schedule(false, LEAVE_GRACE));
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
    clearTimeout(this.#timer);
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
    lastClosed = Date.now();
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

  #schedule(open: boolean, delay: number): void {
    clearTimeout(this.#timer);
    if (delay <= 0) this.open = open;
    else this.#timer = setTimeout(() => (this.open = open), delay);
  }

  #enter = (event: Event) => {
    if ((event as PointerEvent).pointerType === "touch") return;
    const delay = Number.parseFloat(this.getAttribute("delay") ?? "");
    const wait = Date.now() - lastClosed < SKIP_DELAY ? 0 : Number.isFinite(delay) ? delay : DELAY;
    this.#schedule(true, wait);
  };
  /** Leaving the anchor closes after a grace period, so the pointer can move onto the tooltip. */
  #leave = () => this.#schedule(false, LEAVE_GRACE);
  #close = () => this.#schedule(false, 0);
  #focus = () => {
    if (this.#anchor?.matches(":focus-visible")) this.#schedule(true, 0);
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
