"use client";

import {
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";

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
  const insideFocus = useRef(false);
  const { active } = options;

  useEffect(() => {
    if (!active) return;
    const isInside = (event: Event) => {
      const node = latest.current.ref.current;
      const target = event.target as Node | null;
      return !node || (target ? node.contains(target) : false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const o = latest.current;
      if (event.key !== "Escape" || !o.isTop()) return;
      o.onEscapeKeyDown?.(event);
      if (!event.defaultPrevented) {
        event.preventDefault();
        o.onDismiss();
      }
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
      const inside = insideFocus.current || isInside(event);
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
  }, [active]);

  return {
    onPointerDownCapture: (_event: ReactPointerEvent) => {
      insidePointer.current = true;
    },
    onFocusCapture: (_event: ReactFocusEvent) => {
      insideFocus.current = true;
    },
    onBlurCapture: (_event: ReactFocusEvent) => {
      insideFocus.current = false;
    },
  };
}
