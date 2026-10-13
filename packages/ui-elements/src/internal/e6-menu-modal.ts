import {
  blockOutsidePointerEvents,
  enablePointerEvents,
  hideOthers,
} from "@jcsoftdev/ui-core/hide-others";
import { lockScroll } from "@jcsoftdev/ui-core/scroll-lock";

/**
 * Makes `node` the only reachable layer: the rest of the page is `inert` and `aria-hidden`, the
 * pointer is blocked outside it and the body does not scroll. A lazy chunk: only modal menus load
 * it. Returns the release.
 */
export function lockModal(node: HTMLElement): () => void {
  const unlock = lockScroll();
  const show = hideOthers([node]);
  const unblock = blockOutsidePointerEvents();
  const enable = enablePointerEvents(node);
  return () => {
    enable();
    unblock();
    show();
    unlock();
  };
}
