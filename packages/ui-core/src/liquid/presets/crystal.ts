import type { LiquidGlassOptions } from "../options.js";

/**
 * A thick, fully clear convex lens: the backdrop is minified and bent hard towards the rim, the
 * colour channels split at the edge, no frost, no veil, a thin bright rim. Over busy content text
 * is not legible: there is no contrast guarantee, put short bold labels with a text shadow on it.
 * `attachLiquid` loads the crystal and dispersion features for it (and no specular: it is 0).
 */
export const crystal: LiquidGlassOptions = {
  profile: "crystal",
  refraction: 1.67,
  dispersion: 0.05,
  frost: 0,
  saturation: 1,
  opacity: 0,
  tint: { color: "transparent", amount: 0 },
  rim: 0.6,
  specular: { intensity: 0 },
  fresnel: 1,
  shadow: { opacity: 0.8 },
};
