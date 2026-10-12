let cached: boolean | undefined;

/**
 * Whether an SVG filter reference inside `backdrop-filter` actually paints.
 *
 * Only Chromium renders `backdrop-filter: url(#filter)`; Safari parses it and paints nothing
 * (the blur is lost with it) and Firefox ignores it, so `CSS.supports` alone cannot gate it.
 * A pixel probe is not possible from script, so the check is feature based: the declaration
 * must parse, `feDisplacementMap` must exist, and the engine must implement a property only
 * Blink ships (`-webkit-app-region`). Everything else keeps the plain blur. Treat it as a
 * conservative allow-list; pass `refraction: "force"` to {@link applyGlassRefraction} to override.
 */
export function supportsBackdropRefraction(): boolean {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined" || typeof CSS === "undefined" || !CSS.supports) return false;
  cached =
    CSS.supports("backdrop-filter", "url(#ui-glass-probe) blur(1px)") &&
    typeof (window as unknown as { SVGFEDisplacementMapElement?: unknown })
      .SVGFEDisplacementMapElement !== "undefined" &&
    CSS.supports("-webkit-app-region", "drag");
  return cached;
}

/** Test seam: forget the cached probe result. */
export function resetBackdropRefractionSupport(): void {
  cached = undefined;
}
