import { type DefineOptions, defineElement } from "../internal/base.js";
import { ToggleElement } from "../internal/toggle.js";
import css from "./switch.css.js";

/**
 * `<ui-switch>`: `role="switch"` on the host, `checked`, `disabled`, `required`, `name`, `value`.
 * Space and Enter toggle. Form-associated (submits `value`, default `on`, while checked).
 */
export class UiSwitch extends ToggleElement {
  protected readonly controlRole = "switch" as const;
  protected readonly template =
    '<span part="track" aria-hidden="true"><span part="thumb"></span></span><slot></slot>';
  protected readonly css = css;
}

/** Registers `<ui-switch>` (or `<prefix-switch>`) and returns the tag. */
export const defineSwitch = (options?: DefineOptions) => defineElement("switch", UiSwitch, options);
