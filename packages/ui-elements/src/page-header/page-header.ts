import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight, defaultAttr } from "../internal/containers.js";
import css from "./page-header.css.js";

/**
 * `<ui-page-header>`: the header of a view. No required parts: compose a block of
 * `<ui-page-header-eyebrow>`, `<ui-page-header-title>` and `<ui-page-header-lede>` in a plain
 * `<div>` and, when the view has buttons, a `<ui-page-header-actions>` as the second child. The
 * actions wrap under the title when the header is too narrow. No ARIA role.
 */
export class UiPageHeader extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "page-header", css);
  }
}

/** `<ui-page-header-eyebrow>`: the small line above the title. */
export class UiPageHeaderEyebrow extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "page-header-eyebrow", css);
  }
}

/**
 * `<ui-page-header-title>`: the page title, `role="heading"` at `aria-level` 1 (set `aria-level`
 * yourself for another level). Wrap a word in `<span data-accent-word>` to accent it.
 */
export class UiPageHeaderTitle extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "page-header-title", css);
    defaultAttr(this, "role", "heading");
    defaultAttr(this, "aria-level", "1");
  }
}

/** `<ui-page-header-lede>`: the lede paragraph under the title. */
export class UiPageHeaderLede extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "page-header-lede", css);
  }
}

/** `<ui-page-header-actions>`: a wrapping row of buttons. */
export class UiPageHeaderActions extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "page-header-actions", css);
  }
}

/** Registers `<ui-page-header>` and its eyebrow, title, lede and actions; returns the header tag. */
export function definePageHeader(options?: DefineOptions): string {
  defineElement("page-header-eyebrow", UiPageHeaderEyebrow, options);
  defineElement("page-header-title", UiPageHeaderTitle, options);
  defineElement("page-header-lede", UiPageHeaderLede, options);
  defineElement("page-header-actions", UiPageHeaderActions, options);
  return defineElement("page-header", UiPageHeader, options);
}
