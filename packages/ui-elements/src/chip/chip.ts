import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { glyph } from "../internal/e1-icons.js";
import css from "./chip.css.js";

const STATUS_TONES = ["info", "success", "warning", "danger"] as const;

/**
 * `<ui-chip>`: a compact label. It has no role of its own; give it `role="button"` and a
 * `tabindex` when it is interactive; a `role="button"` chip then grows to the 44px touch target
 * under `data-density="touch"` (a style container query on the inherited `--control-height-sm`).
 * Attributes: `tone` (`neutral` default, `danger`, `warning`, `success`, `accent`, `info`,
 * `solid`, `outline`), `square` (smaller radius instead of a pill), `status-icon` (prefixes the
 * `info`, `success`, `warning` and `danger` tones with their glyph). Slots: default content and
 * `icon` (a leading icon; wins over `status-icon`).
 */
export class UiChip extends ElementBase {
  static observedAttributes = ["tone", "status-icon"];

  readonly #status: HTMLElement;
  #iconSlotted = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = '<span part="status"></span><slot name="icon"></slot><slot></slot>';
    this.#status = root.firstElementChild as HTMLElement;
    root.querySelector<HTMLSlotElement>("slot[name=icon]")?.addEventListener("slotchange", (e) => {
      this.#iconSlotted = (e.target as HTMLSlotElement).assignedNodes().length > 0;
      this.#sync();
    });
  }

  connectedCallback(): void {
    this.#sync();
  }

  attributeChangedCallback(): void {
    this.#sync();
  }

  #sync(): void {
    const tone = this.getAttribute("tone") as (typeof STATUS_TONES)[number];
    const show =
      this.hasAttribute("status-icon") && !this.#iconSlotted && STATUS_TONES.includes(tone);
    this.#status.hidden = !show;
    this.#status.innerHTML = show ? glyph(tone) : "";
  }
}

/** Registers `<ui-chip>` (or `<prefix-chip>`) and returns the tag. */
export function defineChip(options?: DefineOptions): string {
  return defineElement("chip", UiChip, options);
}
