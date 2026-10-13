import { type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import { connectLight } from "../internal/containers.js";
import css from "./facts.css.js";

/**
 * `<ui-facts>`: the responsive frame of a native `<dl>` of key facts: a three-column grid under a
 * dashed top rule. Put a `<dl>` inside and wrap each `<dt>` / `<dd>` pair in its own `<div>` (one
 * grid cell). It collapses to one column when the element is 560px wide or less.
 */
export class UiFacts extends ElementBase {
  connectedCallback(): void {
    connectLight(this, "facts", css);
  }
}

/** Registers `<ui-facts>` (or `<prefix-facts>`) and returns the tag. */
export function defineFacts(options?: DefineOptions): string {
  return defineElement("facts", UiFacts, options);
}
