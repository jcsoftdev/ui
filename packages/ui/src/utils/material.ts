/** Surface material of a component: opaque, regular Liquid Glass, or clear Liquid Glass. */
export type Material = "solid" | "glass" | "glass-clear";

/**
 * Class for a component's `material` prop. `undefined` keeps the component's own default
 * (`base`), `"solid"` forces the opaque variant, the glass values use the `glass` utilities.
 * Pass the result after the default class: `cn` lets a later surface material replace it.
 */
export function materialClass(material: Material | undefined, solid: string): string | undefined {
  if (material === undefined) return undefined;
  if (material === "solid") return solid;
  return material === "glass-clear" ? "glass-clear" : "glass";
}
