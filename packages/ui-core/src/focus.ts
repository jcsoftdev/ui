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

/** Elements reachable with Tab inside `root`, in DOM order. Custom elements count through `tabindex`. */
export function getTabbables(root: ParentNode): HTMLElement[] {
  const found = root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR);
  return Array.from(found).filter((element) => element.tabIndex >= 0 && isRendered(element));
}

/**
 * Where Tab or Shift+Tab must be redirected to keep focus inside a trap, or `null` when the
 * browser's own move stays inside. An `active` outside `items` enters from the matching end.
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
 * Tab target when focus sits on a non-tabbable node inside the container (a `tabindex="-1"`
 * region): the neighbouring tabbable in document order, wrapping at the ends.
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

export interface FocusScopeOptions {
  /** Keep Tab and Shift+Tab inside, and pull back focus that leaves. Default true. */
  trapped?: boolean;
  /** While several scopes are open, only the one this returns true for traps. */
  isTop?: () => boolean;
  /** Focus landing outside is allowed when this returns true for its target. */
  allowFocus?: (target: Element) => boolean;
  /** Cancelable: `preventDefault()` keeps focus where it is. */
  onMountAutoFocus?: (event: Event) => void;
  /** Cancelable: `preventDefault()` skips the focus return. */
  onUnmountAutoFocus?: (event: Event) => void;
}

const LIVE_OR_IGNORED = '[aria-live]:not([aria-live="off"]), [data-ui-overlay-ignore]';

const focusQuietly = (element: HTMLElement | null | undefined) =>
  element?.focus({ preventScroll: true });

/** Element focused in the document, through open shadow roots. */
export function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/**
 * Moves focus into `container` (first tabbable that is not a link, else the container), traps Tab
 * inside while `trapped`, and returns focus to where it was when released. The same behaviour as
 * the React kit's `useFocusScope`. Returns the release function.
 */
export function createFocusScope(
  container: HTMLElement,
  options: FocusScopeOptions = {},
): () => void {
  const { trapped = true } = options;
  const previous = document.activeElement as HTMLElement | null;
  const returnTarget = previous && !container.contains(previous) ? previous : null;

  if (!container.contains(previous)) {
    const event = new Event("ui.focusScope.mount", { cancelable: true });
    options.onMountAutoFocus?.(event);
    if (!event.defaultPrevented) {
      const candidates = getTabbables(container).filter((el) => el.tagName !== "A");
      focusQuietly(candidates[0] ?? container);
    }
  }

  const isActiveScope = () => !options.isTop || options.isTop();
  let lastFocused: HTMLElement | null = container.contains(document.activeElement)
    ? (document.activeElement as HTMLElement)
    : null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!isActiveScope()) return;
    const items = getTabbables(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    const target =
      active && active !== container && container.contains(active) && !items.includes(active)
        ? resolveTabFromInside(items, active, event.shiftKey)
        : resolveTabWrap(items, active, event.shiftKey);
    if (target) {
      event.preventDefault();
      focusQuietly(target);
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (container.contains(target)) {
      lastFocused = target as HTMLElement;
      return;
    }
    if (!isActiveScope() || target.closest(LIVE_OR_IGNORED)) return;
    if (options.allowFocus?.(target)) return;
    const fallback = getTabbables(container)[0] ?? container;
    focusQuietly(lastFocused && container.contains(lastFocused) ? lastFocused : fallback);
  };

  const observer =
    typeof MutationObserver === "function"
      ? new MutationObserver((mutations) => {
          if (document.activeElement !== document.body || !isActiveScope()) return;
          if (mutations.some((mutation) => mutation.removedNodes.length > 0))
            focusQuietly(container);
        })
      : undefined;

  if (trapped) {
    observer?.observe(document.body, { childList: true, subtree: true });
    container.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    observer?.disconnect();
    container.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("focusin", onFocusIn);
    const event = new Event("ui.focusScope.unmount", { cancelable: true });
    options.onUnmountAutoFocus?.(event);
    if (event.defaultPrevented) return;
    focusQuietly(returnTarget?.isConnected ? returnTarget : document.body);
  };
}
