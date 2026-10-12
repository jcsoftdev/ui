"use client";

import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { X } from "../../icons/index.js";
import * as DialogPrimitive from "../../primitives/dialog/dialog.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";
import {
  PreviousFocusProvider,
  restoreFocusOnClose,
  useCapturePreviousFocus,
  usePreviousFocus,
} from "../focus-return/index.js";

/**
 * Wraps `DialogPrimitive.Root` so focus is restored on close even when the
 * dialog is opened in a controlled way, without its own `DialogTrigger`.
 */
export function Dialog({ open, children, ...props }: DialogPrimitive.DialogRootProps) {
  const focusRef = useCapturePreviousFocus(open);
  return (
    <DialogPrimitive.Root open={open} {...props}>
      <PreviousFocusProvider focusRef={focusRef}>{children}</PreviousFocusProvider>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogWidth = "md" | "lg";

const widthClasses: Record<DialogWidth, string> = {
  md: "w-[min(520px,100%)]",
  lg: "w-[min(780px,100%)]",
};

export type DialogContentPart = "root" | "overlay" | "close";

export interface DialogContentProps extends DialogPrimitive.DialogContentProps {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the content and is merged last. */
  classNames?: ClassNames<DialogContentPart>;
  width?: DialogWidth;
  /**
   * Surface material. Omitted keeps the default for this layer; `"glass"` and `"glass-clear"`
   * opt into Liquid Glass (with its fallbacks), `"solid"` forces an opaque surface.
   */
  material?: Material;
  /**
   * While a mutation is in flight: `Escape`, outside click and the close button
   * are disabled so half-saved state is not lost.
   */
  blocking?: boolean;
  /** Accessible label of the close button. */
  closeLabel?: string;
  /** Portal target. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
}

export function DialogContent({
  className,
  classNames,
  width = "md",
  material,
  blocking = false,
  closeLabel,
  container,
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const previousFocusRef = usePreviousFocus();
  const strings = useUiStrings();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay className={cn("fixed inset-0 z-70 bg-scrim", classNames?.overlay)} />
      <DialogPrimitive.Content
        className={cn(
          "@container/dialog fixed top-[9dvh] left-1/2 z-70 flex max-h-[84dvh] max-w-full -translate-x-1/2 flex-col overflow-auto rounded-dialog outline-none surface-overlay shadow-overlay",
          widthClasses[width],
          materialClass(material, "surface-solid"),
          classNames?.root,
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
            aria-label={closeLabel ?? strings.close}
            className={cn(
              "absolute top-3 right-3 rounded-event p-1 text-ink-3 hover:text-ink in-data-[density=touch]:top-0.5 in-data-[density=touch]:right-0.5 in-data-[density=touch]:p-3.5",
              classNames?.close,
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2.5 border-b-divider py-3.5 pr-10 pl-4.5", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("m-0 min-w-0 break-words text-dialog-title text-ink", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("m-0 text-ink-2", className)} {...props} />;
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4 p-4.5", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t-divider px-4.5 py-3",
        "@max-sm/dialog:flex-col-reverse @max-sm/dialog:items-stretch @max-sm/dialog:[&>*]:w-full",
        className,
      )}
      {...props}
    />
  );
}
