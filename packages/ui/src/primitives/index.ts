/**
 * Unstyled, headless behaviour primitives. No Tailwind classes or tokens live here:
 * parts forward props and refs, expose `data-state`, and take `asChild` where a
 * trigger makes sense. Styled components in `overlays/` are built on top of them.
 *
 * Not yet published as a subpath; the `exports` entry is added by a later task.
 */
export * as DialogPrimitive from "./dialog/dialog.js";
export { getTabbables, resolveTabWrap } from "./focusable.js";
export { hideOthers } from "./hide-others.js";
export { createLayerStack, type LayerStack, overlayLayers } from "./layer-stack.js";
export { Portal } from "./portal.js";
export { createRefCountedLock, lockBodyScroll } from "./scroll-lock.js";
export {
  type DismissableLayerOptions,
  type FocusOutsideEvent,
  type InteractOutsideEvent,
  type PointerDownOutsideEvent,
  useDismissableLayer,
} from "./use-dismissable-layer.js";
export { type FocusScopeOptions, useFocusScope } from "./use-focus-scope.js";
export { useLayer } from "./use-layer.js";
export { usePresence } from "./use-presence.js";
