import { type DefineOptions, defineElement } from "../internal/base.js";
import { defineMenuParts, MenuContentElement, MenuRootElement } from "../internal/e6-menu.js";

const LONG_PRESS_MS = 600;

class ContextMenuContent extends MenuContentElement {
  protected override readonly defaultOffset = 2;
  protected override defaultAlign = "start" as const;
}

/**
 * `<ui-context-menu>`: the element is the area that answers to right-click, long-press (touch)
 * and the keyboard (Menu key, Shift+F10); its `<ui-context-menu-content>` child opens at the
 * pointer. It is the dropdown menu's content anchored to a point: roving focus, typeahead,
 * submenus, stacked Escape and outside dismiss. Non-modal by default (add `modal` to make it
 * modal); focus returns to where it was when the menu opened. `disabled` turns the area off.
 *
 * Parts are the same as `<ui-dropdown-menu>`'s, named `<ui-context-menu-*>`. Methods:
 * `showAt(x, y)` (viewport pixels), `hide()`. Events: as the dropdown menu.
 */
export class UiContextMenu extends MenuRootElement {
  protected readonly modalDefault = false;
  protected readonly kind = "context-menu";
  #anchor: HTMLElement | undefined;
  #returnFocus: HTMLElement | null = null;
  #press: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.addEventListener("contextmenu", (event) => {
      if (this.hasAttribute("disabled") || event.defaultPrevented) return;
      event.preventDefault();
      if (this.content?.contains(event.target as Node)) return;
      this.showAt(event.clientX, event.clientY);
    });
    this.addEventListener("keydown", (event) => {
      if (this.hasAttribute("disabled") || event.defaultPrevented) return;
      if (this.content?.contains(event.target as Node)) return;
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      const box = (event.target as Element).getBoundingClientRect();
      this.showAt(box.left + 16, box.top + Math.min(box.height, 32));
    });
    this.addEventListener("pointerdown", (event) => {
      if (this.hasAttribute("disabled") || event.pointerType !== "touch") return;
      if (this.content?.contains(event.target as Node)) return;
      const { clientX, clientY } = event;
      clearTimeout(this.#press);
      this.#press = setTimeout(() => this.showAt(clientX, clientY), LONG_PRESS_MS);
    });
    for (const type of ["pointermove", "pointerup", "pointercancel"])
      this.addEventListener(type, () => clearTimeout(this.#press));
  }

  protected anchor(): HTMLElement | null {
    return this.#anchor ?? null;
  }

  returnTarget(): HTMLElement | null {
    return this.#returnFocus;
  }

  /** Opens the menu with its corner at `x`, `y` (viewport pixels). */
  showAt(x: number, y: number): void {
    const content = this.content;
    if (!content) return;
    const focused = document.activeElement as HTMLElement | null;
    if (!this.open || !content.contains(focused)) this.#returnFocus = focused;
    if (!this.#anchor) {
      this.#anchor = document.createElement("span");
      this.#anchor.setAttribute("aria-hidden", "true");
      this.#anchor.setAttribute("data-ui-menu-anchor", "");
      this.#anchor.style.cssText = "position:fixed;width:0;height:0;pointer-events:none";
      this.append(this.#anchor);
    }
    this.#anchor.style.left = `${x}px`;
    this.#anchor.style.top = `${y}px`;
    content.openAt(this.#anchor, "none");
    content.reposition();
  }

  protected override disconnected(): void {
    clearTimeout(this.#press);
  }
}

/** Registers `<ui-context-menu>` and its parts (or `<prefix-context-menu>`...) and returns the tag. */
export function defineContextMenu(options?: DefineOptions): string {
  defineMenuParts("context-menu", ContextMenuContent, options);
  return defineElement("context-menu", UiContextMenu, options);
}
