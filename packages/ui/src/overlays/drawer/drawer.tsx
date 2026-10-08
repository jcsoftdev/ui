"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";
import {
  PreviousFocusProvider,
  restoreFocusOnClose,
  useCapturePreviousFocus,
  usePreviousFocus,
} from "../focus-return/index.js";

/**
 * Wraps `DialogPrimitive.Root` so focus is restored on close even when the
 * drawer is opened in a controlled way, without its own `DrawerTrigger`.
 */
export function Drawer({
  open,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  const focusRef = useCapturePreviousFocus(open);
  return (
    <DialogPrimitive.Root open={open} {...props}>
      <PreviousFocusProvider focusRef={focusRef}>{children}</PreviousFocusProvider>
    </DialogPrimitive.Root>
  );
}

export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerTitle = DialogPrimitive.Title;

export interface DrawerContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Same semantics as `DialogContentProps.blocking`. */
  blocking?: boolean;
  /** Accessible label of the close button. */
  closeLabel?: string;
}

/** Right-anchored side panel for secondary flows. */
export function DrawerContent({
  className,
  blocking = false,
  closeLabel = "Close",
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onCloseAutoFocus,
  ...props
}: DrawerContentProps) {
  const previousFocusRef = usePreviousFocus();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-70 bg-scrim" />
      <DialogPrimitive.Content
        className={cn(
          "@container/drawer fixed inset-y-0 right-0 z-70 flex h-full w-[min(430px,100%)] max-w-full flex-col overflow-y-auto bg-float shadow-pop",
          className,
        )}
        onEscapeKeyDown={(event) => {
          if (blocking) event.preventDefault();
          onEscapeKeyDown?.(event);
        }}
        onPointerDownOutside={(event) => {
          if (blocking) event.preventDefault();
          onPointerDownOutside?.(event);
        }}
        onInteractOutside={(event) => {
          if (blocking) event.preventDefault();
          onInteractOutside?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          restoreFocusOnClose(event, previousFocusRef);
        }}
        {...props}
      >
        {children}
        {!blocking && (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="absolute top-3 right-3 rounded-event p-1 text-ink-3 hover:text-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
