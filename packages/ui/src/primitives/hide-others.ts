import { globalSingleton } from "./global-singleton.js";

/** Never hidden: scripts and styles, live regions (toaster) and explicit opt-outs. */
const IGNORED = '[aria-live]:not([aria-live="off"]), [data-ui-overlay-ignore]';
const SKIP = `script, style, template, ${IGNORED}`;

interface Instance {
  hide: ReadonlySet<Element>;
}

/** Attributes this module wrote on an element, with the value to put back. Absent means not ours. */
interface Owned {
  ariaHidden?: { previous: string | null };
  inert?: { previous: string | null };
}

interface HideState {
  instances: Instance[];
  applied: Map<Element, Owned>;
}

const state = globalSingleton<HideState>("@jcsoftdev/ui/hide-others", () => ({
  instances: [],
  applied: new Map(),
}));

function put(element: Element, name: string, previous: string | null) {
  if (previous === null) element.removeAttribute(name);
  else element.setAttribute(name, previous);
}

/** Releases only what we wrote and only while it is still ours: values changed or removed by others stay as they are. */
function release(element: Element, owned: Owned) {
  if (owned.ariaHidden && element.getAttribute("aria-hidden") === "true") {
    put(element, "aria-hidden", owned.ariaHidden.previous);
  }
  if (owned.inert && element.hasAttribute("inert")) {
    put(element, "inert", owned.inert.previous);
  }
}

/** Only the most recently opened modal decides what is hidden; releasing it re-applies the one below. */
function reconcile() {
  for (const [element, owned] of state.applied) release(element, owned);
  state.applied.clear();
  const top = state.instances[state.instances.length - 1];
  if (!top) return;
  for (const element of top.hide) {
    if (!element.isConnected) continue;
    const owned: Owned = {};
    // Already hidden by someone else (e.g. a Radix menu's own hider): uncontrolled, never touched or restored.
    if (element.getAttribute("aria-hidden") !== "true") {
      owned.ariaHidden = { previous: element.getAttribute("aria-hidden") };
      element.setAttribute("aria-hidden", "true");
    }
    if (!element.hasAttribute("inert")) {
      owned.inert = { previous: null };
      element.setAttribute("inert", "");
    }
    if (owned.ariaHidden || owned.inert) state.applied.set(element, owned);
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
 *
 * Only attributes written here are released, and only while they still hold our
 * value; an element already `aria-hidden="true"` or `inert` from elsewhere is left
 * alone. Like Radix, nodes appended to `body` after a modal opens (and not kept)
 * are not hidden until the modal is reopened.
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
