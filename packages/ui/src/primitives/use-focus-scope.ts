"use client";

import { type RefObject, useEffect, useRef } from "react";
import { getTabbables, resolveTabWrap } from "./focusable.js";

export interface FocusScopeOptions {
  ref: RefObject<HTMLElement | null>;
  /** Scope lifetime: focus moves in when it starts and returns when it ends. */
  active: boolean;
  /** Keep Tab and Shift+Tab inside while true and this scope is on top. */
  trapped: boolean;
  isTop?: (() => boolean) | undefined;
  onMountAutoFocus?: ((event: Event) => void) | undefined;
  onUnmountAutoFocus?: ((event: Event) => void) | undefined;
}

function focusWithoutScroll(element: HTMLElement | null | undefined) {
  element?.focus({ preventScroll: true });
}

/**
 * Moves focus into the container on activation (first tabbable that is not a
 * link, else the container), traps Tab inside, and returns focus when the scope
 * ends. Both auto-focus callbacks receive a cancelable event.
 */
export function useFocusScope(options: FocusScopeOptions) {
  const latest = useRef(options);
  latest.current = options;
  const returnTarget = useRef<HTMLElement | null>(null);
  const activation = useRef(0);
  const { active, trapped } = options;

  useEffect(() => {
    if (!active) return;
    const container = latest.current.ref.current;
    if (!container) return;
    const mine = ++activation.current;
    const previous = document.activeElement as HTMLElement | null;
    if (previous && !container.contains(previous)) returnTarget.current = previous;

    if (!container.contains(previous)) {
      const event = new Event("ui.focusScope.mount", { cancelable: true });
      latest.current.onMountAutoFocus?.(event);
      if (!event.defaultPrevented) {
        const candidates = getTabbables(container).filter((el) => el.tagName !== "A");
        focusWithoutScroll(candidates[0] ?? container);
      }
    }

    return () => {
      const target = returnTarget.current;
      setTimeout(() => {
        if (activation.current !== mine) return;
        const event = new Event("ui.focusScope.unmount", { cancelable: true });
        latest.current.onUnmountAutoFocus?.(event);
        if (!event.defaultPrevented) {
          focusWithoutScroll(target && document.contains(target) ? target : document.body);
        }
      }, 0);
    };
  }, [active]);

  useEffect(() => {
    const container = latest.current.ref.current;
    if (!active || !trapped || !container) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
      if (latest.current.isTop && !latest.current.isTop()) return;
      const items = getTabbables(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const target = resolveTabWrap(
        items,
        document.activeElement as HTMLElement | null,
        event.shiftKey,
      );
      if (target) {
        event.preventDefault();
        focusWithoutScroll(target);
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [active, trapped]);
}
