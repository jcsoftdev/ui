import type { CSSProperties } from "react";
import { liquidOptionsOf, liquidStyle } from "../glass/liquid-options.js";
import type { Material } from "./material-class.js";

/**
 * The `style` of a `material` prop: the `--liquid-*` custom properties of a liquid material
 * object, `undefined` for every other value. Spread it under the component's own `style`.
 */
export function materialStyle(material: Material | undefined): CSSProperties | undefined {
  if (typeof material !== "object") return undefined;
  return liquidStyle(liquidOptionsOf(material));
}

/** {@link materialStyle} under the caller's own `style`, which wins. Returns `style` itself when the material adds nothing. */
export function withMaterialStyle(
  material: Material | undefined,
  style?: CSSProperties,
): CSSProperties | undefined {
  const own = materialStyle(material);
  return own ? { ...own, ...style } : style;
}
