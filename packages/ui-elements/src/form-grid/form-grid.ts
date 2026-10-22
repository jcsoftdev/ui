import { adoptStyles, type DefineOptions, defineElement, ElementBase } from "../internal/base.js";
import css from "./form-grid.css.js";

/**
 * `<ui-form-grid>`: a grid for pairs of fields. One column in a narrow container, two columns from
 * 620px of container width (the host is the size container, so it follows the space it is given,
 * not the viewport). Children are the grid items; no ARIA role.
 */
export class UiFormGrid extends ElementBase {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    adoptStyles(root, css);
    root.innerHTML = '<div part="grid"><slot></slot></div>';
  }
}

/** Registers `<ui-form-grid>` (or `<prefix-form-grid>`) and returns the tag. */
export const defineFormGrid = (options?: DefineOptions) =>
  defineElement("form-grid", UiFormGrid, options);
