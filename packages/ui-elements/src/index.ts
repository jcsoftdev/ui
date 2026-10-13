import { defineButton } from "./button/button.js";
import { defineCheckbox } from "./checkbox/checkbox.js";
import { defineInput } from "./input/input.js";
import type { DefineOptions } from "./internal/base.js";
import { defineRadioGroup } from "./radio-group/radio-group.js";
import { defineSwitch } from "./switch/switch.js";

export { defineButton, UiButton } from "./button/button.js";
export { defineCheckbox, UiCheckbox } from "./checkbox/checkbox.js";
export { defineInput, UiInput } from "./input/input.js";
export type { DefineOptions } from "./internal/base.js";
export { defineRadioGroup, UiRadio, UiRadioGroup } from "./radio-group/radio-group.js";
export { defineSwitch, UiSwitch } from "./switch/switch.js";

/**
 * Registers every element under `prefix` (default `ui`). Convenient, but it loads all of them:
 * import a single entry (`@jcsoftdev/ui-elements/button`) to pay for one element only.
 */
export function define(options?: DefineOptions): void {
  defineButton(options);
  defineInput(options);
  defineCheckbox(options);
  defineSwitch(options);
  defineRadioGroup(options);
}
