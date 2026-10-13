import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import state from "../internal/e3-state.css.js";
import css from "./empty-state.css.js";

const filled = (slot: HTMLSlotElement) =>
  slot
    .assignedNodes()
    .some((node) => node.nodeType === 1 || (node.textContent ?? "").trim() !== "");

/**
 * `<ui-empty-state>`: what a list or view shows when there is nothing to show. No ARIA role; the
 * heading is plain text.
 * Attributes: `heading` (React `title`), `description`. Slots: `icon` (decorative, hidden from
 * assistive technology), default (React `action`: the call to action, centred and wrapping).
 * The padding grows when the element is at least 360px wide.
 */
export class UiEmptyState extends ElementBase {
  static observedAttributes = ["heading", "description"];

  readonly #title: HTMLElement;
  readonly #description: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, state);
    adoptStyles(root, css);
    root.innerHTML =
      '<div part="root"><span part="icon" aria-hidden="true" hidden><slot name="icon"></slot></span>' +
      '<p part="title"></p><p part="description" hidden></p>' +
      '<div part="actions" hidden><slot></slot></div></div>';
    this.#title = root.querySelector("[part=title]") as HTMLElement;
    this.#description = root.querySelector("[part=description]") as HTMLElement;
    for (const slot of root.querySelectorAll("slot")) {
      const part = slot.parentElement as HTMLElement;
      slot.addEventListener("slotchange", () => {
        part.hidden = !filled(slot);
      });
    }
  }

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #render(): void {
    this.#title.textContent = this.getAttribute("heading") ?? "";
    const description = this.getAttribute("description");
    this.#description.textContent = description ?? "";
    this.#description.hidden = !description;
  }
}

/** Registers `<ui-empty-state>` (or `<prefix-empty-state>`) and returns the tag. */
export function defineEmptyState(options?: DefineOptions): string {
  return defineElement("empty-state", UiEmptyState, options);
}
