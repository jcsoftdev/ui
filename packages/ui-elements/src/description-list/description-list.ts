import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./description-list.css.js";

/**
 * `<ui-description-list>`: the responsive frame of a native definition list. Put a `<dl>` with
 * flat `<dt>` / `<dd>` pairs inside; the `dl` keeps its real semantics (term and definition in the
 * accessibility tree) and this element styles it: an auto-width term column and a flexible,
 * right-aligned value column that stacks term over value when the element is narrower than 24rem.
 */
export class UiDescriptionList extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "description-list", css);
  }
}

/** Registers `<ui-description-list>` (or `<prefix-description-list>`) and returns the tag. */
export function defineDescriptionList(options?: DefineOptions): string {
  return defineElement("description-list", UiDescriptionList, options);
}
