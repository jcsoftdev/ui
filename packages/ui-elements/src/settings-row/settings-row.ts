import { type DefineOptions, defineElement, ElementBase, uid } from "../internal/base.js";
import { connectLight, RowParts } from "../internal/containers.js";
import css from "./settings-row.css.js";

/**
 * `<ui-settings-row>`: a settings-list row. The `heading` and the optional `description` sit on
 * the left, and the element's own children are the controls on the right (a switch, a button...).
 * The row wraps the controls under the text when it is narrow. It has no ARIA role of its own: name
 * a control with `aria-labelledby` pointing at {@link UiSettingsRow.titleId}.
 *
 * Attributes: `heading`, `description`. The parts carry `data-ui-part="body" | "title" |
 * "description"` for styling. Consecutive rows are separated by a divider.
 */
export class UiSettingsRow extends ElementBase {
  static observedAttributes = ["heading", "description"];
  readonly #row = new RowParts(this);
  readonly #titleId = uid("settings-row-title");

  /** Id of the title element, for the `aria-labelledby` of a control inside the row. */
  get titleId(): string {
    return this.#titleId;
  }

  connectedCallback(): void {
    connectLight(this, "settings-row", css);
    this.#row.render(this.#titleId);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#row.render(this.#titleId);
  }
}

/** Registers `<ui-settings-row>` (or `<prefix-settings-row>`) and returns the tag. */
export function defineSettingsRow(options?: DefineOptions): string {
  return defineElement("settings-row", UiSettingsRow, options);
}
