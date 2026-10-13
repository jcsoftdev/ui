/**
 * The accessible name of a control that lives inside a shadow root (a `role="slider"` thumb, a
 * rating, a button): `aria-label` or `label` on the host, else the text of the elements named by
 * `aria-labelledby` (resolved in the host's root), else the host's `<label>`s.
 */
export function controlName(host: HTMLElement, labels: Iterable<HTMLLabelElement>): string {
  const own = host.getAttribute("aria-label") ?? host.getAttribute("label");
  if (own) return own;
  const root = host.getRootNode() as Document | ShadowRoot;
  const referenced = (host.getAttribute("aria-labelledby") ?? "")
    .split(/\s+/)
    .map((id) => (id ? root.getElementById?.(id)?.textContent?.trim() : ""))
    .filter(Boolean);
  if (referenced.length) return referenced.join(" ");
  return [...labels]
    .map((label) => label.textContent?.trim())
    .filter(Boolean)
    .join(" ");
}

/** A finite number from an attribute, else `fallback`. */
export function numberAttr(host: Element, name: string, fallback: number): number {
  const raw = host.getAttribute(name);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Where a pointer is across `element`, 0..1 in the writing direction (mirrored in RTL). */
export function inlineRatio(host: Element, physical: number): number {
  return getComputedStyle(host).direction === "rtl" ? 1 - physical : physical;
}

/** Stroke-icon bodies on the 24px grid (same glyphs as the React kit). */
export const ICONS = {
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  upload:
    '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
} as const;

/** Markup of a decorative stroke icon sized by CSS. `fill` makes the body solid (a filled star). */
export const icon = (name: keyof typeof ICONS, fill = false): string =>
  `<svg viewBox="0 0 24 24" fill="${fill ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
