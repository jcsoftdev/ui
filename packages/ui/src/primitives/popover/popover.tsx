"use client";

import {
  type ComponentProps,
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { Slot } from "../../utils/slot.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { getTabbables } from "../focusable.js";
import { hideOthers } from "../hide-others.js";
import * as PopperPrimitive from "../popper/popper.js";
import { Portal } from "../portal.js";
import { lockBodyScroll } from "../scroll-lock.js";
import {
  type FocusOutsideEvent,
  type InteractOutsideEvent,
  type PointerDownOutsideEvent,
  useDismissableLayer,
} from "../use-dismissable-layer.js";
import { useFocusScope } from "../use-focus-scope.js";
import { useLayer } from "../use-layer.js";
import { usePresence } from "../use-presence.js";

/**
 * In-house popover primitive. Same part names, callbacks and ARIA contract as the
 * Radix popover it replaced, positioned by the in-house popper. Unstyled.
 */

interface PopoverContextValue {
  open: boolean;
  modal: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  contentId: string;
  hasCustomAnchor: boolean;
  setHasCustomAnchor: (value: boolean) => void;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(part: string): PopoverContextValue {
  const context = useContext(PopoverContext);
  if (!context) throw new Error(`<${part}> must be rendered inside <Popover>`);
  return context;
}

const stateOf = (open: boolean) => (open ? "open" : "closed");

export interface PopoverRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Traps focus, hides the page and locks scroll while open. Defaults to false. */
  modal?: boolean;
  children?: ReactNode;
}

export function Root({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  modal = false,
  children,
}: PopoverRootProps) {
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentId = useId();
  const [hasCustomAnchor, setHasCustomAnchor] = useState(false);
  const value = useMemo<PopoverContextValue>(
    () => ({ open, modal, setOpen, triggerRef, contentId, hasCustomAnchor, setHasCustomAnchor }),
    [open, modal, setOpen, contentId, hasCustomAnchor],
  );
  return (
    <PopoverContext.Provider value={value}>
      <PopperPrimitive.Root>{children}</PopperPrimitive.Root>
    </PopoverContext.Provider>
  );
}

type ButtonProps = ComponentProps<"button"> & { asChild?: boolean };

/** Positions the content against this element instead of the trigger. */
export function Anchor(props: PopperPrimitive.PopperAnchorProps) {
  const { setHasCustomAnchor } = usePopoverContext("PopoverAnchor");
  useEffect(() => {
    setHasCustomAnchor(true);
    return () => setHasCustomAnchor(false);
  }, [setHasCustomAnchor]);
  return <PopperPrimitive.Anchor {...props} />;
}

export function Trigger({ asChild, onClick, ref, ...props }: ButtonProps) {
  const context = usePopoverContext("PopoverTrigger");
  const composedRef = useComposedRefs<HTMLButtonElement>(
    ref,
    context.triggerRef as RefObject<HTMLButtonElement | null>,
  );
  const Comp = asChild ? Slot : "button";
  const trigger = (
    <Comp
      type={asChild ? undefined : "button"}
      aria-haspopup="dialog"
      aria-expanded={context.open}
      aria-controls={context.open ? context.contentId : undefined}
      data-state={stateOf(context.open)}
      {...props}
      ref={composedRef as never}
      onClick={composeHandlers(onClick, () => context.setOpen(!context.open))}
    />
  );
  return context.hasCustomAnchor ? (
    trigger
  ) : (
    <PopperPrimitive.Anchor asChild>{trigger}</PopperPrimitive.Anchor>
  );
}

export function Close({ asChild, onClick, ...props }: ButtonProps) {
  const context = usePopoverContext("PopoverClose");
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      {...props}
      onClick={composeHandlers(onClick, () => context.setOpen(false))}
    />
  );
}

export { Portal };
export const Arrow = PopperPrimitive.Arrow;

export interface PopoverContentProps extends PopperPrimitive.PopperContentProps {
  /** Keep mounted while closed, for your own animation or measurement. */
  forceMount?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
  onFocusOutside?: (event: FocusOutsideEvent) => void;
  onInteractOutside?: (event: InteractOutsideEvent) => void;
}

export function Content({ forceMount, ref, ...props }: PopoverContentProps) {
  const context = usePopoverContext("PopoverContent");
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const composedRef = useComposedRefs<HTMLDivElement>(ref, nodeRef);
  const mounted = usePresence(forceMount || context.open, nodeRef);
  if (!mounted) return null;
  return (
    <ContentImpl
      {...props}
      ref={composedRef}
      nodeRef={nodeRef}
      engaged={context.open || !forceMount}
    />
  );
}

interface ContentImplProps extends Omit<PopoverContentProps, "forceMount"> {
  nodeRef: RefObject<HTMLDivElement | null>;
  /** False only for a force-mounted content that is currently closed. */
  engaged: boolean;
}

