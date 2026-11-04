import { type RefObject, useEffect } from "react";
import { focusLosing, focusWithin, isVisible } from "./focus-chain.js";

export interface FocusRescueOptions {
  /** Selector of the items inside the root. */
  item: string;
  /** Selector of the nearest ancestor that groups sibling items; the next item is looked up inside it. */
  group: string;
}

/**
 * When the focused item leaves the DOM (approved, started, moved away) the browser drops focus on
 * the body. This hands it to the item that took its place, the last one when it was the tail, or
 * the group when nothing is left. Focus that moved on purpose is never touched.
 */
export function useFocusRescue(
  rootRef: RefObject<HTMLElement | null>,
  { item, group }: FocusRescueOptions,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let tracked: { element: HTMLElement; group: HTMLElement; index: number } | null = null;

    const itemsOf = (scope: HTMLElement) =>
      Array.from(scope.querySelectorAll<HTMLElement>(item)).filter(
        (candidate) => candidate.closest(group) === scope && isVisible(candidate),
      );

    const track = (element: HTMLElement | null) => {
      const found = element?.closest<HTMLElement>(item);
      const scope = found?.closest<HTMLElement>(group);
      if (!found || !scope) return;
      tracked = { element: found, group: scope, index: itemsOf(scope).indexOf(found) };
    };

    const onFocusIn = (event: FocusEvent) =>
      track(event.target instanceof HTMLElement ? event.target : null);

    const rescue = () => {
      if (!tracked) return;
      if (tracked.element.isConnected) {
        track(tracked.element);
        return;
      }
      const lost = tracked;
      if (!focusLosing()) {
        tracked = null;
        return;
      }
      tracked = null;
      const scope = lost.group.isConnected ? lost.group : null;
      if (!scope) return;
      const siblings = itemsOf(scope);
      const next = siblings[Math.min(Math.max(lost.index, 0), siblings.length - 1)];
      if (next) focusWithin(next);
      else focusWithin(scope);
    };

    root.addEventListener("focusin", onFocusIn);
    const observer = new MutationObserver(rescue);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener("focusin", onFocusIn);
      observer.disconnect();
    };
  }, [rootRef, item, group]);
}
