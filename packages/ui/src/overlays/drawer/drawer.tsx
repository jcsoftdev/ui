"use client";

import { type ComponentPropsWithoutRef, type PointerEvent, useRef } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { X } from "../../icons/index.js";
import * as DialogPrimitive from "../../primitives/dialog/dialog.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";
import { DRAWER_MOTION, OVERLAY_MOTION, SHEET_MOTION } from "../../utils/overlay-motion.js";
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

export type DrawerContentPart = "root" | "overlay" | "close" | "handle";

export type DrawerSide = "right" | "bottom";

const SWIPE_CLOSE_PX = 60;

const sideClasses: Record<DrawerSide, string> = {
  right: "inset-y-0 right-0 h-full w-[min(430px,100%)] max-w-full",
  bottom:
    "inset-x-0 bottom-0 max-h-[min(85dvh,100%)] w-full rounded-t-card pb-[env(safe-area-inset-bottom)]",
};

/** Classes of the content box for a side; exported for tests and for wrappers that restyle it. */
export function drawerSideClass(side: DrawerSide): string {
  return sideClasses[side];
}

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
  /**
   * Edge the panel is anchored to. `"right"` (default) is a side panel up to 430 px wide;
   * `"bottom"` is a bottom sheet across the width, padded by the safe-area inset and capped at
   * 85dvh with its own scroll. Focus is trapped and Escape closes it on both.
   */
  side?: DrawerSide;
  /**
   * Shows a grab handle at the top of a `side="bottom"` sheet. It is decorative (hidden from
   * assistive tech); dragging it down closes the sheet unless `blocking`. Ignored on other sides.
   */
  handle?: boolean;
}

/** Side panel (right) or bottom sheet for secondary flows. */
export function DrawerContent({
  className,
  classNames,
  material,
  blocking = false,
  closeLabel,
  side = "right",
  handle = false,
  children,
  onEscapeKeyDown,
  onPointerDownOutside,
  onInteractOutside,
  onCloseAutoFocus,
  ...props
}: DrawerContentProps) {
  const previousFocusRef = usePreviousFocus();
  const strings = useUiStrings();
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<number | null>(null);
  const bottom = side === "bottom";
  const showHandle = bottom && handle;
  const swipeStart = (event: PointerEvent<HTMLDivElement>) => {
    swipe.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const swipeEnd = (event: PointerEvent<HTMLDivElement>) => {
    const from = swipe.current;
    swipe.current = null;
    if (from !== null && !blocking && event.clientY - from >= SWIPE_CLOSE_PX) {
      closeRef.current?.click();
    }
  };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn("fixed inset-0 z-70 bg-scrim", OVERLAY_MOTION, classNames?.overlay)}
      />
      <DialogPrimitive.Content
        className={cn(
          "@container/drawer fixed z-70 flex flex-col overflow-y-auto outline-none surface-overlay shadow-overlay",
          sideClasses[side],
          side === "bottom" ? SHEET_MOTION : DRAWER_MOTION,
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
        {showHandle ? (
          <div
            aria-hidden="true"
            onPointerDown={swipeStart}
            onPointerUp={swipeEnd}
            onPointerCancel={() => {
              swipe.current = null;
            }}
            className={cn("flex shrink-0 touch-none justify-center pt-2 pb-1", classNames?.handle)}
          >
            <span className="h-1 w-9 rounded-pill bg-line-strong" />
          </div>
        ) : null}
        {children}
        {!blocking && (
          <DialogPrimitive.Close
            ref={closeRef}
            aria-label={closeLabel ?? strings.close}
            className={cn(
              "absolute top-[calc(0.5625rem-0.4375rem*var(--touch))] right-[calc(0.5625rem-0.4375rem*var(--touch))] flex size-control-sm items-center justify-center rounded-event text-ink-3 hover:text-ink",
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
