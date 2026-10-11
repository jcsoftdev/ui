"use client";

import { type RefObject, useEffect, useRef } from "react";
import { getTabbables, resolveTabFromInside, resolveTabWrap } from "./focusable.js";

export interface FocusScopeOptions {
  ref: RefObject<HTMLElement | null>;
  /** Scope lifetime: focus moves in when it starts and returns when it ends. */
  active: boolean;
  /** Keep Tab and Shift+Tab inside while true and this scope is on top. */
  trapped: boolean;
  isTop?: (() => boolean) | undefined;
  /**
   * While trapped, focus that lands outside the container is pulled back unless this
   * returns true for the new target. Live regions and `[data-ui-overlay-ignore]` are always allowed.
   */
  allowFocus?: ((target: Element) => boolean) | undefined;
  onMountAutoFocus?: ((event: Event) => void) | undefined;
  onUnmountAutoFocus?: ((event: Event) => void) | undefined;
}

const LIVE_OR_IGNORED = '[aria-live]:not([aria-live="off"]), [data-ui-overlay-ignore]';

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
    const isActiveScope = () => !latest.current.isTop || latest.current.isTop();
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
        focusWithoutScroll(target);
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      if (container.contains(target)) {
        lastFocused = target as HTMLElement;
        return;
      }
      if (!isActiveScope() || target.closest(LIVE_OR_IGNORED)) return;
      if (latest.current.allowFocus?.(target)) return;
      const fallback = getTabbables(container)[0] ?? container;
      focusWithoutScroll(lastFocused && container.contains(lastFocused) ? lastFocused : fallback);
    };

    // The focused node was removed (a menu closed without returning focus): bring focus back to the container.
    const observer = new MutationObserver((mutations) => {
      if (document.activeElement !== document.body || !isActiveScope()) return;
      if (mutations.some((mutation) => mutation.removedNodes.length > 0)) {
        focusWithoutScroll(container);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    container.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      observer.disconnect();
      container.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [active, trapped]);
}
