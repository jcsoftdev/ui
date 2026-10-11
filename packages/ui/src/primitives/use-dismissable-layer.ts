"use client";

import {
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useEnabledPointerEvents } from "./pointer-events-lock.js";

export type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;
export type FocusOutsideEvent = CustomEvent<{ originalEvent: FocusEvent }>;
export type InteractOutsideEvent = PointerDownOutsideEvent | FocusOutsideEvent;

export interface DismissableLayerOptions {
  ref: RefObject<HTMLElement | null>;
  /** Listen for Escape and outside interaction. */
  active: boolean;
  /** Only the topmost layer reacts; see `useLayer`. */
  isTop: () => boolean;
  onEscapeKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  onPointerDownOutside?: ((event: PointerDownOutsideEvent) => void) | undefined;
  onFocusOutside?: ((event: FocusOutsideEvent) => void) | undefined;
  onInteractOutside?: ((event: InteractOutsideEvent) => void) | undefined;
  onDismiss: () => void;
}

/** Layers from libraries outside this stack that can be open inside a dialog (the command palette listbox, until T12). */
const FOREIGN_LAYER = "[role=listbox][data-state=open], [role=combobox][aria-expanded=true]";

/**
 * Elements carrying this attribute are branches of every layer: pointer and focus
 * landing inside one never count as outside (the toaster region).
 */
export const LAYER_BRANCH_ATTRIBUTE = "data-ui-layer-branch";
const LAYER_BRANCH = `[${LAYER_BRANCH_ATTRIBUTE}]`;

/** Owned by something else that handles its own Escape (a toast). */
const NOT_OURS = '[aria-live]:not([aria-live="off"]), [data-ui-overlay-ignore]';

function outsideEvent<E extends Event>(name: string, originalEvent: E) {
  return new CustomEvent(name, { cancelable: true, detail: { originalEvent } });
}

/**
 * Escape and outside press/focus dismissal. Every callback may `preventDefault()`
 * to keep the layer open. Returns capture props to spread on the layer element so
 * events from React-tree children rendered in a portal count as inside.
 */
export function useDismissableLayer(options: DismissableLayerOptions) {
  const latest = useRef(options);
  latest.current = options;
  const insidePointer = useRef(false);
  const focusedNode = useRef<Element | null>(null);
  /** Focus is inside this layer's React subtree right now; derived from the live active element, never sticky. */
  const focusInTree = useCallback(() => {
    const node = focusedNode.current;
    return node?.isConnected === true && document.activeElement === node;
  }, []);
  const { active } = options;
  useEnabledPointerEvents(options.ref, active);

  useEffect(() => {
    if (!active) return;
    const isInside = (event: Event) => {
      const node = latest.current.ref.current;
      const target = event.target as Node | null;
      if (!node) return true;
      if (!target) return false;
      if (node.contains(target)) return true;
      return target instanceof Element && target.closest(LAYER_BRANCH) !== null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const o = latest.current;
      if (event.key !== "Escape" || event.isComposing || event.keyCode === 229) return;
      if (event.defaultPrevented || !o.isTop() || belongsToForeignLayer(event)) return;
      o.onEscapeKeyDown?.(event);
      if (!event.defaultPrevented) {
        event.preventDefault();
        o.onDismiss();
      }
    };

    // Escape pressed inside a React child rendered in a portal (a Radix menu or popover
    // not yet migrated to this layer stack) belongs to that child, which closes itself.
    const belongsToForeignLayer = (event: KeyboardEvent) => {
      const node = latest.current.ref.current;
      if (!node || node.contains(event.target as Node | null)) return false;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target === document.body ||
        target === document.documentElement
      ) {
        return false;
      }
      return (
        target === focusedNode.current || target.closest(`${FOREIGN_LAYER}, ${NOT_OURS}`) !== null
      );
    };

    const dispatchOutside = (
      name: string,
      original: PointerEvent | FocusEvent,
      specific: ((event: never) => void) | undefined,
    ) => {
      const o = latest.current;
      const event = outsideEvent(name, original);
      specific?.(event as never);
      o.onInteractOutside?.(event as InteractOutsideEvent);
      if (!event.defaultPrevented) o.onDismiss();
    };

    let removeTouchClick: (() => void) | undefined;
    const onPointerDown = (event: PointerEvent) => {
      removeTouchClick?.();
      const inside = insidePointer.current || isInside(event);
      insidePointer.current = false;
      if (inside || !latest.current.isTop()) return;
      const fire = () =>
        dispatchOutside("ui.pointerDownOutside", event, latest.current.onPointerDownOutside);
      if (event.pointerType === "touch") {
        document.addEventListener("click", fire, { once: true });
        removeTouchClick = () => document.removeEventListener("click", fire);
      } else {
        fire();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const inside = focusInTree() || isInside(event);
      if (inside || !latest.current.isTop()) return;
      dispatchOutside("ui.focusOutside", event, latest.current.onFocusOutside);
    };

    document.addEventListener("keydown", onKeyDown, true);
    // Registered after the opening gesture has finished bubbling.
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("focusin", onFocusIn);
    }, 0);
    return () => {
      clearTimeout(timer);
      removeTouchClick?.();
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [active, focusInTree]);

  return {
    /** Whether focus is inside this layer's React subtree right now, including portaled children. */
    isFocusInTree: focusInTree,
    onPointerDownCapture: (_event: ReactPointerEvent) => {
      insidePointer.current = true;
    },
    onFocusCapture: (event: ReactFocusEvent) => {
      focusedNode.current = event.target as Element;
    },
    onBlurCapture: (_event: ReactFocusEvent) => {
      focusedNode.current = null;
    },
  };
}
