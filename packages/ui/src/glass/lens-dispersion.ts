/** The node factory and the displacement pass of the lens filter being built. */
export interface DispersionPasses {
  node: (name: string, attrs: Record<string, string>) => Element;
  displace: (channel: "r" | "g" | "b", factor: number) => void;
}

const KEEP = {
  r: "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0",
  g: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0",
  b: "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0",
} as const;

const ADD = { operator: "arithmetic", k1: "0", k2: "1", k3: "1", k4: "0" };

/**
 * Chromatic dispersion: the three colour channels are displaced by slightly different amounts
 * (blue the least, red the most, so the rim fringes like real glass) and added back into `lens`.
 * Its own lazy chunk: the engine imports it only for a surface that asks for dispersion.
 */
export function addDispersion(
  { node, displace }: DispersionPasses,
  dispersion: number,
  crystal: boolean,
): void {
  // The crystal's offsets are large, so the same fraction would paint a noisy rainbow.
  const spread = crystal ? dispersion * 0.6 : dispersion;
  const factors = { r: 1 + spread, g: 1, b: 1 - spread } as const;
  for (const c of ["r", "g", "b"] as const) {
    displace(c, factors[c]);
    node("feColorMatrix", { in: `d${c}`, type: "matrix", values: KEEP[c], result: c });
  }
  node("feComposite", { in: "r", in2: "g", ...ADD, result: "rg" });
  node("feComposite", { in: "rg", in2: "b", ...ADD, result: "lens" });
}
