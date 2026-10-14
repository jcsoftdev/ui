// One MutationObserver and one media listener for every chart on the page, ref-counted.
const ATTRIBUTES = ["data-theme", "class", "style"];
const watched = new Map<Element, Set<() => void>>();
let observer: MutationObserver | undefined;
let media: MediaQueryList | undefined;
let count = 0;

const notify = (callbacks: Iterable<() => void>) => {
  for (const callback of [...callbacks]) callback();
};
const onMedia = () => notify(new Set([...watched.values()].flatMap((set) => [...set])));

const observe = () => {
  observer ??= new MutationObserver((records) => {
    const hit = new Set<() => void>();
    for (const record of records)
      for (const callback of watched.get(record.target as Element) ?? []) hit.add(callback);
    notify(hit);
  });
  observer.disconnect();
  for (const node of watched.keys())
    observer.observe(node, { attributes: true, attributeFilter: ATTRIBUTES });
};

/** Calls `callback` when the page theme changes (`data-theme`, `class`, `style` on the root or the nearest themed ancestor, or `prefers-color-scheme`). Returns the unsubscribe. */
export function watchTheme(element: Element, callback: () => void): () => void {
  const nodes = new Set<Element>([document.documentElement]);
  const themed = element.closest("[data-theme]");
  if (themed) nodes.add(themed);
  for (const node of nodes) {
    const set = watched.get(node) ?? new Set();
    set.add(callback);
    watched.set(node, set);
  }
  if (count++ === 0) {
    media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onMedia);
  }
  observe();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const node of nodes) {
      const set = watched.get(node);
      set?.delete(callback);
      if (set && !set.size) watched.delete(node);
    }
    if (--count === 0) {
      media?.removeEventListener("change", onMedia);
      media = undefined;
      observer?.disconnect();
      observer = undefined;
    } else observe();
  };
}

/** Live subscriptions, for tests. */
export const themeWatchers = () => count;
