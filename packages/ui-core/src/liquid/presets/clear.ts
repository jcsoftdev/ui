import type { LiquidGlassOptions } from "../options.js";

/** `data-glass="liquid-clear"`: thinner frost, a lighter veil, a slightly brighter glint. */
export const clear: LiquidGlassOptions = {
  frost: 0.6,
  opacity: 0.75,
  refraction: 0.9,
  shadow: { opacity: 0.7 },
  specular: { intensity: 1.1 },
};
