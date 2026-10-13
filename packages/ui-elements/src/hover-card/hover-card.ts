import {
  createHoverIntent,
  graceArea,
  isPointInPolygon,
  type Point,
} from "@jcsoftdev/ui-core/hover-intent";
import { AnchoredOverlay } from "../internal/anchored.js";
import {
  adoptStyles,
  byId,
  type DefineOptions,
  defineElement,
  ensureId,
  rootOf,
} from "../internal/base.js";
import css from "./hover-card.css.js";

const OPEN_DELAY = 300;
const CLOSE_DELAY = 150;
/** How long after leaving the trigger the pointer may cross the gap toward the card. */
const GRACE_MS = 300;

const number = (value: string | null, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * `<ui-hover-card for="id">`: a preview card for the element `for` names (it may appear after the
 * card; the card binds when it does). It opens when a mouse or pen pointer rests on the trigger for
 * `open-delay` ms (default 300) and at once when the trigger receives focus (any focus, as the
 * React kit does). It closes `close-delay` ms (default 150) after the pointer leaves, on blur, and
 * on Escape; Escape also cancels the key's default, so an enclosing dialog stays open for that
 * press. Moving from the trigger toward the card keeps it open while the pointer is inside ui-core's
 * grace area (about 300 ms), and resting on the card, or focus inside it, holds it open. It is a
 * preview: nothing takes focus when it opens. `role="tooltip"`; while open the trigger's
 * `aria-describedby` includes the card, like the React kit. A manual popover in the top layer on
 * the `surface-overlay` surface. Touch pointers never open it.
 *
 * Attributes: `for`, `open-delay`, `close-delay`, `side` (default bottom), `align`, `side-offset`
 * (default 8), `anchor`, `open`, `material` and the `liquid-*` options. Fires `open` and `close`.
 */
export class UiHoverCard extends AnchoredOverlay {
  static override observedAttributes = [...AnchoredOverlay.observedAttributes, "for"];
  protected readonly popoverMode = "manual" as const;
  protected readonly defaultOffset = 8;
  readonly #internals = this.attachInternals();
  #trigger: HTMLElement | null = null;
  #watch: MutationObserver | undefined;
  #grace: { area: Point[]; until: number } | undefined;
  #graceTimer: ReturnType<typeof setTimeout> | undefined;
  readonly #intent = createHoverIntent({
    onChange: (open) => {
      this.open = open;
    },
    openDelay: () => number(this.getAttribute("open-delay"), OPEN_DELAY),
    closeDelay: () => number(this.getAttribute("close-delay"), CLOSE_DELAY),
    skip: false,
  });

  constructor() {
    super();
    this.#internals.role = "tooltip";
    this.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") this.#hold();
    });
    this.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") this.#intent.leave();
    });
    // A focus ring inside the card (a link it holds) keeps it open while the card has focus.
    this.addEventListener("focusin", () => this.#intent.hold());
    this.addEventListener("focusout", (event) => {
      if (!this.contains(event.relatedTarget as Node | null)) this.#intent.close();
    });
  }

  protected override connected(): void {
    this.dataset.ui = "hover-card";
    adoptStyles(rootOf(this), css);
    this.#resolve();
  }

  /** Binds the trigger `for` names, or waits (one observer) until it is added to the document. */
  #resolve(): void {
    this.#watch?.disconnect();
    this.#watch = undefined;
    const trigger = byId(this, this.getAttribute("for"));
    this.#bind(trigger);
    if (trigger || !this.getAttribute("for") || typeof MutationObserver === "undefined") return;
    this.#watch = new MutationObserver(() => {
      if (byId(this, this.getAttribute("for"))) this.#resolve();
    });
    this.#watch.observe(this.getRootNode(), { childList: true, subtree: true });
  }

  override disconnectedCallback(): void {
    this.#watch?.disconnect();
    this.#watch = undefined;
    this.#intent.cancel();
    this.#endGrace();
    super.disconnectedCallback();
    this.#bind(null);
  }

  override attributeChangedCallback(name: string): void {
    if (name === "for" && this.isConnected) this.#resolve();
    else super.attributeChangedCallback(name);
  }

  protected override opened(): void {
    document.addEventListener("keydown", this.#onKey, true);
    this.#describe(true);
  }

  protected override closed(): void {
    document.removeEventListener("keydown", this.#onKey, true);
    this.#endGrace();
    this.#describe(false);
  }

  #hold(): void {
    this.#intent.hold();
    this.#endGrace();
  }

  /** The trigger's `aria-describedby` with this card's id present (open) or absent (closed). */
  #describedBy(open: boolean): string {
    const id = ensureId(this, "hover-card");
    const ids = (this.#trigger?.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter((entry) => entry && entry !== id);
    return (open ? [...ids, id] : ids).join(" ");
  }

  #describe(open: boolean): void {
    const value = this.#describedBy(open);
    if (value) this.#trigger?.setAttribute("aria-describedby", value);
    else this.#trigger?.removeAttribute("aria-describedby");
  }

  #bind(trigger: HTMLElement | null): void {
    const previous = this.#trigger;
    if (previous === trigger) return;
    if (previous) {
      for (const [type, listener] of this.#listeners) previous.removeEventListener(type, listener);
      this.#describe(false);
    }
    this.#trigger = trigger;
    this.anchorElement = trigger;
    if (!trigger) return;
    for (const [type, listener] of this.#listeners) trigger.addEventListener(type, listener);
  }

  #enter = (event: Event) => {
    this.#endGrace();
    this.#intent.enter(event as PointerEvent);
  };

  /**
   * Leaving the trigger: close after the delay, unless the pointer is heading for the card. The
   * grace area is the triangle from the exit point to the card; while the pointer moves inside it
   * the close is held. It expires after {@link GRACE_MS}.
   */
  #leave = (event: Event) => {
    const pointer = event as PointerEvent;
    if (pointer.pointerType === "touch") return;
    this.#intent.leave(pointer);
    if (!this.open) return;
    const card = this.getBoundingClientRect();
    const trigger = this.#trigger?.getBoundingClientRect();
    if (!trigger || (card.width === 0 && card.height === 0)) return;
    const exit = { x: pointer.clientX, y: pointer.clientY };
    const side = this.#sideOf(card, trigger);
    this.#grace = { area: graceArea(exit, side, card), until: Date.now() + GRACE_MS };
    document.addEventListener("pointermove", this.#onMove);
    clearTimeout(this.#graceTimer);
    this.#graceTimer = setTimeout(() => {
      this.#endGrace();
      this.#intent.leave();
    }, GRACE_MS);
  };

  #sideOf(card: DOMRect, trigger: DOMRect): "top" | "right" | "bottom" | "left" {
    const side = this.dataset.side;
    if (side === "top" || side === "right" || side === "bottom" || side === "left") return side;
    if (card.top >= trigger.bottom) return "bottom";
    if (card.bottom <= trigger.top) return "top";
    return card.left >= trigger.right ? "right" : "left";
  }

  #onMove = (event: PointerEvent) => {
    const grace = this.#grace;
    if (!grace || Date.now() > grace.until) return;
    if (isPointInPolygon({ x: event.clientX, y: event.clientY }, grace.area)) this.#intent.hold();
  };

  #endGrace(): void {
    this.#grace = undefined;
    clearTimeout(this.#graceTimer);
    document.removeEventListener("pointermove", this.#onMove);
  }

  #focus = () => {
    this.#endGrace();
    this.#intent.focus();
  };
  #blur = () => this.#intent.close();
  #onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !this.open) return;
    // One layer per press: the card closes and an enclosing dialog stays open.
    event.preventDefault();
    this.#intent.close();
  };
  #listeners: [string, EventListener][] = [
    ["pointerenter", this.#enter],
    ["pointerleave", this.#leave],
    ["focusin", this.#focus],
    ["focusout", this.#blur],
  ];
}

/** Registers `<ui-hover-card>` (or `<prefix-hover-card>`) and returns the tag. */
export function defineHoverCard(options?: DefineOptions): string {
  return defineElement("hover-card", UiHoverCard, options);
}
