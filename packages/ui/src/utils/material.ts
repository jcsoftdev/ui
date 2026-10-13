import type { CSSProperties } from "react";
import { type LiquidMaterial, liquidOptionsOf, liquidStyle } from "../glass/liquid-options.js";

/** The material names: opaque, frosted glass or Liquid Glass (lensing, specular rim, thickness). */
export type MaterialName = "solid" | "glass" | "glass-clear" | "liquid" | "liquid-clear";

export type { LiquidMaterial };

/**
 * Surface material of a component: opaque, frosted glass (`glass`, `glass-clear`: blur and tint)
 * or Liquid Glass (`liquid`, `liquid-clear`: lensing, specular rim, thickness). `glass` keeps
 * rendering as it always did; a `data-glass="liquid"` ancestor switches it, and the chrome
 * surfaces of the glass preset, to the liquid look globally.
 *
 * Liquid Glass also takes options: `material={{ type: "liquid", frost: 4, profile: "dome" }}`
 * (see `LiquidGlassOptions`). The string values stay as they were.
 */
export type Material = MaterialName | LiquidMaterial;

const CLASS: Record<Exclude<MaterialName, "solid">, string> = {
  glass: "glass",
  "glass-clear": "glass-clear",
  liquid: "liquid",
  "liquid-clear": "liquid-clear",
};

/**
 * Class for a component's `material` prop. `undefined` keeps the component's own default
 * (`base`), `"solid"` forces the opaque variant, the glass values use the glass utilities.
 * Pass the result after the default class: `cn` lets a later surface material replace it.
 */
export function materialClass(material: Material | undefined, solid: string): string | undefined {
  if (material === undefined) return undefined;
  if (material === "solid") return solid;
  if (typeof material === "object") return CLASS[material.type];
  return CLASS[material];
}

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
