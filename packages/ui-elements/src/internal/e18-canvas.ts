// Shared by the E18 charts that switch to the canvas layer for thousands of marks. A canvas cannot
// read `var(--token)`, so colors are resolved once per draw through a hidden probe.

/** Marks above this count are painted on the canvas layer instead of one SVG node each. */
export const CANVAS_MARKS = 5000;

/** Height (px) a canvas-layer chart grows to when its natural height would be thousands of pixels. */
export const CANVAS_HEIGHT = 640;

/** Resolves CSS colors (`var(--x)`, `color-mix(...)`, names) to a value the 2D context accepts. */
export function colorResolver(parent: Element): (value: string) => string {
  const cache = new Map<string, string>();
  return (value) => {
    const known = cache.get(value);
    if (known !== undefined) return known;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    probe.style.color = value;
    parent.append(probe);
    const resolved = getComputedStyle(probe).color || value;
    probe.remove();
    cache.set(value, resolved);
    return resolved;
  };
}
