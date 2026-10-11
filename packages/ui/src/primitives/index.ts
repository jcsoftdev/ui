/**
 * Unstyled, headless behaviour primitives. No Tailwind classes or tokens live here:
 * parts forward props and refs, expose `data-state`, and take `asChild` where a
 * trigger makes sense. Styled components in `overlays/` are built on top of them.
 *
 * Only the building blocks meant for consumers are exported. Internals (layer
 * stack singleton, scroll lock, `hideOthers`, tab helpers) are imported by file
 * from inside the package. The package `./*` wildcard export already resolves
 * `@jcsoftdev/ui/primitives` to this barrel (built as `dist/primitives/index.js`);
 * deep paths such as `primitives/hide-others` do not resolve. The documented,
 * explicit entry is defined in T14.
 */
export * as DialogPrimitive from "./dialog/dialog.js";
export { Portal } from "./portal.js";
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
