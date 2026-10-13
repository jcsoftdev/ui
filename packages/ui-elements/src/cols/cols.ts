import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./cols.css.js";

/**
 * `<ui-cols>`: responsive column layout (a CSS grid, no ARIA role). Breakpoints react to the
 * nearest ancestor container named `page` (`container: page / inline-size`), not to the viewport;
 * without such an ancestor the wide layouts always apply.
 *
 * Attribute `variant`: omit for the main + side split, or `rail` (fluid + 372px rail), `half`
 * (two equal columns) or `calc` (narrow + wide).
 */
export class UiCols extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "cols", css);
  }
}

/**
 * `<ui-cols-stack>`: a vertical stack for one column of `<ui-cols>`. Attribute `wide-split`: from
 * 1500px of page width the stack becomes two columns and its first child spans both rows.
 */
export class UiColsStack extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "cols-stack", css);
  }
}

/** Registers `<ui-cols>` and `<ui-cols-stack>` (or the same under another prefix); returns the cols tag. */
export function defineCols(options?: DefineOptions): string {
  defineElement("cols-stack", UiColsStack, options);
  return defineElement("cols", UiCols, options);
}
