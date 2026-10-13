/** Stroke-icon bodies (24px grid) of the AI chat set; same glyphs as the React kit. */
const GLYPHS = {
  file: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  stop: '<rect width="18" height="18" x="3" y="3" rx="2" fill="currentColor"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  like: '<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/>',
  dislike:
    '<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/><path d="M17 14V2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash:
    '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
} as const;

export type ChatGlyph = keyof typeof GLYPHS;

/** Markup of a decorative stroke icon sized by CSS. Static strings only: no data reaches it. */
export const chatGlyph = (name: ChatGlyph, part = "icon"): string =>
  `<svg part="${part}" data-ui-part="${part}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name]}</svg>`;

/** Replaces the children of `target` with a parsed copy of a trusted, static icon string. */
export function setGlyph(target: Element, name: ChatGlyph, part = "icon"): void {
  const template = document.createElement("template");
  template.innerHTML = chatGlyph(name, part);
  target.replaceChildren(template.content);
}

/**
 * The tag of a sibling part of the same family under the host's prefix: `acme-conversation` and
 * `chat-message` give `acme-chat-message`.
 */
export function siblingTag(host: Element, ownName: string, partName: string): string {
  const prefix = host.localName.slice(0, host.localName.length - ownName.length);
  return `${prefix}${partName}`;
}

/** Visually hidden but announced. The matching CSS is `[data-ui-part="sr"]` in each element. */
export function srOnly(tag = "span"): HTMLElement {
  const element = document.createElement(tag);
  element.dataset.uiPart = "sr";
  return element;
}

/** Parses a finite number attribute, `undefined` when absent or not a number. */
export function numberAttr(host: Element, name: string): number | undefined {
  const raw = host.getAttribute(name);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Makes the children of `parent` match `wanted` without moving the subtree that holds focus
 * (moving or re-inserting a focused node blurs it, which `replaceChildren` would do).
 */
export function reconcile(parent: Element, wanted: readonly Node[]): void {
  const keep = new Set<Node>(wanted);
  for (const child of [...parent.childNodes]) if (!keep.has(child)) child.remove();
  const focused = document.activeElement;
  let cursor: Node | null = parent.firstChild;
  for (const node of wanted) {
    if (node === cursor) cursor = cursor.nextSibling;
    else if (!(focused && node.contains(focused))) parent.insertBefore(node, cursor);
  }
}
