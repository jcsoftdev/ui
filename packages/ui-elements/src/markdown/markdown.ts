import { renderMarkdown } from "@jcsoftdev/ui-core/markdown";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import { codeNode } from "../internal/code-node.js";
import css from "./markdown.css.js";

/**
 * `<ui-markdown>`: a safe Markdown renderer for chat answers and documentation. It renders through
 * ui-core's `markdown`, which builds elements with `createElement` and text with `textContent`:
 * raw HTML in the source is shown as text, nothing reaches `innerHTML`, and only http, https and
 * mailto links are active (opened with `target="_blank" rel="noopener noreferrer nofollow"`).
 * Supported: headings, paragraphs, lists, emphasis, inline code, fenced code, quotes, rules,
 * tables and links.
 *
 * Source: the `value` property or attribute, else a `<template>` child (its text, inert until read:
 * escape `<` as `&lt;`), else the element's initial text content. Plain light-DOM text is parsed by
 * the HTML parser BEFORE this element upgrades, so markup in it (an `<img onerror>`) would already
 * have run; never place untrusted text there. Use `value` or a `<template>` for untrusted input.
 * Attributes: `value`, `streaming` (blinking caret after the last character, `aria-busy`),
 * `highlight` (asks `<prefix-code-block>` for syntax highlighting). Fenced code uses
 * `<prefix-code-block>` when the page defined it, else a plain `<pre><code>`.
 */
export class UiMarkdown extends ElementBase {
  static observedAttributes = ["value", "streaming", "highlight"];
  #value: string | null = null;

  get value(): string {
    return this.#value ?? this.getAttribute("value") ?? "";
  }
  set value(next: string) {
    this.#value = String(next ?? "");
    this.#render();
  }

  get streaming(): boolean {
    return this.hasAttribute("streaming");
  }
  set streaming(on: boolean) {
    this.toggleAttribute("streaming", Boolean(on));
  }

  connectedCallback(): void {
    this.dataset.ui = "markdown";
    adoptStyles(rootOf(this), css);
    if (this.#value === null && !this.hasAttribute("value")) {
      const template = this.querySelector(":scope > template") as HTMLTemplateElement | null;
      this.#value = template ? (template.content.textContent ?? "") : (this.textContent ?? "");
    }
    this.#render();
  }

  attributeChangedCallback(name: string): void {
    if (name === "value") this.#value = null;
    if (this.isConnected) this.#render();
  }

  #render(): void {
    const streaming = this.streaming;
    const highlight = this.hasAttribute("highlight");
    if (streaming) this.setAttribute("aria-busy", "true");
    else this.removeAttribute("aria-busy");
    this.replaceChildren(
      renderMarkdown(this.value, {
        streaming,
        renderCode: (code, language) => {
          const node = codeNode(this, "markdown", code, language || null, highlight);
          node.dataset.part = "code-block";
          return node;
        },
      }),
    );
  }
}

/** Registers `<ui-markdown>` (or `<prefix-markdown>`) and returns the tag. */
export function defineMarkdown(options?: DefineOptions): string {
  return defineElement("markdown", UiMarkdown, options);
}
