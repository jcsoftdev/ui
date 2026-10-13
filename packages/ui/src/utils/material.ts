/**
 * Surface material of a component: opaque (`solid`), frosted glass (`glass`, `glass-clear`: blur
 * and tint) or Liquid Glass (`liquid`, `liquid-clear`: rim, depth, and the lens once
 * `<LiquidGlass />` is mounted). Liquid options are CSS variables: pass `liquidStyle(options)`
 * from `@jcsoftdev/ui/liquid` as the component's `style`, or set them on a scope or the theme.
 */
export type Material = "solid" | "glass" | "glass-clear" | "liquid" | "liquid-clear";

/**
 * Class for a component's `material` prop. `undefined` keeps the component's own default,
 * `"solid"` forces the opaque variant (`solid`), every other value is the utility of the same
 * name. Pass the result after the default class: `cn` lets a later surface material replace it.
 */
export function materialClass(material: Material | undefined, solid: string): string | undefined {
  return material === "solid" ? solid : material;
}
