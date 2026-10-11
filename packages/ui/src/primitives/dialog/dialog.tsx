"use client";

import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { Slot } from "../../utils/slot.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { hideOthers } from "../hide-others.js";
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
 * In-house modal dialog primitive (WAI-ARIA dialog pattern). Same part names and
 * dismiss callbacks as the Radix dialog it replaced; `Dialog` and `Drawer` build on it.
 */

interface DialogContextValue {
  open: boolean;
  modal: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  overlayRef: RefObject<HTMLElement | null>;
  contentId: string;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(part: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error(`<${part}> must be rendered inside <Dialog>`);
  return context;
}

function isProduction(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

const stateOf = (open: boolean) => (open ? "open" : "closed");

export interface DialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Traps focus, hides the page and locks scroll while open. Defaults to true. */
  modal?: boolean;
  children?: ReactNode;
}

export function Root({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  children,
}: DialogRootProps) {
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const contentId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const value = useMemo<DialogContextValue>(
    () => ({
      open,
      modal,
      setOpen,
      triggerRef,
      overlayRef,
      contentId,
      titleId,
      descriptionId,
    }),
    [open, modal, setOpen, contentId, titleId, descriptionId],
  );
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

type ButtonProps = ComponentProps<"button"> & { asChild?: boolean };

export function Trigger({ asChild, onClick, ref, ...props }: ButtonProps) {
  const context = useDialogContext("DialogTrigger");
  const composedRef = useComposedRefs<HTMLButtonElement>(
    ref,
    context.triggerRef as RefObject<HTMLButtonElement | null>,
  );
  const Comp = asChild ? Slot : "button";
  return (
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
}

export function Close({ asChild, onClick, ...props }: ButtonProps) {
  const context = useDialogContext("DialogClose");
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : "button"}
      {...props}
      onClick={composeHandlers(onClick, () => context.setOpen(false))}
    />
  );
}

export function Title({ asChild, ...props }: ComponentProps<"h2"> & { asChild?: boolean }) {
  const { titleId } = useDialogContext("DialogTitle");
  const Comp = asChild ? Slot : "h2";
  return <Comp id={titleId} {...props} />;
}

export function Description({ asChild, ...props }: ComponentProps<"p"> & { asChild?: boolean }) {
  const { descriptionId } = useDialogContext("DialogDescription");
  const Comp = asChild ? Slot : "p";
  return <Comp id={descriptionId} {...props} />;
}

export { Portal };

export interface DialogOverlayProps extends ComponentProps<"div"> {
  forceMount?: boolean;
}

export function Overlay({ forceMount, ref, ...props }: DialogOverlayProps) {
  const { open, modal, overlayRef } = useDialogContext("DialogOverlay");
  const present = modal && (forceMount || open);
  const composedRef = useComposedRefs<HTMLDivElement>(
    ref,
    overlayRef as RefObject<HTMLDivElement | null>,
  );
  const mounted = usePresence(present, overlayRef);
  if (!mounted) return null;
  return <div data-state={stateOf(open)} aria-hidden="true" {...props} ref={composedRef} />;
}

export interface DialogContentProps extends Omit<ComponentProps<"div">, "onFocus"> {
  forceMount?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
  onFocusOutside?: (event: FocusOutsideEvent) => void;
  onInteractOutside?: (event: InteractOutsideEvent) => void;
}

export function Content({ forceMount, ref, ...props }: DialogContentProps) {
  const context = useDialogContext("DialogContent");
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

interface ContentImplProps extends Omit<DialogContentProps, "forceMount"> {
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
  ...props
}: ContentImplProps) {
  const context = useDialogContext("DialogContent");
  const { open, modal, setOpen, triggerRef, overlayRef } = context;
  const listening = open && engaged;
  const isTop = useLayer(listening);
  const interactedOutside = useRef(false);
  const focusInTree = useRef<() => boolean>(() => false);

  useEffect(() => {
    if (listening) interactedOutside.current = false;
  }, [listening]);

  useEffect(() => {
    if (!engaged || !modal) return;
    const unlock = lockBodyScroll();
    const show = hideOthers([nodeRef.current, overlayRef.current]);
    return () => {
      show();
      unlock();
    };
  }, [engaged, modal, nodeRef, overlayRef]);

  useFocusScope({
    ref: nodeRef,
    active: engaged,
    trapped: modal && open,
    isTop,
    // Portaled React children (menus, popovers) own focus while they are open.
    allowFocus: () => focusInTree.current(),
    onMountAutoFocus: onOpenAutoFocus,
    onUnmountAutoFocus: (event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      // A non-modal dialog closed by pressing elsewhere leaves focus where the user put it.
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
      // A modal traps focus, so a stray focus event must not close it.
      if (modal) event.preventDefault();
    },
    onInteractOutside: (event) => {
      onInteractOutside?.(event);
      const target = event.detail.originalEvent.target as Node | null;
      if (!modal && target && triggerRef.current?.contains(target)) event.preventDefault();
      if (!event.defaultPrevented) interactedOutside.current = true;
    },
    onDismiss: () => setOpen(false),
  });

  focusInTree.current = layerProps.isFocusInTree;

  const ariaLabel = props["aria-label"];
  const ariaLabelledBy = props["aria-labelledby"];
  // Like Radix, the ids are always rendered so the name and description exist from the
  // first focusin once Title/Description mount. A dangling reference is ignored by
  // assistive tech; pass `aria-describedby={undefined}` (or your own id) to opt out.
  useEffect(() => {
    if (isProduction() || !engaged) return;
    if (!ariaLabel && !ariaLabelledBy && !document.getElementById(context.titleId)) {
      console.error(
        "DialogContent requires a DialogTitle (or an aria-label) so screen readers can name the dialog.",
      );
    }
  }, [engaged, context.titleId, ariaLabel, ariaLabelledBy]);

  return (
    <div
      id={context.contentId}
      role="dialog"
      aria-modal={modal ? true : undefined}
      aria-labelledby={context.titleId}
      aria-describedby={context.descriptionId}
      data-state={stateOf(open)}
      tabIndex={-1}
      {...props}
      onPointerDownCapture={composeHandlers(onPointerDownCapture, layerProps.onPointerDownCapture)}
      onFocusCapture={composeHandlers(onFocusCapture, layerProps.onFocusCapture)}
      onBlurCapture={composeHandlers(onBlurCapture, layerProps.onBlurCapture)}
    />
  );
}
