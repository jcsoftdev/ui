import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import { upgradeProperties } from "../internal/e10.js";
import css from "../internal/e23-crossfilter.css.js";
import {
  type CrossfilterTexts,
  DEFAULT_TEXTS,
  linkProvider,
  type ProviderLink,
} from "../internal/e23-crossfilter.js";

/**
 * `<ui-crossfilter-summary>`: "128 of 480 sales" plus a button that clears every filter, for the
 * `<ui-crossfilter>` it sits in. Attribute: `noun` (what the records are). Property: `texts`.
 */
export class UiCrossfilterSummary extends ElementBase {
  static observedAttributes = ["noun"];

  #texts: Partial<CrossfilterTexts> = {};
  #link: ProviderLink | undefined;
  #text = document.createElement("p");
  #button = document.createElement("button");

  constructor() {
    super();
    this.#text.setAttribute("aria-live", "polite");
    this.#button.type = "button";
    this.#button.addEventListener("click", () => this.#link?.api?.clear());
  }

  connectedCallback(): void {
    this.dataset.ui = "crossfilter-summary";
    adoptStyles(rootOf(this), css);
    upgradeProperties(this, ["texts"]);
    this.replaceChildren(this.#text, this.#button);
    this.#link = linkProvider(this, () => this.#render());
    this.#render();
  }

  disconnectedCallback(): void {
    this.#link?.stop();
    this.#link = undefined;
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  /** Strings to override (see the shared `CrossfilterTexts`); assigning redraws. */
  get texts(): Partial<CrossfilterTexts> {
    return this.#texts;
  }

  set texts(value: Partial<CrossfilterTexts>) {
    this.#texts = value;
    if (this.isConnected) this.#render();
  }

  #render(): void {
    const api = this.#link?.api;
    const texts = { ...DEFAULT_TEXTS, ...this.texts };
    this.#text.textContent = api
      ? `${texts.count(api.filtered.length, api.total)} ${this.getAttribute("noun") ?? ""}`.trim()
      : "";
    this.#button.textContent = texts.clearAll;
    this.#button.hidden = !api || api.activeCount === 0;
  }
}

/** Registers `<ui-crossfilter-summary>` (or `<prefix>-crossfilter-summary`) and returns the tag. */
export function defineCrossfilterSummary(options?: DefineOptions): string {
  return defineElement("crossfilter-summary", UiCrossfilterSummary, options);
}
