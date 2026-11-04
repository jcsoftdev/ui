const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CONTAINER_TAGS = new Set(["UL", "OL", "TBODY", "TABLE", "MAIN", "SECTION", "ARTICLE"]);

export function isVisible(element: Element): boolean {
  return element.getClientRects().length > 0;
}

export function focusLosing(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || active === document.documentElement;
}

/** Focuses the element, or a control inside it; returns whether focus moved there. */
export function focusWithin(element: HTMLElement): boolean {
  const target = element.hasAttribute("tabindex")
    ? element
    : (element.querySelector<HTMLElement>(FOCUSABLE) ?? element);
  if (!target.hasAttribute("tabindex") && !target.matches(FOCUSABLE)) {
    target.setAttribute("tabindex", "-1");
  }
  target.focus({ preventScroll: false });
  return document.activeElement === target;
}

/** The element and its ancestors up to the body, nearest first. */
export function focusChain(element: Element | null): HTMLElement[] {
  const chain: HTMLElement[] = [];
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    if (node instanceof HTMLElement) chain.push(node);
  }
  return chain;
}

/**
 * Focuses the first element of a chain captured with `focusChain` that still lives in the
 * document: the element itself, otherwise the nearest surviving interactive or list-like ancestor.
 */
export function restoreFocusFromChain(chain: readonly HTMLElement[]): boolean {
  for (const [index, element] of chain.entries()) {
    if (!element.isConnected || !isVisible(element)) continue;
    const usable =
      index === 0 ||
      element.hasAttribute("tabindex") ||
      element.matches(FOCUSABLE) ||
      CONTAINER_TAGS.has(element.tagName) ||
      element.getAttribute("role") === "listbox" ||
      element.getAttribute("role") === "list";
    if (usable && focusWithin(element)) return true;
  }
  return false;
}
