/**
 * Surface material of a component: opaque, frosted glass (`glass`, `glass-clear`: blur and tint)
 * or Liquid Glass (`liquid`, `liquid-clear`: lensing, specular rim, thickness). `glass` keeps
 * rendering as it always did; a `data-glass="liquid"` ancestor switches it, and the chrome
 * surfaces of the glass preset, to the liquid look globally.
 */
export type Material = "solid" | "glass" | "glass-clear" | "liquid" | "liquid-clear";

const CLASS: Record<Exclude<Material, "solid">, string> = {
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
  return CLASS[material];
}