function ContentImpl({
  nodeRef,
  engaged,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  onPointerDownCapture,
  onFocusCapture,
  onBlurCapture,
  onKeyDown,
  ...props
}: ContentImplProps) {
  const context = usePopoverContext("PopoverContent");
  const { open, modal, setOpen, triggerRef } = context;
  const listening = open && engaged;
  const isTop = useLayer(listening);
  const interactedOutside = useRef(false);
  /** A press that landed on the trigger a moment ago: the focus it causes elsewhere is not a dismissal. */
  const pressedTrigger = useRef(false);
  const pressedTriggerTimer = useRef<number | undefined>(undefined);
  const focusInTree = useRef<() => boolean>(() => false);

  useEffect(() => {
    if (listening) interactedOutside.current = false;
  }, [listening]);

  useEffect(() => {
    if (!engaged || !modal) return;
    const unlock = lockBodyScroll();
    const show = hideOthers([nodeRef.current]);
    return () => {
      show();
      unlock();
    };
  }, [engaged, modal, nodeRef]);

  useFocusScope({
    ref: nodeRef,
    active: engaged,
    trapped: modal && open,
    isTop,
    allowFocus: () => focusInTree.current(),
    onMountAutoFocus: onOpenAutoFocus,
    onUnmountAutoFocus: (event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      // Closed by pressing elsewhere: leave focus where the user put it.
      if (!modal && interactedOutside.current) {
        event.preventDefault();
        return;
      }
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) {
        event.preventDefault();
        trigger.focus({ preventScroll: true });
      }
    },
  });

  const layerProps = useDismissableLayer({
    ref: nodeRef,
    active: listening,
    isTop,
    onEscapeKeyDown,
    onPointerDownOutside: (event) => {
      onPointerDownOutside?.(event);
      const original = event.detail.originalEvent;
      const contextClick = original.button === 2 || (original.button === 0 && original.ctrlKey);
      if (modal && contextClick) event.preventDefault();
    },
    onFocusOutside: (event) => {
      onFocusOutside?.(event);
      // A modal traps focus, so a stray focus event must not close it. Pressing the trigger
      // can focus a focusable ancestor (Safari buttons, a tabindex container): the trigger's
      // own click closes the popover, so closing here too would reopen it.
      if (modal || pressedTrigger.current) event.preventDefault();
    },
    onInteractOutside: (event) => {
      onInteractOutside?.(event);
      const target = event.detail.originalEvent.target as Node | null;
      // The trigger toggles on its own click; closing here too would reopen it.
      if (target && triggerRef.current?.contains(target)) {
        event.preventDefault();
        if (event.detail.originalEvent.type === "pointerdown") {
          pressedTrigger.current = true;
          window.clearTimeout(pressedTriggerTimer.current);
          pressedTriggerTimer.current = window.setTimeout(() => {
            pressedTrigger.current = false;
          }, 300);
        }
      }
      if (!event.defaultPrevented) interactedOutside.current = true;
    },
    onDismiss: () => setOpen(false),
  });

  focusInTree.current = layerProps.isFocusInTree;
  useEffect(() => () => window.clearTimeout(pressedTriggerTimer.current), []);

  // A non-modal popover is portaled to the end of <body>, so the browser would send Tab off
  // the page. Hand focus to the neighbours of the trigger and close instead.
  const leaveWithTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const node = nodeRef.current;
    const trigger = triggerRef.current;
    const active = document.activeElement;
    if (modal || event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!node || !trigger || !active || !node.contains(active) || !isTop()) return;
    const items = getTabbables(node);
    const first = items[0];
    const last = items[items.length - 1];
    const leavingForward = !event.shiftKey && (active === last || items.length === 0);
    const leavingBackward = event.shiftKey && (active === first || active === node);
    if (!leavingForward && !leavingBackward) return;
    event.preventDefault();
    // First tabbable after the trigger in document order; the trigger itself may not be tabbable.
    const next = leavingForward
      ? getTabbables(document.body).find(
          (element) =>
            !node.contains(element) &&
            !trigger.contains(element) &&
            Boolean(trigger.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
        )
      : undefined;
    interactedOutside.current = true;
    (next ?? trigger).focus({ preventScroll: true });
    setOpen(false);
  };

  return (
    <PopperPrimitive.Content
      id={context.contentId}
      role="dialog"
      data-state={stateOf(open)}
      tabIndex={-1}
      {...props}
      onPointerDownCapture={composeHandlers(onPointerDownCapture, layerProps.onPointerDownCapture)}
      onFocusCapture={composeHandlers(onFocusCapture, layerProps.onFocusCapture)}
      onBlurCapture={composeHandlers(onBlurCapture, layerProps.onBlurCapture)}
      onKeyDown={composeHandlers(onKeyDown, leaveWithTab)}
    />
  );
}
