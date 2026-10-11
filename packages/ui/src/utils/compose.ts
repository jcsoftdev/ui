import { type Ref, type RefCallback, useCallback } from "react";
import { composeRefs } from "./slot.js";

/** Runs the caller's handler first and skips ours once it called `preventDefault`. */
export function composeHandlers<E extends { defaultPrevented: boolean }>(
  user: ((event: E) => void) | undefined,
  ours: ((event: E) => void) | undefined,
): (event: E) => void {
  return (event) => {
    user?.(event);
    if (!event.defaultPrevented) ours?.(event);
  };
}

/** Stable composed ref: changes identity only when one of the refs does. */
export function useComposedRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are the dependencies
  return useCallback(composeRefs(...refs), refs);
}
