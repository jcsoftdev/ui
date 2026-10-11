"use client";

import { type RefObject, useLayoutEffect } from "react";
import { globalSingleton } from "./global-singleton.js";

const state = globalSingleton("@jcsoftdev/ui/pointer-events-lock", () => ({
  count: 0,
  previous: "",
}));

/**
 * Makes everything outside layers that set `pointer-events: auto` inert to the
 * pointer. Ref-counted; returns the release function.
 */
export function blockOutsidePointerEvents(): () => void {
  if (state.count++ === 0) {
    state.previous = document.body.style.pointerEvents;
    document.body.style.pointerEvents = "none";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state.count === 0) document.body.style.pointerEvents = state.previous;
  };
}

/** Whether a modal layer currently makes everything outside it inert to the pointer. */
export function isPointerEventsBlocked(): boolean {
  return state.count > 0;
}

/**
 * Layers opened while the lock is held (a dialog or popover launched from a modal
 * menu, a nested menu) would inherit `pointer-events: none` from `<body>`. This
 * re-enables the pointer on the layer element itself, like Radix does for every
 * dismissable layer above the lock holder.
 */
export function useEnabledPointerEvents(ref: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!active || !node || !isPointerEventsBlocked() || node.style.pointerEvents !== "") return;
    node.style.pointerEvents = "auto";
    return () => {
      if (node.style.pointerEvents === "auto") node.style.pointerEvents = "";
    };
  }, [ref, active]);
}
