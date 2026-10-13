import { type DefineOptions, defineElement } from "../internal/base.js";
import { BannerBase } from "../internal/e3-banner.js";

/**
 * `<ui-banner>`: an inline notice with a tone, an optional bold heading, a body and actions.
 * Only `tone="danger"` interrupts (`role="alert"`, assertive); the other tones are a polite
 * `role="status"`. The role is exposed through ElementInternals on the host.
 * Attributes: `tone` (`info` default, `success`, `warning`, `danger`), `heading` (React `title`),
 * `no-icon` (React `icon={null}`). Slots: default (body), `icon` (replaces the tone glyph),
 * `action` (React `action`: buttons on the right, wrapping under the body when narrow).
 */
export class UiBanner extends BannerBase {
  static observedAttributes = ["tone", "heading", "no-icon"];

  connectedCallback(): void {
    this.renderBanner();
  }

  attributeChangedCallback(): void {
    this.renderBanner();
  }
}

/** Registers `<ui-banner>` (or `<prefix-banner>`) and returns the tag. */
export function defineBanner(options?: DefineOptions): string {
  return defineElement("banner", UiBanner, options);
}
