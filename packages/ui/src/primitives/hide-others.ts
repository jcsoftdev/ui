import { globalSingleton } from "./global-singleton.js";

/** Never hidden: scripts and styles, live regions (toaster) and explicit opt-outs. */
const IGNORED = "[aria-live], [data-ui-overlay-ignore]";
const SKIP = `script, style, template, ${IGNORED}`;

interface Instance {
  hide: ReadonlySet<Element>;
}

interface Saved {
  ariaHidden: string | null;
  inert: string | null;
}

interface HideState {
  instances: Instance[];
  applied: Map<Element, Saved>;
}

const state = globalSingleton<HideState>("@jcsoftdev/ui/hide-others", () => ({
  instances: [],
  applied: new Map(),
}));

function restore(element: Element, saved: Saved) {
  if (saved.ariaHidden === null) element.removeAttribute("aria-hidden");
  else element.setAttribute("aria-hidden", saved.ariaHidden);
  if (saved.inert === null) element.removeAttribute("inert");
  else element.setAttribute("inert", saved.inert);
}

/** Only the most recently opened modal decides what is hidden; releasing it re-applies the one below. */
function reconcile() {
  for (const [element, saved] of state.applied) restore(element, saved);
  state.applied.clear();
  const top = state.instances[state.instances.length - 1];
  if (!top) return;
  for (const element of top.hide) {
    if (!element.isConnected) continue;
    state.applied.set(element, {
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.getAttribute("inert"),
    });
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
  }
}

function withinKept(node: Element, kept: readonly Element[]): boolean {
  return kept.some((keep) => keep.contains(node));
}

function computeHidden(kept: readonly Element[]): Set<Element> {
  const leaves = new Set<Element>(kept);
  for (const ignored of document.querySelectorAll(IGNORED)) {
    if (!withinKept(ignored, kept)) leaves.add(ignored);
  }
  const ancestors = new Set<Element>();
  for (const leaf of leaves) {
    for (let current = leaf.parentElement; current; current = current.parentElement) {
      ancestors.add(current);
      if (current === document.body) break;
    }
  }
  const hide = new Set<Element>();
  for (const ancestor of ancestors) {
    for (const child of Array.from(ancestor.children)) {
      if (leaves.has(child) || ancestors.has(child) || child.matches(SKIP)) continue;
      hide.add(child);
    }
  }
  return hide;
}

/**
 * Makes everything outside `keep` unreachable (`aria-hidden` + `inert`) by hiding,
 * at every level on the way to `body`, the siblings of each kept node. Live
 * regions and `[data-ui-overlay-ignore]` elements stay reachable even when nested
 * inside an otherwise hidden subtree. The most recent call wins, so a nested modal
 * portaled into a container that an outer modal hid is still usable, and releases
 * can happen in any order.
 */
export function hideOthers(keep: ReadonlyArray<Element | null | undefined>): () => void {
  const kept = keep.filter((node): node is Element => Boolean(node));
  const instance: Instance = { hide: computeHidden(kept) };
  state.instances.push(instance);
  reconcile();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = state.instances.indexOf(instance);
    if (index !== -1) state.instances.splice(index, 1);
    reconcile();
  };
}
