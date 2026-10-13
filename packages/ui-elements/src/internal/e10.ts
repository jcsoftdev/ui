/** Helpers shared by the E10 containers (action-bar, toolbar, item-card-group, timeline, ...). */

/** Builds an element with a `data-ui-part`, optional text and children. */
export function part<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  name: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.dataset.uiPart = name;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** A decorative 24px stroke icon from path data. */
export function icon(paths: string, size = 16): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-ui-part="icon">${paths}</svg>`;
}

/**
 * Moves the author's own children into `into` and keeps doing it for children added later.
 * `own` tells the elements the host built itself from the author's (which stay where they are).
 * A child that lands before the target container (`prepend`) is moved to the start of it, so the
 * order the author wrote is kept; the others are appended. `watch` lists containers whose own
 * child list is observed too (removals), so `onMoved` also runs when something leaves them.
 * Returns a stop function.
 */
export function gather(
  host: HTMLElement,
  into: (child: Element) => Element | null,
  own: (child: Element) => boolean,
  onMoved?: () => void,
  watch: Element[] = [],
): () => void {
  const run = () => {
    let moved = false;
    const before: Array<[Element, Element]> = [];
    for (const child of Array.from(host.children)) {
      if (own(child)) continue;
      const target = into(child);
      if (!target) continue;
      if (target.parentElement === host && child.compareDocumentPosition(target) & 4)
        before.push([child, target]);
      else target.append(child);
      moved = true;
    }
    for (const [child, target] of before.reverse()) target.prepend(child);
    if (moved) onMoved?.();
  };
  run();
  const observer = new MutationObserver(run);
  observer.observe(host, { childList: true });
  const removals = new MutationObserver(() => onMoved?.());
  for (const element of watch) removals.observe(element, { childList: true });
  return () => {
    observer.disconnect();
    removals.disconnect();
  };
}

/**
 * Re-applies properties set on the element before it was upgraded: an own property shadows the
 * class accessor, so each is deleted and assigned again through the setter.
 */
export function upgradeProperties(element: HTMLElement, names: string[]): void {
  for (const name of names) {
    if (!Object.hasOwn(element, name)) continue;
    const value = (element as unknown as Record<string, unknown>)[name];
    delete (element as unknown as Record<string, unknown>)[name];
    (element as unknown as Record<string, unknown>)[name] = value;
  }
}

/** Runs `callback` now and whenever the direct children of `host` change. Returns a stop function. */
export function watchChildren(host: HTMLElement, callback: () => void): () => void {
  callback();
  const observer = new MutationObserver(callback);
  observer.observe(host, { childList: true });
  return () => observer.disconnect();
}

const NESTED =
  '[role="radiogroup"],[role="group"],[role="menu"],[role="listbox"],[role="dialog"],[role="toolbar"],[popover],dialog,[data-roving-skip]';
const NESTED_TAGS =
  /-(radio-group|radio-button-group|checkbox-button-group|popover|dropdown-menu|menu|dialog)$/;

/** Whether `element` sits inside a composite widget of its own (a group, menu or popover) below `host`. */
const isNested = (element: Element, host: Element): boolean => {
  for (let node = element.parentElement; node && node !== host; node = node.parentElement)
    if (node.matches(NESTED) || NESTED_TAGS.test(node.localName)) return true;
  return false;
};

const isFocusable = (element: Element, host: Element): element is HTMLElement => {
  if (!(element instanceof HTMLElement) || element.hidden || isNested(element, host)) return false;
  const tag = element.localName;
  return (
    tag === "button" ||
    (tag === "a" && element.hasAttribute("href")) ||
    tag.endsWith("-button") ||
    element.getAttribute("role") === "button" ||
    element.hasAttribute("data-roving-item")
  );
};

/**
 * Roving tabindex over the buttons and links of a toolbar (one tab stop, arrows, Home/End). The
 * behaviour is loaded on demand from ui-core, so a toolbar without `roving` never fetches it.
 * Items inside a nested composite (a radio group, a menu, a popover) are left alone. Returns a
 * stop function that puts every item's own `tabindex` back.
 */
export function startRoving(host: HTMLElement, orientation: "horizontal" | "vertical"): () => void {
  let dead = false;
  let stop = () => {};
  const originals = new Map<HTMLElement, string | null>();
  const items = () => {
    const found = Array.from(host.querySelectorAll("*")).filter((element) =>
      isFocusable(element, host),
    );
    for (const item of found)
      if (!originals.has(item)) originals.set(item, item.getAttribute("tabindex"));
    return found;
  };
  import("@jcsoftdev/ui-core/roving").then(({ createRovingFocus }) => {
    if (dead) return;
    const roving = createRovingFocus(host, { items, orientation });
    const observer = new MutationObserver(() => roving.update());
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-disabled", "hidden"],
    });
    stop = () => {
      observer.disconnect();
      roving.destroy();
      for (const [item, original] of originals) {
        if (original === null) item.removeAttribute("tabindex");
        else item.setAttribute("tabindex", original);
      }
    };
  });
  return () => {
    dead = true;
    stop();
  };
}
