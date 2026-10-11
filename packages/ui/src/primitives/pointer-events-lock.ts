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
