interface HiddenState {
  count: number;
  ariaHidden: string | null;
  inert: string | null;
}

const hidden = new WeakMap<Element, HiddenState>();
const SKIP = "script, style, template, [aria-live], [data-ui-overlay-ignore]";

function hide(element: Element): () => void {
  let state = hidden.get(element);
  if (!state) {
    state = {
      count: 0,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.getAttribute("inert"),
    };
    hidden.set(element, state);
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
  }
  state.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = hidden.get(element);
    if (!current) return;
    current.count -= 1;
    if (current.count > 0) return;
    hidden.delete(element);
    if (current.ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", current.ariaHidden);
    if (current.inert === null) element.removeAttribute("inert");
    else element.setAttribute("inert", current.inert);
  };
}

/**
 * Makes everything outside `keep` unreachable: siblings along the path from each
 * kept node up to `body` get `aria-hidden` and `inert`. Ref-counted per element,
 * so nested modals stack and release in any order.
 */
export function hideOthers(keep: ReadonlyArray<Element | null | undefined>): () => void {
  const kept = keep.filter((node): node is Element => Boolean(node));
  const path = new Set<Element>();
  for (const node of kept) {
    for (let current: Element | null = node; current; current = current.parentElement) {
      path.add(current);
      if (current === document.body) break;
    }
  }
  const releases: Array<() => void> = [];
  for (const ancestor of path) {
    if (kept.includes(ancestor)) continue;
    for (const child of Array.from(ancestor.children)) {
      if (path.has(child) || child.matches(SKIP)) continue;
      releases.push(hide(child));
    }
  }
  return () => {
    for (const release of releases) release();
  };
}
