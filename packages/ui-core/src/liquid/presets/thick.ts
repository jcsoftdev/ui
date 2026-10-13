import type { LiquidGlassOptions } from "../options.js";

/** `data-glass="liquid-thick"`: a wider bevel, more frost, a brighter rim and a deeper shadow. */
export const thick: LiquidGlassOptions = {
  bevelWidth: 32,
  frost: 3,
  refraction: 1,
  rim: 1.25,
  fresnel: 0.35,
  shadow: { opacity: 1.2, spread: 12, offsetY: 16 },
};
