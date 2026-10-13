import { setSafeHtml } from "@jcsoftdev/ui-core/sanitize-html";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import css from "./rich-text-view.css.js";

/**
 * `<ui-rich-text-view>`: read-only rendering of rich-text editor output. Every write goes through
 * ui-core's `sanitize-html` allowlist (`setSafeHtml`), so stored HTML is never trusted: only the
 * editor's vocabulary survives, attributes are dropped except `<a href>`, and hrefs keep the
 * sanitizer's scheme allowlist (http, https, mailto, tel, relative).
 *
 * Source: the `html` attribute or property, or a `<template>` child. Never the element's own
 * children: the HTML parser would already have run them before any sanitiser could.
 * Attributes: `html`.
 */
export class UiRichTextView extends ElementBase {
  static observedAttributes = ["html"];
  #html: string | null = null;

  get html(): string {
    return this.#html ?? this.getAttribute("html") ?? "";
  }
  set html(value: string) {
    this.#html = String(value ?? "");
    this.#render();
  }

  connectedCallback(): void {
    this.dataset.ui = "rich-text-view";
    adoptStyles(rootOf(this), css);
    if (this.#html === null && !this.hasAttribute("html")) {
      const template = this.querySelector(":scope > template");
      if (template) this.#html = (template as HTMLTemplateElement).innerHTML;
    }
    this.#render();
  }

  attributeChangedCallback(): void {
    this.#html = null;
    if (this.isConnected) this.#render();
  }

  #render(): void {
    setSafeHtml(this, this.html);
  }
}

/** Registers `<ui-rich-text-view>` (or `<prefix-rich-text-view>`) and returns the tag. */
export function defineRichTextView(options?: DefineOptions): string {
  return defineElement("rich-text-view", UiRichTextView, options);
}
