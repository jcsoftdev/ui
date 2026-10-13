import type { FilterNode } from "./specular.js";

const KEEP = {
  r: "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0",
  g: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0",
  b: "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0",
} as const;

/** How much further than the lens the crystal's red channel reaches (its spread is damped). */
export const crystalSpread = (dispersion: number) => dispersion * 0.6;

/**
 * Chromatic dispersion: the three colour channels are displaced by slightly different amounts
 * (blue the least, red the most, so the rim fringes like real glass) and added back into `lens`.
 * `displace(channel, factor)` adds one displacement pass whose result is `d<channel>`. It runs
 * three passes instead of one (about +50% to +100% of the lens cost).
 */
export function buildDispersion(
  node: FilterNode,
  displace: (channel: "r" | "g" | "b", factor: number) => void,
  dispersion: number,
  crystal: boolean,
): void {
  // The crystal's offsets are large, so the same fraction would paint a noisy rainbow.
  const spread = crystal ? crystalSpread(dispersion) : dispersion;
  const factors = { r: 1 + spread, g: 1, b: 1 - spread } as const;
  for (const c of ["r", "g", "b"] as const) {
    displace(c, factors[c]);
    node("feColorMatrix", { in: `d${c}`, type: "matrix", values: KEEP[c], result: c });
  }
  const add = (a: string, b: string, result: string) =>
    node("feComposite", {
      in: a,
      in2: b,
      operator: "arithmetic",
      k1: "0",
      k2: "1",
      k3: "1",
      k4: "0",
      result,
    });
  add("r", "g", "rg");
  add("rg", "b", "lens");
}
