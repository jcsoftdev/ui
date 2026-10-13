import {
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  toggleAttr,
} from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { icon, watchCompact } from "../internal/e8-shell.js";
import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";
import css from "./topbar.css.js";

const isApple = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent || "");

const part = <T extends HTMLElement>(tag: string, name: string): T => {
  const element = document.createElement(tag) as T;
  element.dataset.uiPart = name;
  return element;
};

/**
 * `<ui-topbar>`: the top bar of the app shell, a `banner` landmark with the breadcrumb trail, a
 * search trigger (also opened by Cmd/Ctrl+K) and slots for actions. The bar is an inline-size query
 * container named `topbar`: small widths hide the parent crumbs and collapse the search to an icon.
 * It is sticky, so place it at the top of the page column of a `<ui-app-shell>`.
 *
 * Children, by `slot`: `slot="crumb"` elements are the breadcrumb trail in order (the last one is
 * the current view and gets `aria-current="page"`); `slot="end"` goes at the far end (the account
 * menu); every other child goes between the search and the end block (status, notifications,
 * a primary action).
 *
 * Attributes: `breadcrumbs-label` (name of the breadcrumb landmark), `menu-label` (shows the menu
 * button when the shell is narrower than 900 px, and names it; omitted: no button), `search-label`
 * (name of the search button), `search-placeholder` (its text), and the `material` attributes:
 * `material="liquid" | "liquid-clear"` opts into Liquid Glass (loaded lazily, only then).
 * Cmd/Ctrl+K is ignored while typing in a field, with Shift or Alt, or when another handler (another
 * topbar) already handled it.
 * Events: `open-menu` (the menu button; React `onOpenMenu`) and `search` (the search button and
 * Cmd/Ctrl+K; React `onSearch`). The menu button is exposed as the `menuButton` property to
 * restore focus after the drawer closes.
 */
export class UiTopbar extends ElementBase {
  static observedAttributes: string[] = [
    ...MATERIAL_ATTRIBUTES,
    "breadcrumbs-label",
    "menu-label",
    "search-label",
    "search-placeholder",
  ];
  readonly #internals = this.attachInternals();
  readonly #material = new Material(this, () => this);
  readonly #inner = part<HTMLDivElement>("div", "inner");
  readonly #crumbs = part<HTMLElement>("nav", "breadcrumbs");
  readonly #menu = part<HTMLButtonElement>("button", "menu-button");
  readonly #search = part<HTMLButtonElement>("button", "search");
  readonly #searchText = part<HTMLSpanElement>("span", "search-text");
  readonly #shortcut = part<HTMLSpanElement>("span", "shortcut");
  readonly #actions = part<HTMLDivElement>("div", "actions");
  readonly #end = part<HTMLDivElement>("div", "end");
  #mutations: MutationObserver | undefined;
  #stopCompact: (() => void) | undefined;

  constructor() {
    super();
    this.#internals.role = "banner";
    this.#menu.type = "button";
    this.#menu.append(icon("M4 6h16", "M4 12h16", "M4 18h16"));
    this.#menu.addEventListener("click", () => emit(this, "open-menu"));
    this.#search.type = "button";
    this.#search.append(
      icon("m21 21-4.3-4.3", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z"),
      this.#searchText,
      this.#shortcut,
    );
    this.#search.addEventListener("click", () => emit(this, "search"));
    this.#inner.append(this.#menu, this.#crumbs, this.#search, this.#actions, this.#end);
  }

  /** The menu button, to restore focus to it when the sidebar drawer closes. */
  get menuButton(): HTMLButtonElement {
    return this.#menu;
  }

  connectedCallback(): void {
    connectLight(this, "topbar", css);
    this.#shortcut.textContent = isApple() ? "⌘K" : "Ctrl+K";
    this.append(this.#inner);
    this.#mutations = new MutationObserver(() => this.#arrange());
    this.#mutations.observe(this, { childList: true });
    this.#arrange();
    this.#render();
    this.#stopCompact = watchCompact(this, (compact) => toggleAttr(this, "data-compact", compact));
    window.addEventListener("keydown", this.#onKeyDown);
    this.#material.sync();
  }

  disconnectedCallback(): void {
    this.#mutations?.disconnect();
    this.#stopCompact?.();
    window.removeEventListener("keydown", this.#onKeyDown);
    this.#material.stop();
  }

  attributeChangedCallback(name: string): void {
    if ((MATERIAL_ATTRIBUTES as readonly string[]).includes(name)) this.#material.sync();
    else this.#render();
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.shiftKey || event.altKey) return;
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
    const target = event.composedPath()[0];
    if (
      target instanceof Element &&
      target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")
    )
      return;
    event.preventDefault();
    emit(this, "search");
  };

  #arrange(): void {
    for (const child of [...this.children]) {
      if (child === this.#inner) continue;
      const slot = child.getAttribute("slot");
      (slot === "crumb" ? this.#crumbs : slot === "end" ? this.#end : this.#actions).append(child);
    }
    const crumbs = [...this.#crumbs.children];
    crumbs.forEach((crumb, index) => {
      if (index === crumbs.length - 1) crumb.setAttribute("aria-current", "page");
      else crumb.removeAttribute("aria-current");
    });
  }

  #render(): void {
    const menuLabel = this.getAttribute("menu-label");
    this.#menu.hidden = menuLabel === null;
    if (menuLabel !== null) this.#menu.setAttribute("aria-label", menuLabel);
    this.#crumbs.setAttribute("aria-label", this.getAttribute("breadcrumbs-label") ?? "");
    this.#search.setAttribute("aria-label", this.getAttribute("search-label") ?? "");
    this.#searchText.textContent = this.getAttribute("search-placeholder") ?? "";
  }
}

/** Registers `<ui-topbar>` (or `<prefix-topbar>`) and returns the tag. */
export function defineTopbar(options?: DefineOptions): string {
  return defineElement("topbar", UiTopbar, options);
}
