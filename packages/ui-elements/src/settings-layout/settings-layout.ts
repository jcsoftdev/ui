import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import css from "./settings-layout.css.js";

/**
 * `<ui-settings-layout>`: a two-column settings grid (side nav and content) that collapses to one
 * column at 940px or less of the ancestor container named `page` (`container: page / inline-size`).
 */
export class UiSettingsLayout extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "settings-layout", css);
  }
}

/**
 * `<ui-settings-layout-nav>`: the sticky side navigation, `role="navigation"` named "Sections"
 * unless `aria-label` is set. On narrow pages it becomes a scrollable horizontal row.
 */
export class UiSettingsLayoutNav extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "settings-layout-nav", css);
    defaultAttr(this, "role", "navigation");
    defaultAttr(this, "aria-label", "Sections");
  }
}

/**
 * `<ui-settings-layout-nav-item>`: a nav button (`role="button"`, focusable, Enter and Space
 * click it). Attribute `active` marks the visible section with `aria-current="true"`; `disabled`
 * blocks it.
 */
export class UiSettingsLayoutNavItem extends ElementBase {
  static observedAttributes = ["active", "disabled"];

  constructor() {
    super();
    this.addEventListener("keydown", (event) => {
      if (event.target !== this || this.hasAttribute("disabled")) return;
      if (event.key === "Enter") {
        event.preventDefault();
        this.click();
      } else if (event.key === " ") event.preventDefault();
    });
    this.addEventListener("keyup", (event) => {
      if (event.target === this && event.key === " " && !this.hasAttribute("disabled"))
        this.click();
    });
    this.addEventListener(
      "click",
      (event) => {
        if (this.hasAttribute("disabled")) {
          event.stopImmediatePropagation();
          event.preventDefault();
        }
      },
      true,
    );
  }

  get active(): boolean {
    return this.hasAttribute("active");
  }
  set active(value: boolean) {
    this.toggleAttribute("active", value);
  }

  connectedCallback(): void {
    connectLight(this, "settings-layout-nav-item", css);
    defaultAttr(this, "role", "button");
    this.#sync();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#sync();
  }

  #sync(): void {
    if (this.hasAttribute("active")) this.setAttribute("aria-current", "true");
    else this.removeAttribute("aria-current");
    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
      this.removeAttribute("tabindex");
    } else {
      this.removeAttribute("aria-disabled");
      this.setAttribute("tabindex", "0");
    }
  }
}

/**
 * `<ui-settings-layout-main>`: the content column. A single stack that becomes a two-column
 * masonry at 1180px of page width, where each direct child (a card) is not split across columns.
 */
export class UiSettingsLayoutMain extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "settings-layout-main", css);
  }
}

/** Registers `<ui-settings-layout>` with its nav, nav item and main parts; returns the layout tag. */
export function defineSettingsLayout(options?: DefineOptions): string {
  defineElement("settings-layout-nav", UiSettingsLayoutNav, options);
  defineElement("settings-layout-nav-item", UiSettingsLayoutNavItem, options);
  defineElement("settings-layout-main", UiSettingsLayoutMain, options);
  return defineElement("settings-layout", UiSettingsLayout, options);
}
