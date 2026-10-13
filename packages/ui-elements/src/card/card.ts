import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import { MATERIAL_ATTRIBUTES, Material } from "../internal/material.js";
import css from "./card.css.js";

/**
 * `<ui-card>`: a content surface (opaque by default) with optional `<ui-card-header>`,
 * `<ui-card-body>` and `<ui-card-footer>` sections. No ARIA role: it is layout, so give it
 * `role="group"` and a name yourself when it needs one. The card is an inline-size query container
 * named `card` (`@container card (...)`).
 *
 * Attributes: `material="liquid" | "liquid-clear"` opts into Liquid Glass (use sparingly, over
 * imagery, never inside another glass surface), with `lens`, `liquid-preset`, `liquid-refraction`,
 * `liquid-frost`, `liquid-profile`, `liquid-dispersion`, `liquid-specular`, `liquid-motion`,
 * `liquid-interactive` and `liquid-radius`. The liquid code loads lazily, only for a glass card.
 */
export class UiCard extends ElementBase {
  static observedAttributes: string[] = [...MATERIAL_ATTRIBUTES];
  readonly #material = new Material(this, () => this);

  connectedCallback(): void {
    connectLight(this, "card", css);
    this.#material.sync();
  }

  disconnectedCallback(): void {
    this.#material.stop();
  }

  attributeChangedCallback(): void {
    this.#material.sync();
  }
}

/** `<ui-card-header>`: a wrapping flex row with a bottom divider (title, badges, actions). */
export class UiCardHeader extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "card-header", css);
  }
}

/** `<ui-card-body>`: the padded content of a card. */
export class UiCardBody extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "card-body", css);
  }
}

/** `<ui-card-footer>`: a wrapping flex row with a top divider and muted meta text. */
export class UiCardFooter extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "card-footer", css);
  }
}

/**
 * Registers `<ui-card>` with `<ui-card-header>`, `<ui-card-body>` and `<ui-card-footer>` (or the
 * same under another prefix) and returns the card tag.
 */
export function defineCard(options?: DefineOptions): string {
  defineElement("card-header", UiCardHeader, options);
  defineElement("card-body", UiCardBody, options);
  defineElement("card-footer", UiCardFooter, options);
  return defineElement("card", UiCard, options);
}
