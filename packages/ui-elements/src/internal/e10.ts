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
 * Returns a stop function.
 */
export function gather(
  host: HTMLElement,
  into: (child: Element) => Element | null,
  own: (child: Element) => boolean,
  onMoved?: () => void,
): () => void {
  const run = () => {
    let moved = false;
    for (const child of Array.from(host.children)) {
      if (own(child)) continue;
      const target = into(child);
      if (!target) continue;
      target.append(child);
      moved = true;
    }
    if (moved) onMoved?.();
  };
  run();
  const observer = new MutationObserver(run);
  observer.observe(host, { childList: true });
  return () => observer.disconnect();
}

/** Runs `callback` now and whenever the direct children of `host` change. Returns a stop function. */
export function watchChildren(host: HTMLElement, callback: () => void): () => void {
  callback();
  const observer = new MutationObserver(callback);
  observer.observe(host, { childList: true });
  return () => observer.disconnect();
}

const isFocusable = (element: Element): element is HTMLElement => {
  if (!(element instanceof HTMLElement) || element.hidden) return false;
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
 * Returns a stop function that also restores the natural tab order.
 */
export function startRoving(host: HTMLElement, orientation: "horizontal" | "vertical"): () => void {
  let dead = false;
  let stop = () => {};
  const items = () => Array.from(host.querySelectorAll("*")).filter(isFocusable);
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
      for (const item of items()) item.removeAttribute("tabindex");
    };
  });
  return () => {
    dead = true;
    stop();
  };
}
