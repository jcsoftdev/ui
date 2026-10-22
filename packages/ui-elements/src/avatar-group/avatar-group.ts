import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import css from "./avatar-group.css.js";

/**
 * `<ui-avatar-group>`: stacked, overlapping avatars separated by a surface-coloured ring. A
 * light-DOM layout container with no role; children are usually `<ui-avatar>`.
 */
export class UiAvatarGroup extends ElementBase {
  connectedCallback(): void {
    this.dataset.ui = "avatar-group";
    adoptStyles(rootOf(this), css);
  }
}

/** Registers `<ui-avatar-group>` (or `<prefix-avatar-group>`) and returns the tag. */
export function defineAvatarGroup(options?: DefineOptions): string {
  return defineElement("avatar-group", UiAvatarGroup, options);
}
