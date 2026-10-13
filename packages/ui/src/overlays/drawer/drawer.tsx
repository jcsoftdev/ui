"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useGlassLens } from "../../glass/use-glass-lens.js";
import { useUiStrings } from "../../i18n/index.js";
import { X } from "../../icons/index.js";
import * as DialogPrimitive from "../../primitives/dialog/dialog.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material-class.js";
import { useMaterialStyle } from "../../utils/use-material-style.js";
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
export function Drawer({ open, children, ...props }: DialogPrimitive.DialogRootProps) {
  const focusRef = useCapturePreviousFocus(open);
  return (
    <DialogPrimitive.Root open={open} {...props}>
      <PreviousFocusProvider focusRef={focusRef}>{children}</PreviousFocusProvider>
    </DialogPrimitive.Root>
  );
}

export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export function DrawerTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("m-0", className)} {...props} />;
}
export function DrawerDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("m-0 text-ink-2", className)} {...props} />;
}

export type DrawerContentPart = "root" | "overlay" | "close";

export interface DrawerContentProps extends DialogPrimitive.DialogContentProps {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the content and is merged last. */
  classNames?: ClassNames<DrawerContentPart>;
  /**
   * Surface material. Omitted keeps the default for this layer; `"glass"` and `"glass-clear"`
   * opt into Liquid Glass (with its fallbacks), `"solid"` forces an opaque surface.
   */
  material?: Material;
  /** Same semantics as `DialogContentProps.blocking`. */
  blocking?: boolean;
  /** Accessible label of the close button. */
  closeLabel?: string;
}

/** Right-anchored side panel for secondary flows. */
export function DrawerContent({
  className,
  classNames,
  material,
  blocking = false,
  closeLabel,
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onCloseAutoFocus,
  ref,
  style,
  ...props
}: DrawerContentProps) {
  const materialProps = useMaterialStyle(material, style);
  const lens = useGlassLens(ref, { ownInteractive: true });
  const previousFocusRef = usePreviousFocus();
  const strings = useUiStrings();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn("fixed inset-0 z-70 bg-scrim", classNames?.overlay)} />
      <DialogPrimitive.Content
        ref={lens}
        className={cn(
          "@container/drawer fixed inset-y-0 right-0 z-70 flex h-full w-[min(430px,100%)] max-w-full flex-col overflow-y-auto outline-none surface-overlay shadow-overlay",
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
        {...materialProps}
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
