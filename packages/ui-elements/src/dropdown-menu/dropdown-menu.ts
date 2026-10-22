import { bindMenuTrigger } from "@jcsoftdev/ui-core/menu";
import { type DefineOptions, defineElement } from "../internal/base.js";
import { defineMenuParts, MenuContentElement, MenuRootElement } from "../internal/e6-menu.js";

/**
 * `<ui-dropdown-menu>`: a menu button (WAI-ARIA menu button pattern). The first child that is not
 * the content, or the child marked `data-menu-trigger`, is the trigger: it gets `aria-haspopup`,
 * `aria-expanded` and `aria-controls`, opens on press, Enter, Space, ArrowDown (first item) and
 * ArrowUp (last item). The `<ui-dropdown-menu-content>` is a top-layer popover with `role="menu"`:
 * roving focus, typeahead, Home/End, submenus, Escape and outside press dismiss (stacked, so
 * Escape inside a dialog closes the menu first), focus returned to the trigger. Modal by default
 * (page inert, pointer blocked outside, scroll locked); `modal="false"` turns that off.
 *
 * Parts (all `<ui-dropdown-menu-*>`): `content` (`side`, `align`, `side-offset`, `material`, the
 * `liquid-*` options), `item` (`disabled`, `text-value`, `tone="danger"`), `checkbox-item`
 * (`checked`, `mixed`), `radio-group` (`value`) with `radio-item` (`value`), `label`, `separator`,
 * `shortcut`, `group`, and `sub` wrapping a `sub-trigger` and a `sub-content`.
 *
 * Attributes of the root: `open`, `modal`. Methods: `show()`, `hide()`, `toggle()`. Events (they
 * bubble): `open` and `close` of the content, a cancelable `select` on the chosen item (prevent it
 * to keep the menu open), `change` on a checkbox item (`{ checked }`) and on a radio group
 * (`{ value }`).
 */
export class UiDropdownMenu extends MenuRootElement {
  protected readonly modalDefault = true;
  protected readonly kind = "dropdown-menu";
  #trigger: HTMLElement | undefined;
  #unbind: (() => void) | undefined;

  constructor() {
    super();
    // Children parsed after the element upgraded are wired on the first interaction.
    for (const type of ["pointerdown", "keydown"])
      this.addEventListener(type, () => this.#wire(), true);
  }

  get trigger(): HTMLElement | null {
    return (
      this.querySelector<HTMLElement>(":scope > [data-menu-trigger]") ??
      Array.from(this.children).find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && !child.matches("[data-ui-menu]"),
      ) ??
      null
    );
  }

  protected anchor(): HTMLElement | null {
    return this.trigger;
  }

  returnTarget(): HTMLElement | null {
    return this.trigger;
  }

  protected override connected(): void {
    this.#wire();
    queueMicrotask(() => this.#wire());
  }

  protected override disconnected(): void {
    this.#unbind?.();
    this.#unbind = undefined;
    this.#trigger = undefined;
  }

  protected override stateChanged(open: boolean): void {
    const trigger = this.trigger;
    trigger?.setAttribute("aria-expanded", String(open));
    trigger?.setAttribute("data-state", open ? "open" : "closed");
  }

  #wire(): void {
    const trigger = this.trigger;
    if (!trigger || trigger === this.#trigger) return;
    this.#unbind?.();
    this.#trigger = trigger;
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", String(this.open));
    this.#unbind = bindMenuTrigger(trigger, {
      isOpen: () => this.open,
      setOpen: (open, intent) => (open ? this.show(intent) : this.hide()),
      disabled: () =>
        trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true",
    });
  }
}

/** Registers `<ui-dropdown-menu>` and its parts (or `<prefix-dropdown-menu>`...) and returns the tag. */
export function defineDropdownMenu(options?: DefineOptions): string {
  defineMenuParts("dropdown-menu", MenuContentElement, options);
  return defineElement("dropdown-menu", UiDropdownMenu, options);
}
