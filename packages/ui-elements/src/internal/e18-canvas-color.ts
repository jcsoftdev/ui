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
