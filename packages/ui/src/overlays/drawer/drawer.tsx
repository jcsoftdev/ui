"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { X } from "../../icons/index.js";
import * as DialogPrimitive from "../../primitives/dialog/dialog.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";
import { DRAWER_MOTION, OVERLAY_MOTION } from "../../utils/overlay-motion.js";
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
   * are frosted glass, `"liquid"` and `"liquid-clear"` Liquid Glass (with its fallbacks), `"solid"`
   * forces an opaque surface. Liquid options go in `style` (`liquidStyle()` from
   * `@jcsoftdev/ui/liquid`); the lens needs `<LiquidGlass />` mounted once.
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
  ...props
}: DrawerContentProps) {
  const previousFocusRef = usePreviousFocus();
  const strings = useUiStrings();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn("fixed inset-0 z-70 bg-scrim", OVERLAY_MOTION, classNames?.overlay)}
      />
      <DialogPrimitive.Content
        className={cn(
          "@container/drawer fixed inset-y-0 right-0 z-70 flex h-full w-[min(430px,100%)] max-w-full flex-col overflow-y-auto outline-none surface-overlay shadow-overlay",
          DRAWER_MOTION,
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
              "absolute top-2.25 right-2.25 flex size-control-sm items-center justify-center rounded-event text-ink-3 hover:text-ink in-data-[density=touch]:top-0.5 in-data-[density=touch]:right-0.5",
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
