const TABBABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]:not([contenteditable=false])",
  "[tabindex]",
].join(",");

function isRendered(element: HTMLElement): boolean {
  if (element.closest("[inert]")) return false;
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({ visibilityProperty: true });
  }
  return element.getClientRects().length > 0;
}

/** Elements reachable with Tab inside `root`, in DOM order. */
export function getTabbables(root: HTMLElement): HTMLElement[] {
  const found = root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR);
  return Array.from(found).filter((element) => element.tabIndex >= 0 && isRendered(element));
}

/**
 * Where Tab or Shift+Tab must be redirected to keep focus inside a trap, or `null`
 * when the browser's own move stays inside. An `active` outside `items` (the
 * container itself, or `body`) enters the list from the matching end.
 */
export function resolveTabWrap<T>(items: readonly T[], active: T | null, shift: boolean): T | null {
  if (items.length === 0) return null;
  const first = items[0] as T;
  const last = items[items.length - 1] as T;
  if (active === null || !items.includes(active)) return shift ? last : first;
  if (!shift && active === last) return first;
  if (shift && active === first) return last;
  return null;
}

/**
 * Tab target when focus sits on a non-tabbable node inside the container (a
 * `tabindex="-1"` region): the neighbouring tabbable in document order, wrapping
 * at the ends. Mirrors the browser's own sequential navigation start point.
 */
export function resolveTabFromInside(
  items: readonly HTMLElement[],
  active: HTMLElement,
  shift: boolean,
): HTMLElement | null {
  if (items.length === 0) return null;
  const follows = (item: HTMLElement) =>
    Boolean(active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (shift) {
    const before = items.filter((item) => !follows(item));
    return before[before.length - 1] ?? items[items.length - 1] ?? null;
  }
  return items.find((item) => follows(item)) ?? items[0] ?? null;
}

/**
 * Where focus goes when a portaled layer opened from `trigger` is left with Tab: the
 * first tabbable after the trigger in document order, or with `backwards` the trigger
 * itself when tabbable, else the closest tabbable before it. Elements inside `exclude`
 * (the layer) or the trigger are skipped; `null` when nothing qualifies.
 */
export function resolveTabOut(
  trigger: HTMLElement,
  exclude: HTMLElement | null,
  backwards: boolean,
): HTMLElement | null {
  const items = getTabbables(document.body).filter((element) => !exclude?.contains(element));
  const follows = (element: HTMLElement) =>
    Boolean(trigger.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (!backwards) {
    return items.find((element) => !trigger.contains(element) && follows(element)) ?? null;
  }
  if (items.includes(trigger)) return trigger;
  const before = items.filter((element) => !trigger.contains(element) && !follows(element));
  return before[before.length - 1] ?? null;
}
