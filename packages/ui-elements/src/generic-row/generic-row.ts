import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./generic-row.css.js";

/**
 * `<ui-generic-row>`: a three-column row (start, flexible content, end) for heterogeneous lists.
 * The start and end slots take any content (icon, avatar, chip, button). The middle column is a
 * `<ui-generic-row-content>` holding a `<ui-generic-row-title>` and a `<ui-generic-row-meta>`; mark
 * the end child with `data-end` when the row has no start child. No ARIA role: put the rows in a
 * `<ul>` / `role="list"` yourself when they are a list. The first row of a consecutive run has no
 * top border.
 */
export class UiGenericRow extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "generic-row", css);
  }
}

/** `<ui-generic-row-content>`: the flexible middle column wrapping title and meta. */
export class UiGenericRowContent extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "generic-row-content", css);
  }
}

/** `<ui-generic-row-title>`: the row title. */
export class UiGenericRowTitle extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "generic-row-title", css);
  }
}

/** `<ui-generic-row-meta>`: secondary metadata under the title. */
export class UiGenericRowMeta extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "generic-row-meta", css);
  }
}

/** Registers `<ui-generic-row>` and its content, title and meta parts; returns the row tag. */
export function defineGenericRow(options?: DefineOptions): string {
  defineElement("generic-row-content", UiGenericRowContent, options);
  defineElement("generic-row-title", UiGenericRowTitle, options);
  defineElement("generic-row-meta", UiGenericRowMeta, options);
  return defineElement("generic-row", UiGenericRow, options);
}
